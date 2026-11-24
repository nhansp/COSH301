package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/pricing"
	"eventticketing/internal/store"
)

const PricingInterval = 5 * time.Minute

const (
	SuggestionPending  = "PENDING"
	SuggestionApproved = "APPROVED"
	SuggestionRejected = "REJECTED"
)

// Pricing modes shown to the organizer.
const (
	PricingModeOff    = "OFF"
	PricingModeManual = "MANUAL"
	PricingModeAuto   = "AUTO"
)

// Kinds of pricing alerts.
const (
	AlertSellingFast       = "SELLING_FAST"
	AlertSellingSlow       = "SELLING_SLOW"
	AlertRecommendation    = "RECOMMENDATION"
	AlertAutoAdjusted      = "AUTO_ADJUSTED"
	AlertAtCeiling         = "AT_CEILING"
	AlertAtFloor           = "AT_FLOOR"
	AlertInsufficientData  = "INSUFFICIENT_DATA"
	AlertBoundsNotApproved = "BOUNDS_NOT_APPROVED"
)

var (
	ErrSuggestionNotFound   = errors.New("suggestion_not_found")
	ErrSuggestionNotPending = errors.New("suggestion_not_pending")
	// ErrSuggestionStale means the zone's prices changed after the suggestion was made.
	ErrSuggestionStale = errors.New("suggestion_stale")
	// ErrBoundsNotApproved means automatic pricing needs the organizer to save a zone's floor and ceiling first.
	ErrBoundsNotApproved      = errors.New("bounds_not_approved")
	ErrInvalidPricingSettings = errors.New("invalid_pricing_settings")
	ErrAlertNotFound          = errors.New("alert_not_found")
)

// InterestSource supplies the demand insight the recommendation data holds.
type InterestSource interface {
	EventInterest(ctx context.Context, eventID pgtype.UUID) (pricing.Interest, error)
}

// DynamicPricingEngine analyzes zone demand (FR-22). In manual mode it only
// suggests and alerts; in automatic mode it changes prices itself, inside the
// organizer-approved floor and ceiling, a step limit and a cooldown.
type DynamicPricingEngine struct {
	dbPool       *pgxpool.Pool
	queries      *store.Queries
	strategy     pricing.Strategy
	interest     InterestSource
	paymentsLive bool
	interval     time.Duration
}

func NewDynamicPricingEngine(dbPool *pgxpool.Pool, queries *store.Queries, strategy pricing.Strategy, interest InterestSource, paymentsLive bool, interval time.Duration) *DynamicPricingEngine {
	if interval <= 0 {
		interval = PricingInterval
	}
	return &DynamicPricingEngine{
		dbPool: dbPool, queries: queries, strategy: strategy, interest: interest,
		paymentsLive: paymentsLive, interval: interval,
	}
}

// Start runs the pricing job until ctx ends.
func (e *DynamicPricingEngine) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(e.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := e.RunOnce(ctx); err != nil {
					log.Printf("[DynamicPricing] run failed: %v", err)
				}
			}
		}
	}()
}

// RunOnce analyzes every event with dynamic pricing on. One event failing does not stop the others.
func (e *DynamicPricingEngine) RunOnce(ctx context.Context) error {
	ids, err := e.queries.ListDynamicPricingEvents(ctx)
	if err != nil {
		return fmt.Errorf("list events: %w", err)
	}
	var errs []error
	for _, id := range ids {
		if err := e.RunEvent(ctx, id); err != nil {
			errs = append(errs, fmt.Errorf("event %s: %w", store.UUIDToString(id), err))
		}
	}
	return errors.Join(errs...)
}

type zoneAnalysis struct {
	row   store.ListZoneDemandRow
	input pricing.ZoneInput
	rec   pricing.Recommendation
}

type eventAnalysis struct {
	ctx    store.GetEventPricingContextRow
	limits pricing.Limits
	zones  []zoneAnalysis
	at     time.Time
}

