package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"eventticketing/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSeatNotAvailable   = errors.New("seat_not_available")
	ErrSeatNotFound       = errors.New("seat_not_found")
	ErrTicketLimitReached = errors.New("ticket_limit_reached")
	ErrHoldNotFound       = errors.New("hold_not_found")
	ErrEventNotOnSale     = errors.New("event_not_on_sale")
)

const (
	holdSeconds       = 5 * 60
	pgUniqueViolation = "23505"
)

const SeatNotificationChannel = "event_seats_channel"

type SeatUpdateMessage struct {
	Type      string    `json:"type"` // "seat_held", "seat_released", "seat_expired"
	EventID   string    `json:"eventId"`
	SeatID    string    `json:"seatId"`
	Status    string    `json:"status"` // "AVAILABLE", "HELD", "SOLD"
	Timestamp time.Time `json:"timestamp"`
}

type SeatService struct {
	dbPool  *pgxpool.Pool
	queries *store.Queries
	// limitTickets enforces events.max_tickets_per_user (FR-11).
	limitTickets bool
}

func NewSeatService(dbPool *pgxpool.Pool, queries *store.Queries, limitTickets bool) *SeatService {
	return &SeatService{dbPool: dbPool, queries: queries, limitTickets: limitTickets}
}

func notify(ctx context.Context, q *store.Queries, msg SeatUpdateMessage) error {
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return q.NotifyChannel(ctx, store.NotifyChannelParams{
		PgNotify:   SeatNotificationChannel,
		PgNotify_2: string(payload),
	})
}

type SeatMapItem struct {
	EventSeatID  string  `json:"eventSeatId"`
	EventID      string  `json:"eventId"`
	SeatID       string  `json:"seatId"`
	Status       string  `json:"status"` // "available", "held", "sold", "selected"
	CurrentPrice int64   `json:"currentPrice"`
	RowLabel     string  `json:"row"`
	SeatNumber   string  `json:"number"`
	SeatLabel    string  `json:"label"`
	XPosition    float64 `json:"x"`
	YPosition    float64 `json:"y"`
	ZoneID       string  `json:"zoneId"`
	ZoneCode     string  `json:"zoneCode"`
	ZoneName     string  `json:"zoneName"`
	IsMyHold     bool    `json:"isMyHold"`
}

// GetSeatMap returns the interactive seat map with viewer-specific hold highlighting.
func (s *SeatService) GetSeatMap(ctx context.Context, eventID pgtype.UUID, currentUserID *pgtype.UUID) ([]SeatMapItem, error) {
	rows, err := s.queries.GetEventSeatMap(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch seat map: %w", err)
	}

	// Fetch active holds for current user if logged in
	userHolds := make(map[[16]byte]bool)
	if currentUserID != nil && currentUserID.Valid {
		holds, err := s.queries.ListActiveHoldsForUser(ctx, store.ListActiveHoldsForUserParams{
			EventID: eventID,
			UserID:  *currentUserID,
		})
		if err != nil {
			return nil, fmt.Errorf("fetch user holds: %w", err)
		}
		for _, h := range holds {
			userHolds[h.SeatID.Bytes] = true
		}
	}

	items := make([]SeatMapItem, 0, len(rows))
	for _, r := range rows {
		st := string(r.Status)
		isMyHold := userHolds[r.SeatID.Bytes]

		var displayStatus string
		switch st {
		case "AVAILABLE":
			displayStatus = "available"
		case "SOLD", "BLOCKED":
			displayStatus = "sold" // blocked seats are unavailable to buyers
		case "HELD":
			if isMyHold {
				displayStatus = "selected" // purple for current user
			} else {
				displayStatus = "held" // yellow for others
			}
		default:
			displayStatus = "available"
		}

		var x, y float64
		if r.XPosition.Valid {
			f, _ := r.XPosition.Float64Value()
			x = f.Float64
		}
		if r.YPosition.Valid {
			f, _ := r.YPosition.Float64Value()
			y = f.Float64
		}

		price, _ := r.CurrentPrice.Int64Value()

		items = append(items, SeatMapItem{
			EventSeatID:  store.UUIDToString(r.EventSeatID),
			EventID:      store.UUIDToString(r.EventID),
			SeatID:       store.UUIDToString(r.SeatID),
			Status:       displayStatus,
			CurrentPrice: price.Int64,
			RowLabel:     r.RowLabel.String,
			SeatNumber:   r.SeatNumber.String,
			SeatLabel:    r.SeatLabel,
			XPosition:    x,
			YPosition:    y,
			ZoneID:       store.UUIDToString(r.ZoneID),
			ZoneCode:     r.ZoneCode,
			ZoneName:     r.ZoneName,
			IsMyHold:     isMyHold,
		})
	}

	return items, nil
}

