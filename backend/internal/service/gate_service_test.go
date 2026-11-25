package service

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5/pgtype"
)

// paidTicket buys one seat for a new customer through the real checkout and IPN.
func paidTicket(t *testing.T, f *payFixture) (user, ticket pgtype.UUID) {
	t.Helper()
	user, _ = f.holdFreshSeats(1)
	co, txnRef := f.checkout(user)
	wantIPN(t, f.pay.HandleVNPayIPN(context.Background(), f.ipn(txnRef, co.Total, "00")), "00")
	if err := f.pool.QueryRow(context.Background(), `SELECT id FROM tickets WHERE user_id = $1`, user).Scan(&ticket); err != nil {
		t.Fatalf("ticket: %v", err)
	}
	return user, ticket
}

func TestGate_AdmitsOnceThenReportsUsed(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	gate := NewGateService(f.pool, f.q)
	user, ticket := paidTicket(t, f)

	qr, err := gate.CurrentQR(ctx, user, ticket)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(qr.Payload, qrPrefix+".") || qr.PeriodSec != 30 || !qr.ExpiresAt.After(time.Now()) {
		t.Fatalf("unexpected code %+v", qr)
	}
	first, err := gate.CheckIn(ctx, qr.Payload, f.eventID)
	if err != nil || first.Result != store.CheckinResultVALID || first.SeatLabel == "" || first.ScannedAt == nil {
		t.Fatalf("first scan %+v, err %v", first, err)
	}
	again, err := gate.CheckIn(ctx, qr.Payload, f.eventID)
	if err != nil || again.Result != store.CheckinResultALREADYUSED || again.FirstUsedAt == nil {
		t.Fatalf("second scan %+v, err %v", again, err)
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE id = $1 AND status = 'USED'`, ticket); n != 1 {
		t.Fatal("ticket not marked used")
	}
	if n := f.count(`SELECT count(*) FROM checkins WHERE ticket_id = $1`, ticket); n != 2 {
		t.Fatalf("%d checkins, want 2", n)
	}
	if _, err := gate.CurrentQR(ctx, user, ticket); err != ErrTicketNotUsable {
		t.Fatalf("used ticket still shows a code: %v", err)
	}
}

func TestGate_RefusesOldForgedForeignAndWrongEvent(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	gate := NewGateService(f.pool, f.q)
	user, ticket := paidTicket(t, f)

	// A screenshot taken two minutes ago.
	gate.now = func() time.Time { return time.Now().Add(-2 * time.Minute) }
	old, err := gate.CurrentQR(ctx, user, ticket)
	if err != nil {
		t.Fatal(err)
	}
	gate.now = time.Now
	if out, _ := gate.CheckIn(ctx, old.Payload, pgtype.UUID{}); out.Result != store.CheckinResultINVALID || out.SeatLabel != "" {
		t.Fatalf("old code %+v", out)
	}

	qr, _ := gate.CurrentQR(ctx, user, ticket)
	forged := qr.Payload[:len(qr.Payload)-1] + map[bool]string{true: "0", false: "1"}[!strings.HasSuffix(qr.Payload, "0")]
	if out, _ := gate.CheckIn(ctx, forged, pgtype.UUID{}); out.Result != store.CheckinResultINVALID {
		t.Fatalf("forged code %+v", out)
	}
	for _, junk := range []string{"", "hello", "COSH301T1.x.1.abc", qrPrefix + ".00000000-0000-0000-0000-000000000000.1.0123456789abcdef0123"} {
		if out, err := gate.CheckIn(ctx, junk, pgtype.UUID{}); err != nil || out.Result != store.CheckinResultINVALID {
			t.Fatalf("junk %q: %+v %v", junk, out, err)
		}
	}

	stranger := createCustomer(t, f.q, int(txnCounter.Add(1)))
	if _, err := gate.CurrentQR(ctx, stranger, ticket); err != ErrTicketNotFound {
		t.Fatalf("stranger got a code: %v", err)
	}

	var otherEvent pgtype.UUID
	if err := f.pool.QueryRow(ctx, `SELECT id FROM events WHERE id <> $1 LIMIT 1`, f.eventID).Scan(&otherEvent); err != nil {
		t.Fatal(err)
	}
	out, _ := gate.CheckIn(ctx, qr.Payload, otherEvent)
	if out.Result != store.CheckinResultINVALID || !out.WrongEvent {
		t.Fatalf("wrong event %+v", out)
	}
	if n := f.count(`SELECT count(*) FROM tickets WHERE id = $1 AND status = 'ISSUED'`, ticket); n != 1 {
		t.Fatal("a refused scan changed the ticket")
	}
}

func TestGate_ConcurrentScansAdmitOnce(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	gate := NewGateService(f.pool, f.q)
	user, ticket := paidTicket(t, f)
	qr, err := gate.CurrentQR(ctx, user, ticket)
	if err != nil {
		t.Fatal(err)
	}

	const gates = 12
	results := make(chan store.CheckinResult, gates)
	var wg sync.WaitGroup
	for range gates {
		wg.Add(1)
		go func() {
			defer wg.Done()
			out, err := gate.CheckIn(ctx, qr.Payload, f.eventID)
			if err != nil {
				t.Error(err)
				return
			}
			results <- out.Result
		}()
	}
	wg.Wait()
	close(results)
	valid := 0
	for r := range results {
		if r == store.CheckinResultVALID {
			valid++
		} else if r != store.CheckinResultALREADYUSED {
			t.Fatalf("unexpected result %s", r)
		}
	}
	if valid != 1 {
		t.Fatalf("%d gates admitted the ticket, want 1", valid)
	}
}

func TestMaskHolder(t *testing.T) {
	for in, want := range map[string]string{
		"+84911222333":      "+8491****333",
		"khach@example.com": "kh***@example.com",
		"a@b.vn":            "***@b.vn",
		"User 2333":         "User 2333",
	} {
		if got := maskHolder(in); got != want {
			t.Errorf("maskHolder(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestGate_AdmitNotifiesTheOwnersTopic(t *testing.T) {
	f := newPayFixture(t)
	ctx := context.Background()
	gate := NewGateService(f.pool, f.q)
	user, ticket := paidTicket(t, f)
	qr, err := gate.CurrentQR(ctx, user, ticket)
	if err != nil {
		t.Fatal(err)
	}

	conn, err := f.pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "LISTEN "+SeatNotificationChannel); err != nil {
		t.Fatal(err)
	}
	defer conn.Exec(ctx, "UNLISTEN *")

	if out, err := gate.CheckIn(ctx, qr.Payload, f.eventID); err != nil || out.Result != store.CheckinResultVALID {
		t.Fatalf("scan %+v %v", out, err)
	}
	want := TicketTopic(store.UUIDToString(ticket))
	deadline, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	for {
		n, err := conn.Conn().WaitForNotification(deadline)
		if err != nil {
			t.Fatalf("no ticket_used notification: %v", err)
		}
		if strings.Contains(n.Payload, `"type":"ticket_used"`) && strings.Contains(n.Payload, `"eventId":"`+want+`"`) {
			break
		}
	}

	// A repeated scan admits nobody, so it notifies nobody.
	if out, _ := gate.CheckIn(ctx, qr.Payload, f.eventID); out.Result != store.CheckinResultALREADYUSED {
		t.Fatalf("second scan %+v", out)
	}
	quiet, stop := context.WithTimeout(ctx, 300*time.Millisecond)
	defer stop()
	for {
		n, err := conn.Conn().WaitForNotification(quiet)
		if err != nil {
			break
		}
		if strings.Contains(n.Payload, want) {
			t.Fatal("a repeated scan notified the owner again")
		}
	}
}