func (e *DynamicPricingEngine) analyze(ctx context.Context, eventID pgtype.UUID) (*eventAnalysis, error) {
	c, err := e.queries.GetEventPricingContext(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEventNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load pricing context: %w", err)
	}
	rows, err := e.queries.ListZoneDemand(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load zone demand: %w", err)
	}
	interest, err := e.interest.EventInterest(ctx, eventID)
	if err != nil {
		return nil, err
	}

	a := &eventAnalysis{
		ctx:    c,
		limits: pricing.Limits{MaxStepPct: int(c.MaxStepPct), Cooldown: pricing.Cooldown(c.CooldownMinutes)},
		at:     time.Now(),
	}
	for _, r := range rows {
		in := pricing.ZoneInput{
			Now: a.at, SalesOpen: c.SalesOpenAt.Time, SalesClose: c.SalesCloseAt.Time,
			ListPrice: r.ListPrice,
			Capacity:  r.Capacity, Available: r.Available, Held: r.Held, Sold: r.Sold,
			Holds1h: r.Holds1h, Holds24h: r.Holds24h, HoldsTotal: r.HoldsTotal,
			Sales1h: r.Sales1h, Sales24h: r.Sales24h, SalesTotal: r.SalesTotal,
			PaymentsLive:  e.paymentsLive,
			QueueWaiting:  c.QueueWaiting,
			QueueCapacity: int64(c.WaitingRoomCapacity),
			Interest:      interest,
			// The smoothed index only carries between runs of the job itself.
			PreviousDemand:      r.PreviousDemand,
			LastChangeAt:        r.LastChangeAt.Time,
			LastChangeDirection: int(r.LastChangeDirection),
		}
		if in.CurrentPrice, err = int64Of(r.BasePrice); err != nil {
			return nil, err
		}
		if in.FloorPrice, err = int64Of(r.FloorPrice); err != nil {
			return nil, err
		}
		if in.CeilingPrice, err = int64Of(r.CeilingPrice); err != nil {
			return nil, err
		}
		a.zones = append(a.zones, zoneAnalysis{row: r, input: in, rec: e.strategy.Recommend(in, a.limits)})
	}
	return a, nil
}

// RunEvent analyzes one event and acts on it according to its mode.
func (e *DynamicPricingEngine) RunEvent(ctx context.Context, eventID pgtype.UUID) error {
	a, err := e.analyze(ctx, eventID)
	if err != nil {
		return err
	}
	if !a.ctx.Enabled {
		return nil
	}
	for _, z := range a.zones {
		if !z.row.IsDynamicPricingEnabled || z.rec.SalesClosed || z.rec.SoldOut {
			continue
		}
		if err := e.queries.UpsertZoneDemandState(ctx, store.UpsertZoneDemandStateParams{
			EventID: eventID, ZoneID: z.row.ZoneID, DemandIndex: z.rec.DemandIndex,
		}); err != nil {
			return fmt.Errorf("store demand state: %w", err)
		}
		if err := e.raiseConditionAlerts(ctx, eventID, z); err != nil {
			return err
		}
		if a.ctx.AutoAdjust {
			err = e.actAutomatically(ctx, eventID, a, z)
		} else {
			err = e.suggest(ctx, eventID, z)
		}
		if err != nil {
			return err
		}
	}
	e.notifyOrganizer(ctx, eventID, "pricing_update", pgtype.UUID{})
	return nil
}

func (e *DynamicPricingEngine) raiseConditionAlerts(ctx context.Context, eventID pgtype.UUID, z zoneAnalysis) error {
	r, name := z.rec, z.row.ZoneName
	switch {
	case r.InsufficientData:
		return e.alert(ctx, eventID, z, AlertInsufficientData, 360,
			fmt.Sprintf("Khu %s: chưa đủ dữ liệu để đề xuất giá đáng tin cậy.", name))
	case e.strategy.SellingFast(r):
		if err := e.alert(ctx, eventID, z, AlertSellingFast, 180,
			fmt.Sprintf("Khu %s bán nhanh hơn kế hoạch: %.1f vé/giờ so với %.1f vé/giờ cần thiết, đã bán %.0f%% sức chứa (kế hoạch %.0f%%).",
				name, r.Velocity, r.RequiredVelocity, r.ActualShare*100, r.ExpectedShare*100)); err != nil {
			return err
		}
	case e.strategy.SellingSlow(r):
		if err := e.alert(ctx, eventID, z, AlertSellingSlow, 180,
			fmt.Sprintf("Khu %s bán chậm hơn kế hoạch: %.1f vé/giờ so với %.1f vé/giờ cần thiết, đã bán %.0f%% sức chứa (kế hoạch %.0f%%).",
				name, r.Velocity, r.RequiredVelocity, r.ActualShare*100, r.ExpectedShare*100)); err != nil {
			return err
		}
	}
	switch {
	case r.AtCeiling:
		return e.alert(ctx, eventID, z, AlertAtCeiling, 360,
			fmt.Sprintf("Khu %s có nhu cầu cao nhưng giá đã chạm giá trần %s. Cân nhắc nâng giá trần.", name, pricing.FormatVND(z.input.CeilingPrice)))
	case r.AtFloor:
		return e.alert(ctx, eventID, z, AlertAtFloor, 360,
			fmt.Sprintf("Khu %s bán chậm nhưng giá đã ở giá sàn %s. Cân nhắc hạ giá sàn hoặc khuyến mãi.", name, pricing.FormatVND(z.input.FloorPrice)))
	}
	return nil
}

