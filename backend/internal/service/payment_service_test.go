package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eventticketing/internal/store"
	"eventticketing/internal/vnpay"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The payment tests share the TEST_DATABASE_URL database with the seat tests
// and sell seats from the seeded concerts for good, so each one takes its own.

var txnCounter atomic.Int64

type payFixture struct {
	t       *testing.T
	pool    *pgxpool.Pool
	q       *store.Queries
	seats   *SeatService
	pay     *PaymentService
	client  vnpay.Client
	eventID pgtype.UUID
}

func newPayFixture(t *testing.T) *payFixture {
	t.Helper()
	pool, q := testDB(t)
	client := vnpay.Client{
		TmnCode:    "TESTCODE",
		HashSecret: "test-secret-not-a-real-one",
		PayURL:     "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
		ReturnURL:  "https://example.test/payment/vnpay/return",
	}
	f := &payFixture{
		t: t, pool: pool, q: q, client: client,
		seats: NewSeatService(pool, q, false),
		pay:   NewPaymentService(pool, q, client),
	}
	err := pool.QueryRow(context.Background(), `
		SELECT id FROM events
		WHERE status = 'ON_SALE'
		  AND (sales_starts_at IS NULL OR sales_starts_at <= now())
		  AND (sales_ends_at IS NULL OR sales_ends_at > now())
		ORDER BY starts_at LIMIT 1`).Scan(&f.eventID)
	if err != nil {
		t.Fatalf("pick event: %v", err)
	}
	return f
}

// holdFreshSeats holds n available seats of the event for a new customer.
func (f *payFixture) holdFreshSeats(n int) (pgtype.UUID, []pgtype.UUID) {
	f.t.Helper()
	ctx := context.Background()
	user := createCustomer(f.t, f.q, int(txnCounter.Add(1)))
	rows, err := f.pool.Query(ctx, `
		SELECT seat_id FROM event_seats WHERE event_id = $1 AND status = 'AVAILABLE'
		ORDER BY random() LIMIT $2`, f.eventID, n)
	if err != nil {
		f.t.Fatal(err)
	}
	defer rows.Close()
	var ids []pgtype.UUID
	for rows.Next() {
		var id pgtype.UUID
		if err := rows.Scan(&id); err != nil {
			f.t.Fatal(err)
		}
		ids = append(ids, id)
	}
	rows.Close()
	if len(ids) != n {
		f.t.Fatalf("need %d available seats, found %d", n, len(ids))
	}
	for _, id := range ids {
		if _, err := f.seats.HoldSeat(ctx, f.eventID, id, user); err != nil {
			f.t.Fatalf("hold: %v", err)
		}
	}
	return user, ids
}

func (f *payFixture) checkout(user pgtype.UUID) (*Checkout, string) {
	f.t.Helper()
	co, err := f.pay.CreateVNPayCheckout(context.Background(), user, f.eventID, "203.0.113.7")
	if err != nil {
		f.t.Fatalf("checkout: %v", err)
	}
	u, err := url.Parse(co.PaymentURL)
	if err != nil {
		f.t.Fatal(err)
	}
	if !f.client.Verify(u.Query()) {
		f.t.Fatal("payment URL carries an invalid signature")
	}
	return co, u.Query().Get("vnp_TxnRef")
}

// ipn builds the notification VNPay would send for a payment, signed with the merchant secret.
func (f *payFixture) ipn(txnRef string, amountVND int64, responseCode string) url.Values {
	q := url.Values{}
	q.Set("vnp_Amount", fmt.Sprint(amountVND*vnpay.AmountScale))
	q.Set("vnp_BankCode", "NCB")
	q.Set("vnp_BankTranNo", "VNP14000001")
	q.Set("vnp_OrderInfo", "Thanh toan ve")
	q.Set("vnp_PayDate", vnpay.FormatTime(time.Now()))
	q.Set("vnp_ResponseCode", responseCode)
	q.Set("vnp_TmnCode", f.client.TmnCode)
	q.Set("vnp_TransactionNo", fmt.Sprint(time.Now().UnixNano()%1_000_000_000_000+txnCounter.Add(1)))
	q.Set("vnp_TransactionStatus", responseCode)
	q.Set("vnp_TxnRef", txnRef)
	q.Set("vnp_SecureHash", f.client.SignParams(q))
	return q
}

