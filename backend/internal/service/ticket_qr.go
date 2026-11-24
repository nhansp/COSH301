package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrTicketNotFound  = errors.New("ticket_not_found")
	ErrTicketForbidden = errors.New("ticket_forbidden")
	ErrTicketInactive  = errors.New("ticket_inactive")
)

type UserTicketDTO struct {
	ID            string `json:"id"`
	OrderID       string `json:"orderId"`
	OrderCode     string `json:"orderCode"`
	EventID       string `json:"eventId"`
	EventSlug     string `json:"eventSlug"`
	EventName     string `json:"eventName"`
	EventStartsAt string `json:"eventStartsAt"`
	EventCity     string `json:"eventCity"`
	EventImageURL string `json:"eventImageUrl,omitempty"`
	VenueName     string `json:"venueName"`
	VenueAddress  string `json:"venueAddress,omitempty"`
	SeatID        string `json:"seatId"`
	SeatLabel     string `json:"seatLabel"`
	RowLabel      string `json:"rowLabel,omitempty"`
	SeatNumber    string `json:"seatNumber,omitempty"`
	ZoneID        string `json:"zoneId"`
	ZoneCode      string `json:"zoneCode"`
	ZoneName      string `json:"zoneName"`
	Price         int64  `json:"price"`
	PaymentMethod string `json:"paymentMethod,omitempty"`
	TicketCode    string `json:"ticketCode"`
	Status        string `json:"status"`
	IssuedAt      string `json:"issuedAt"`
	PaidAt        string `json:"paidAt,omitempty"`
}

type TicketQRDTO struct {
	TicketID   string `json:"ticketId"`
	TicketCode string `json:"ticketCode"`
	Payload    string `json:"payload"`
	Status     string `json:"status"`
}

type QRVerifyResult struct {
	Valid      bool   `json:"valid"`
	Reason     string `json:"reason"`
	TicketID   string `json:"ticketId,omitempty"`
	TicketCode string `json:"ticketCode,omitempty"`
	EventName  string `json:"eventName,omitempty"`
	SeatLabel  string `json:"seatLabel,omitempty"`
	ZoneName   string `json:"zoneName,omitempty"`
	Status     string `json:"status,omitempty"`
}

// GenerateQRSecret creates a 256-bit cryptographically random hex secret for a ticket.
func GenerateQRSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func computeFixedQRSignature(ticketCode, qrSecret string) string {
	mac := hmac.New(sha256.New, []byte(qrSecret))
	_, _ = fmt.Fprint(mac, ticketCode)
	return hex.EncodeToString(mac.Sum(nil)[:16])
}

// GenerateFixedQRPayload builds a deterministic, non-expiring HMAC-signed payload: ticket_code.sig.
func GenerateFixedQRPayload(ticketCode, qrSecret string) string {
	return fmt.Sprintf("%s.%s", ticketCode, computeFixedQRSignature(ticketCode, qrSecret))
}