// suggest keeps one pending suggestion per zone in step with the latest
// recommendation, and never changes a price (Mode B).
func (e *DynamicPricingEngine) suggest(ctx context.Context, eventID pgtype.UUID, z zoneAnalysis) error {
	key := store.ExpirePendingSuggestionParams{EventID: eventID, ZoneID: z.row.ZoneID}
	if z.rec.InsufficientData || z.rec.Action == pricing.Maintain {
		return e.queries.ExpirePendingSuggestion(ctx, key)
	}

	previous, err := e.queries.GetPendingSuggestion(ctx, store.GetPendingSuggestionParams(key))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("load pending suggestion: %w", err)
	}
	previousPrice, _ := previous.SuggestedPrice.Int64Value()

	metrics, err := json.Marshal(z.rec)
	if err != nil {
		return fmt.Errorf("encode recommendation: %w", err)
	}
	if _, err := e.queries.UpsertPendingPriceSuggestion(ctx, store.UpsertPendingPriceSuggestionParams{
		EventID: eventID, ZoneID: z.row.ZoneID,
		CurrentPrice: z.row.BasePrice, SuggestedPrice: numeric(z.rec.Price),
		Reason: z.rec.Explanation, Metrics: metrics,
	}); err != nil {
		return fmt.Errorf("store suggestion: %w", err)
	}
	if previousPrice.Valid && previousPrice.Int64 == z.rec.Price {
		return nil
	}
	verb := "tăng"
	if z.rec.Action == pricing.Decrease {
		verb = "giảm"
	}
	return e.alert(ctx, eventID, z, AlertRecommendation, 0,
		fmt.Sprintf("Đề xuất %s giá khu %s từ %s thành %s.", verb, z.row.ZoneName, pricing.FormatVND(z.input.CurrentPrice), pricing.FormatVND(z.rec.Price)))
}

// actAutomatically applies a recommendation when the guards allow it (Mode A).
func (e *DynamicPricingEngine) actAutomatically(ctx context.Context, eventID pgtype.UUID, a *eventAnalysis, z zoneAnalysis) error {
	if !z.row.BoundsApprovedAt.Valid {
		return e.alert(ctx, eventID, z, AlertBoundsNotApproved, 360,
			fmt.Sprintf("Khu %s chưa được duyệt giá sàn, giá trần nên không tự động đổi giá.", z.row.ZoneName))
	}
	if ok, _ := pricing.AutoDecision(z.rec, z.input, a.limits); !ok {
		return nil
	}
	applied, err := e.applyAutomatic(ctx, eventID, z)
	if err != nil || !applied {
		return err
	}
	verb := "tăng"
	if z.rec.Action == pricing.Decrease {
		verb = "giảm"
	}
	return e.alert(ctx, eventID, z, AlertAutoAdjusted, 0,
		fmt.Sprintf("Đã tự động %s giá khu %s từ %s thành %s.", verb, z.row.ZoneName, pricing.FormatVND(z.input.CurrentPrice), pricing.FormatVND(z.rec.Price)))
}

// applyAutomatic changes the price only if nobody changed the zone since it
// was analyzed and the price is still inside the current floor and ceiling.
func (e *DynamicPricingEngine) applyAutomatic(ctx context.Context, eventID pgtype.UUID, z zoneAnalysis) (bool, error) {
	tx, err := e.dbPool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := e.queries.WithTx(tx)

	zone, err := qtx.GetEventZoneForUpdate(ctx, store.GetEventZoneForUpdateParams{EventID: eventID, ZoneID: z.row.ZoneID})
	if err != nil {
		return false, fmt.Errorf("lock zone: %w", err)
	}
	p, err := zonePricingOf(zone)
	if err != nil {
		return false, err
	}
	if p.BasePrice != z.input.CurrentPrice || z.rec.Price < p.FloorPrice || z.rec.Price > p.CeilingPrice {
		return false, nil
	}
	if err := qtx.SetEventZoneBasePrice(ctx, store.SetEventZoneBasePriceParams{
		EventID: eventID, ZoneID: z.row.ZoneID, BasePrice: numeric(z.rec.Price),
	}); err != nil {
		return false, fmt.Errorf("set base price: %w", err)
	}
	if err := recordBaseChange(ctx, qtx, zone, z.rec.Price, pgtype.UUID{}, PriceChangeAuto, z.rec.Explanation); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit automatic price: %w", err)
	}
	return true, nil
}