func (f *payFixture) count(query string, args ...any) int {
	f.t.Helper()
	var n int
	if err := f.pool.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		f.t.Fatal(err)
	}
	return n
}

func (f *payFixture) orderStatus(orderID string) string {
	f.t.Helper()
	var s string
	if err := f.pool.QueryRow(context.Background(), `SELECT status::text FROM orders WHERE id = $1`, orderID).Scan(&s); err != nil {
		f.t.Fatal(err)
	}
	return s
}

func (f *payFixture) paymentState(txnRef string) (status string, refund bool) {
	f.t.Helper()
	err := f.pool.QueryRow(context.Background(),
		`SELECT status::text, refund_required FROM payments WHERE payment_code = $1`, txnRef).Scan(&status, &refund)
	if err != nil {
		f.t.Fatal(err)
	}
	return status, refund
}

func (f *payFixture) seatStatus(seat pgtype.UUID) string {
	f.t.Helper()
	var s string
	err := f.pool.QueryRow(context.Background(),
		`SELECT status::text FROM event_seats WHERE event_id = $1 AND seat_id = $2`, f.eventID, seat).Scan(&s)
	if err != nil {
		f.t.Fatal(err)
	}
	return s
}

func wantIPN(t *testing.T, got IPNResult, code string) {
	t.Helper()
	if got.RspCode != code {
		t.Fatalf("RspCode = %s (%s), want %s", got.RspCode, got.Message, code)
	}
}

func TestServiceFee(t *testing.T) {
	for subtotal, want := range map[int64]int64{0: 0, 1_000_000: 30_000, 2_500_000: 75_000, 150: 5, 149: 4} {
		if got := ServiceFee(subtotal); got != want {
			t.Errorf("ServiceFee(%d) = %d, want %d", subtotal, got, want)
		}
	}
}

func TestCheckout_PricesHoldsOnTheServer(t *testing.T) {
	f := newPayFixture(t)
	user, seats := f.holdFreshSeats(2)

	var subtotal int64
	for _, s := range seats {
		var price int64
		if err := f.pool.QueryRow(context.Background(),
			`SELECT current_price::bigint FROM event_seats WHERE event_id = $1 AND seat_id = $2`, f.eventID, s).Scan(&price); err != nil {
			t.Fatal(err)
		}
		subtotal += price
	}

	co, txnRef := f.checkout(user)
	if co.Subtotal != subtotal || co.ServiceFee != ServiceFee(subtotal) || co.Total != subtotal+ServiceFee(subtotal) {
		t.Fatalf("amounts %+v, want subtotal %d", co, subtotal)
	}
	u, _ := url.Parse(co.PaymentURL)
	if got := u.Query().Get("vnp_Amount"); got != fmt.Sprint(co.Total*100) {
		t.Fatalf("vnp_Amount = %s, want %d", got, co.Total*100)
	}

	var holdExpiry time.Time
	if err := f.pool.QueryRow(context.Background(),
		`SELECT min(expires_at) FROM seat_holds WHERE user_id = $1 AND status = 'ACTIVE'`, user).Scan(&holdExpiry); err != nil {
		t.Fatal(err)
	}
	if !co.ExpiresAt.Equal(holdExpiry) {
		t.Fatalf("order expires %v, earliest hold %v: the order must not outlive the holds", co.ExpiresAt, holdExpiry)
	}
	if u.Query().Get("vnp_ExpireDate") != vnpay.FormatTime(holdExpiry) {
		t.Fatal("vnp_ExpireDate must be the hold expiry")
	}

	// A second click reuses the order but starts a new payment attempt.
	again, txnRef2 := f.checkout(user)
	if again.OrderID != co.OrderID || txnRef2 == txnRef {
		t.Fatalf("reuse failed: order %s/%s, txn %s/%s", co.OrderID, again.OrderID, txnRef, txnRef2)
	}
}

