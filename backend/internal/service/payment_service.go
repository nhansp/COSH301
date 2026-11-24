package service

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"eventticketing/internal/store"
	"eventticketing/internal/vnpay"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNoActiveHolds = errors.New("no_active_holds")
	// ErrHoldsExpiring means the holds end before the customer could finish paying.
	ErrHoldsExpiring = errors.New("holds_expiring")
)

const (
	// ServiceFeePercent is the booking fee added on top of the ticket prices.
	// The seat page shows the same rate (frontend SERVICE_FEE_RATE).
	ServiceFeePercent = 3

	// minPaymentWindow is the least time a customer needs on the VNPay page.
	minPaymentWindow = time.Minute
)

// ServiceFee returns the booking fee for a ticket subtotal, rounded to whole VND.
func ServiceFee(subtotal int64) int64 {
	return (subtotal*ServiceFeePercent + 50) / 100
}

// PaymentService turns holds into orders, takes payment through VNPay and issues tickets.
type PaymentService struct {
	dbPool  *pgxpool.Pool
	queries *store.Queries
	vnpay   vnpay.Client
}

func NewPaymentService(dbPool *pgxpool.Pool, queries *store.Queries, client vnpay.Client) *PaymentService {
	return &PaymentService{dbPool: dbPool, queries: queries, vnpay: client}
}

func toNumeric(v int64) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(v), Valid: true}
}

func fromNumeric(n pgtype.Numeric) int64 {
	v, _ := n.Int64Value()
	return v.Int64
}

func randomCode(prefix string, bytes int) string {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		panic(fmt.Sprintf("crypto/rand: %v", err))
	}
	return prefix + strings.ToUpper(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buf))
}

// Checkout is a pending order together with the VNPay URL that pays it.
type Checkout struct {
	OrderID    string    `json:"orderId"`
	OrderCode  string    `json:"orderCode"`
	Subtotal   int64     `json:"subtotal"`
	ServiceFee int64     `json:"serviceFee"`
	Total      int64     `json:"total"`
	ExpiresAt  time.Time `json:"expiresAt"`
	PaymentURL string    `json:"paymentUrl"`
}

// CreateVNPayCheckout prices the caller's active holds on the event from the
// database, creates (or reuses) the pending order for them, and starts a new
// VNPay payment attempt. The order ends when the earliest hold ends; nothing
// is extended.
func (s *PaymentService) CreateVNPayCheckout(ctx context.Context, userID, eventID pgtype.UUID, ip string) (*Checkout, error) {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	// Same lock as HoldSeat and Cancel: one checkout per user and event at a time.
	if err := qtx.LockUserEventAdvisory(ctx, store.LockUserEventAdvisoryParams{
		Column1: store.UUIDToString(userID),
		Column2: store.UUIDToString(eventID),
	}); err != nil {
		return nil, fmt.Errorf("advisory lock: %w", err)
	}

	sale, err := qtx.GetEventSaleState(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEventNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load event: %w", err)
	}
	if sale.Status != store.EventStatusONSALE {
		return nil, ErrEventNotOnSale
	}

	holds, err := qtx.LockBuyableHolds(ctx, store.LockBuyableHoldsParams{EventID: eventID, UserID: userID})
	if err != nil {
		return nil, fmt.Errorf("lock holds: %w", err)
	}
	if len(holds) == 0 {
		return nil, ErrNoActiveHolds
	}

	var subtotal int64
	expiresAt := holds[0].ExpiresAt.Time
	holdIDs := make([]string, 0, len(holds))
	for _, h := range holds {
		subtotal += fromNumeric(h.CurrentPrice)
		if h.ExpiresAt.Time.Before(expiresAt) {
			expiresAt = h.ExpiresAt.Time
		}
		holdIDs = append(holdIDs, store.UUIDToString(h.HoldID))
	}
	slices.Sort(holdIDs)
	now := time.Now()
	if expiresAt.Sub(now) < minPaymentWindow {
		return nil, ErrHoldsExpiring
	}

	order, err := s.orderForHolds(ctx, qtx, userID, eventID, holds, holdIDs, subtotal, expiresAt)
	if err != nil {
		return nil, err
	}

	payment, err := qtx.CreatePayment(ctx, store.CreatePaymentParams{
		OrderID:     order.ID,
		PaymentCode: randomCode("VNP", 10) + vnpay.FormatTime(now),
		Amount:      order.FinalAmount,
	})
	if err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit checkout: %w", err)
	}

	return &Checkout{
		OrderID:    store.UUIDToString(order.ID),
		OrderCode:  order.OrderCode,
		Subtotal:   fromNumeric(order.TotalAmount),
		ServiceFee: fromNumeric(order.ServiceFee),
		Total:      fromNumeric(order.FinalAmount),
		ExpiresAt:  order.ExpiresAt.Time,
		PaymentURL: s.vnpay.PaymentURL(vnpay.PayRequest{
			TxnRef:    payment.PaymentCode,
			AmountVND: fromNumeric(payment.Amount),
			OrderInfo: "Thanh toan ve " + order.OrderCode,
			IPAddr:    ip,
			CreatedAt: now,
			ExpiresAt: order.ExpiresAt.Time,
		}),
	}, nil
}

