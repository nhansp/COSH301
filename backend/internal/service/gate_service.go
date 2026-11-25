package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Gate codes rotate every qrPeriod. A code is accepted during its own window and
// the one after, so a screenshot stops working within a minute.
const (
	qrPeriod     = 30 * time.Second
	qrPrefix     = "COSH301T1"
	qrSigHexLen  = 20
	qrAcceptBack = 1
)

var (
	ErrTicketNotFound  = errors.New("ticket_not_found")
	ErrTicketNotUsable = errors.New("ticket_not_usable")
)

type GateService struct {
	dbPool  *pgxpool.Pool
	queries *store.Queries
	now     func() time.Time
}

func NewGateService(dbPool *pgxpool.Pool, queries *store.Queries) *GateService {
	return &GateService{dbPool: dbPool, queries: queries, now: time.Now}
}

// TicketQR is the code a ticket shows right now and when it stops being shown.
type TicketQR struct {
	Payload   string    `json:"payload"`
	ExpiresAt time.Time `json:"expiresAt"`
	PeriodSec int       `json:"periodSec"`
}

// CheckinOutcome is what the gate sees after a scan.
type CheckinOutcome struct {
	Result        store.CheckinResult `json:"result"`
	EventID       string              `json:"eventId,omitempty"`
	EventName     string              `json:"eventName,omitempty"`
	SeatLabel     string              `json:"seatLabel,omitempty"`
	ZoneName      string              `json:"zoneName,omitempty"`
	TicketCode    string              `json:"ticketCode,omitempty"`
	Holder        string              `json:"holder,omitempty"`
	ScannedAt     *time.Time          `json:"scannedAt,omitempty"`
	FirstUsedAt   *time.Time          `json:"firstUsedAt,omitempty"`
	WrongEvent    bool                `json:"wrongEvent,omitempty"`
	EventCheckins int                 `json:"eventCheckins,omitempty"`
}

// TicketTopic is the realtime hub key a ticket's owner listens on.
func TicketTopic(ticketID string) string { return "ticket:" + ticketID }

// TicketUsedMessage tells the owner's screen that the gate just admitted the
// ticket. EventID carries the hub topic, as the hub routes on that field.
type TicketUsedMessage struct {
	Type     string    `json:"type"`
	EventID  string    `json:"eventId"`
	TicketID string    `json:"ticketId"`
	UsedAt   time.Time `json:"usedAt"`
}

func qrWindow(t time.Time) int64 { return t.Unix() / int64(qrPeriod/time.Second) }

func qrSignature(secret, ticketID string, window int64) string {
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%s.%d", ticketID, window)
	return hex.EncodeToString(mac.Sum(nil))[:qrSigHexLen]
}

func qrPayload(secret, ticketID string, window int64) string {
	return fmt.Sprintf("%s.%s.%d.%s", qrPrefix, ticketID, window, qrSignature(secret, ticketID, window))
}

// parseQR splits a payload into ticket id, window and signature without trusting any of them.
func parseQR(payload string) (pgtype.UUID, string, int64, string, bool) {
	parts := strings.Split(strings.TrimSpace(payload), ".")
	if len(parts) != 4 || parts[0] != qrPrefix || len(parts[3]) != qrSigHexLen {
		return pgtype.UUID{}, "", 0, "", false
	}
	id, err := store.StringToUUID(parts[1])
	if err != nil {
		return pgtype.UUID{}, "", 0, "", false
	}
	window, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		return pgtype.UUID{}, "", 0, "", false
	}
	return id, parts[1], window, parts[3], true
}