func TestCheckout_ChangedSeatsCancelOldOrder(t *testing.T) {
	f := newPayFixture(t)
	user, seats := f.holdFreshSeats(2)
	first, _ := f.checkout(user)

	if err := f.seats.ReleaseSeat(context.Background(), f.eventID, seats[0], user); err != nil {
		t.Fatal(err)
	}
	second, _ := f.checkout(user)
	if second.OrderID == first.OrderID {
		t.Fatal("seat set changed but the order was reused")
	}
	if got := f.orderStatus(first.OrderID); got != "CANCELLED" {
		t.Fatalf("old order is %s, want CANCELLED", got)
	}
}

func TestCheckout_Rejections(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()

	noHolds := createCustomer(t, f.q, int(txnCounter.Add(1)))
	if _, err := f.pay.CreateVNPayCheckout(ctx, noHolds, f.eventID, "203.0.113.7"); !errors.Is(err, ErrNoActiveHolds) {
		t.Fatalf("no holds: %v", err)
	}

	user, _ := f.holdFreshSeats(1)
	if _, err := f.pool.Exec(ctx, `UPDATE seat_holds SET expires_at = now() + interval '20 seconds' WHERE user_id = $1 AND status = 'ACTIVE'`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pay.CreateVNPayCheckout(ctx, user, f.eventID, "203.0.113.7"); !errors.Is(err, ErrHoldsExpiring) {
		t.Fatalf("expiring holds: %v", err)
	}
}

func TestIPN_SuccessIssuesTicketsOnce(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, seats := f.holdFreshSeats(3)
	co, txnRef := f.checkout(user)

	msg := f.ipn(txnRef, co.Total, "00")
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, msg), "00")

	if got := f.orderStatus(co.OrderID); got != "PAID" {
		t.Fatalf("order %s, want PAID", got)
	}
	if status, refund := f.paymentState(txnRef); status != "SUCCESS" || refund {
		t.Fatalf("payment %s refund=%v", status, refund)
	}
	for _, s := range seats {
		if got := f.seatStatus(s); got != "SOLD" {
			t.Fatalf("seat %s, want SOLD", got)
		}
	}
	if n := f.count(`SELECT count(*) FROM seat_holds WHERE user_id = $1 AND status = 'CONVERTED'`, user); n != 3 {
		t.Fatalf("%d converted holds, want 3", n)
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE user_id = $1 AND status = 'ISSUED'`, user); n != 3 {
		t.Fatalf("%d tickets, want 3", n)
	}

	// VNPay retries and duplicates change nothing.
	for range 3 {
		wantIPN(t, f.pay.HandleVNPayIPN(ctx, msg), "02")
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE user_id = $1`, user); n != 3 {
		t.Fatalf("%d tickets after replay, want 3", n)
	}

	tickets, err := f.pay.ListMyTickets(ctx, user)
	if err != nil || len(tickets) != 3 {
		t.Fatalf("tickets %d, err %v", len(tickets), err)
	}
	var priced int64
	for _, tk := range tickets {
		priced += tk.Price
	}
	if priced != co.Subtotal {
		t.Fatalf("ticket prices %d, want subtotal %d", priced, co.Subtotal)
	}

	outcome, err := f.pay.VerifyVNPayReturn(ctx, msg)
	if err != nil || outcome.Status != "paid" || outcome.TicketCount != 3 {
		t.Fatalf("return outcome %+v, err %v", outcome, err)
	}
}

