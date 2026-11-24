package service

import (
	"context"
	"encoding/json"
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
		if _, err := applyBasePrice(ctx, qtx, eventID, zoneID, userID, oldBase.Int64, p.BasePrice, ReasonManual); err != nil {
			return nil, err
		}
		// A suggestion made for the old price no longer applies.
		if _, err := qtx.ExpirePendingPriceSuggestion(ctx, store.ExpirePendingPriceSuggestionParams{EventID: eventID, ZoneID: zoneID}); err != nil {
			return nil, fmt.Errorf("expire stale suggestion: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit pricing: %w", err)
	}
	return &p, nil
}

// Reasons recorded in price_changes.
const (
	ReasonManual  = "MANUAL"
	ReasonDynamic = "DYNAMIC"
)

// applyBasePrice reprices a zone's available seats, logs the change and
// announces it on the seat stream once the transaction commits. The zone's
// base_price column must already hold newPrice.
//
// Held seats keep the price their holder saw; they take the new base price
// when they return to sale. It returns how many seats were repriced.
func applyBasePrice(ctx context.Context, qtx *store.Queries, eventID, zoneID, userID pgtype.UUID, oldPrice, newPrice int64, reason string) (int64, error) {
	repriced, err := qtx.RepriceAvailableZoneSeats(ctx, store.RepriceAvailableZoneSeatsParams{
		EventID:      eventID,
		ZoneID:       zoneID,
		CurrentPrice: numeric(newPrice),
	})
	if err != nil {
		return 0, fmt.Errorf("reprice seats: %w", err)
	}
	if err := qtx.InsertPriceChange(ctx, store.InsertPriceChangeParams{
		EventID:   eventID,
		ZoneID:    zoneID,
		OldPrice:  numeric(oldPrice),
		NewPrice:  numeric(newPrice),
		ChangedBy: userID,
		Reason:    reason,
	}); err != nil {
		return 0, fmt.Errorf("log price change: %w", err)
	}
	if err := notifyPriceChange(ctx, qtx, PriceChangeMessage{
		Type:     PriceChangedType,
		EventID:  store.UUIDToString(eventID),
		ZoneID:   store.UUIDToString(zoneID),
		OldPrice: oldPrice,
		NewPrice: newPrice,
		Reason:   reason,
	}); err != nil {
		return 0, fmt.Errorf("announce price change: %w", err)
	}
	return repriced, nil
}

// PriceChangedType is the Type of a PriceChangeMessage.
const PriceChangedType = "price_changed"

// PriceChangeMessage tells seat map viewers that a zone's price changed.
type PriceChangeMessage struct {
	Type      string    `json:"type"`
	EventID   string    `json:"eventId"`
	ZoneID    string    `json:"zoneId"`
	OldPrice  int64     `json:"oldPrice"`
	NewPrice  int64     `json:"newPrice"`
	Reason    string    `json:"reason"`
	Timestamp time.Time `json:"timestamp"`
}

// notifyPriceChange sends the message on the seat channel. PostgreSQL delivers
// it when the surrounding transaction commits, so viewers never see a price that rolled back.
func notifyPriceChange(ctx context.Context, q *store.Queries, msg PriceChangeMessage) error {
	msg.Timestamp = time.Now().UTC()
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return q.NotifyChannel(ctx, store.NotifyChannelParams{
		PgNotify:   SeatNotificationChannel,
		PgNotify_2: string(payload),
	})
}
