package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/config"
	"eventticketing/internal/pricing"
	"eventticketing/internal/store"
)

var (
	ErrSuggestionNotFound   = errors.New("suggestion_not_found")
	ErrSuggestionNotPending = errors.New("suggestion_not_pending")
	// ErrSuggestionStale means the zone's price or bounds changed after the suggestion was made.
	ErrSuggestionStale = errors.New("suggestion_stale")
)

const (
	suggestionPending  = "PENDING"
	suggestionApproved = "APPROVED"
	suggestionRejected = "REJECTED"

	// historyPoints is how many recent price changes of a zone the console draws.
	historyPoints = 12
)

// PricingService runs the dynamic pricing engine (FR-22) and applies the
// organizer's decisions on its suggestions (W-01).
type PricingService struct {
	dbPool  *pgxpool.Pool
	queries *store.Queries
	cfg     config.PricingConfig
	lastRun atomic.Pointer[time.Time]
}

func NewPricingService(dbPool *pgxpool.Pool, queries *store.Queries, cfg config.PricingConfig) *PricingService {
	if cfg.WindowMinutes <= 0 {
		cfg.WindowMinutes = config.DefaultPricingWindowMinutes
	}
	if cfg.Interval <= 0 {
		cfg.Interval = config.DefaultPricingIntervalSeconds * time.Second
	}
	return &PricingService{dbPool: dbPool, queries: queries, cfg: cfg}
}