// CurrentQR returns the rotating code of a ticket the caller owns. The ticket's
// secret never leaves the server.
func (s *GateService) CurrentQR(ctx context.Context, userID, ticketID pgtype.UUID) (*TicketQR, error) {
	t, err := s.queries.GetOwnedTicketSecret(ctx, store.GetOwnedTicketSecretParams{ID: ticketID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTicketNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load ticket: %w", err)
	}
	if t.Status != store.TicketStatusISSUED && t.Status != store.TicketStatusACTIVE {
		return nil, ErrTicketNotUsable
	}
	now := s.now()
	window := qrWindow(now)
	return &TicketQR{
		Payload:   qrPayload(t.QrSecret, store.UUIDToString(t.ID), window),
		ExpiresAt: time.Unix((window+1)*int64(qrPeriod/time.Second), 0).UTC(),
		PeriodSec: int(qrPeriod / time.Second),
	}, nil
}

// OwnsTicket reports ErrTicketNotFound unless the ticket belongs to the user.
func (s *GateService) OwnsTicket(ctx context.Context, userID, ticketID pgtype.UUID) error {
	_, err := s.queries.GetOwnedTicketSecret(ctx, store.GetOwnedTicketSecretParams{ID: ticketID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrTicketNotFound
	}
	return err
}

// CheckIn verifies a scanned code and admits the ticket at most once. When
// eventID is set, a ticket for another event is refused. Every scan of a known
// ticket is recorded in checkins.
func (s *GateService) CheckIn(ctx context.Context, payload string, eventID pgtype.UUID) (*CheckinOutcome, error) {
	ticketID, idText, window, sig, ok := parseQR(payload)
	if !ok {
		return &CheckinOutcome{Result: store.CheckinResultINVALID}, nil
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	q := s.queries.WithTx(tx)

	t, err := q.LockTicketForCheckin(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return &CheckinOutcome{Result: store.CheckinResultINVALID}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("lock ticket: %w", err)
	}

	out := &CheckinOutcome{
		EventID:    store.UUIDToString(t.EventID),
		EventName:  t.EventName,
		SeatLabel:  t.SeatLabel,
		ZoneName:   t.ZoneName,
		TicketCode: t.TicketCode,
		Holder:     maskHolder(t.Holder),
	}
	now := qrWindow(s.now())
	signed := hmac.Equal([]byte(sig), []byte(qrSignature(t.QrSecret, idText, window)))
	fresh := window <= now && window >= now-qrAcceptBack

	switch {
	case !signed || !fresh:
		// A forged or expired code says nothing reliable about the ticket.
		out = &CheckinOutcome{Result: store.CheckinResultINVALID}
	case eventID.Valid && eventID != t.EventID:
		out.Result = store.CheckinResultINVALID
		out.WrongEvent = true
	case t.Status == store.TicketStatusUSED:
		out.Result = store.CheckinResultALREADYUSED
		if first, err := q.FirstValidCheckin(ctx, t.ID); err == nil && first.Valid {
			ts := first.Time
			out.FirstUsedAt = &ts
		}
	case t.Status != store.TicketStatusISSUED && t.Status != store.TicketStatusACTIVE:
		out.Result = store.CheckinResultVOID
	default:
		out.Result = store.CheckinResultVALID
		if err := q.MarkTicketUsed(ctx, t.ID); err != nil {
			return nil, fmt.Errorf("mark used: %w", err)
		}
		// Delivered only if the transaction commits.
		msg, _ := json.Marshal(TicketUsedMessage{
			Type: "ticket_used", EventID: TicketTopic(idText), TicketID: idText, UsedAt: s.now().UTC(),
		})
		if err := q.NotifyChannel(ctx, store.NotifyChannelParams{PgNotify: SeatNotificationChannel, PgNotify_2: string(msg)}); err != nil {
			return nil, fmt.Errorf("notify ticket used: %w", err)
		}
	}

	if signed {
		at, err := q.InsertCheckin(ctx, store.InsertCheckinParams{TicketID: t.ID, EventID: t.EventID, Result: out.Result})
		if err != nil {
			return nil, fmt.Errorf("record checkin: %w", err)
		}
		if at.Valid {
			ts := at.Time
			out.ScannedAt = &ts
		}
		if out.Result == store.CheckinResultVALID {
			out.FirstUsedAt = out.ScannedAt
		}
	}
	if out.EventID != "" {
		if n, err := q.CountEventCheckins(ctx, t.EventID); err == nil {
			out.EventCheckins = int(n)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return out, nil
}

// maskHolder keeps enough of a name, phone or email for staff to match a person
// without showing the full contact.
func maskHolder(h string) string {
	r := []rune(h)
	switch {
	case strings.Contains(h, "@"):
		at := strings.Index(h, "@")
		if at <= 2 {
			return "***" + h[at:]
		}
		return h[:2] + "***" + h[at:]
	case len(r) >= 8 && strings.Trim(h, "+0123456789 ") == "":
		return string(r[:len(r)-7]) + "****" + string(r[len(r)-3:])
	default:
		return h
	}
}