func TestIPN_ConcurrentDuplicatesConfirmOnce(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, _ := f.holdFreshSeats(2)
	co, txnRef := f.checkout(user)
	msg := f.ipn(txnRef, co.Total, "00")

	const calls = 12
	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		results = map[string]int{}
	)
	start := make(chan struct{})
	for range calls {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			r := f.pay.HandleVNPayIPN(ctx, msg)
			mu.Lock()
			results[r.RspCode]++
			mu.Unlock()
		}()
	}
	close(start)
	wg.Wait()

	if results["00"] != 1 || results["02"] != calls-1 {
		t.Fatalf("results %v, want one 00 and %d x 02", results, calls-1)
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE user_id = $1`, user); n != 2 {
		t.Fatalf("%d tickets, want 2", n)
	}
}

func TestIPN_BadSignatureChangesNothing(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, seats := f.holdFreshSeats(1)
	co, txnRef := f.checkout(user)

	forged := f.ipn(txnRef, co.Total, "00")
	forged.Set("vnp_SecureHash", vnpay.Sign("some-other-secret", "vnp_TxnRef="+txnRef))
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, forged), "97")

	tampered := f.ipn(txnRef, co.Total, "24") // a real "cancelled" message...
	tampered.Set("vnp_ResponseCode", "00")    // ...edited into a success
	tampered.Set("vnp_TransactionStatus", "00")
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, tampered), "97")

	if status, _ := f.paymentState(txnRef); status != "INITIATED" {
		t.Fatalf("payment %s, want INITIATED", status)
	}
	if got := f.orderStatus(co.OrderID); got != "PENDING" {
		t.Fatalf("order %s, want PENDING", got)
	}
	if got := f.seatStatus(seats[0]); got != "HELD" {
		t.Fatalf("seat %s, want HELD", got)
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE user_id = $1`, user); n != 0 {
		t.Fatalf("%d tickets from a forged IPN", n)
	}
}

func TestIPN_AmountMismatch(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, _ := f.holdFreshSeats(1)
	co, txnRef := f.checkout(user)

	// Correctly signed, but for a smaller amount than the order.
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, f.ipn(txnRef, co.Total-1000, "00")), "04")

	if status, _ := f.paymentState(txnRef); status != "INITIATED" {
		t.Fatalf("payment %s, want INITIATED", status)
	}
	if got := f.orderStatus(co.OrderID); got != "PENDING" {
		t.Fatalf("order %s, want PENDING", got)
	}

	// The right amount still goes through afterwards.
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, f.ipn(txnRef, co.Total, "00")), "00")
	if got := f.orderStatus(co.OrderID); got != "PAID" {
		t.Fatalf("order %s, want PAID", got)
	}
}

func TestIPN_UnknownOrAlienMessages(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()

	wantIPN(t, f.pay.HandleVNPayIPN(ctx, f.ipn("VNPDOESNOTEXIST", 10000, "00")), "01")

	other := f.ipn("VNPX", 10000, "00")
	other.Set("vnp_TmnCode", "OTHERMER")
	other.Set("vnp_SecureHash", f.client.SignParams(withoutHash(other)))
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, other), "99")

	missing := f.ipn("VNPX", 10000, "00")
	missing.Del("vnp_Amount")
	missing.Set("vnp_SecureHash", f.client.SignParams(withoutHash(missing)))
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, missing), "99")
}

func withoutHash(q url.Values) url.Values {
	out := url.Values{}
	for k, v := range q {
		if k != "vnp_SecureHash" {
			out[k] = v
		}
	}
	return out
}

func TestIPN_FailureKeepsOrderPayableAndIsFinal(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, seats := f.holdFreshSeats(1)
	co, txnRef := f.checkout(user)

	cancelled := f.ipn(txnRef, co.Total, "24")
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, cancelled), "00")
	if status, _ := f.paymentState(txnRef); status != "FAILED" {
		t.Fatalf("payment %s, want FAILED", status)
	}
	if got := f.orderStatus(co.OrderID); got != "PENDING" {
		t.Fatalf("order %s, want PENDING so the customer can retry", got)
	}
	if got := f.seatStatus(seats[0]); got != "HELD" {
		t.Fatalf("seat %s, want HELD", got)
	}
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, cancelled), "02")

	// Retry with a new attempt on the same order.
	retry, txnRef2 := f.checkout(user)
	if retry.OrderID != co.OrderID {
		t.Fatal("retry should reuse the pending order")
	}
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, f.ipn(txnRef2, retry.Total, "00")), "00")
	if got := f.orderStatus(co.OrderID); got != "PAID" {
		t.Fatalf("order %s, want PAID", got)
	}
	outcome, err := f.pay.VerifyVNPayReturn(ctx, cancelled)
	if err != nil || outcome.Status != "failed" {
		t.Fatalf("return for the cancelled attempt: %+v, %v", outcome, err)
	}
}