type PricingAlertDTO struct {
	ID        string          `json:"id"`
	EventID   string          `json:"eventId"`
	ZoneID    string          `json:"zoneId,omitempty"`
	ZoneCode  string          `json:"zoneCode,omitempty"`
	ZoneName  string          `json:"zoneName,omitempty"`
	Kind      string          `json:"kind"`
	Message   string          `json:"message"`
	Data      json.RawMessage `json:"data"`
	Read      bool            `json:"read"`
	CreatedAt string          `json:"createdAt"`
}

// alert stores an alert unless the same kind was raised for the zone within
// dedupeMinutes, and pushes it to the organizer's open dashboard.
func (e *DynamicPricingEngine) alert(ctx context.Context, eventID pgtype.UUID, z zoneAnalysis, kind string, dedupeMinutes int32, message string) error {
	data, err := json.Marshal(map[string]any{
		"zoneName": z.row.ZoneName, "currentPrice": z.input.CurrentPrice,
		"action": z.rec.Action, "price": z.rec.Price, "explanation": z.rec.Explanation,
	})
	if err != nil {
		return fmt.Errorf("encode alert: %w", err)
	}
	_, err = e.queries.InsertPricingAlert(ctx, store.InsertPricingAlertParams{
		EventID: eventID, ZoneID: z.row.ZoneID, Kind: kind, Message: message, Data: data, DedupeMinutes: dedupeMinutes,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("store alert: %w", err)
	}
	e.notifyOrganizer(ctx, eventID, "pricing_alert", z.row.ZoneID)
	return nil
}

// notifyOrganizer tells open pricing dashboards to refresh. Customers' seat
// streams never receive it (see RealtimeHub).
func (e *DynamicPricingEngine) notifyOrganizer(ctx context.Context, eventID pgtype.UUID, kind string, zoneID pgtype.UUID) {
	msg := SeatUpdateMessage{Type: kind, EventID: store.UUIDToString(eventID), Timestamp: time.Now()}
	if zoneID.Valid {
		msg.ZoneID = store.UUIDToString(zoneID)
	}
	if err := notify(ctx, e.queries, msg); err != nil {
		log.Printf("[DynamicPricing] notify organizer: %v", err)
	}
}

// --- Organizer settings ---

type PricingSettingsInput struct {
	Enabled         bool  `json:"enabled"`
	AutoAdjust      bool  `json:"autoAdjust"`
	MaxStepPct      int32 `json:"maxStepPct"`
	CooldownMinutes int32 `json:"cooldownMinutes"`
}

// UpdateSettings switches an event between off, manual and automatic pricing.
// Turning pricing on for an event with no zone included includes them all.
// Automatic pricing needs every included zone's bounds approved.
func (e *DynamicPricingEngine) UpdateSettings(ctx context.Context, eventID, userID pgtype.UUID, in PricingSettingsInput) error {
	if in.MaxStepPct < 1 || in.MaxStepPct > 20 || in.CooldownMinutes < 5 || in.CooldownMinutes > 1440 || (in.AutoAdjust && !in.Enabled) {
		return ErrInvalidPricingSettings
	}
	tx, err := e.dbPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := e.queries.WithTx(tx)

	zones, err := qtx.LockEventZones(ctx, eventID)
	if err != nil {
		return fmt.Errorf("lock zones: %w", err)
	}
	if len(zones) == 0 {
		return ErrZoneNotFound
	}
	anyIncluded := false
	for _, z := range zones {
		anyIncluded = anyIncluded || z.IsDynamicPricingEnabled
	}
	if in.Enabled && !anyIncluded {
		if err := qtx.IncludeAllZones(ctx, eventID); err != nil {
			return fmt.Errorf("include zones: %w", err)
		}
	}
	if in.AutoAdjust {
		for _, z := range zones {
			if (z.IsDynamicPricingEnabled || !anyIncluded) && !z.BoundsApprovedAt.Valid {
				return ErrBoundsNotApproved
			}
		}
	}
	if _, err := qtx.UpsertPricingSettings(ctx, store.UpsertPricingSettingsParams{
		EventID: eventID, Enabled: in.Enabled, AutoAdjust: in.AutoAdjust,
		MaxStepPct: in.MaxStepPct, CooldownMinutes: in.CooldownMinutes, UpdatedBy: userID,
	}); err != nil {
		return fmt.Errorf("save settings: %w", err)
	}
	// Suggestions only belong to manual mode.
	if !in.Enabled || in.AutoAdjust {
		if err := qtx.ExpireEventPendingSuggestions(ctx, eventID); err != nil {
			return fmt.Errorf("close suggestions: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit settings: %w", err)
	}
	e.notifyOrganizer(ctx, eventID, "pricing_update", pgtype.UUID{})
	return nil
}

// SetZoneIncluded adds a zone to dynamic pricing or takes it out.
func (e *DynamicPricingEngine) SetZoneIncluded(ctx context.Context, eventID, zoneID pgtype.UUID, included bool) error {
	tx, err := e.dbPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := e.queries.WithTx(tx)

	zones, err := qtx.LockEventZones(ctx, eventID)
	if err != nil {
		return fmt.Errorf("lock zones: %w", err)
	}
	var zone *store.LockEventZonesRow
	for i := range zones {
		if zones[i].ZoneID == zoneID {
			zone = &zones[i]
		}
	}
	if zone == nil {
		return ErrZoneNotFound
	}
	c, err := qtx.GetEventPricingContext(ctx, eventID)
	if err != nil {
		return fmt.Errorf("load settings: %w", err)
	}
	if included && c.AutoAdjust && !zone.BoundsApprovedAt.Valid {
		return ErrBoundsNotApproved
	}
	if err := qtx.SetZoneIncluded(ctx, store.SetZoneIncludedParams{EventID: eventID, ZoneID: zoneID, IsDynamicPricingEnabled: included}); err != nil {
		return fmt.Errorf("update zone: %w", err)
	}
	if !included {
		if err := qtx.ExpirePendingSuggestion(ctx, store.ExpirePendingSuggestionParams{EventID: eventID, ZoneID: zoneID}); err != nil {
			return fmt.Errorf("close suggestion: %w", err)
		}
	}
	return tx.Commit(ctx)
}

// --- Dashboard ---

type DemandPointDTO struct {
	At    string `json:"at"`
	Holds int64  `json:"holds"`
	Sales int64  `json:"sales"`
	Views int64  `json:"views"`
}

type ZonePricingDTO struct {
	ZoneID           string `json:"zoneId"`
	ZoneCode         string `json:"zoneCode"`
	ZoneName         string `json:"zoneName"`
	Included         bool   `json:"included"`
	BasePrice        int64  `json:"basePrice"`
	FloorPrice       int64  `json:"floorPrice"`
	CeilingPrice     int64  `json:"ceilingPrice"`
	ListPrice        int64  `json:"listPrice"`
	BoundsApprovedAt string `json:"boundsApprovedAt,omitempty"`
	Capacity         int64  `json:"capacity"`
	Available        int64  `json:"available"`
	Held             int64  `json:"held"`
	Sold             int64  `json:"sold"`
	Holds1h          int64  `json:"holds1h"`
	Holds24h         int64  `json:"holds24h"`
	Sales24h         int64  `json:"sales24h"`
	LastChangeAt     string `json:"lastChangeAt,omitempty"`
	// AutoBlockedBy says why automatic mode is not applying the recommendation right now.
	AutoBlockedBy  string                 `json:"autoBlockedBy,omitempty"`
	Recommendation pricing.Recommendation `json:"recommendation"`
	Pending        *PriceSuggestionDTO    `json:"pending,omitempty"`
}

type PricingOverviewDTO struct {
	EventID         string           `json:"eventId"`
	EventName       string           `json:"eventName"`
	Mode            string           `json:"mode"`
	Enabled         bool             `json:"enabled"`
	AutoAdjust      bool             `json:"autoAdjust"`
	MaxStepPct      int32            `json:"maxStepPct"`
	CooldownMinutes int32            `json:"cooldownMinutes"`
	SalesOpenAt     string           `json:"salesOpenAt"`
	SalesCloseAt    string           `json:"salesCloseAt"`
	PaymentsLive    bool             `json:"paymentsLive"`
	UnreadAlerts    int64            `json:"unreadAlerts"`
	AnalyzedAt      string           `json:"analyzedAt"`
	Zones           []ZonePricingDTO `json:"zones"`
	Demand          []DemandPointDTO `json:"demand"`
}

// Overview analyzes an event without acting on it, for the organizer dashboard.
func (e *DynamicPricingEngine) Overview(ctx context.Context, eventID pgtype.UUID) (*PricingOverviewDTO, error) {
	a, err := e.analyze(ctx, eventID)
	if err != nil {
		return nil, err
	}
	pending, err := e.ListPending(ctx, eventID)
	if err != nil {
		return nil, err
	}
	pendingByZone := make(map[string]*PriceSuggestionDTO, len(pending))
	for i := range pending {
		pendingByZone[pending[i].ZoneID] = &pending[i]
	}
	unread, err := e.queries.CountUnreadPricingAlerts(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("count alerts: %w", err)
	}
	demand, err := e.queries.ListHourlyDemand(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load demand: %w", err)
	}

	c := a.ctx
	mode := PricingModeOff
	switch {
	case c.Enabled && c.AutoAdjust:
		mode = PricingModeAuto
	case c.Enabled:
		mode = PricingModeManual
	}
	out := &PricingOverviewDTO{
		EventID: store.UUIDToString(eventID), EventName: c.Name, Mode: mode,
		Enabled: c.Enabled, AutoAdjust: c.AutoAdjust, MaxStepPct: c.MaxStepPct, CooldownMinutes: c.CooldownMinutes,
		SalesOpenAt: c.SalesOpenAt.Time.Format(time.RFC3339), SalesCloseAt: c.SalesCloseAt.Time.Format(time.RFC3339),
		PaymentsLive: e.paymentsLive, UnreadAlerts: unread, AnalyzedAt: a.at.Format(time.RFC3339),
	}
	for _, z := range a.zones {
		id := store.UUIDToString(z.row.ZoneID)
		dto := ZonePricingDTO{
			ZoneID: id, ZoneCode: z.row.ZoneCode, ZoneName: z.row.ZoneName, Included: z.row.IsDynamicPricingEnabled,
			BasePrice: z.input.CurrentPrice, FloorPrice: z.input.FloorPrice, CeilingPrice: z.input.CeilingPrice, ListPrice: z.row.ListPrice,
			Capacity: z.row.Capacity, Available: z.row.Available, Held: z.row.Held, Sold: z.row.Sold,
			Holds1h: z.row.Holds1h, Holds24h: z.row.Holds24h, Sales24h: z.row.Sales24h,
			Recommendation: z.rec, Pending: pendingByZone[id],
		}
		if z.row.BoundsApprovedAt.Valid {
			dto.BoundsApprovedAt = z.row.BoundsApprovedAt.Time.Format(time.RFC3339)
		}
		if z.row.LastChangeAt.Valid {
			dto.LastChangeAt = z.row.LastChangeAt.Time.Format(time.RFC3339)
		}
		if mode == PricingModeAuto && z.row.IsDynamicPricingEnabled {
			if !z.row.BoundsApprovedAt.Valid {
				dto.AutoBlockedBy = "bounds_not_approved"
			} else if ok, why := pricing.AutoDecision(z.rec, z.input, a.limits); !ok {
				dto.AutoBlockedBy = why
			}
		}
		out.Zones = append(out.Zones, dto)
	}
	for _, d := range demand {
		out.Demand = append(out.Demand, DemandPointDTO{At: d.Bucket.Time.Format(time.RFC3339), Holds: d.Holds, Sales: d.Sales, Views: d.Views})
	}
	return out, nil
}

type PriceChangeDTO struct {
	ID            int64  `json:"id"`
	ZoneID        string `json:"zoneId"`
	ZoneCode      string `json:"zoneCode"`
	ZoneName      string `json:"zoneName"`
	OldPrice      int64  `json:"oldPrice"`
	NewPrice      int64  `json:"newPrice"`
	Trigger       string `json:"trigger"`
	Details       string `json:"details,omitempty"`
	ChangedBy     string `json:"changedBy,omitempty"`
	ChangedByName string `json:"changedByName,omitempty"`
	CreatedAt     string `json:"createdAt"`
}

// History lists an event's price changes, newest first.
func (e *DynamicPricingEngine) History(ctx context.Context, eventID pgtype.UUID, limit int32) ([]PriceChangeDTO, error) {
	rows, err := e.queries.ListPriceHistory(ctx, store.ListPriceHistoryParams{EventID: eventID, Limit: limit})
	if err != nil {
		return nil, fmt.Errorf("list price history: %w", err)
	}
	out := make([]PriceChangeDTO, 0, len(rows))
	for _, r := range rows {
		oldPrice, err := int64Of(r.OldPrice)
		if err != nil {
			return nil, err
		}
		newPrice, err := int64Of(r.NewPrice)
		if err != nil {
			return nil, err
		}
		dto := PriceChangeDTO{
			ID: r.ID, ZoneID: store.UUIDToString(r.ZoneID), ZoneCode: r.ZoneCode, ZoneName: r.ZoneName,
			OldPrice: oldPrice, NewPrice: newPrice, Trigger: r.Reason, Details: r.Details.String,
			ChangedByName: r.ChangedByName.String, CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
		}
		if r.ChangedBy.Valid {
			dto.ChangedBy = store.UUIDToString(r.ChangedBy)
		}
		out = append(out, dto)
	}
	return out, nil
}

// Alerts lists an event's pricing alerts, newest first.
func (e *DynamicPricingEngine) Alerts(ctx context.Context, eventID pgtype.UUID, limit int32) ([]PricingAlertDTO, error) {
	rows, err := e.queries.ListPricingAlerts(ctx, store.ListPricingAlertsParams{EventID: eventID, Limit: limit})
	if err != nil {
		return nil, fmt.Errorf("list alerts: %w", err)
	}
	out := make([]PricingAlertDTO, 0, len(rows))
	for _, r := range rows {
		dto := PricingAlertDTO{
			ID: store.UUIDToString(r.ID), EventID: store.UUIDToString(r.EventID),
			ZoneCode: r.ZoneCode.String, ZoneName: r.ZoneName.String,
			Kind: r.Kind, Message: r.Message, Data: r.Data, Read: r.ReadAt.Valid,
			CreatedAt: r.CreatedAt.Time.Format(time.RFC3339),
		}
		if r.ZoneID.Valid {
			dto.ZoneID = store.UUIDToString(r.ZoneID)
		}
		out = append(out, dto)
	}
	return out, nil
}

// AlertEvent returns the event an alert belongs to, for authorization.
func (e *DynamicPricingEngine) AlertEvent(ctx context.Context, id pgtype.UUID) (pgtype.UUID, error) {
	eventID, err := e.queries.GetPricingAlertEvent(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return pgtype.UUID{}, ErrAlertNotFound
	}
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("load alert: %w", err)
	}
	return eventID, nil
}

func (e *DynamicPricingEngine) MarkAlertRead(ctx context.Context, id pgtype.UUID) error {
	return e.queries.MarkPricingAlertRead(ctx, id)
}

func (e *DynamicPricingEngine) MarkAllAlertsRead(ctx context.Context, eventID pgtype.UUID) error {
	return e.queries.MarkEventPricingAlertsRead(ctx, eventID)
}

// --- Suggestions (Mode B) ---

type PriceSuggestionDTO struct {
	ID             string          `json:"id"`
	ZoneID         string          `json:"zoneId"`
	ZoneCode       string          `json:"zoneCode"`
	ZoneName       string          `json:"zoneName"`
	CurrentPrice   int64           `json:"currentPrice"`
	SuggestedPrice int64           `json:"suggestedPrice"`
	Reason         string          `json:"reason"`
	Metrics        json.RawMessage `json:"metrics"`
	CreatedAt      string          `json:"createdAt"`
}

// ListPending returns an event's suggestions awaiting review.
func (e *DynamicPricingEngine) ListPending(ctx context.Context, eventID pgtype.UUID) ([]PriceSuggestionDTO, error) {
	rows, err := e.queries.ListPendingPriceSuggestions(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("list suggestions: %w", err)
	}
	out := make([]PriceSuggestionDTO, 0, len(rows))
	for _, r := range rows {
		current, err := int64Of(r.CurrentPrice)
		if err != nil {
			return nil, err
		}
		suggested, err := int64Of(r.SuggestedPrice)
		if err != nil {
			return nil, err
		}
		out = append(out, PriceSuggestionDTO{
			ID:             store.UUIDToString(r.ID),
			ZoneID:         store.UUIDToString(r.ZoneID),
			ZoneCode:       r.ZoneCode,
			ZoneName:       r.ZoneName,
			CurrentPrice:   current,
			SuggestedPrice: suggested,
			Reason:         r.Reason,
			Metrics:        r.Metrics,
			CreatedAt:      r.CreatedAt.Time.Format(time.RFC3339),
		})
	}
	return out, nil
}

// SuggestionEvent returns the event a suggestion belongs to, for authorization.
func (e *DynamicPricingEngine) SuggestionEvent(ctx context.Context, id pgtype.UUID) (pgtype.UUID, error) {
	s, err := e.queries.GetPriceSuggestion(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return pgtype.UUID{}, ErrSuggestionNotFound
	}
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("load suggestion: %w", err)
	}
	return s.EventID, nil
}

