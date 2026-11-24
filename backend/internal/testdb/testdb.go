// Package testdb gives integration tests an isolated event to work on.
//
// The tests need a disposable PostgreSQL database in TEST_DATABASE_URL and are
// skipped without it. It is imported by test files only.
package testdb

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/store"
)

// Open migrates the database and returns a pool on it.
func Open(t *testing.T) (*pgxpool.Pool, *store.Queries) {
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

// URL is the database the tests run on.
func URL() string { return os.Getenv("TEST_DATABASE_URL") }

// User creates an active user with the given role (CUSTOMER, ORGANIZER, ...).
func User(t *testing.T, pool *pgxpool.Pool, role string) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	email := fmt.Sprintf("%s-%s@test.local", role, uuid.NewString()[:8])
	err := pool.QueryRow(context.Background(),
		`INSERT INTO users (email, role, status) VALUES ($1, $2::user_role, 'ACTIVE') RETURNING id`, email, role).Scan(&id)
	if err != nil {
		t.Fatalf("create %s: %v", role, err)
	}
	return id
}

// Session signs the user in and returns the bearer token.
func Session(t *testing.T, pool *pgxpool.Pool, user pgtype.UUID) string {
	t.Helper()
	token := uuid.NewString() + uuid.NewString()
	sum := sha256.Sum256([]byte(token))
	_, err := pool.Exec(context.Background(),
		`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
		user, hex.EncodeToString(sum[:]))
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	return token
}

// Options describe the event Event creates. Zero fields take the default.
type Options struct {
	Seats    int           // default 24
	Base     int64         // default 1_000_000
	Floor    int64         // default 800_000
	Ceiling  int64         // default 1_200_000
	SalesEnd time.Duration // time until sales close, default 2h
}

// Fixture is a venue with one zone and an event on sale, all created for one test.
type Fixture struct {
	EventID     pgtype.UUID
	ZoneID      pgtype.UUID
	OrganizerID pgtype.UUID
	SeatIDs     []pgtype.UUID
}

// Event creates an organizer, a one-zone venue and an event on sale. When the
// test ends the event is closed, so that other tests never pick it up.
func Event(t *testing.T, pool *pgxpool.Pool, opt Options) *Fixture {
	t.Helper()
	if opt.Seats == 0 {
		opt.Seats = 24
	}
	if opt.Base == 0 {
		opt.Base, opt.Floor, opt.Ceiling = 1_000_000, 800_000, 1_200_000
	}
	if opt.SalesEnd == 0 {
		opt.SalesEnd = 2 * time.Hour
	}
	ctx := context.Background()
	f := &Fixture{OrganizerID: User(t, pool, "ORGANIZER")}
	suffix := uuid.NewString()[:8]

	var venueID pgtype.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO venues (name) VALUES ($1) RETURNING id`, "Test venue "+suffix).Scan(&venueID); err != nil {
		t.Fatalf("create venue: %v", err)
	}
	if err := pool.QueryRow(ctx,
		`INSERT INTO venue_zones (venue_id, code, name, capacity) VALUES ($1, 'Z', 'Test zone', $2) RETURNING id`,
		venueID, opt.Seats).Scan(&f.ZoneID); err != nil {
		t.Fatalf("create zone: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO events (organizer_id, venue_id, name, slug, starts_at, ends_at, sales_starts_at, sales_ends_at, status)
		VALUES ($1, $2, $3, $4, now() + interval '40 days', now() + interval '41 days',
		        now() - interval '1 hour', now() + make_interval(secs => $5), 'ON_SALE')
		RETURNING id`,
		f.OrganizerID, venueID, "Test event "+suffix, "test-event-"+suffix, opt.SalesEnd.Seconds()).Scan(&f.EventID); err != nil {
		t.Fatalf("create event: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price, is_dynamic_pricing_enabled)
		VALUES ($1, $2, $3, $4, $5, TRUE)`, f.EventID, f.ZoneID, opt.Base, opt.Floor, opt.Ceiling); err != nil {
		t.Fatalf("create event zone: %v", err)
	}
	for i := 1; i <= opt.Seats; i++ {
		var seatID pgtype.UUID
		if err := pool.QueryRow(ctx, `
			INSERT INTO seats (zone_id, row_label, seat_number, seat_label)
			VALUES ($1, 'A', $2, $3) RETURNING id`, f.ZoneID, fmt.Sprint(i), fmt.Sprintf("A%d", i)).Scan(&seatID); err != nil {
			t.Fatalf("create seat: %v", err)
		}
		if _, err := pool.Exec(ctx,
			`INSERT INTO event_seats (event_id, seat_id, current_price) VALUES ($1, $2, $3)`, f.EventID, seatID, opt.Base); err != nil {
			t.Fatalf("create event seat: %v", err)
		}
		f.SeatIDs = append(f.SeatIDs, seatID)
	}

	t.Cleanup(func() {
		// price_changes is append-only, so the event stays; closing it is enough.
		_, _ = pool.Exec(context.Background(), `UPDATE events SET status = 'ENDED' WHERE id = $1`, f.EventID)
	})
	return f
}
