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

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit pricing: %w", err)
	}
	return &p, nil
}