func TestIPN_PaidAfterHoldsExpiredNeedsRefund(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, seats := f.holdFreshSeats(2)
	co, txnRef := f.checkout(user)

	// The customer pays, but the holds ran out before the IPN arrived.
	if _, err := f.pool.Exec(ctx, `UPDATE seat_holds SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND status = 'ACTIVE'`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := f.seats.ExpireStaleHolds(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE orders SET expires_at = now() - interval '1 second' WHERE id = $1`, co.OrderID); err != nil {
		t.Fatal(err)
	}
	if n, err := f.pay.ExpireStaleOrders(ctx); err != nil || n < 1 {
		t.Fatalf("expired orders %d, err %v", n, err)
	}

	msg := f.ipn(txnRef, co.Total, "00")
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, msg), "00")

	if status, refund := f.paymentState(txnRef); status != "SUCCESS" || !refund {
		t.Fatalf("payment %s refund=%v, want SUCCESS with refund_required", status, refund)
	}
	if got := f.orderStatus(co.OrderID); got != "EXPIRED" {
		t.Fatalf("order %s, want EXPIRED", got)
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE user_id = $1`, user); n != 0 {
		t.Fatalf("%d tickets issued without holds", n)
	}
	for _, s := range seats {
		if got := f.seatStatus(s); got != "AVAILABLE" {
			t.Fatalf("seat %s, want AVAILABLE", got)
		}
	}
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, msg), "02")

	outcome, err := f.pay.VerifyVNPayReturn(ctx, msg)
	if err != nil || outcome.Status != "refund_pending" {
		t.Fatalf("return outcome %+v, err %v", outcome, err)
	}
}

func TestIPN_SeatTakenByAnotherCustomerNeedsRefund(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, seats := f.holdFreshSeats(1)
	co, txnRef := f.checkout(user)

	if _, err := f.pool.Exec(ctx, `UPDATE seat_holds SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND status = 'ACTIVE'`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := f.seats.ExpireStaleHolds(ctx); err != nil {
		t.Fatal(err)
	}
	rival := createCustomer(t, f.q, int(txnCounter.Add(1)))
	if _, err := f.seats.HoldSeat(ctx, f.eventID, seats[0], rival); err != nil {
		t.Fatalf("rival hold: %v", err)
	}

	wantIPN(t, f.pay.HandleVNPayIPN(ctx, f.ipn(txnRef, co.Total, "00")), "00")

	if _, refund := f.paymentState(txnRef); !refund {
		t.Fatal("payment must be flagged for refund")
	}
	if got := f.seatStatus(seats[0]); got != "HELD" {
		t.Fatalf("seat %s: the rival's hold must survive", got)
	}
	if n := f.count(`SELECT count(*) FROM seat_holds WHERE user_id = $1 AND status = 'ACTIVE'`, rival); n != 1 {
		t.Fatalf("rival has %d active holds, want 1", n)
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE seat_id = $1 AND event_id = $2`, seats[0], f.eventID); n != 0 {
		t.Fatalf("%d tickets for a seat that was not ours", n)
	}
}

func TestIPN_SecondPaymentOfPaidOrderNeedsRefund(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	user, _ := f.holdFreshSeats(1)
	co, first := f.checkout(user)
	_, second := f.checkout(user) // a second tab, same order

	wantIPN(t, f.pay.HandleVNPayIPN(ctx, f.ipn(first, co.Total, "00")), "00")
	wantIPN(t, f.pay.HandleVNPayIPN(ctx, f.ipn(second, co.Total, "00")), "00")

	if _, refund := f.paymentState(second); !refund {
		t.Fatal("the duplicate payment must be flagged for refund")
	}
	if _, refund := f.paymentState(first); refund {
		t.Fatal("the first payment must not be flagged")
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE user_id = $1`, user); n != 1 {
		t.Fatalf("%d tickets, want 1", n)
	}
}

func TestReturn_RejectsUnsignedAndUnknown(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()

	q := f.ipn("VNPNOPE", 10000, "00")
	if _, err := f.pay.VerifyVNPayReturn(ctx, q); !errors.Is(err, ErrPaymentNotFound) {
		t.Fatalf("unknown reference: %v", err)
	}
	q.Set("vnp_Amount", "1")
	if _, err := f.pay.VerifyVNPayReturn(ctx, q); !errors.Is(err, ErrReturnInvalid) {
		t.Fatalf("tampered query: %v", err)
	}
}
