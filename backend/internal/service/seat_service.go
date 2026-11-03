package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"eventticketing/internal/store"
)

var (
	ErrSeatNotAvailable  = errors.New("seat_not_available")
	ErrTicketLimitReached = errors.New("ticket_limit_reached")
	ErrHoldNotFound      = errors.New("hold_not_found")
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
}

func NewSeatService(dbPool *pgxpool.Pool, queries *store.Queries) *SeatService {
	return &SeatService{
		dbPool:  dbPool,
		queries: queries,
	}
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
		if err == nil {
			for _, h := range holds {
				userHolds[h.SeatID.Bytes] = true
			}
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
		case "SOLD":
			displayStatus = "sold"
		case "HELD":
			if isMyHold {
				displayStatus = "selected" // purple for current user
			} else {
				displayStatus = "held"     // yellow for others
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

// HoldSeat executes atomic 5-minute seat reservation under ACID transaction.
func (s *SeatService) HoldSeat(ctx context.Context, eventID, seatID, userID pgtype.UUID) (*store.SeatHold, error) {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// 1. Lock user+event scope using pg_advisory_xact_lock
	if err := qtx.LockUserEventAdvisory(ctx, store.LockUserEventAdvisoryParams{
		Column1: store.UUIDToString(userID),
		Column2: store.UUIDToString(eventID),
	}); err != nil {
		return nil, fmt.Errorf("advisory lock failed: %w", err)
	}

	// 2. Check ticket limit (default max 4 per user per event)
	count, err := qtx.CountUserHeldAndBoughtTickets(ctx, store.CountUserHeldAndBoughtTicketsParams{
		EventID: eventID,
		UserID:  userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to check ticket limit: %w", err)
	}
	if count >= 4 {
		return nil, ErrTicketLimitReached
	}

	// 3. Attempt to lock the seat atomically
	lockedSeat, err := qtx.TryLockSeat(ctx, store.TryLockSeatParams{
		EventID: eventID,
		SeatID:  seatID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Check if seat is currently HELD but the old hold has expired
			stolenSeat, stealErr := qtx.TryStealExpiredSeatHold(ctx, store.TryStealExpiredSeatHoldParams{
				EventID: eventID,
				SeatID:  seatID,
			})
			if stealErr != nil {
				return nil, ErrSeatNotAvailable
			}
			lockedSeat = stolenSeat
		} else {
			return nil, fmt.Errorf("failed to lock seat: %w", err)
		}
	}
	_ = lockedSeat

	// 4. Create active seat hold for 5 minutes
	holdToken, err := GenerateToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate hold token: %w", err)
	}

	expiresAt := pgtype.Timestamptz{
		Time:  time.Now().Add(5 * time.Minute),
		Valid: true,
	}

	hold, err := qtx.CreateSeatHold(ctx, store.CreateSeatHoldParams{
		EventID:   eventID,
		SeatID:    seatID,
		UserID:    userID,
		HoldToken: holdToken,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to insert seat hold: %w", err)
	}

	// 5. Broadcast notification to Postgres LISTEN/NOTIFY channel
	msg := SeatUpdateMessage{
		Type:      "seat_held",
		EventID:   store.UUIDToString(eventID),
		SeatID:    store.UUIDToString(seatID),
		Status:    "HELD",
		Timestamp: time.Now(),
	}
	msgBytes, _ := json.Marshal(msg)
	_ = qtx.NotifyChannel(ctx, store.NotifyChannelParams{
		PgNotify:   SeatNotificationChannel,
		PgNotify_2: string(msgBytes),
	})

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit hold transaction: %w", err)
	}

	return &hold, nil
}

// ReleaseSeat releases an active hold on a seat by user.
func (s *SeatService) ReleaseSeat(ctx context.Context, eventID, seatID, userID pgtype.UUID) error {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	_, err = qtx.ReleaseSeatHold(ctx, store.ReleaseSeatHoldParams{
		EventID: eventID,
		SeatID:  seatID,
		UserID:  userID,
	})
	if err != nil {
		return ErrHoldNotFound
	}

	if err := qtx.ResetSeatToAvailable(ctx, store.ResetSeatToAvailableParams{
		EventID: eventID,
		SeatID:  seatID,
	}); err != nil {
		return fmt.Errorf("failed to reset seat status: %w", err)
	}

	msg := SeatUpdateMessage{
		Type:      "seat_released",
		EventID:   store.UUIDToString(eventID),
		SeatID:    store.UUIDToString(seatID),
		Status:    "AVAILABLE",
		Timestamp: time.Now(),
	}
	msgBytes, _ := json.Marshal(msg)
	_ = qtx.NotifyChannel(ctx, store.NotifyChannelParams{
		PgNotify:   SeatNotificationChannel,
		PgNotify_2: string(msgBytes),
	})

	return tx.Commit(ctx)
}

// ExpireStaleHolds checks and releases all holds that passed 5-minute timeout.
func (s *SeatService) ExpireStaleHolds(ctx context.Context) ([]store.ExpireStaleSeatHoldsRow, error) {
	expiredRows, err := s.queries.ExpireStaleSeatHolds(ctx)
	if err != nil {
		return nil, err
	}

	for _, row := range expiredRows {
		msg := SeatUpdateMessage{
			Type:      "seat_expired",
			EventID:   uuid.UUID(row.ExpEventID.Bytes).String(),
			SeatID:    uuid.UUID(row.ExpSeatID.Bytes).String(),
			Status:    "AVAILABLE",
			Timestamp: time.Now(),
		}
		msgBytes, _ := json.Marshal(msg)
		_ = s.queries.NotifyChannel(ctx, store.NotifyChannelParams{
			PgNotify:   SeatNotificationChannel,
			PgNotify_2: string(msgBytes),
		})
	}

	return expiredRows, nil
}
