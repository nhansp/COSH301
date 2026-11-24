package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNoActiveHolds        = errors.New("no_active_holds")
	ErrOrderNotFound        = errors.New("order_not_found")
	ErrOrderForbidden       = errors.New("order_forbidden")
	ErrOrderNotPending      = errors.New("order_not_pending")
	ErrOrderExpired         = errors.New("order_expired")
	ErrInvalidProvider      = errors.New("invalid_payment_provider")
	ErrPaymentNotFound      = errors.New("payment_not_found")
	ErrInvalidIPNSignature  = errors.New("invalid_signature")
	ErrAmountMismatch       = errors.New("amount_mismatch")
	ErrSeatConflictRefunded = errors.New("seat_conflict_refunded")
)

var allowedProviders = map[string]bool{
	"MOMO":   true,
	"VNPAY":  true,
	"VIETQR": true,
}

type PaymentService struct {
	dbPool        *pgxpool.Pool
	queries       *store.Queries
	webhookSecret string
	demoMode      bool
}

func NewPaymentService(dbPool *pgxpool.Pool, queries *store.Queries, webhookSecret string, demoMode bool) *PaymentService {
	return &PaymentService{
		dbPool:        dbPool,
		queries:       queries,
		webhookSecret: webhookSecret,
		demoMode:      demoMode,
	}
}

// ServiceFeeOf matches frontend's 3% service fee rounding (Math.round(subtotal * 0.03)).
func ServiceFeeOf(subtotal int64) int64 {
	if subtotal <= 0 {
		return 0
	}
	return (subtotal*3 + 50) / 100
}

type OrderItemDTO struct {
	SeatID    string `json:"seatId"`
	SeatLabel string `json:"seatLabel"`
	ZoneID    string `json:"zoneId"`
	ZoneCode  string `json:"zoneCode"`
	ZoneName  string `json:"zoneName"`
	Price     int64  `json:"price"`
}

type PaymentSummaryDTO struct {
	ID            string `json:"id"`
	PaymentCode   string `json:"paymentCode"`
	Provider      string `json:"provider"`
	ProviderTxnID string `json:"providerTxnId,omitempty"`
	Amount        int64  `json:"amount"`
	Status        string `json:"status"`
	CreatedAt     string `json:"createdAt"`
}

type OrderDTO struct {
	ID             string              `json:"id"`
	OrderCode      string              `json:"orderCode"`
	EventID        string              `json:"eventId"`
	EventSlug      string              `json:"eventSlug"`
	EventName      string              `json:"eventName"`
	EventStartsAt  string              `json:"eventStartsAt"`
	VenueName      string              `json:"venueName"`
	Status         string              `json:"status"`
	SubtotalAmount int64               `json:"subtotalAmount"`
	ServiceFee     int64               `json:"serviceFee"`
	DiscountAmount int64               `json:"discountAmount"`
	FinalAmount    int64               `json:"finalAmount"`
	Currency       string              `json:"currency"`
	PaymentMethod  string              `json:"paymentMethod,omitempty"`
	ExpiresAt      string              `json:"expiresAt"`
	PaidAt         string              `json:"paidAt,omitempty"`
	CreatedAt      string              `json:"createdAt"`
	Items          []OrderItemDTO      `json:"items"`
	Payments       []PaymentSummaryDTO `json:"payments,omitempty"`
	Tickets        []UserTicketDTO     `json:"tickets,omitempty"`
}

type PaymentSessionDTO struct {
	PaymentID            string `json:"paymentId"`
	PaymentCode          string `json:"paymentCode"`
	OrderID              string `json:"orderId"`
	OrderCode            string `json:"orderCode"`
	Provider             string `json:"provider"`
	Amount               int64  `json:"amount"`
	Currency             string `json:"currency"`
	Status               string `json:"status"`
	ExpiresAt            string `json:"expiresAt"`
	IPNUrl               string `json:"ipnUrl"`
	ReturnUrl            string `json:"returnUrl"`
	SandboxMode          bool   `json:"sandboxMode"`
	SandboxTxnID         string `json:"sandboxTxnId,omitempty"`
	SandboxSignature     string `json:"sandboxSignature,omitempty"`
	SandboxFailTxnID     string `json:"sandboxFailTxnId,omitempty"`
	SandboxFailSignature string `json:"sandboxFailSignature,omitempty"`
}