// ParseFixedQRPayload splits ticket_code.sig without verifying the MAC.
func ParseFixedQRPayload(payload string) (ticketCode, sig string, ok bool) {
	parts := strings.Split(strings.TrimSpace(payload), ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// VerifyFixedQRPayload checks the fixed ticket QR signature in constant time.
func VerifyFixedQRPayload(payload, qrSecret string) (ticketCode string, valid bool, reason string) {
	ticketCode, sig, ok := ParseFixedQRPayload(payload)
	if !ok {
		return "", false, "invalid_format"
	}
	expected := computeFixedQRSignature(ticketCode, qrSecret)
	if !hmac.Equal([]byte(strings.ToLower(sig)), []byte(expected)) {
		return ticketCode, false, "invalid_signature"
	}
	return ticketCode, true, "valid"
}

// ListMyTickets returns all active/issued/used tickets belonging to the caller.
func (s *TicketService) ListMyTickets(ctx context.Context, userID pgtype.UUID) ([]UserTicketDTO, error) {
	rows, err := s.queries.ListUserTickets(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list user tickets: %w", err)
	}
	out := make([]UserTicketDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, userTicketFromRow(r))
	}
	return out, nil
}

func userTicketFromRow(r store.ListUserTicketsRow) UserTicketDTO {
	price, _ := r.SeatPrice.Int64Value()
	dto := UserTicketDTO{
		ID:            store.UUIDToString(r.ID),
		OrderID:       store.UUIDToString(r.OrderID),
		OrderCode:     r.OrderCode,
		EventID:       store.UUIDToString(r.EventID),
		EventSlug:     r.EventSlug,
		EventName:     r.EventName,
		EventStartsAt: r.EventStartsAt.Time.UTC().Format(time.RFC3339),
		EventCity:     r.EventCity.String,
		EventImageURL: r.EventImageUrl.String,
		VenueName:     r.VenueName,
		VenueAddress:  r.VenueAddress.String,
		SeatID:        store.UUIDToString(r.SeatID),
		SeatLabel:     r.SeatLabel,
		RowLabel:      r.RowLabel.String,
		SeatNumber:    r.SeatNumber.String,
		ZoneID:        store.UUIDToString(r.ZoneID),
		ZoneCode:      r.ZoneCode,
		ZoneName:      r.ZoneName,
		Price:         price.Int64,
		PaymentMethod: r.PaymentMethod.String,
		TicketCode:    r.TicketCode,
		Status:        string(r.Status),
		IssuedAt:      r.IssuedAt.Time.UTC().Format(time.RFC3339),
	}
	if r.PaidAt.Valid {
		dto.PaidAt = r.PaidAt.Time.UTC().Format(time.RFC3339)
	}
	return dto
}

func userTicketFromOrderRow(r store.ListOrderTicketsRow) UserTicketDTO {
	price, _ := r.SeatPrice.Int64Value()
	dto := UserTicketDTO{
		ID:            store.UUIDToString(r.ID),
		OrderID:       store.UUIDToString(r.OrderID),
		OrderCode:     r.OrderCode,
		EventID:       store.UUIDToString(r.EventID),
		EventSlug:     r.EventSlug,
		EventName:     r.EventName,
		EventStartsAt: r.EventStartsAt.Time.UTC().Format(time.RFC3339),
		EventCity:     r.EventCity.String,
		EventImageURL: r.EventImageUrl.String,
		VenueName:     r.VenueName,
		VenueAddress:  r.VenueAddress.String,
		SeatID:        store.UUIDToString(r.SeatID),
		SeatLabel:     r.SeatLabel,
		RowLabel:      r.RowLabel.String,
		SeatNumber:    r.SeatNumber.String,
		ZoneID:        store.UUIDToString(r.ZoneID),
		ZoneCode:      r.ZoneCode,
		ZoneName:      r.ZoneName,
		Price:         price.Int64,
		PaymentMethod: r.PaymentMethod.String,
		TicketCode:    r.TicketCode,
		Status:        string(r.Status),
		IssuedAt:      r.IssuedAt.Time.UTC().Format(time.RFC3339),
	}
	if r.PaidAt.Valid {
		dto.PaidAt = r.PaidAt.Time.UTC().Format(time.RFC3339)
	}
	return dto
}

// GetFixedQR returns the deterministic fixed QR payload for an active ticket.
func (s *TicketService) GetFixedQR(ctx context.Context, ticketID, callerID pgtype.UUID, isStaff bool) (*TicketQRDTO, error) {
	t, err := s.queries.GetTicketDetailByID(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTicketNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load ticket: %w", err)
	}
	if !isStaff && t.UserID != callerID {
		return nil, ErrTicketForbidden
	}
	if t.Status != store.TicketStatusISSUED && t.Status != store.TicketStatusACTIVE {
		return nil, ErrTicketInactive
	}

	return &TicketQRDTO{
		TicketID:   store.UUIDToString(t.ID),
		TicketCode: t.TicketCode,
		Payload:    GenerateFixedQRPayload(t.TicketCode, t.QrSecret),
		Status:     string(t.Status),
	}, nil
}

// VerifyTicketQR validates a scanned fixed QR payload against the stored ticket secret.
func (s *TicketService) VerifyTicketQR(ctx context.Context, payload string) (*QRVerifyResult, error) {
	ticketCode, _, ok := ParseFixedQRPayload(payload)
	if !ok {
		return &QRVerifyResult{Valid: false, Reason: "invalid_format"}, nil
	}
	t, err := s.queries.GetTicketByCode(ctx, ticketCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return &QRVerifyResult{Valid: false, Reason: "ticket_not_found", TicketCode: ticketCode}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("lookup ticket by code: %w", err)
	}
	base := &QRVerifyResult{
		TicketID:   store.UUIDToString(t.ID),
		TicketCode: t.TicketCode,
		EventName:  t.EventName,
		SeatLabel:  t.SeatLabel,
		ZoneName:   t.ZoneName,
		Status:     string(t.Status),
	}
	switch t.Status {
	case store.TicketStatusUSED:
		base.Reason = "already_used"
		return base, nil
	case store.TicketStatusVOID, store.TicketStatusREVOKED:
		base.Reason = "ticket_void"
		return base, nil
	}

	_, valid, reason := VerifyFixedQRPayload(payload, t.QrSecret)
	base.Valid = valid
	base.Reason = reason
	return base, nil
}
