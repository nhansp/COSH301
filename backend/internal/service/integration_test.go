package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/config"
	"eventticketing/internal/store"
)

// These tests need a disposable PostgreSQL database in TEST_DATABASE_URL.
func testDB(t *testing.T) (*pgxpool.Pool, *store.Queries) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	if err := store.RunMigrations(url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool, store.New(pool)
}

func createCustomer(t *testing.T, q *store.Queries, i int) pgtype.UUID {
	t.Helper()
	token, err := GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	u, err := q.CreateUser(context.Background(), store.CreateUserParams{
		Email:  pgtype.Text{String: fmt.Sprintf("race-%d-%s@test.local", i, token[:8]), Valid: true},
		Role:   store.UserRoleCUSTOMER,
		Status: store.UserStatusACTIVE,
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	return u.ID
}

func TestHoldSeat_ConcurrentHoldersGetOneSeat(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()

	var eventID, seatID pgtype.UUID
	err := pool.QueryRow(ctx, `
		SELECT es.event_id, es.seat_id FROM event_seats es
		JOIN events e ON e.id = es.event_id
		WHERE es.status = 'AVAILABLE' AND e.status = 'ON_SALE'
		LIMIT 1`).Scan(&eventID, &seatID)
	if err != nil {
		t.Fatalf("pick seat: %v", err)
	}

	const buyers = 50
	users := make([]pgtype.UUID, buyers)
	for i := range users {
		users[i] = createCustomer(t, q, i)
	}

	svc := NewSeatService(pool, q, true)
	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		winners []pgtype.UUID
		failed  []error
	)
	start := make(chan struct{})
	for _, u := range users {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := svc.HoldSeat(ctx, eventID, seatID, u)
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				winners = append(winners, u)
			case !errors.Is(err, ErrSeatNotAvailable):
				failed = append(failed, err)
			}
		}()
	}
	close(start)
	wg.Wait()

	if len(failed) > 0 {
		t.Fatalf("unexpected errors: %v", failed)
	}
	if len(winners) != 1 {
		t.Fatalf("expected exactly one hold, got %d", len(winners))
	}

	var active int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM seat_holds WHERE event_id = $1 AND seat_id = $2 AND status = 'ACTIVE'`,
		eventID, seatID).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 1 {
		t.Fatalf("expected one active hold row, got %d", active)
	}

	if err := svc.ReleaseSeat(ctx, eventID, seatID, winners[0]); err != nil {
		t.Fatalf("release: %v", err)
	}
}

func TestVerifyOTP_LocksAfterMaxAttempts(t *testing.T) {
	_, q := testDB(t)
	ctx := context.Background()
	svc := NewAuthService(q, &config.Config{OTPDemo: true})

	token, err := GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	dest := "otp-" + token[:8] + "@test.local"
	issue, err := svc.RequestOTP(ctx, dest)
	if err != nil {
		t.Fatalf("request otp: %v", err)
	}
	if _, err := svc.RequestOTP(ctx, dest); !errors.Is(err, ErrOTPRateLimited) {
		t.Fatalf("second request within cooldown: got %v, want ErrOTPRateLimited", err)
	}

	wrong := "000000"
	if issue.DemoCode == wrong {
		wrong = "111111"
	}
	for range otpMaxAttempts {
		if _, _, err := svc.VerifyOTP(ctx, dest, wrong, "", ""); !errors.Is(err, ErrOTPInvalid) {
			t.Fatalf("wrong code: got %v, want ErrOTPInvalid", err)
		}
	}
	if _, _, err := svc.VerifyOTP(ctx, dest, issue.DemoCode, "", ""); !errors.Is(err, ErrOTPInvalid) {
		t.Fatalf("correct code after lockout: got %v, want ErrOTPInvalid", err)
	}
}

func TestCancel_OnlyReleasesOwnHolds(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()

	var eventID, seatID pgtype.UUID
	var seatLabel string
	err := pool.QueryRow(ctx, `
		SELECT es.event_id, es.seat_id, s.seat_label FROM event_seats es
		JOIN events e ON e.id = es.event_id
		JOIN seats s ON s.id = es.seat_id
		WHERE es.status = 'AVAILABLE' AND e.status = 'ON_SALE'
		LIMIT 1`).Scan(&eventID, &seatID, &seatLabel)
	if err != nil {
		t.Fatalf("pick seat: %v", err)
	}

	owner, other := createCustomer(t, q, 1), createCustomer(t, q, 2)
	seats := NewSeatService(pool, q, false)
	if _, err := seats.HoldSeat(ctx, eventID, seatID, owner); err != nil {
		t.Fatalf("hold: %v", err)
	}
	t.Cleanup(func() { _ = seats.ReleaseSeat(ctx, eventID, seatID, owner) })

	tickets := NewTicketService(pool, q)
	if _, err := tickets.Cancel(ctx, other, "", eventID, CancelRequest{Seats: []string{seatLabel}}); !errors.Is(err, ErrNothingToCancel) {
		t.Fatalf("cancel by other user: got %v, want ErrNothingToCancel", err)
	}

	res, err := tickets.Cancel(ctx, owner, "", eventID, CancelRequest{Seats: []string{store.UUIDToString(seatID)}})
	if err != nil {
		t.Fatalf("cancel by owner: %v", err)
	}
	if len(res.ReleasedSeats) != 1 {
		t.Fatalf("owner released %v, want one seat", res.ReleasedSeats)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM event_seats WHERE event_id = $1 AND seat_id = $2`,
		eventID, seatID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "AVAILABLE" {
		t.Fatalf("seat status = %s, want AVAILABLE", status)
	}
}

