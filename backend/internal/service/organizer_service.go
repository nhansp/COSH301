package service

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/store"
)

var (
	ErrEventNotFound      = errors.New("event_not_found")
	ErrZoneNotFound       = errors.New("zone_not_found")
	ErrNotEventOrganizer  = errors.New("not_event_organizer")
	ErrInvalidPriceBounds = errors.New("invalid_price_bounds")
)

// OrganizerService lets organizers manage their events and zone prices (FR-08).
type OrganizerService struct {
	dbPool  *pgxpool.Pool
	queries *store.Queries
}

func NewOrganizerService(dbPool *pgxpool.Pool, queries *store.Queries) *OrganizerService {
	return &OrganizerService{dbPool: dbPool, queries: queries}
}

type OrganizerEventDTO struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Status    string `json:"status"`
	StartsAt  string `json:"startsAt"`
	ImageURL  string `json:"imageUrl"`
	VenueName string `json:"venueName"`
}

// ListEvents returns the events the user organizes, or all events for admins.
func (s *OrganizerService) ListEvents(ctx context.Context, userID pgtype.UUID, isAdmin bool) ([]OrganizerEventDTO, error) {
	rows, err := s.queries.ListOrganizerEvents(ctx, store.ListOrganizerEventsParams{IsAdmin: isAdmin, OrganizerID: userID})
	if err != nil {
		return nil, fmt.Errorf("list organizer events: %w", err)
	}
	out := make([]OrganizerEventDTO, 0, len(rows))
	for _, e := range rows {
		out = append(out, OrganizerEventDTO{
			ID:        store.UUIDToString(e.ID),
			Name:      e.Name,
			Slug:      e.Slug,
			Status:    string(e.Status),
			StartsAt:  e.StartsAt.Time.Format(time.RFC3339),
			ImageURL:  e.ImageUrl.String,
			VenueName: e.VenueName,
		})
	}
	return out, nil
}

// AuthorizeEvent checks that the user may manage the event.
func (s *OrganizerService) AuthorizeEvent(ctx context.Context, eventID, userID pgtype.UUID, isAdmin bool) error {
	owner, err := s.queries.GetEventOrganizer(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrEventNotFound
	}
	if err != nil {
		return fmt.Errorf("load event organizer: %w", err)
	}
	if !isAdmin && owner != userID {
		return ErrNotEventOrganizer
	}
	return nil
}

type ZonePricing struct {
	BasePrice    int64 `json:"basePrice"`
	FloorPrice   int64 `json:"floorPrice"`
	CeilingPrice int64 `json:"ceilingPrice"`
}

func numeric(v int64) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(v), Valid: true}
}

