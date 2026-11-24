package service

import (
	"context"
	"errors"
	"fmt"
	"math/big"
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
	ID           string `json:"id"`
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Status       string `json:"status"`
	StartsAt     string `json:"startsAt"`
	EndsAt       string `json:"endsAt"`
	ImageURL     string `json:"imageUrl"`
	Genre        string `json:"genre"`
	City         string `json:"city"`
	VenueName    string `json:"venueName"`
	VenueAddress string `json:"venueAddress"`
	// UnreadAlerts counts pricing alerts the organizer has not read.
	UnreadAlerts int64 `json:"unreadAlerts"`
	Capacity     int64 `json:"capacity"`
	Available    int64 `json:"available"`
	Held         int64 `json:"held"`
	Sold         int64 `json:"sold"`
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
			ID:           store.UUIDToString(e.ID),
			Name:         e.Name,
			Slug:         e.Slug,
			Status:       string(e.Status),
			StartsAt:     e.StartsAt.Time.Format(time.RFC3339),
			EndsAt:       e.EndsAt.Time.Format(time.RFC3339),
			ImageURL:     e.ImageUrl.String,
			Genre:        e.Genre.String,
			City:         e.City.String,
			VenueName:    e.VenueName,
			VenueAddress: e.VenueAddress.String,
			UnreadAlerts: e.UnreadAlerts,
			Capacity:     e.Capacity,
			Available:    e.Available,
			Held:         e.Held,
			Sold:         e.Sold,
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

	// Saving the form is also the organizer's approval of the floor and ceiling.
	if _, err := qtx.UpdateEventZonePricing(ctx, store.UpdateEventZonePricingParams{
		EventID:          eventID,
		ZoneID:           zoneID,
		BasePrice:        numeric(p.BasePrice),
		FloorPrice:       numeric(p.FloorPrice),
		CeilingPrice:     numeric(p.CeilingPrice),
		BoundsApprovedBy: userID,
	}); err != nil {
		return nil, fmt.Errorf("update zone pricing: %w", err)
	}
	if err := recordBaseChange(ctx, qtx, current, p.BasePrice, userID, PriceChangeManual, ""); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit pricing: %w", err)
	}
	return &p, nil
}

// Triggers written to price_changes.reason.
const (
	PriceChangeManual     = "MANUAL"
	PriceChangeSuggestion = "SUGGESTION"
	PriceChangeAuto       = "AUTO"
)

// recordBaseChange follows a zone's base price moving from current.BasePrice
// to newBase inside the caller's transaction, which must hold the row lock on
// current and have written the new base price. Available seats are repriced,
// the change is logged, an open suggestion for the zone is closed and open seat
// maps are told to reload. actor is invalid for automatic changes.
func recordBaseChange(ctx context.Context, qtx *store.Queries, current store.EventZone, newBase int64, actor pgtype.UUID, reason, details string) error {
	oldBase, err := current.BasePrice.Int64Value()
	if err != nil {
		return fmt.Errorf("read base price: %w", err)
	}
	if oldBase.Int64 == newBase {
		return nil
	}

	// Held seats keep the price their holder saw; they take the new base price
	// when they return to sale.
	if _, err := qtx.RepriceAvailableZoneSeats(ctx, store.RepriceAvailableZoneSeatsParams{
		EventID:      current.EventID,
		ZoneID:       current.ZoneID,
		CurrentPrice: numeric(newBase),
	}); err != nil {
		return fmt.Errorf("reprice seats: %w", err)
	}
	if err := qtx.InsertPriceChange(ctx, store.InsertPriceChangeParams{
		EventID:   current.EventID,
		ZoneID:    current.ZoneID,
		OldPrice:  current.BasePrice,
		NewPrice:  numeric(newBase),
		ChangedBy: actor,
		Reason:    reason,
		Details:   pgtype.Text{String: details, Valid: details != ""},
	}); err != nil {
		return fmt.Errorf("log price change: %w", err)
	}
	if err := qtx.ExpirePendingSuggestion(ctx, store.ExpirePendingSuggestionParams{EventID: current.EventID, ZoneID: current.ZoneID}); err != nil {
		return fmt.Errorf("close pending suggestion: %w", err)
	}
	if err := notify(ctx, qtx, SeatUpdateMessage{
		Type:      "zone_repriced",
		EventID:   store.UUIDToString(current.EventID),
		ZoneID:    store.UUIDToString(current.ZoneID),
		Timestamp: time.Now(),
	}); err != nil {
		return fmt.Errorf("notify zone repriced: %w", err)
	}
	return nil
}
