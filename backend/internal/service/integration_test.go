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
