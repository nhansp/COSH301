package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultCancelReason = "Khách hàng xác nhận hủy vé trên ứng dụng"

// TicketService cancels the caller's own seats and keeps the cancellation history.
type TicketService struct {
	dbPool  *pgxpool.Pool
	queries *store.Queries
}

func NewTicketService(dbPool *pgxpool.Pool, queries *store.Queries) *TicketService {
	return &TicketService{dbPool: dbPool, queries: queries}
}

// CancelRequest describes a booking the client wants to cancel. Concert and
// TicketDetails are client-supplied display data and are stored as such.
type CancelRequest struct {
	BookingID     string
	BookingCode   string
	EventRef      string
	Reason        string
	Seats         []string
	Concert       map[string]any
	TicketDetails map[string]any
}

type CancelResult struct {
	AuditLogID    int64
	CancelledAt   time.Time
	Concert       map[string]any
	ReleasedSeats []string
}

// Cancel releases the user's holds and voids the user's tickets on the
// requested seats, then records the cancellation, all in one transaction.
// eventID may be invalid when the booking refers to an unknown event.
func (s *TicketService) Cancel(ctx context.Context, userID pgtype.UUID, userEmail string, eventID pgtype.UUID, req CancelRequest) (*CancelResult, error) {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	released := []string{}
	concert := map[string]any{}
	if eventID.Valid {
		for _, ref := range req.Seats {
			label, err := s.cancelSeat(ctx, qtx, eventID, userID, strings.TrimSpace(ref))
			if err != nil {
				return nil, err
			}
			if label != "" {
				released = append(released, label)
			}
		}
		if concert, err = eventConcertInfo(ctx, qtx, eventID); err != nil {
			return nil, err
		}
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = defaultCancelReason
	}
	seats := req.Seats
	if seats == nil {
		seats = []string{}
	}
	oldData, err := json.Marshal(map[string]any{
		"bookingId":     req.BookingID,
		"bookingCode":   req.BookingCode,
		"eventId":       req.EventRef,
		"seats":         seats,
		"releasedSeats": released,
		"concert":       concert,
		"userEmail":     userEmail,
		"client": map[string]any{
			"concert":       req.Concert,
			"ticketDetails": req.TicketDetails,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("encode audit data: %w", err)
	}
	newData, err := json.Marshal(map[string]any{
		"status":       "CANCELLED",
		"cancelled_at": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("encode audit data: %w", err)
	}

	entry, err := qtx.CreateAuditLog(ctx, store.CreateAuditLogParams{
		ActorUserID: userID,
		EventID:     eventID,
		Action:      "TICKET_CANCELLED",
		EntityType:  "BOOKING",
		OldData:     oldData,
		NewData:     newData,
		Reason:      pgtype.Text{String: reason, Valid: true},
		RequestID:   pgtype.Text{String: fmt.Sprintf("req_cancel_%d", time.Now().UnixNano()), Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("create audit log: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit cancellation: %w", err)
	}

	return &CancelResult{
		AuditLogID:    entry.ID,
		CancelledAt:   entry.CreatedAt.Time,
		Concert:       mergeConcert(req.Concert, concert),
		ReleasedSeats: released,
	}, nil
}

// cancelSeat frees one seat owned by the user and returns its label, or ""
// when the reference does not match exactly one of the user's seats.
func (s *TicketService) cancelSeat(ctx context.Context, qtx *store.Queries, eventID, userID pgtype.UUID, ref string) (string, error) {
	if ref == "" {
		return "", nil
	}
	matches, err := qtx.FindOwnedEventSeats(ctx, store.FindOwnedEventSeatsParams{EventID: eventID, SeatRef: ref, UserID: userID})
	if err != nil {
		return "", fmt.Errorf("find seat %q: %w", ref, err)
	}
	// A label shared by seats in different zones is ambiguous; leave them untouched.
	if len(matches) != 1 {
		return "", nil
	}
	seat := matches[0]

	releasedHold := true
	if _, err := qtx.ReleaseSeatHold(ctx, store.ReleaseSeatHoldParams{EventID: eventID, SeatID: seat.SeatID, UserID: userID}); err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("release hold: %w", err)
		}
		releasedHold = false
	}
	voided, err := qtx.VoidUserSeatTicket(ctx, store.VoidUserSeatTicketParams{EventID: eventID, SeatID: seat.SeatID, UserID: userID})
	if err != nil {
		return "", fmt.Errorf("void ticket: %w", err)
	}
	// Only reset the seat if this transaction actually released a hold or voided a ticket;
	// otherwise a concurrent expiry/steal may have already reassigned the seat.
	if !releasedHold && voided == 0 {
		return "", nil
	}
	if err := qtx.ResetCancelledSeat(ctx, store.ResetCancelledSeatParams{EventID: eventID, SeatID: seat.SeatID}); err != nil {
		return "", fmt.Errorf("reset seat: %w", err)
	}
	if err := notify(ctx, qtx, SeatUpdateMessage{
		Type:      "seat_released",
		EventID:   store.UUIDToString(eventID),
		SeatID:    store.UUIDToString(seat.SeatID),
		Status:    "AVAILABLE",
		Timestamp: time.Now(),
	}); err != nil {
		return "", fmt.Errorf("notify seat released: %w", err)
	}
	return seat.SeatLabel, nil
}

func eventConcertInfo(ctx context.Context, q *store.Queries, eventID pgtype.UUID) (map[string]any, error) {
	e, err := q.GetEventByID(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return map[string]any{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load event: %w", err)
	}
	info := map[string]any{
		"id":       store.UUIDToString(e.ID),
		"name":     e.Name,
		"title":    e.Name,
		"slug":     e.Slug,
		"venue":    e.VenueName,
		"startsAt": e.StartsAt.Time.Format(time.RFC3339),
		"endsAt":   e.EndsAt.Time.Format(time.RFC3339),
	}
	if e.City.String != "" {
		info["city"] = e.City.String
	}
	if e.Genre.String != "" {
		info["genre"] = e.Genre.String
	}
	if e.VenueAddress.String != "" {
		info["venueAddress"] = e.VenueAddress.String
	}
	return info, nil
}

// mergeConcert overlays server event data on the client's display data.
func mergeConcert(client, server map[string]any) map[string]any {
	out := make(map[string]any, len(client)+len(server))
	for k, v := range client {
		out[k] = v
	}
	for k, v := range server {
		out[k] = v
	}
	return out
}

type CancelledTicketItem struct {
	ID            int64          `json:"id"`
	BookingID     string         `json:"bookingId"`
	BookingCode   string         `json:"bookingCode"`
	EventID       string         `json:"eventId"`
	EventTitle    string         `json:"eventTitle"`
	Concert       map[string]any `json:"concert,omitempty"`
	TicketDetails map[string]any `json:"ticketDetails,omitempty"`
	Seats         []string       `json:"seats"`
	ReleasedSeats []string       `json:"releasedSeats"`
	Reason        string         `json:"reason"`
	CancelledAt   string         `json:"cancelledAt"`
	UserEmail     string         `json:"userEmail"`
}

// ListCancelled returns the user's cancellations since their last demo reset.
func (s *TicketService) ListCancelled(ctx context.Context, userID pgtype.UUID) ([]CancelledTicketItem, error) {
	rows, err := s.queries.ListUserCancelledTickets(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list cancelled tickets: %w", err)
	}
	list := make([]CancelledTicketItem, 0, len(rows))
	for _, r := range rows {
		list = append(list, cancelledItemFromAudit(r))
	}
	return list, nil
}

func cancelledItemFromAudit(r store.ListUserCancelledTicketsRow) CancelledTicketItem {
	item := CancelledTicketItem{
		ID:            r.ID,
		Seats:         []string{},
		ReleasedSeats: []string{},
		Reason:        r.Reason,
		CancelledAt:   r.CreatedAt.Time.Format(time.RFC3339),
	}
	var data struct {
		BookingID     string         `json:"bookingId"`
		BookingCode   string         `json:"bookingCode"`
		EventID       string         `json:"eventId"`
		UserEmail     string         `json:"userEmail"`
		Seats         []string       `json:"seats"`
		ReleasedSeats []string       `json:"releasedSeats"`
		Concert       map[string]any `json:"concert"`
		TicketDetails map[string]any `json:"ticketDetails"` // older records
		Client        struct {
			Concert       map[string]any `json:"concert"`
			TicketDetails map[string]any `json:"ticketDetails"`
		} `json:"client"`
	}
	if len(r.OldData) > 0 {
		_ = json.Unmarshal(r.OldData, &data)
	}
	item.BookingID = data.BookingID
	item.BookingCode = data.BookingCode
	item.EventID = data.EventID
	item.UserEmail = data.UserEmail
	if data.Seats != nil {
		item.Seats = data.Seats
	}
	if data.ReleasedSeats != nil {
		item.ReleasedSeats = data.ReleasedSeats
	}
	if c := mergeConcert(data.Client.Concert, data.Concert); len(c) > 0 {
		item.Concert = c
	}
	item.TicketDetails = data.Client.TicketDetails
	if item.TicketDetails == nil {
		item.TicketDetails = data.TicketDetails
	}

	item.EventTitle = firstString(item.Concert["name"], item.Concert["title"], item.TicketDetails["eventTitle"])
	if item.EventTitle == "" {
		item.EventTitle = "Concert"
	}
	return item
}

func firstString(vals ...any) string {
	for _, v := range vals {
		if s, ok := v.(string); ok && s != "" {
			return s
		}
	}
	return ""
}

type AuditItem struct {
	ID         int64          `json:"id"`
	Action     string         `json:"action"`
	EntityType string         `json:"entityType"`
	Reason     string         `json:"reason"`
	CreatedAt  string         `json:"createdAt"`
	ActorEmail string         `json:"actorEmail"`
	EventName  string         `json:"eventName"`
	Concert    map[string]any `json:"concert,omitempty"`
	OldData    map[string]any `json:"oldData,omitempty"`
	NewData    map[string]any `json:"newData,omitempty"`
}

// ListAuditLogs returns recent audit entries for the organizer's events, or all entries for admins.
func (s *TicketService) ListAuditLogs(ctx context.Context, userID pgtype.UUID, isAdmin bool) ([]AuditItem, error) {
	rows, err := s.queries.ListStaffAuditLogs(ctx, store.ListStaffAuditLogsParams{IsAdmin: isAdmin, OrganizerID: userID})
	if err != nil {
		return nil, fmt.Errorf("list audit logs: %w", err)
	}
	items := make([]AuditItem, 0, len(rows))
	for _, r := range rows {
		item := AuditItem{
			ID:         r.ID,
			Action:     r.Action,
			EntityType: r.EntityType,
			Reason:     r.Reason,
			CreatedAt:  r.CreatedAt.Time.Format(time.RFC3339),
			ActorEmail: r.ActorEmail,
			EventName:  r.EventName,
		}
		if len(r.OldData) > 0 {
			_ = json.Unmarshal(r.OldData, &item.OldData)
			if c, ok := item.OldData["concert"].(map[string]any); ok {
				item.Concert = c
			}
		}
		if len(r.NewData) > 0 {
			_ = json.Unmarshal(r.NewData, &item.NewData)
		}
		items = append(items, item)
	}
	return items, nil
}

// ResetDemo releases the user's active holds and appends a DEMO_RESET entry,
// which hides earlier cancellations without touching the append-only audit log.
func (s *TicketService) ResetDemo(ctx context.Context, userID pgtype.UUID) error {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	released, err := qtx.ReleaseUserActiveHolds(ctx, userID)
	if err != nil {
		return fmt.Errorf("release holds: %w", err)
	}
	for _, r := range released {
		if err := notify(ctx, qtx, SeatUpdateMessage{
			Type:      "seat_released",
			EventID:   store.UUIDToString(r.RelEventID),
			SeatID:    store.UUIDToString(r.RelSeatID),
			Status:    "AVAILABLE",
			Timestamp: time.Now(),
		}); err != nil {
			return fmt.Errorf("notify seat released: %w", err)
		}
	}

	newData, err := json.Marshal(map[string]any{"releasedHolds": len(released)})
	if err != nil {
		return fmt.Errorf("encode audit data: %w", err)
	}
	if _, err := qtx.CreateAuditLog(ctx, store.CreateAuditLogParams{
		ActorUserID: userID,
		Action:      "DEMO_RESET",
		EntityType:  "USER",
		EntityID:    userID,
		NewData:     newData,
		RequestID:   pgtype.Text{String: fmt.Sprintf("req_reset_%d", time.Now().UnixNano()), Valid: true},
	}); err != nil {
		return fmt.Errorf("create audit log: %w", err)
	}
	return tx.Commit(ctx)
}