type ReviewedSuggestion struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	// BasePrice is the zone's new base price; only set on approval.
	BasePrice int64 `json:"basePrice,omitempty"`
}

// Approve sets the zone's base price to the suggested one. It refuses if the
// zone's price changed since the suggestion was made, or the suggestion falls
// outside the current floor and ceiling.
func (e *DynamicPricingEngine) Approve(ctx context.Context, id, userID pgtype.UUID) (*ReviewedSuggestion, error) {
	tx, err := e.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := e.queries.WithTx(tx)

	s, err := lockPendingSuggestion(ctx, qtx, id)
	if err != nil {
		return nil, err
	}
	zone, err := qtx.GetEventZoneForUpdate(ctx, store.GetEventZoneForUpdateParams{EventID: s.EventID, ZoneID: s.ZoneID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrZoneNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load event zone: %w", err)
	}
	p, err := zonePricingOf(zone)
	if err != nil {
		return nil, err
	}
	basedOn, err := int64Of(s.CurrentPrice)
	if err != nil {
		return nil, err
	}
	suggested, err := int64Of(s.SuggestedPrice)
	if err != nil {
		return nil, err
	}
	if p.BasePrice != basedOn || suggested < p.FloorPrice || suggested > p.CeilingPrice {
		return nil, ErrSuggestionStale
	}

	// Mark it approved first: recordBaseChange closes whatever is still pending.
	if err := qtx.ReviewPriceSuggestion(ctx, store.ReviewPriceSuggestionParams{
		ID: id, Status: SuggestionApproved, ReviewedBy: userID,
	}); err != nil {
		return nil, fmt.Errorf("mark suggestion approved: %w", err)
	}
	if err := qtx.SetEventZoneBasePrice(ctx, store.SetEventZoneBasePriceParams{
		EventID: s.EventID, ZoneID: s.ZoneID, BasePrice: numeric(suggested),
	}); err != nil {
		return nil, fmt.Errorf("set base price: %w", err)
	}
	if err := recordBaseChange(ctx, qtx, zone, suggested, userID, PriceChangeSuggestion, s.Reason); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit approval: %w", err)
	}
	e.notifyOrganizer(ctx, s.EventID, "pricing_update", pgtype.UUID{})
	return &ReviewedSuggestion{ID: store.UUIDToString(id), Status: SuggestionApproved, BasePrice: suggested}, nil
}