// HoldSeat reserves a seat for the user for five minutes in one transaction.
func (s *SeatService) HoldSeat(ctx context.Context, eventID, seatID, userID pgtype.UUID) (*store.SeatHold, error) {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	sale, err := qtx.GetEventSaleState(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEventNotOnSale
	}
	if err != nil {
		return nil, fmt.Errorf("load event: %w", err)
	}
	if sale.Status != store.EventStatusONSALE || !sale.InSalesWindow.Bool {
		return nil, ErrEventNotOnSale
	}

	if s.limitTickets {
		// Serializes concurrent holds by the same user on the same event.
		if err := qtx.LockUserEventAdvisory(ctx, store.LockUserEventAdvisoryParams{
			Column1: store.UUIDToString(userID),
			Column2: store.UUIDToString(eventID),
		}); err != nil {
			return nil, fmt.Errorf("advisory lock: %w", err)
		}
		count, err := qtx.CountUserHeldAndBoughtTickets(ctx, store.CountUserHeldAndBoughtTicketsParams{
			EventID: eventID,
			UserID:  userID,
		})
		if err != nil {
			return nil, fmt.Errorf("count user tickets: %w", err)
		}
		if count >= sale.MaxTicketsPerUser {
			return nil, ErrTicketLimitReached
		}
	}

	if err := s.lockSeat(ctx, qtx, eventID, seatID); err != nil {
		return nil, err
	}

	holdToken, err := GenerateToken()
	if err != nil {
		return nil, fmt.Errorf("generate hold token: %w", err)
	}

	hold, err := qtx.CreateSeatHold(ctx, store.CreateSeatHoldParams{
		EventID:     eventID,
		SeatID:      seatID,
		UserID:      userID,
		HoldToken:   holdToken,
		HoldSeconds: holdSeconds,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return nil, ErrSeatNotAvailable
		}
		return nil, fmt.Errorf("insert seat hold: %w", err)
	}

	// NOTIFY is delivered only if the transaction commits.
	if err := notify(ctx, qtx, SeatUpdateMessage{
		Type:      "seat_held",
		EventID:   store.UUIDToString(eventID),
		SeatID:    store.UUIDToString(seatID),
		Status:    "HELD",
		Timestamp: time.Now(),
	}); err != nil {
		return nil, fmt.Errorf("notify seat held: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit hold: %w", err)
	}
	return &hold, nil
}

// lockSeat marks the seat HELD inside the caller's transaction.
func (s *SeatService) lockSeat(ctx context.Context, qtx *store.Queries, eventID, seatID pgtype.UUID) error {
	params := store.TryLockSeatParams{EventID: eventID, SeatID: seatID}
	if _, err := qtx.TryLockSeat(ctx, params); !errors.Is(err, pgx.ErrNoRows) {
		if err != nil {
			return fmt.Errorf("lock seat: %w", err)
		}
		return nil
	}

	// The seat may still be marked HELD by a hold the reaper has not expired yet.
	_, err := qtx.TryStealExpiredSeatHold(ctx, store.TryStealExpiredSeatHoldParams{EventID: eventID, SeatID: seatID})
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("take expired hold: %w", err)
	}

	// The reaper may have freed the seat while the steal was waiting on its row lock.
	if _, err := qtx.TryLockSeat(ctx, params); !errors.Is(err, pgx.ErrNoRows) {
		if err != nil {
			return fmt.Errorf("lock seat: %w", err)
		}
		return nil
	}

	exists, err := qtx.EventSeatExists(ctx, store.EventSeatExistsParams{EventID: eventID, SeatID: seatID})
	if err != nil {
		return fmt.Errorf("check seat: %w", err)
	}
	if !exists {
		return ErrSeatNotFound
	}
	return ErrSeatNotAvailable
}