// orderForHolds reuses the user's pending order when it covers exactly the
// current holds. Any other pending order of the user for the event is
// cancelled, so a seat is never part of two payable orders.
func (s *PaymentService) orderForHolds(ctx context.Context, qtx *store.Queries, userID, eventID pgtype.UUID,
	holds []store.LockBuyableHoldsRow, holdIDs []string, subtotal int64, expiresAt time.Time) (store.Order, error) {

	pending, err := qtx.LockPendingOrdersForUser(ctx, store.LockPendingOrdersForUserParams{UserID: userID, EventID: eventID})
	if err != nil {
		return store.Order{}, fmt.Errorf("lock pending orders: %w", err)
	}
	var reuse *store.Order
	for i, o := range pending {
		ids, err := qtx.ListOrderHoldIDs(ctx, o.ID)
		if err != nil {
			return store.Order{}, fmt.Errorf("list order holds: %w", err)
		}
		strs := make([]string, 0, len(ids))
		for _, id := range ids {
			strs = append(strs, store.UUIDToString(id))
		}
		slices.Sort(strs)
		if reuse == nil && o.ExpiresAt.Time.After(time.Now()) && slices.Equal(strs, holdIDs) {
			reuse = &pending[i]
			continue
		}
		if err := qtx.CancelOrder(ctx, o.ID); err != nil {
			return store.Order{}, fmt.Errorf("cancel stale order: %w", err)
		}
	}
	if reuse != nil {
		return *reuse, nil
	}

	fee := ServiceFee(subtotal)
	order, err := qtx.CreateOrder(ctx, store.CreateOrderParams{
		EventID:     eventID,
		UserID:      userID,
		OrderCode:   randomCode("ET", 5),
		TotalAmount: toNumeric(subtotal),
		ServiceFee:  toNumeric(fee),
		FinalAmount: toNumeric(subtotal + fee),
		ExpiresAt:   pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return store.Order{}, fmt.Errorf("create order: %w", err)
	}
	for _, h := range holds {
		if err := qtx.CreateOrderItem(ctx, store.CreateOrderItemParams{
			OrderID: order.ID,
			SeatID:  h.SeatID,
			Price:   h.CurrentPrice,
			HoldID:  h.HoldID,
		}); err != nil {
			return store.Order{}, fmt.Errorf("create order item: %w", err)
		}
	}
	return order, nil
}

// IPNResult is the JSON body VNPay expects from the IPN endpoint.
type IPNResult struct {
	RspCode string `json:"RspCode"`
	Message string `json:"Message"`
}

var (
	ipnConfirmed     = IPNResult{"00", "Confirm Success"}
	ipnOrderNotFound = IPNResult{"01", "Order not found"}
	ipnAlreadyDone   = IPNResult{"02", "Order already confirmed"}
	ipnInvalidAmount = IPNResult{"04", "Invalid amount"}
	ipnInvalidSig    = IPNResult{"97", "Invalid signature"}
	ipnUnknown       = IPNResult{"99", "Unknown error"}
)

// Refund reasons stored in payments.refund_reason.
const (
	refundOrderAlreadyPaid = "order_already_paid"
	refundOrderNotPending  = "order_not_pending"
	refundHoldsLost        = "holds_no_longer_valid"
)

// HandleVNPayIPN processes the server-to-server payment notification. It is
// the only place that turns a payment into tickets, and it is safe to call any
// number of times for the same transaction.
func (s *PaymentService) HandleVNPayIPN(ctx context.Context, query url.Values) IPNResult {
	if !s.vnpay.Verify(query) {
		return ipnInvalidSig
	}
	// Signed but addressed to another merchant, or missing what we need.
	txnRef := query.Get("vnp_TxnRef")
	amount, amountErr := strconv.ParseInt(query.Get("vnp_Amount"), 10, 64)
	if query.Get("vnp_TmnCode") != s.vnpay.TmnCode || txnRef == "" || amountErr != nil {
		return ipnUnknown
	}

	result, err := s.confirmPayment(ctx, query, txnRef, amount)
	if err != nil {
		// Never log the query: it is signed customer data. The reference is enough to trace.
		log.Printf("[payments] IPN %s failed: %v", txnRef, err)
		return ipnUnknown
	}
	return result
}

func (s *PaymentService) confirmPayment(ctx context.Context, query url.Values, txnRef string, vnpAmount int64) (IPNResult, error) {
	found, err := s.queries.GetPaymentByCode(ctx, txnRef)
	if errors.Is(err, pgx.ErrNoRows) {
		return ipnOrderNotFound, nil
	}
	if err != nil {
		return IPNResult{}, fmt.Errorf("load payment: %w", err)
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return IPNResult{}, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	// Order first, then payment: the same order every writer takes locks in.
	order, err := qtx.LockOrderForUpdate(ctx, found.OrderID)
	if err != nil {
		return IPNResult{}, fmt.Errorf("lock order: %w", err)
	}
	payment, err := qtx.LockPaymentForUpdate(ctx, found.ID)
	if err != nil {
		return IPNResult{}, fmt.Errorf("lock payment: %w", err)
	}

	expected := fromNumeric(payment.Amount)
	if vnpAmount != expected*vnpay.AmountScale || expected != fromNumeric(order.FinalAmount) {
		return ipnInvalidAmount, nil
	}
	if payment.Status != store.PaymentStatusINITIATED && payment.Status != store.PaymentStatusPROCESSING {
		return ipnAlreadyDone, nil
	}

	raw := rawVNPayResponse(query)
	if query.Get("vnp_ResponseCode") != vnpay.CodeSuccess || query.Get("vnp_TransactionStatus") != vnpay.CodeSuccess {
		if err := qtx.MarkPaymentFailed(ctx, store.MarkPaymentFailedParams{ID: payment.ID, RawResponse: raw}); err != nil {
			return IPNResult{}, fmt.Errorf("mark payment failed: %w", err)
		}
		return ipnConfirmed, tx.Commit(ctx)
	}

	refundReason, err := s.fulfil(ctx, qtx, order)
	if err != nil {
		return IPNResult{}, err
	}
	err = qtx.MarkPaymentSuccess(ctx, store.MarkPaymentSuccessParams{
		ID:             payment.ID,
		ProviderTxnID:  pgtype.Text{String: query.Get("vnp_TransactionNo"), Valid: query.Get("vnp_TransactionNo") != ""},
		RawResponse:    raw,
		RefundRequired: refundReason != "",
		RefundReason:   pgtype.Text{String: refundReason, Valid: refundReason != ""},
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
		// The same VNPay transaction number is already recorded on another payment.
		return ipnAlreadyDone, nil
	}
	if err != nil {
		return IPNResult{}, fmt.Errorf("mark payment success: %w", err)
	}
	return ipnConfirmed, tx.Commit(ctx)
}

// fulfil sells the order's seats and issues its tickets. It returns the refund
// reason instead when the money arrived for an order that can no longer be
// fulfilled, so the customer is never charged for seats they do not get.
func (s *PaymentService) fulfil(ctx context.Context, qtx *store.Queries, order store.Order) (string, error) {
	switch order.Status {
	case store.OrderStatusPAID:
		return refundOrderAlreadyPaid, nil
	case store.OrderStatusPENDING:
	default:
		return refundOrderNotPending, nil
	}

	// A payment VNPay accepted before vnp_ExpireDate is honoured while the holds
	// are still ours. Once a hold is gone the seat may belong to someone else.
	seats, err := qtx.LockOrderHolds(ctx, order.ID)
	if err != nil {
		return "", fmt.Errorf("lock order holds: %w", err)
	}
	items, err := qtx.CountOrderItems(ctx, order.ID)
	if err != nil {
		return "", fmt.Errorf("count order items: %w", err)
	}
	intact := items > 0 && int(items) == len(seats)
	for _, seat := range seats {
		intact = intact && seat.HoldStatus == store.HoldStatusACTIVE &&
			seat.HoldUserID == order.UserID && seat.SeatStatus == store.SeatStatusHELD
	}
	if !intact {
		if err := qtx.MarkOrderExpired(ctx, order.ID); err != nil {
			return "", fmt.Errorf("expire order: %w", err)
		}
		return refundHoldsLost, nil
	}

	if err := qtx.ConvertOrderHolds(ctx, order.ID); err != nil {
		return "", fmt.Errorf("convert holds: %w", err)
	}
	if err := qtx.MarkOrderSeatsSold(ctx, order.ID); err != nil {
		return "", fmt.Errorf("mark seats sold: %w", err)
	}
	sold, err := qtx.IssueOrderTickets(ctx, order.ID)
	if err != nil {
		return "", fmt.Errorf("issue tickets: %w", err)
	}
	if err := qtx.MarkOrderPaid(ctx, order.ID); err != nil {
		return "", fmt.Errorf("mark order paid: %w", err)
	}
	for _, seatID := range sold {
		if err := notify(ctx, qtx, SeatUpdateMessage{
			Type:      "seat_sold",
			EventID:   store.UUIDToString(order.EventID),
			SeatID:    store.UUIDToString(seatID),
			Status:    "SOLD",
			Timestamp: time.Now(),
		}); err != nil {
			return "", fmt.Errorf("notify seat sold: %w", err)
		}
	}
	return "", nil
}

// rawVNPayResponse keeps what VNPay sent, minus the signature.
func rawVNPayResponse(query url.Values) []byte {
	m := make(map[string]string, len(query))
	for k, v := range query {
		if strings.HasPrefix(k, "vnp_") && k != "vnp_SecureHash" && k != "vnp_SecureHashType" && len(v) > 0 {
			m[k] = v[0]
		}
	}
	b, _ := json.Marshal(m)
	return b
}

// PaymentOutcome is what the return page may show, taken from the database.
type PaymentOutcome struct {
	// Status is one of: paid, processing, failed, refund_pending.
	Status       string `json:"status"`
	OrderCode    string `json:"orderCode"`
	EventID      string `json:"eventId"`
	Amount       int64  `json:"amount"`
	TicketCount  int    `json:"ticketCount"`
	ResponseCode string `json:"responseCode"`
}

// ErrReturnInvalid means the return URL was not signed by VNPay for this merchant.
var ErrReturnInvalid = errors.New("invalid_signature")

// ErrPaymentNotFound means the signed transaction reference is unknown here.
var ErrPaymentNotFound = errors.New("payment_not_found")

// VerifyVNPayReturn checks the return URL signature and reports the state
// recorded by the IPN. It never changes anything.
func (s *PaymentService) VerifyVNPayReturn(ctx context.Context, query url.Values) (*PaymentOutcome, error) {
	if !s.vnpay.Verify(query) || query.Get("vnp_TmnCode") != s.vnpay.TmnCode {
		return nil, ErrReturnInvalid
	}
	row, err := s.queries.GetPaymentReturnState(ctx, query.Get("vnp_TxnRef"))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPaymentNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load payment: %w", err)
	}

	code := query.Get("vnp_ResponseCode")
	out := &PaymentOutcome{
		OrderCode:    row.OrderCode,
		EventID:      store.UUIDToString(row.EventID),
		Amount:       fromNumeric(row.Amount),
		TicketCount:  int(row.TicketCount),
		ResponseCode: code,
	}
	switch {
	case row.PaymentStatus == store.PaymentStatusSUCCESS && row.RefundRequired:
		out.Status = "refund_pending"
	case row.PaymentStatus == store.PaymentStatusSUCCESS:
		out.Status = "paid"
	case row.PaymentStatus == store.PaymentStatusFAILED || code != vnpay.CodeSuccess:
		out.Status = "failed"
	default:
		// VNPay says paid but its IPN has not reached us yet.
		out.Status = "processing"
	}
	return out, nil
}

// ExpireStaleOrders ends pending orders whose holds have run out. Their
// payments stay open on purpose: a late IPN must still be recorded and refunded.
func (s *PaymentService) ExpireStaleOrders(ctx context.Context) (int64, error) {
	return s.queries.ExpireStalePendingOrders(ctx)
}

type MyTicket struct {
	ID         string `json:"id"`
	TicketCode string `json:"ticketCode"`
	Status     string `json:"status"`
	IssuedAt   string `json:"issuedAt"`
	OrderCode  string `json:"orderCode"`
	EventID    string `json:"eventId"`
	EventSlug  string `json:"eventSlug"`
	EventName  string `json:"eventName"`
	StartsAt   string `json:"startsAt"`
	VenueName  string `json:"venueName"`
	SeatLabel  string `json:"seatLabel"`
	ZoneName   string `json:"zoneName"`
	Price      int64  `json:"price"`
}

// ListMyTickets returns the user's issued tickets, soonest event first.
func (s *PaymentService) ListMyTickets(ctx context.Context, userID pgtype.UUID) ([]MyTicket, error) {
	rows, err := s.queries.ListUserTickets(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list tickets: %w", err)
	}
	tickets := make([]MyTicket, 0, len(rows))
	for _, r := range rows {
		tickets = append(tickets, MyTicket{
			ID:         store.UUIDToString(r.ID),
			TicketCode: r.TicketCode,
			Status:     string(r.Status),
			IssuedAt:   r.IssuedAt.Time.Format(time.RFC3339),
			OrderCode:  r.OrderCode,
			EventID:    store.UUIDToString(r.EventID),
			EventSlug:  r.EventSlug,
			EventName:  r.EventName,
			StartsAt:   r.StartsAt.Time.Format(time.RFC3339),
			VenueName:  r.VenueName,
			SeatLabel:  r.SeatLabel,
			ZoneName:   r.ZoneName,
			Price:      fromNumeric(r.Price),
		})
	}
	return tickets, nil
}