func TestAuditLogs_RejectTruncate(t *testing.T) {
	pool, _ := testDB(t)
	for _, table := range []string{"audit_logs", "price_changes"} {
		if _, err := pool.Exec(context.Background(), "TRUNCATE "+table); err == nil {
			t.Errorf("TRUNCATE %s succeeded, want error", table)
		}
	}
}

func TestCancel_NothingOwnedWritesNoAudit(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()

	var eventID, seatID pgtype.UUID
	if err := pool.QueryRow(ctx, `
		SELECT es.event_id, es.seat_id FROM event_seats es
		JOIN events e ON e.id = es.event_id
		WHERE es.status = 'AVAILABLE' AND e.status = 'ON_SALE'
		LIMIT 1`).Scan(&eventID, &seatID); err != nil {
		t.Fatalf("pick seat: %v", err)
	}
	user := createCustomer(t, q, 0)
	svc := NewTicketService(pool, q)

	_, err := svc.Cancel(ctx, user, "", eventID, CancelRequest{Seats: []string{store.UUIDToString(seatID), "junk"}})
	if !errors.Is(err, ErrNothingToCancel) {
		t.Fatalf("cancel unowned seat: got %v, want ErrNothingToCancel", err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE actor_user_id = $1`, user).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("expected no audit rows, got %d", n)
	}

	seats := NewSeatService(pool, q, false)
	if _, err := seats.HoldSeat(ctx, eventID, seatID, user); err != nil {
		t.Fatalf("hold: %v", err)
	}
	res, err := svc.Cancel(ctx, user, "", eventID, CancelRequest{Seats: []string{store.UUIDToString(seatID), store.UUIDToString(seatID)}})
	if err != nil {
		t.Fatalf("cancel held seat: %v", err)
	}
	if len(res.ReleasedSeats) != 1 {
		t.Fatalf("released %v, want one seat", res.ReleasedSeats)
	}
}

func TestZonePricing_HeldSeatKeepsPriceUntilReleased(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()

	var eventID, seatID, zoneID pgtype.UUID
	var base, floor, ceiling, seatPrice int64
	if err := pool.QueryRow(ctx, `
		SELECT es.event_id, es.seat_id, s.zone_id, ez.base_price, ez.floor_price, ez.ceiling_price, es.current_price
		FROM event_seats es
		JOIN events e ON e.id = es.event_id
		JOIN seats s ON s.id = es.seat_id
		JOIN event_zones ez ON ez.event_id = es.event_id AND ez.zone_id = s.zone_id
		WHERE es.status = 'AVAILABLE' AND e.status = 'ON_SALE' AND ez.ceiling_price > ez.base_price
		LIMIT 1`).Scan(&eventID, &seatID, &zoneID, &base, &floor, &ceiling, &seatPrice); err != nil {
		t.Fatalf("pick seat: %v", err)
	}
	user := createCustomer(t, q, 0)
	seats := NewSeatService(pool, q, false)
	org := NewOrganizerService(pool, q)

	if _, err := seats.HoldSeat(ctx, eventID, seatID, user); err != nil {
		t.Fatalf("hold: %v", err)
	}
	newBase := ceiling
	if _, err := org.UpdateZonePricing(ctx, eventID, zoneID, user, ZonePricing{BasePrice: newBase, FloorPrice: floor, CeilingPrice: ceiling}); err != nil {
		t.Fatalf("update pricing: %v", err)
	}
	t.Cleanup(func() {
		_, _ = org.UpdateZonePricing(ctx, eventID, zoneID, user, ZonePricing{BasePrice: base, FloorPrice: floor, CeilingPrice: ceiling})
	})

	price := func() int64 {
		var p int64
		if err := pool.QueryRow(ctx, `SELECT current_price FROM event_seats WHERE event_id = $1 AND seat_id = $2`, eventID, seatID).Scan(&p); err != nil {
			t.Fatal(err)
		}
		return p
	}
	if got := price(); got != seatPrice {
		t.Fatalf("held seat price changed to %d, want %d", got, seatPrice)
	}
	if err := seats.ReleaseSeat(ctx, eventID, seatID, user); err != nil {
		t.Fatalf("release: %v", err)
	}
	if got := price(); got != newBase {
		t.Fatalf("released seat price %d, want new base %d", got, newBase)
	}
}