// ReleaseSeat releases an active hold on a seat by user.
func (s *SeatService) ReleaseSeat(ctx context.Context, eventID, seatID, userID pgtype.UUID) error {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if _, err := qtx.ReleaseSeatHold(ctx, store.ReleaseSeatHoldParams{
		EventID: eventID,
		SeatID:  seatID,
		UserID:  userID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrHoldNotFound
		}
		return fmt.Errorf("release hold: %w", err)
	}

	if err := qtx.ResetSeatToAvailable(ctx, store.ResetSeatToAvailableParams{
		EventID: eventID,
		SeatID:  seatID,
	}); err != nil {
		return fmt.Errorf("failed to reset seat status: %w", err)
	}

	if err := notify(ctx, qtx, SeatUpdateMessage{
		Type:      "seat_released",
		EventID:   store.UUIDToString(eventID),
		SeatID:    store.UUIDToString(seatID),
		Status:    "AVAILABLE",
		Timestamp: time.Now(),
	}); err != nil {
		return fmt.Errorf("notify seat released: %w", err)
	}

	return tx.Commit(ctx)
}

// ExpireStaleHolds checks and releases all holds that passed 5-minute timeout.
func (s *SeatService) ExpireStaleHolds(ctx context.Context) ([]store.ExpireStaleSeatHoldsRow, error) {
	expiredRows, err := s.queries.ExpireStaleSeatHolds(ctx)
	if err != nil {
		return nil, err
	}

	var errs []error
	for _, row := range expiredRows {
		if err := notify(ctx, s.queries, SeatUpdateMessage{
			Type:      "seat_expired",
			EventID:   uuid.UUID(row.ExpEventID.Bytes).String(),
			SeatID:    uuid.UUID(row.ExpSeatID.Bytes).String(),
			Status:    "AVAILABLE",
			Timestamp: time.Now(),
		}); err != nil {
			errs = append(errs, fmt.Errorf("notify seat expired: %w", err))
		}
	}

	return expiredRows, errors.Join(errs...)
}

// MyHold is one of the caller's active seat holds.
type MyHold struct {
	EventID   string `json:"eventId"`
	EventSlug string `json:"eventSlug"`
	EventName string `json:"eventName"`
	StartsAt  string `json:"startsAt"`
	VenueName string `json:"venueName"`
	SeatID    string `json:"seatId"`
	SeatLabel string `json:"seatLabel"`
	ZoneName  string `json:"zoneName"`
	Price     int64  `json:"price"`
	ExpiresAt string `json:"expiresAt"`
}

// ListMyHolds returns the user's active holds across all events.
func (s *SeatService) ListMyHolds(ctx context.Context, userID pgtype.UUID) ([]MyHold, error) {
	rows, err := s.queries.ListMyActiveHolds(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list holds: %w", err)
	}
	holds := make([]MyHold, 0, len(rows))
	for _, r := range rows {
		price, _ := r.CurrentPrice.Int64Value()
		holds = append(holds, MyHold{
			EventID:   store.UUIDToString(r.EventID),
			EventSlug: r.EventSlug,
			EventName: r.EventName,
			StartsAt:  r.StartsAt.Time.Format(time.RFC3339),
			VenueName: r.VenueName,
			SeatID:    store.UUIDToString(r.SeatID),
			SeatLabel: r.SeatLabel,
			ZoneName:  r.ZoneName,
			Price:     price.Int64,
			ExpiresAt: r.ExpiresAt.Time.Format(time.RFC3339),
		})
	}
	return holds, nil
}