// Start analyzes every event on sale at once, then once per interval until ctx ends.
func (s *PricingService) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(s.cfg.Interval)
		defer ticker.Stop()
		for {
			if sum, err := s.RunAll(ctx); err != nil {
				log.Printf("[Pricing] analysis failed: %v", err)
			} else if sum.Created+sum.Updated+sum.Withdrawn > 0 {
				log.Printf("[Pricing] %d zones analyzed: %d new, %d refreshed, %d withdrawn suggestions",
					sum.Zones, sum.Created, sum.Updated, sum.Withdrawn)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

// ZoneInputs are the measurements one analysis is based on. They are stored
// with each suggestion, so the organizer sees what the suggestion was made from.
type ZoneInputs struct {
	VelocityActual float64 `json:"velocityActual"` // seats per minute over the window
	VelocityTarget float64 `json:"velocityTarget"` // seats per minute needed to sell out
	VelocityRatio  float64 `json:"velocityRatio"`
	DemandSeats    int     `json:"demandSeats"` // distinct seats held or sold in the window
	WindowMinutes  int     `json:"windowMinutes"`
	MinutesLeft    float64 `json:"minutesLeft"` // time left that the target assumes
	Remaining      int     `json:"remaining"`
	Held           int     `json:"held"`
	Sold           int     `json:"sold"`
	Total          int     `json:"total"`
	HeldRatio      float64 `json:"heldRatio"`
	FillRate       float64 `json:"fillRate"` // sold / total
	Queue          int     `json:"queue"`
	Alpha          float64 `json:"alpha"`
	Delta          float64 `json:"delta"`
}

type ZoneSuggestionDTO struct {
	ID             string          `json:"id"`
	CurrentPrice   int64           `json:"currentPrice"`
	SuggestedPrice int64           `json:"suggestedPrice"`
	ChangePercent  float64         `json:"changePercent"`
	Reason         string          `json:"reason"`
	Inputs         json.RawMessage `json:"inputs"`
	CreatedAt      string          `json:"createdAt"`
	UpdatedAt      string          `json:"updatedAt"`
}

// PricePreview is what the engine would suggest from the data right now.
type PricePreview struct {
	SuggestedPrice int64   `json:"suggestedPrice"`
	ChangePercent  float64 `json:"changePercent"`
	// Significant is true when the change reaches the threshold and would become a suggestion.
	Significant bool `json:"significant"`
}

type PricePoint struct {
	At       string `json:"at"`
	OldPrice int64  `json:"oldPrice"`
	NewPrice int64  `json:"newPrice"`
	Reason   string `json:"reason"`
}

type ZonePricingState struct {
	ZoneID                  string `json:"zoneId"`
	ZoneCode                string `json:"zoneCode"`
	ZoneName                string `json:"zoneName"`
	Floor                   string `json:"floor"`
	Capacity                int32  `json:"capacity"`
	BasePrice               int64  `json:"basePrice"`
	FloorPrice              int64  `json:"floorPrice"`
	CeilingPrice            int64  `json:"ceilingPrice"`
	IsDynamicPricingEnabled bool   `json:"isDynamicPricingEnabled"`
	// Analysis is "ok", "sold_out" or "sales_closed". Inputs and Preview exist only for "ok".
	Analysis string             `json:"analysis"`
	Inputs   *ZoneInputs        `json:"inputs"`
	Preview  *PricePreview      `json:"preview"`
	Pending  *ZoneSuggestionDTO `json:"pending"`
	History  []PricePoint       `json:"history"`
}

type PricingSettings struct {
	IntervalSeconds      int     `json:"intervalSeconds"`
	WindowMinutes        int     `json:"windowMinutes"`
	TargetHorizonMinutes int     `json:"targetHorizonMinutes"`
	MinChangePercent     float64 `json:"minChangePercent"`
	MaxStepPercent       float64 `json:"maxStepPercent"`
	RoundTo              int64   `json:"roundTo"`
}

type PricingOverview struct {
	EventID     string             `json:"eventId"`
	GeneratedAt string             `json:"generatedAt"`
	LastRunAt   *string            `json:"lastRunAt"`
	Settings    PricingSettings    `json:"settings"`
	Zones       []ZonePricingState `json:"zones"`
}

// RunSummary counts what one analysis pass did.
type RunSummary struct {
	Zones     int `json:"zones"`
	Created   int `json:"created"`
	Updated   int `json:"updated"`
	Withdrawn int `json:"withdrawn"`
}

func (s *RunSummary) add(o RunSummary) {
	s.Zones += o.Zones
	s.Created += o.Created
	s.Updated += o.Updated
	s.Withdrawn += o.Withdrawn
}

// zoneAnalysis is one evaluation of a zone.
type zoneAnalysis struct {
	state     string // "ok", "sold_out" or "sales_closed"
	inputs    ZoneInputs
	model     pricing.Inputs
	result    pricing.Result
	current   int64
	floor     int64
	ceiling   int64
	salesOpen bool
}

func (s *PricingService) analyze(ctx context.Context, q *store.Queries, eventID pgtype.UUID, zone store.EventZone, timing store.GetEventPricingTimingRow) (*zoneAnalysis, error) {
	a := &zoneAnalysis{
		current: fromNumeric(zone.BasePrice),
		floor:   fromNumeric(zone.FloorPrice),
		ceiling: fromNumeric(zone.CeilingPrice),
	}
	a.salesOpen = timing.Status == store.EventStatusONSALE && timing.SalesStarted.Bool && timing.MinutesLeft > 0
	if !a.salesOpen {
		a.state = "sales_closed"
		return a, nil
	}

	demand, err := q.GetZoneDemand(ctx, store.GetZoneDemandParams{
		EventID:       eventID,
		ZoneID:        zone.ZoneID,
		WindowMinutes: int32(s.cfg.WindowMinutes),
	})
	if err != nil {
		return nil, fmt.Errorf("zone demand: %w", err)
	}
	queue, err := q.CountWaitingQueue(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("waiting queue: %w", err)
	}

	remaining := int(demand.Available + demand.Held)
	if remaining == 0 {
		a.state = "sold_out"
		return a, nil
	}

	minutesLeft := timing.MinutesLeft
	if h := float64(s.cfg.TargetHorizonMinutes); h > 0 && minutesLeft > h {
		minutesLeft = h
	}
	// In the last minute the target would blow up; treat it as one minute left.
	minutesLeft = max(minutesLeft, 1)

	a.model = pricing.Inputs{
		Current:       a.current,
		Floor:         a.floor,
		Ceiling:       a.ceiling,
		Remaining:     remaining,
		Held:          int(demand.Held),
		DemandSeats:   int(demand.DemandSeats),
		WindowMinutes: float64(s.cfg.WindowMinutes),
		MinutesLeft:   minutesLeft,
		Queue:         int(queue),
	}
	a.result, err = pricing.Evaluate(a.model)
	if err != nil {
		return nil, fmt.Errorf("evaluate zone %s: %w", store.UUIDToString(zone.ZoneID), err)
	}

	fill := 0.0
	if demand.Total > 0 {
		fill = float64(demand.Sold) / float64(demand.Total)
	}
	a.state = "ok"
	a.inputs = ZoneInputs{
		VelocityActual: a.result.VelocityActual,
		VelocityTarget: a.result.VelocityTarget,
		VelocityRatio:  a.result.VelocityRatio,
		DemandSeats:    int(demand.DemandSeats),
		WindowMinutes:  s.cfg.WindowMinutes,
		MinutesLeft:    minutesLeft,
		Remaining:      remaining,
		Held:           int(demand.Held),
		Sold:           int(demand.Sold),
		Total:          int(demand.Total),
		HeldRatio:      a.result.HeldRatio,
		FillRate:       fill,
		Queue:          int(queue),
		Alpha:          a.result.Alpha,
		Delta:          a.result.Delta,
	}
	return a, nil
}

// RunAll analyzes every event that is on sale.
func (s *PricingService) RunAll(ctx context.Context) (RunSummary, error) {
	ids, err := s.queries.ListPricingEventIDs(ctx)
	if err != nil {
		return RunSummary{}, fmt.Errorf("list events on sale: %w", err)
	}
	var total RunSummary
	for _, id := range ids {
		sum, err := s.RunEvent(ctx, id)
		if err != nil {
			return total, err
		}
		total.add(sum)
	}
	return total, nil
}

// RunEvent analyzes the zones of one event and refreshes their suggestions.
func (s *PricingService) RunEvent(ctx context.Context, eventID pgtype.UUID) (RunSummary, error) {
	zones, err := s.queries.ListEventZonesWithPrices(ctx, eventID)
	if err != nil {
		return RunSummary{}, fmt.Errorf("list zones: %w", err)
	}
	var total RunSummary
	for _, z := range zones {
		sum, err := s.refreshZone(ctx, eventID, z.ZoneID)
		if err != nil {
			return total, err
		}
		total.add(sum)
	}
	now := time.Now()
	s.lastRun.Store(&now)
	return total, nil
}

// refreshZone makes the zone's open suggestion match the data of this moment:
// it creates, updates or withdraws it. The zone row stays locked meanwhile, so
// an approval or a manual price change cannot slip in between.
func (s *PricingService) refreshZone(ctx context.Context, eventID, zoneID pgtype.UUID) (RunSummary, error) {
	sum := RunSummary{Zones: 1}
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return sum, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	q := s.queries.WithTx(tx)

	zone, err := q.GetEventZoneForUpdate(ctx, store.GetEventZoneForUpdateParams{EventID: eventID, ZoneID: zoneID})
	if err != nil {
		return sum, fmt.Errorf("lock zone: %w", err)
	}
	timing, err := q.GetEventPricingTiming(ctx, eventID)
	if err != nil {
		return sum, fmt.Errorf("event timing: %w", err)
	}

	withdraw := func() error {
		n, err := q.ExpirePendingPriceSuggestion(ctx, store.ExpirePendingPriceSuggestionParams{EventID: eventID, ZoneID: zoneID})
		sum.Withdrawn += int(n)
		return err
	}

	var a *zoneAnalysis
	if zone.IsDynamicPricingEnabled {
		if a, err = s.analyze(ctx, q, eventID, zone, timing); err != nil {
			return sum, err
		}
	}
	if a == nil || a.state != "ok" || !a.result.Significant {
		if err := withdraw(); err != nil {
			return sum, fmt.Errorf("withdraw suggestion: %w", err)
		}
		return sum, tx.Commit(ctx)
	}

	rejected, err := q.HasRecentRejection(ctx, store.HasRecentRejectionParams{
		EventID:         eventID,
		ZoneID:          zoneID,
		CurrentPrice:    toNumeric(a.current),
		SuggestedPrice:  toNumeric(a.result.Suggested),
		CooldownMinutes: int32(s.cfg.RejectCooldownMinutes),
	})
	if err != nil {
		return sum, fmt.Errorf("check rejections: %w", err)
	}
	if rejected {
		if err := withdraw(); err != nil {
			return sum, fmt.Errorf("withdraw suggestion: %w", err)
		}
		return sum, tx.Commit(ctx)
	}

	metrics, err := json.Marshal(a.inputs)
	if err != nil {
		return sum, err
	}
	reason := pricing.Explain(a.model, a.result)
	pending, err := q.GetPendingPriceSuggestion(ctx, store.GetPendingPriceSuggestionParams{EventID: eventID, ZoneID: zoneID})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		_, err = q.InsertPriceSuggestion(ctx, store.InsertPriceSuggestionParams{
			EventID:        eventID,
			ZoneID:         zoneID,
			CurrentPrice:   toNumeric(a.current),
			SuggestedPrice: toNumeric(a.result.Suggested),
			Reason:         reason,
			Metrics:        metrics,
		})
		sum.Created++
	case err != nil:
		return sum, fmt.Errorf("load pending suggestion: %w", err)
	default:
		_, err = q.RefreshPriceSuggestion(ctx, store.RefreshPriceSuggestionParams{
			ID:             pending.ID,
			CurrentPrice:   toNumeric(a.current),
			SuggestedPrice: toNumeric(a.result.Suggested),
			Reason:         reason,
			Metrics:        metrics,
		})
		sum.Updated++
	}
	if err != nil {
		return sum, fmt.Errorf("store suggestion: %w", err)
	}
	return sum, tx.Commit(ctx)
}

// Overview reports the live inputs, the open suggestion and the recent price
// history of every zone of an event. It does not change anything.
func (s *PricingService) Overview(ctx context.Context, eventID pgtype.UUID) (*PricingOverview, error) {
	zones, err := s.queries.ListEventZonesWithPrices(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("list zones: %w", err)
	}
	timing, err := s.queries.GetEventPricingTiming(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("event timing: %w", err)
	}
	pendings, err := s.queries.ListPendingPriceSuggestions(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("list suggestions: %w", err)
	}
	pendingByZone := make(map[pgtype.UUID]store.PriceSuggestion, len(pendings))
	for _, p := range pendings {
		pendingByZone[p.ZoneID] = p
	}
	changes, err := s.queries.ListZonePriceHistory(ctx, store.ListZonePriceHistoryParams{EventID: eventID, MaxRows: historyPoints})
	if err != nil {
		return nil, fmt.Errorf("list price history: %w", err)
	}
	historyByZone := make(map[pgtype.UUID][]PricePoint)
	for _, c := range changes {
		historyByZone[c.ZoneID] = append(historyByZone[c.ZoneID], PricePoint{
			At:       c.CreatedAt.Time.Format(time.RFC3339),
			OldPrice: fromNumeric(c.OldPrice),
			NewPrice: fromNumeric(c.NewPrice),
			Reason:   c.Reason,
		})
	}

	out := &PricingOverview{
		EventID:     store.UUIDToString(eventID),
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Settings: PricingSettings{
			IntervalSeconds:      int(s.cfg.Interval / time.Second),
			WindowMinutes:        s.cfg.WindowMinutes,
			TargetHorizonMinutes: s.cfg.TargetHorizonMinutes,
			MinChangePercent:     pricing.MinChange * 100,
			MaxStepPercent:       pricing.MaxStep * 100,
			RoundTo:              pricing.RoundTo,
		},
		Zones: make([]ZonePricingState, 0, len(zones)),
	}
	if t := s.lastRun.Load(); t != nil {
		at := t.UTC().Format(time.RFC3339)
		out.LastRunAt = &at
	}

	for _, z := range zones {
		a, err := s.analyze(ctx, s.queries, eventID, store.EventZone{
			ZoneID:       z.ZoneID,
			BasePrice:    z.BasePrice,
			FloorPrice:   z.FloorPrice,
			CeilingPrice: z.CeilingPrice,
		}, timing)
		if err != nil {
			return nil, err
		}
		st := ZonePricingState{
			ZoneID:                  store.UUIDToString(z.ZoneID),
			ZoneCode:                z.Code,
			ZoneName:                z.ZoneName,
			Floor:                   z.Floor.String,
			Capacity:                z.Capacity,
			BasePrice:               a.current,
			FloorPrice:              a.floor,
			CeilingPrice:            a.ceiling,
			IsDynamicPricingEnabled: z.IsDynamicPricingEnabled,
			Analysis:                a.state,
			History:                 historyByZone[z.ZoneID],
		}
		if st.History == nil {
			st.History = []PricePoint{}
		}
		if a.state == "ok" {
			st.Inputs = &a.inputs
			st.Preview = &PricePreview{
				SuggestedPrice: a.result.Suggested,
				ChangePercent:  a.result.Change * 100,
				Significant:    a.result.Significant,
			}
		}
		if p, ok := pendingByZone[z.ZoneID]; ok {
			st.Pending = suggestionDTO(p)
		}
		out.Zones = append(out.Zones, st)
	}
	return out, nil
}

func suggestionDTO(p store.PriceSuggestion) *ZoneSuggestionDTO {
	current, suggested := fromNumeric(p.CurrentPrice), fromNumeric(p.SuggestedPrice)
	change := 0.0
	if current > 0 {
		change = float64(suggested-current) / float64(current) * 100
	}
	return &ZoneSuggestionDTO{
		ID:             store.UUIDToString(p.ID),
		CurrentPrice:   current,
		SuggestedPrice: suggested,
		ChangePercent:  change,
		Reason:         p.Reason,
		Inputs:         json.RawMessage(p.Metrics),
		CreatedAt:      p.CreatedAt.Time.Format(time.RFC3339),
		UpdatedAt:      p.UpdatedAt.Time.Format(time.RFC3339),
	}
}

// SuggestionEventID returns the event a suggestion belongs to, so callers can check who may decide on it.
func (s *PricingService) SuggestionEventID(ctx context.Context, id pgtype.UUID) (pgtype.UUID, error) {
	sg, err := s.queries.GetPriceSuggestion(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return pgtype.UUID{}, ErrSuggestionNotFound
	}
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("load suggestion: %w", err)
	}
	return sg.EventID, nil
}