// Reject closes a suggestion without touching any price.
func (e *DynamicPricingEngine) Reject(ctx context.Context, id, userID pgtype.UUID) (*ReviewedSuggestion, error) {
	tx, err := e.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := e.queries.WithTx(tx)

	s, err := lockPendingSuggestion(ctx, qtx, id)
	if err != nil {
		return nil, err
	}
	if err := qtx.ReviewPriceSuggestion(ctx, store.ReviewPriceSuggestionParams{
		ID: id, Status: SuggestionRejected, ReviewedBy: userID,
	}); err != nil {
		return nil, fmt.Errorf("mark suggestion rejected: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit rejection: %w", err)
	}
	e.notifyOrganizer(ctx, s.EventID, "pricing_update", pgtype.UUID{})
	return &ReviewedSuggestion{ID: store.UUIDToString(id), Status: SuggestionRejected}, nil
}

func lockPendingSuggestion(ctx context.Context, qtx *store.Queries, id pgtype.UUID) (store.PriceSuggestion, error) {
	s, err := qtx.GetPriceSuggestionForUpdate(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return s, ErrSuggestionNotFound
	}
	if err != nil {
		return s, fmt.Errorf("lock suggestion: %w", err)
	}
	if s.Status != SuggestionPending {
		return s, ErrSuggestionNotPending
	}
	return s, nil
}

func zonePricingOf(z store.EventZone) (ZonePricing, error) {
	var p ZonePricing
	var err error
	if p.BasePrice, err = int64Of(z.BasePrice); err != nil {
		return p, err
	}
	if p.FloorPrice, err = int64Of(z.FloorPrice); err != nil {
		return p, err
	}
	p.CeilingPrice, err = int64Of(z.CeilingPrice)
	return p, err
}

func int64Of(n pgtype.Numeric) (int64, error) {
	v, err := n.Int64Value()
	if err != nil {
		return 0, fmt.Errorf("read price: %w", err)
	}
	return v.Int64, nil
}