type IPNRequest struct {
	PaymentCode   string `json:"paymentCode"`
	ProviderTxnID string `json:"providerTxnId"`
	Amount        int64  `json:"amount"`
	Result        string `json:"result"` // "SUCCESS" or "FAILED"
	Signature     string `json:"signature"`
}

type IPNResult struct {
	Idempotent bool      `json:"idempotent"`
	Status     string    `json:"status"`
	Order      *OrderDTO `json:"order"`
}

func randomHexUpper(numBytes int) string {
	b := make([]byte, numBytes)
	_, _ = rand.Read(b)
	return strings.ToUpper(hex.EncodeToString(b))
}

func int64ToNumeric(v int64) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(v), Exp: 0, Valid: true}
}

func numericToInt64(n pgtype.Numeric) int64 {
	if !n.Valid {
		return 0
	}
	v, _ := n.Int64Value()
	return v.Int64
}

// SignIPN computes the canonical HMAC-SHA256 signature for a payment IPN callback.
func (s *PaymentService) SignIPN(provider, paymentCode, providerTxnID string, amount int64, result string) string {
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	_, _ = fmt.Fprintf(mac, "%s|%s|%s|%d|%s",
		strings.ToUpper(strings.TrimSpace(provider)),
		strings.TrimSpace(paymentCode),
		strings.TrimSpace(providerTxnID),
		amount,
		strings.ToUpper(strings.TrimSpace(result)),
	)
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyIPNSignature checks the webhook HMAC-SHA256 signature in constant time.
func (s *PaymentService) VerifyIPNSignature(provider, paymentCode, providerTxnID string, amount int64, result, signature string) bool {
	if s.webhookSecret == "" || signature == "" {
		return false
	}
	expected := s.SignIPN(provider, paymentCode, providerTxnID, amount, result)
	return hmac.Equal([]byte(strings.ToLower(strings.TrimSpace(signature))), []byte(expected))
}

// CreateOrder snapshots the caller's active holds for an event into a PENDING order.
func (s *PaymentService) CreateOrder(ctx context.Context, userID, eventID pgtype.UUID, requestedSeatIDs []string, paymentMethod string) (*OrderDTO, error) {
	method := strings.ToUpper(strings.TrimSpace(paymentMethod))
	if method != "" && !allowedProviders[method] {
		return nil, ErrInvalidProvider
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin order tx: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	if err := qtx.LockUserEventAdvisory(ctx, store.LockUserEventAdvisoryParams{
		Column1: store.UUIDToString(userID),
		Column2: store.UUIDToString(eventID),
	}); err != nil {
		return nil, fmt.Errorf("advisory lock: %w", err)
	}

	holds, err := qtx.ListActiveHoldsForOrder(ctx, store.ListActiveHoldsForOrderParams{
		EventID: eventID,
		UserID:  userID,
	})
	if err != nil {
		return nil, fmt.Errorf("list active holds: %w", err)
	}

	if len(requestedSeatIDs) > 0 {
		wanted := make(map[string]bool, len(requestedSeatIDs))
		for _, id := range requestedSeatIDs {
			wanted[strings.TrimSpace(id)] = true
		}
		filtered := make([]store.ListActiveHoldsForOrderRow, 0, len(holds))
		for _, h := range holds {
			if wanted[store.UUIDToString(h.SeatID)] {
				filtered = append(filtered, h)
			}
		}
		holds = filtered
	}
	if len(holds) == 0 {
		return nil, ErrNoActiveHolds
	}

	var subtotal int64
	earliestExpiry := holds[0].ExpiresAt.Time
	for _, h := range holds {
		subtotal += numericToInt64(h.CurrentPrice)
		if h.ExpiresAt.Time.Before(earliestExpiry) {
			earliestExpiry = h.ExpiresAt.Time
		}
	}
	fee := ServiceFeeOf(subtotal)
	finalAmount := subtotal + fee
	orderCode := fmt.Sprintf("SMS-%s-%s", time.Now().UTC().Format("060102"), randomHexUpper(3))

	order, err := qtx.CreateOrder(ctx, store.CreateOrderParams{
		EventID:        eventID,
		UserID:         userID,
		OrderCode:      orderCode,
		TotalAmount:    int64ToNumeric(subtotal),
		DiscountAmount: int64ToNumeric(0),
		FinalAmount:    int64ToNumeric(finalAmount),
		PaymentMethod:  pgtype.Text{String: method, Valid: method != ""},
		ExpiresAt:      pgtype.Timestamptz{Time: earliestExpiry, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}

	for _, h := range holds {
		if _, err := qtx.CreateOrderItem(ctx, store.CreateOrderItemParams{
			OrderID: order.ID,
			SeatID:  h.SeatID,
			Price:   h.CurrentPrice,
		}); err != nil {
			return nil, fmt.Errorf("create order item: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit order: %w", err)
	}

	return s.loadOrderDTO(ctx, s.queries, order.ID)
}

// GetOrder loads an order owned by the caller (or any order for admin).
func (s *PaymentService) GetOrder(ctx context.Context, userID, orderID pgtype.UUID, isAdmin bool) (*OrderDTO, error) {
	row, err := s.queries.GetOrderWithEvent(ctx, orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOrderNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load order: %w", err)
	}
	if !isAdmin && row.UserID != userID {
		return nil, ErrOrderForbidden
	}
	return s.assembleOrderDTO(ctx, s.queries, row)
}

// ListOrders returns the caller's recent orders.
func (s *PaymentService) ListOrders(ctx context.Context, userID pgtype.UUID) ([]OrderDTO, error) {
	rows, err := s.queries.ListUserOrders(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list user orders: %w", err)
	}
	out := make([]OrderDTO, 0, len(rows))
	for _, r := range rows {
		dto, err := s.assembleOrderDTO(ctx, s.queries, store.GetOrderWithEventRow(r))
		if err != nil {
			return nil, err
		}
		out = append(out, *dto)
	}
	return out, nil
}

// InitiatePayment creates an INITIATED payment row for a PENDING order and returns
// gateway session details (including signed sandbox IPN tokens when running in dev/demo mode).
func (s *PaymentService) InitiatePayment(ctx context.Context, userID, orderID pgtype.UUID, provider string) (*PaymentSessionDTO, error) {
	prov := strings.ToUpper(strings.TrimSpace(provider))
	if !allowedProviders[prov] {
		return nil, ErrInvalidProvider
	}

	order, err := s.queries.GetOrderWithEvent(ctx, orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOrderNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load order: %w", err)
	}
	if order.UserID != userID {
		return nil, ErrOrderForbidden
	}
	if order.Status != store.OrderStatusPENDING {
		return nil, ErrOrderNotPending
	}
	if time.Now().UTC().After(order.ExpiresAt.Time) {
		return nil, ErrOrderExpired
	}

	amount := numericToInt64(order.FinalAmount)
	paymentCode := fmt.Sprintf("PAY-%s-%s", prov, randomHexUpper(4))
	initRaw, _ := json.Marshal(map[string]any{
		"orderCode": order.OrderCode,
		"provider":  prov,
		"sandbox":   s.demoMode,
	})

	pay, err := s.queries.CreatePayment(ctx, store.CreatePaymentParams{
		OrderID:     order.ID,
		PaymentCode: paymentCode,
		Provider:    prov,
		Amount:      order.FinalAmount,
		RawResponse: initRaw,
	})
	if err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}

	provLower := strings.ToLower(prov)
	session := &PaymentSessionDTO{
		PaymentID:   store.UUIDToString(pay.ID),
		PaymentCode: pay.PaymentCode,
		OrderID:     store.UUIDToString(order.ID),
		OrderCode:   order.OrderCode,
		Provider:    prov,
		Amount:      amount,
		Currency:    order.Currency,
		Status:      string(pay.Status),
		ExpiresAt:   order.ExpiresAt.Time.UTC().Format(time.RFC3339),
		IPNUrl:      fmt.Sprintf("/api/payments/%s/ipn", provLower),
		ReturnUrl:   fmt.Sprintf("/api/payments/%s/return?orderId=%s&paymentCode=%s", provLower, store.UUIDToString(order.ID), pay.PaymentCode),
		SandboxMode: s.demoMode,
	}

	if s.demoMode {
		okTxn := fmt.Sprintf("%s-TXN-%s", prov, randomHexUpper(4))
		failTxn := fmt.Sprintf("%s-FAIL-%s", prov, randomHexUpper(4))
		session.SandboxTxnID = okTxn
		session.SandboxSignature = s.SignIPN(prov, pay.PaymentCode, okTxn, amount, "SUCCESS")
		session.SandboxFailTxnID = failTxn
		session.SandboxFailSignature = s.SignIPN(prov, pay.PaymentCode, failTxn, amount, "FAILED")
	}

	return session, nil
}

// ProcessIPN handles an HMAC-signed gateway callback idempotently (FR-13, FR-15, NFR-04).
// On SUCCESS, it converts holds to SOLD seats, issues active tickets with rotating QR secrets,
// logs the audit entry, and emits SSE seat_sold notifications.
func (s *PaymentService) ProcessIPN(ctx context.Context, provider string, req IPNRequest) (*IPNResult, error) {
	prov := strings.ToUpper(strings.TrimSpace(provider))
	if !allowedProviders[prov] {
		return nil, ErrInvalidProvider
	}
	resStatus := strings.ToUpper(strings.TrimSpace(req.Result))
	if resStatus == "" {
		resStatus = "SUCCESS"
	}
	if !s.VerifyIPNSignature(prov, req.PaymentCode, req.ProviderTxnID, req.Amount, resStatus, req.Signature) {
		return nil, ErrInvalidIPNSignature
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin ipn tx: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	// Fast idempotency check by (provider, provider_txn_id).
	if req.ProviderTxnID != "" {
		if existing, err := qtx.GetPaymentByProviderTxn(ctx, store.GetPaymentByProviderTxnParams{
			Provider:      prov,
			ProviderTxnID: pgtype.Text{String: req.ProviderTxnID, Valid: true},
		}); err == nil {
			if err := tx.Commit(ctx); err != nil {
				return nil, fmt.Errorf("commit idempotent check: %w", err)
			}
			orderDTO, err := s.loadOrderDTO(ctx, s.queries, existing.OrderID)
			if err != nil {
				return nil, err
			}
			return &IPNResult{
				Idempotent: true,
				Status:     string(existing.Status),
				Order:      orderDTO,
			}, nil
		}
	}

	pay, err := qtx.GetPaymentByCodeForUpdate(ctx, req.PaymentCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPaymentNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock payment: %w", err)
	}
	if strings.ToUpper(pay.Provider) != prov {
		return nil, ErrInvalidProvider
	}
	expectedAmt := numericToInt64(pay.Amount)
	if req.Amount != expectedAmt {
		return nil, ErrAmountMismatch
	}

	// Already finalized: treat duplicate IPN as idempotent.
	if pay.Status == store.PaymentStatusSUCCESS {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit idempotent payment: %w", err)
		}
		orderDTO, err := s.loadOrderDTO(ctx, s.queries, pay.OrderID)
		if err != nil {
			return nil, err
		}
		return &IPNResult{Idempotent: true, Status: string(pay.Status), Order: orderDTO}, nil
	}

	order, err := qtx.GetOrderByIDForUpdate(ctx, pay.OrderID)
	if err != nil {
		return nil, fmt.Errorf("lock order: %w", err)
	}

	rawIPN, _ := json.Marshal(map[string]any{
		"paymentCode":   req.PaymentCode,
		"providerTxnId": req.ProviderTxnID,
		"amount":        req.Amount,
		"result":        resStatus,
		"processedAt":   time.Now().UTC().Format(time.RFC3339),
	})

	if resStatus != "SUCCESS" {
		if _, err := qtx.UpdatePaymentResult(ctx, store.UpdatePaymentResultParams{
			ID:            pay.ID,
			Status:        store.PaymentStatusFAILED,
			ProviderTxnID: pgtype.Text{String: req.ProviderTxnID, Valid: req.ProviderTxnID != ""},
			RawResponse:   rawIPN,
		}); err != nil {
			return nil, fmt.Errorf("mark payment failed: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit failed payment: %w", err)
		}
		orderDTO, err := s.loadOrderDTO(ctx, s.queries, order.ID)
		if err != nil {
			return nil, err
		}
		return &IPNResult{Idempotent: false, Status: string(store.PaymentStatusFAILED), Order: orderDTO}, nil
	}

	// Order already PAID via another payment attempt -> idempotent return.
	if order.Status == store.OrderStatusPAID {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit already paid: %w", err)
		}
		orderDTO, err := s.loadOrderDTO(ctx, s.queries, order.ID)
		if err != nil {
			return nil, err
		}
		return &IPNResult{Idempotent: true, Status: string(store.PaymentStatusSUCCESS), Order: orderDTO}, nil
	}

	// Serialize with HoldSeat and TicketService.Cancel for the same (user, event).
	if err := qtx.LockUserEventAdvisory(ctx, store.LockUserEventAdvisoryParams{
		Column1: store.UUIDToString(order.UserID),
		Column2: store.UUIDToString(order.EventID),
	}); err != nil {
		return nil, fmt.Errorf("advisory lock: %w", err)
	}

	items, err := qtx.ListOrderItemsWithSeats(ctx, order.ID)
	if err != nil {
		return nil, fmt.Errorf("list order items: %w", err)
	}
	if len(items) == 0 {
		return nil, ErrOrderNotFound
	}

	// Claim every seat atomically; if any seat was already claimed after hold expiry,
	// roll back seat changes via a savepoint and mark the payment/order REFUNDED (FR-15).
	sp, err := tx.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin savepoint: %w", err)
	}
	qsp := s.queries.WithTx(sp)
	conflictSeat := ""

	for _, item := range items {
		converted, err := qsp.ConvertSeatHold(ctx, store.ConvertSeatHoldParams{
			EventID: order.EventID,
			SeatID:  item.SeatID,
			UserID:  order.UserID,
		})
		if err != nil {
			_ = sp.Rollback(ctx)
			return nil, fmt.Errorf("convert hold: %w", err)
		}
		if converted > 0 {
			sold, err := qsp.MarkHeldSeatSold(ctx, store.MarkHeldSeatSoldParams{
				EventID: order.EventID,
				SeatID:  item.SeatID,
			})
			if err != nil {
				_ = sp.Rollback(ctx)
				return nil, fmt.Errorf("mark held seat sold: %w", err)
			}
			if sold == 0 {
				conflictSeat = item.SeatLabel
				break
			}
			continue
		}

		// Late payment after hold expiry: claim seat if it is still AVAILABLE (FR-15).
		sold, err := qsp.MarkAvailableSeatSold(ctx, store.MarkAvailableSeatSoldParams{
			EventID: order.EventID,
			SeatID:  item.SeatID,
		})
		if err != nil {
			_ = sp.Rollback(ctx)
			return nil, fmt.Errorf("mark available seat sold: %w", err)
		}
		if sold == 0 {
			conflictSeat = item.SeatLabel
			break
		}
	}

	if conflictSeat != "" {
		_ = sp.Rollback(ctx)
		if _, err := qtx.UpdatePaymentResult(ctx, store.UpdatePaymentResultParams{
			ID:            pay.ID,
			Status:        store.PaymentStatusREFUNDED,
			ProviderTxnID: pgtype.Text{String: req.ProviderTxnID, Valid: req.ProviderTxnID != ""},
			RawResponse:   rawIPN,
		}); err != nil {
			return nil, fmt.Errorf("mark payment refunded: %w", err)
		}
		if _, err := qtx.MarkOrderRefunded(ctx, order.ID); err != nil {
			return nil, fmt.Errorf("mark order refunded: %w", err)
		}
		auditData, _ := json.Marshal(map[string]any{
			"orderCode":    order.OrderCode,
			"paymentCode":  pay.PaymentCode,
			"conflictSeat": conflictSeat,
		})
		_, _ = qtx.CreateAuditLog(ctx, store.CreateAuditLogParams{
			ActorUserID: order.UserID,
			EventID:     order.EventID,
			Action:      "PAYMENT_REFUNDED_CONFLICT",
			EntityType:  "ORDER",
			EntityID:    order.ID,
			NewData:     auditData,
			Reason:      pgtype.Text{String: "Ghế đã hết thời gian giữ và được người khác mua trước khi đối soát IPN", Valid: true},
			RequestID:   pgtype.Text{String: pay.PaymentCode, Valid: true},
		})
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit refund reconciliation: %w", err)
		}
		return nil, ErrSeatConflictRefunded
	}

	// Issue one ticket per seat with its own 256-bit rotating QR secret.
	issuedCodes := make([]string, 0, len(items))
	for _, item := range items {
		qrSecret, err := GenerateQRSecret()
		if err != nil {
			_ = sp.Rollback(ctx)
			return nil, fmt.Errorf("generate qr secret: %w", err)
		}
		ticketCode := fmt.Sprintf("TKT-%s", randomHexUpper(5))
		if _, err := qsp.CreateTicket(ctx, store.CreateTicketParams{
			OrderID:    order.ID,
			EventID:    order.EventID,
			SeatID:     item.SeatID,
			UserID:     order.UserID,
			TicketCode: ticketCode,
			QrSecret:   qrSecret,
		}); err != nil {
			_ = sp.Rollback(ctx)
			return nil, fmt.Errorf("create ticket: %w", err)
		}
		issuedCodes = append(issuedCodes, ticketCode)
	}

	if err := sp.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit seat sale savepoint: %w", err)
	}

	if _, err := qtx.MarkOrderPaid(ctx, store.MarkOrderPaidParams{
		ID:            order.ID,
		PaymentMethod: pgtype.Text{String: prov, Valid: true},
	}); err != nil {
		return nil, fmt.Errorf("mark order paid: %w", err)
	}
	if _, err := qtx.UpdatePaymentResult(ctx, store.UpdatePaymentResultParams{
		ID:            pay.ID,
		Status:        store.PaymentStatusSUCCESS,
		ProviderTxnID: pgtype.Text{String: req.ProviderTxnID, Valid: req.ProviderTxnID != ""},
		RawResponse:   rawIPN,
	}); err != nil {
		return nil, fmt.Errorf("mark payment success: %w", err)
	}

	auditNew, _ := json.Marshal(map[string]any{
		"orderCode":     order.OrderCode,
		"paymentCode":   pay.PaymentCode,
		"provider":      prov,
		"providerTxnId": req.ProviderTxnID,
		"finalAmount":   expectedAmt,
		"ticketCodes":   issuedCodes,
	})
	if _, err := qtx.CreateAuditLog(ctx, store.CreateAuditLogParams{
		ActorUserID: order.UserID,
		EventID:     order.EventID,
		Action:      "ORDER_PAID",
		EntityType:  "ORDER",
		EntityID:    order.ID,
		NewData:     auditNew,
		Reason:      pgtype.Text{String: fmt.Sprintf("Thanh toán thành công qua %s", prov), Valid: true},
		RequestID:   pgtype.Text{String: pay.PaymentCode, Valid: true},
	}); err != nil {
		return nil, fmt.Errorf("audit order paid: %w", err)
	}

	// Notify live seat map subscribers over PostgreSQL LISTEN/NOTIFY -> SSE.
	now := time.Now().UTC()
	eventIDStr := store.UUIDToString(order.EventID)
	for _, item := range items {
		if err := notify(ctx, qtx, SeatUpdateMessage{
			Type:      "seat_sold",
			EventID:   eventIDStr,
			SeatID:    store.UUIDToString(item.SeatID),
			Status:    "SOLD",
			Timestamp: now,
		}); err != nil {
			return nil, fmt.Errorf("notify seat sold: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit order payment: %w", err)
	}

	orderDTO, err := s.loadOrderDTO(ctx, s.queries, order.ID)
	if err != nil {
		return nil, err
	}
	return &IPNResult{
		Idempotent: false,
		Status:     string(store.PaymentStatusSUCCESS),
		Order:      orderDTO,
	}, nil
}

func (s *PaymentService) loadOrderDTO(ctx context.Context, q *store.Queries, orderID pgtype.UUID) (*OrderDTO, error) {
	row, err := q.GetOrderWithEvent(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("load order with event: %w", err)
	}
	return s.assembleOrderDTO(ctx, q, row)
}

func (s *PaymentService) assembleOrderDTO(ctx context.Context, q *store.Queries, row store.GetOrderWithEventRow) (*OrderDTO, error) {
	itemRows, err := q.ListOrderItemsWithSeats(ctx, row.ID)
	if err != nil {
		return nil, fmt.Errorf("list order items: %w", err)
	}
	items := make([]OrderItemDTO, 0, len(itemRows))
	for _, it := range itemRows {
		items = append(items, OrderItemDTO{
			SeatID:    store.UUIDToString(it.SeatID),
			SeatLabel: it.SeatLabel,
			ZoneID:    store.UUIDToString(it.ZoneID),
			ZoneCode:  it.ZoneCode,
			ZoneName:  it.ZoneName,
			Price:     numericToInt64(it.Price),
		})
	}

	payRows, err := q.ListOrderPayments(ctx, row.ID)
	if err != nil {
		return nil, fmt.Errorf("list order payments: %w", err)
	}
	payments := make([]PaymentSummaryDTO, 0, len(payRows))
	for _, p := range payRows {
		payments = append(payments, PaymentSummaryDTO{
			ID:            store.UUIDToString(p.ID),
			PaymentCode:   p.PaymentCode,
			Provider:      p.Provider,
			ProviderTxnID: p.ProviderTxnID.String,
			Amount:        numericToInt64(p.Amount),
			Status:        string(p.Status),
			CreatedAt:     p.CreatedAt.Time.UTC().Format(time.RFC3339),
		})
	}

	var tickets []UserTicketDTO
	if row.Status == store.OrderStatusPAID {
		tRows, err := q.ListOrderTickets(ctx, row.ID)
		if err != nil {
			return nil, fmt.Errorf("list order tickets: %w", err)
		}
		tickets = make([]UserTicketDTO, 0, len(tRows))
		for _, t := range tRows {
			tickets = append(tickets, userTicketFromOrderRow(t))
		}
	}

	subtotal := numericToInt64(row.TotalAmount)
	discount := numericToInt64(row.DiscountAmount)
	finalAmt := numericToInt64(row.FinalAmount)
	fee := finalAmt - subtotal + discount
	if fee < 0 {
		fee = 0
	}

	dto := &OrderDTO{
		ID:             store.UUIDToString(row.ID),
		OrderCode:      row.OrderCode,
		EventID:        store.UUIDToString(row.EventID),
		EventSlug:      row.EventSlug,
		EventName:      row.EventName,
		EventStartsAt:  row.EventStartsAt.Time.UTC().Format(time.RFC3339),
		VenueName:      row.VenueName,
		Status:         string(row.Status),
		SubtotalAmount: subtotal,
		ServiceFee:     fee,
		DiscountAmount: discount,
		FinalAmount:    finalAmt,
		Currency:       row.Currency,
		PaymentMethod:  row.PaymentMethod.String,
		ExpiresAt:      row.ExpiresAt.Time.UTC().Format(time.RFC3339),
		CreatedAt:      row.CreatedAt.Time.UTC().Format(time.RFC3339),
		Items:          items,
		Payments:       payments,
		Tickets:        tickets,
	}
	if row.PaidAt.Valid {
		dto.PaidAt = row.PaidAt.Time.UTC().Format(time.RFC3339)
	}
	return dto, nil
}