// UpdateZonePricing sets a zone's floor, ceiling and base price. A new base
// price reprices the zone's available seats and is written to the price log.
func (s *OrganizerService) UpdateZonePricing(ctx context.Context, eventID, zoneID, userID pgtype.UUID, p ZonePricing) (*ZonePricing, error) {
	if p.FloorPrice < 0 || p.FloorPrice > p.BasePrice || p.BasePrice > p.CeilingPrice {
		return nil, ErrInvalidPriceBounds
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	current, err := qtx.GetEventZoneForUpdate(ctx, store.GetEventZoneForUpdateParams{EventID: eventID, ZoneID: zoneID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrZoneNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load event zone: %w", err)
	}

	if _, err := qtx.UpdateEventZonePricing(ctx, store.UpdateEventZonePricingParams{
		EventID:      eventID,
		ZoneID:       zoneID,
		BasePrice:    numeric(p.BasePrice),
		FloorPrice:   numeric(p.FloorPrice),
		CeilingPrice: numeric(p.CeilingPrice),
	}); err != nil {
		return nil, fmt.Errorf("update zone pricing: %w", err)
	}

	oldBase, err := current.BasePrice.Int64Value()
	if err != nil {
		return nil, fmt.Errorf("read base price: %w", err)
	}
	if oldBase.Int64 != p.BasePrice {
		if _, err := qtx.RepriceAvailableZoneSeats(ctx, store.RepriceAvailableZoneSeatsParams{
			EventID:      eventID,
			ZoneID:       zoneID,
			CurrentPrice: numeric(p.BasePrice),
		}); err != nil {
			return nil, fmt.Errorf("reprice seats: %w", err)
		}
		if err := qtx.InsertPriceChange(ctx, store.InsertPriceChangeParams{
			EventID:   eventID,
			ZoneID:    zoneID,
			OldPrice:  current.BasePrice,
			NewPrice:  numeric(p.BasePrice),
			ChangedBy: userID,
			Reason:    "MANUAL",
		}); err != nil {
			return nil, fmt.Errorf("log price change: %w", err)
		}
	}

	// Held seats keep their price for the holder but must stay within the new bounds.
	if _, err := qtx.ClampZoneSeatPrices(ctx, store.ClampZoneSeatPricesParams{
		EventID:      eventID,
		ZoneID:       zoneID,
		FloorPrice:   numeric(p.FloorPrice),
		CeilingPrice: numeric(p.CeilingPrice),
	}); err != nil {
		return nil, fmt.Errorf("clamp seat prices: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit pricing: %w", err)
	}
	return &p, nil
}

type ZoneSalesSummaryDTO struct {
	ZoneID                  string  `json:"zoneId"`
	ZoneCode                string  `json:"zoneCode"`
	ZoneName                string  `json:"zoneName"`
	Kind                    string  `json:"kind"`
	Capacity                int     `json:"capacity"`
	Sold                    int     `json:"sold"`
	Held                    int     `json:"held"`
	Available               int     `json:"available"`
	FillRate                float64 `json:"fillRate"`
	BasePrice               int64   `json:"basePrice"`
	FloorPrice              int64   `json:"floorPrice"`
	CeilingPrice            int64   `json:"ceilingPrice"`
	IsDynamicPricingEnabled bool    `json:"isDynamicPricingEnabled"`
	RealizedRevenue         int64   `json:"realizedRevenue"`
	HeldPipelineRevenue     int64   `json:"heldPipelineRevenue"`
	PotentialRevenue        int64   `json:"potentialRevenue"`
	PriceHeadroomPct        float64 `json:"priceHeadroomPct"`
}

type EventSalesSummaryDTO struct {
	EventID             string                `json:"eventId"`
	EventName           string                `json:"eventName"`
	Slug                string                `json:"slug"`
	City                string                `json:"city"`
	VenueName           string                `json:"venueName"`
	StartsAt            string                `json:"startsAt"`
	TotalCapacity       int                   `json:"totalCapacity"`
	SoldCount           int                   `json:"soldCount"`
	HeldCount           int                   `json:"heldCount"`
	AvailableCount      int                   `json:"availableCount"`
	FillRate            float64               `json:"fillRate"`
	RealizedRevenue     int64                 `json:"realizedRevenue"`
	HeldPipelineRevenue int64                 `json:"heldPipelineRevenue"`
	PotentialRevenue    int64                 `json:"potentialRevenue"`
	RemainingRevenue    int64                 `json:"remainingRevenue"`
	StandingFillRate    float64               `json:"standingFillRate"`
	SeatedFillRate      float64               `json:"seatedFillRate"`
	HotZones            []string              `json:"hotZones"`
	SlowZones           []string              `json:"slowZones"`
	Zones               []ZoneSalesSummaryDTO `json:"zones"`
}

func isStandingZoneName(name string) bool {
	return strings.Contains(strings.ToLower(name), "đứng")
}

// GetEventSalesSummary aggregates live seat occupancy, realized/pipeline revenue,
// and pricing corridor headroom for an organizer's event directly from PostgreSQL.
func (s *OrganizerService) GetEventSalesSummary(ctx context.Context, eventID pgtype.UUID) (*EventSalesSummaryDTO, error) {
	ev, err := s.queries.GetEventByID(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEventNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load event for sales summary: %w", err)
	}

	zones, err := s.queries.ListEventZonesWithPrices(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load event zones for sales summary: %w", err)
	}
	seats, err := s.queries.GetEventSeatMap(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load seat map for sales summary: %w", err)
	}

	type seatAgg struct {
		total     int
		sold      int
		held      int
		available int
		soldRev   int64
		heldRev   int64
		availRev  int64
	}
	byZone := make(map[string]*seatAgg, len(zones))
	for _, st := range seats {
		zid := store.UUIDToString(st.ZoneID)
		agg := byZone[zid]
		if agg == nil {
			agg = &seatAgg{}
			byZone[zid] = agg
		}
		priceVal, _ := st.CurrentPrice.Int64Value()
		price := priceVal.Int64
		agg.total++
		switch st.Status {
		case store.SeatStatusSOLD:
			agg.sold++
			agg.soldRev += price
		case store.SeatStatusHELD:
			agg.held++
			agg.heldRev += price
		case store.SeatStatusAVAILABLE:
			agg.available++
			agg.availRev += price
		}
	}

	out := &EventSalesSummaryDTO{
		EventID:   store.UUIDToString(ev.ID),
		EventName: ev.Name,
		Slug:      ev.Slug,
		City:      ev.City.String,
		VenueName: ev.VenueName,
		StartsAt:  ev.StartsAt.Time.Format(time.RFC3339),
		HotZones:  []string{},
		SlowZones: []string{},
		Zones:     make([]ZoneSalesSummaryDTO, 0, len(zones)),
	}

	var standingTotal, standingTaken, seatedTotal, seatedTaken int

	for _, z := range zones {
		zid := store.UUIDToString(z.ZoneID)
		baseVal, _ := z.BasePrice.Int64Value()
		floorVal, _ := z.FloorPrice.Int64Value()
		ceilVal, _ := z.CeilingPrice.Int64Value()
		basePrice := baseVal.Int64
		floorPrice := floorVal.Int64
		ceilPrice := ceilVal.Int64

		agg := byZone[zid]
		capCount := int(z.Capacity)
		sold, held, avail := 0, 0, capCount
		var soldRev, heldRev, potRev int64
		if agg != nil && agg.total > 0 {
			capCount = agg.total
			sold = agg.sold
			held = agg.held
			avail = agg.available
			soldRev = agg.soldRev
			heldRev = agg.heldRev
			potRev = agg.soldRev + agg.heldRev + agg.availRev
		} else {
			potRev = int64(capCount) * basePrice
		}

		fill := 0.0
		if capCount > 0 {
			fill = float64(sold+held) / float64(capCount)
		}
		headroom := 0.0
		if basePrice > 0 && ceilPrice > basePrice {
			headroom = float64(ceilPrice-basePrice) / float64(basePrice)
		}

		kind := "seated"
		if isStandingZoneName(z.ZoneName) {
			kind = "standing"
			standingTotal += capCount
			standingTaken += sold + held
		} else {
			seatedTotal += capCount
			seatedTaken += sold + held
		}

		if fill >= 0.70 {
			out.HotZones = append(out.HotZones, z.ZoneName)
		} else if fill < 0.20 {
			out.SlowZones = append(out.SlowZones, z.ZoneName)
		}

		out.TotalCapacity += capCount
		out.SoldCount += sold
		out.HeldCount += held
		out.AvailableCount += avail
		out.RealizedRevenue += soldRev
		out.HeldPipelineRevenue += heldRev
		out.PotentialRevenue += potRev

		out.Zones = append(out.Zones, ZoneSalesSummaryDTO{
			ZoneID:                  zid,
			ZoneCode:                z.Code,
			ZoneName:                z.ZoneName,
			Kind:                    kind,
			Capacity:                capCount,
			Sold:                    sold,
			Held:                    held,
			Available:               avail,
			FillRate:                fill,
			BasePrice:               basePrice,
			FloorPrice:              floorPrice,
			CeilingPrice:            ceilPrice,
			IsDynamicPricingEnabled: z.IsDynamicPricingEnabled,
			RealizedRevenue:         soldRev,
			HeldPipelineRevenue:     heldRev,
			PotentialRevenue:        potRev,
			PriceHeadroomPct:        headroom,
		})
	}

	sort.Slice(out.Zones, func(i, j int) bool {
		return out.Zones[i].BasePrice > out.Zones[j].BasePrice
	})

	if out.TotalCapacity > 0 {
		out.FillRate = float64(out.SoldCount+out.HeldCount) / float64(out.TotalCapacity)
	}
	if standingTotal > 0 {
		out.StandingFillRate = float64(standingTaken) / float64(standingTotal)
	}
	if seatedTotal > 0 {
		out.SeatedFillRate = float64(seatedTaken) / float64(seatedTotal)
	}
	out.RemainingRevenue = out.PotentialRevenue - out.RealizedRevenue
	if out.RemainingRevenue < 0 {
		out.RemainingRevenue = 0
	}
	return out, nil
}