type ApprovalResult struct {
	SuggestionID  string `json:"suggestionId"`
	ZoneID        string `json:"zoneId"`
	OldPrice      int64  `json:"oldPrice"`
	NewPrice      int64  `json:"newPrice"`
	RepricedSeats int64  `json:"repricedSeats"`
}

// Approve applies a pending suggestion: the zone's base price and its
// available seats take the suggested price, and the change is logged.
// Concurrent approvals of one suggestion apply it once; the others get ErrSuggestionNotPending.
func (s *PricingService) Approve(ctx context.Context, id, userID pgtype.UUID) (*ApprovalResult, error) {
	peek, err := s.queries.GetPriceSuggestion(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSuggestionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load suggestion: %w", err)
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	q := s.queries.WithTx(tx)

	// Lock the zone before the suggestion, as the engine does, so the two cannot deadlock.
	zone, err := q.GetEventZoneForUpdate(ctx, store.GetEventZoneForUpdateParams{EventID: peek.EventID, ZoneID: peek.ZoneID})
	if err != nil {
		return nil, fmt.Errorf("lock zone: %w", err)
	}
	sg, err := q.GetPriceSuggestionForUpdate(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("lock suggestion: %w", err)
	}
	if sg.Status != suggestionPending {
		return nil, ErrSuggestionNotPending
	}

	oldPrice, newPrice := fromNumeric(zone.BasePrice), fromNumeric(sg.SuggestedPrice)
	if oldPrice != fromNumeric(sg.CurrentPrice) || newPrice == oldPrice ||
		newPrice < fromNumeric(zone.FloorPrice) || newPrice > fromNumeric(zone.CeilingPrice) {
		if err := q.ExpirePriceSuggestion(ctx, id); err != nil {
			return nil, fmt.Errorf("expire suggestion: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit: %w", err)
		}
		return nil, ErrSuggestionStale
	}

	if _, err := q.UpdateEventZoneBasePrice(ctx, store.UpdateEventZoneBasePriceParams{
		EventID: sg.EventID, ZoneID: sg.ZoneID, BasePrice: sg.SuggestedPrice,
	}); err != nil {
		return nil, fmt.Errorf("update base price: %w", err)
	}
	repriced, err := applyBasePrice(ctx, q, sg.EventID, sg.ZoneID, userID, oldPrice, newPrice, ReasonDynamic)
	if err != nil {
		return nil, err
	}
	if _, err := q.MarkPriceSuggestionReviewed(ctx, store.MarkPriceSuggestionReviewedParams{
		ID: id, Status: suggestionApproved, ReviewedBy: userID,
	}); err != nil {
		return nil, fmt.Errorf("mark approved: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit approval: %w", err)
	}
	return &ApprovalResult{
		SuggestionID:  store.UUIDToString(id),
		ZoneID:        store.UUIDToString(sg.ZoneID),
		OldPrice:      oldPrice,
		NewPrice:      newPrice,
		RepricedSeats: repriced,
	}, nil
}

// Reject closes a pending suggestion and leaves every price as it is.
func (s *PricingService) Reject(ctx context.Context, id, userID pgtype.UUID) error {
	_, err := s.queries.MarkPriceSuggestionReviewed(ctx, store.MarkPriceSuggestionReviewedParams{
		ID: id, Status: suggestionRejected, ReviewedBy: userID,
	})
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("mark rejected: %w", err)
	}
	if _, err := s.queries.GetPriceSuggestion(ctx, id); errors.Is(err, pgx.ErrNoRows) {
		return ErrSuggestionNotFound
	} else if err != nil {
		return fmt.Errorf("load suggestion: %w", err)
	}
	return ErrSuggestionNotPending
}

// SetZoneEnabled turns dynamic pricing on or off for one zone. Turning it off withdraws the open suggestion.
func (s *PricingService) SetZoneEnabled(ctx context.Context, eventID, zoneID pgtype.UUID, enabled bool) error {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	q := s.queries.WithTx(tx)

	if _, err := q.GetEventZoneForUpdate(ctx, store.GetEventZoneForUpdateParams{EventID: eventID, ZoneID: zoneID}); errors.Is(err, pgx.ErrNoRows) {
		return ErrZoneNotFound
	} else if err != nil {
		return fmt.Errorf("lock zone: %w", err)
	}
	if _, err := q.SetZoneDynamicPricing(ctx, store.SetZoneDynamicPricingParams{
		EventID: eventID, ZoneID: zoneID, IsDynamicPricingEnabled: enabled,
	}); err != nil {
		return fmt.Errorf("set zone flag: %w", err)
	}
	if !enabled {
		if _, err := q.ExpirePendingPriceSuggestion(ctx, store.ExpirePendingPriceSuggestionParams{EventID: eventID, ZoneID: zoneID}); err != nil {
			return fmt.Errorf("withdraw suggestion: %w", err)
		}
	}
	return tx.Commit(ctx)
}
