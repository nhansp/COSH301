package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/pricing"
	"eventticketing/internal/store"
)

type pricingFixture struct {
	pool      *pgxpool.Pool
	q         *store.Queries
	engine    *DynamicPricingEngine
	organizer *OrganizerService
	eventID   pgtype.UUID
	ownerID   pgtype.UUID
	zones     []pgtype.UUID // ordered by zone code
}

// newPricingFixture copies a seeded concert into a fresh event whose sale
// opened a day ago and closes in a day. Every zone costs 1.000.000đ with
// bounds 800.000đ to 1.300.000đ that no organizer has approved yet.
func newPricingFixture(t *testing.T) *pricingFixture {
	t.Helper()
	pool, q := testDB(t)
	ctx := context.Background()
	f := &pricingFixture{pool: pool, q: q, organizer: NewOrganizerService(pool, q)}
	f.engine = NewDynamicPricingEngine(pool, q, pricing.Default(), NewRecommendationService(q), false, 0)

	suffix, err := GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	var source pgtype.UUID
	mustScan(t, pool, `
		INSERT INTO events (organizer_id, venue_id, name, slug, genre, city, starts_at, ends_at,
		                    sales_starts_at, sales_ends_at, status)
		SELECT organizer_id, venue_id, 'Pricing test', 'pricing-test-' || $1, genre, city,
		       now() + interval '2 days', now() + interval '2 days 3 hours',
		       now() - interval '24 hours', now() + interval '24 hours', 'ON_SALE'
		FROM events WHERE status = 'ON_SALE' ORDER BY slug LIMIT 1
		RETURNING id, organizer_id, (SELECT id FROM events WHERE status = 'ON_SALE' ORDER BY slug LIMIT 1)`,
		[]any{&f.eventID, &f.ownerID, &source}, suffix[:10])
	mustExec(t, pool, `
		INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price)
		SELECT $1, zone_id, 1000000, 800000, 1300000 FROM event_zones WHERE event_id = $2`, f.eventID, source)
	mustExec(t, pool, `
		INSERT INTO event_seats (event_id, seat_id, status, current_price)
		SELECT $1, seat_id, 'AVAILABLE', 1000000 FROM event_seats WHERE event_id = $2`, f.eventID, source)

	rows, err := pool.Query(ctx, `
		SELECT ez.zone_id FROM event_zones ez JOIN venue_zones vz ON vz.id = ez.zone_id
		WHERE ez.event_id = $1 ORDER BY vz.code`, f.eventID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id pgtype.UUID
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		f.zones = append(f.zones, id)
	}
	if len(f.zones) < 2 {
		t.Fatalf("source event has %d zones", len(f.zones))
	}
	return f
}

// approveBounds saves every zone's prices as the organizer would.
func (f *pricingFixture) approveBounds(t *testing.T) {
	t.Helper()
	for _, z := range f.zones {
		if _, err := f.organizer.UpdateZonePricing(context.Background(), f.eventID, z, f.ownerID,
			ZonePricing{BasePrice: 1_000_000, FloorPrice: 800_000, CeilingPrice: 1_300_000}); err != nil {
			t.Fatalf("approve bounds: %v", err)
		}
	}
}

// hotZone makes a zone sell well ahead of plan: 16 of 24 seats sold and 48
// seats held over the last day, 24 of them in the last hour.
func (f *pricingFixture) hotZone(t *testing.T, zone pgtype.UUID) {
	t.Helper()
	mustExec(t, f.pool, `
		UPDATE event_seats es SET status = 'SOLD'
		FROM (SELECT es2.id FROM event_seats es2 JOIN seats s ON s.id = es2.seat_id
		      WHERE es2.event_id = $1 AND s.zone_id = $2 ORDER BY s.seat_label LIMIT 16) pick
		WHERE es.id = pick.id`, f.eventID, zone)
	buyer := createCustomer(t, f.q, 9000)
	for i, age := range []string{"10 minutes", "3 hours"} {
		mustExec(t, f.pool, fmt.Sprintf(`
			INSERT INTO seat_holds (event_id, seat_id, user_id, hold_token, status, created_at, expires_at)
			SELECT $1, s.id, $3, 'test-' || $4 || '-' || s.id, 'RELEASED', now() - interval '%s', now()
			FROM seats s JOIN event_seats es ON es.seat_id = s.id AND es.event_id = $1
			WHERE s.zone_id = $2`, age), f.eventID, zone, buyer, fmt.Sprint(i))
	}
}

func (f *pricingFixture) basePrice(t *testing.T, zone pgtype.UUID) int64 {
	t.Helper()
	var base int64
	mustScan(t, f.pool, `SELECT base_price::bigint FROM event_zones WHERE event_id = $1 AND zone_id = $2`,
		[]any{&base}, f.eventID, zone)
	return base
}

func (f *pricingFixture) count(t *testing.T, sql string, args ...any) int64 {
	t.Helper()
	var n int64
	mustScan(t, f.pool, sql, []any{&n}, args...)
	return n
}

func (f *pricingFixture) settings(t *testing.T, enabled, auto bool) error {
	t.Helper()
	return f.engine.UpdateSettings(context.Background(), f.eventID, f.ownerID,
		PricingSettingsInput{Enabled: enabled, AutoAdjust: auto, MaxStepPct: 10, CooldownMinutes: 60})
}

func TestPricing_OffByDefault(t *testing.T) {
	f := newPricingFixture(t)
	f.hotZone(t, f.zones[0])
	if err := f.engine.RunEvent(context.Background(), f.eventID); err != nil {
		t.Fatal(err)
	}
	if got := f.basePrice(t, f.zones[0]); got != 1_000_000 {
		t.Fatalf("price changed with pricing off: %d", got)
	}
	if n := f.count(t, `SELECT count(*) FROM price_suggestions WHERE event_id = $1`, f.eventID); n != 0 {
		t.Fatalf("%d suggestions with pricing off", n)
	}
}

func TestPricing_ManualModeSuggestsButNeverChangesPrice(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	f.hotZone(t, f.zones[0])
	if err := f.settings(t, true, false); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := f.engine.RunEvent(ctx, f.eventID); err != nil {
			t.Fatal(err)
		}
	}

	if got := f.basePrice(t, f.zones[0]); got != 1_000_000 {
		t.Fatalf("manual mode changed the price to %d", got)
	}
	pending, err := f.engine.ListPending(ctx, f.eventID)
	if err != nil {
		t.Fatal(err)
	}
	// The hot zone should rise; the others, unsold halfway through the sale, should fall.
	if len(pending) != len(f.zones) {
		t.Fatalf("want one suggestion per zone, got %d", len(pending))
	}
	var hot *PriceSuggestionDTO
	for i := range pending {
		if pending[i].ZoneID == store.UUIDToString(f.zones[0]) {
			hot = &pending[i]
		} else if pending[i].SuggestedPrice >= 1_000_000 {
			t.Fatalf("unsold zone not lowered: %+v", pending[i])
		}
	}
	if hot == nil || hot.SuggestedPrice <= 1_000_000 {
		t.Fatalf("hot zone not raised: %+v", hot)
	}
	if n := f.count(t, `SELECT count(*) FROM pricing_alerts WHERE event_id = $1 AND kind = $2`, f.eventID, AlertRecommendation); n != int64(len(f.zones)) {
		t.Fatalf("want one recommendation alert per zone across two runs, got %d", n)
	}
	if n := f.count(t, `SELECT count(*) FROM pricing_alerts WHERE event_id = $1 AND kind = $2`, f.eventID, AlertSellingFast); n != 1 {
		t.Fatalf("want one selling-fast alert, got %d", n)
	}
	if n := f.count(t, `SELECT count(*) FROM pricing_alerts WHERE event_id = $1 AND kind = $2`, f.eventID, AlertSellingSlow); n != int64(len(f.zones)-1) {
		t.Fatalf("want a selling-slow alert per unsold zone, got %d", n)
	}

	// Approving applies it, logged as a suggestion by the organizer.
	id, _ := store.StringToUUID(hot.ID)
	approved, err := f.engine.Approve(ctx, id, f.ownerID)
	if err != nil {
		t.Fatal(err)
	}
	if f.basePrice(t, f.zones[0]) != approved.BasePrice {
		t.Fatal("approval did not change the base price")
	}
	if n := f.count(t, `SELECT count(*) FROM price_changes WHERE event_id = $1 AND reason = $2 AND changed_by = $3`,
		f.eventID, PriceChangeSuggestion, f.ownerID); n != 1 {
		t.Fatalf("approval not logged: %d rows", n)
	}
	if _, err := f.engine.Approve(ctx, id, f.ownerID); !errors.Is(err, ErrSuggestionNotPending) {
		t.Fatalf("second approval: %v", err)
	}
}

func TestPricing_AutoModeNeedsApprovedBounds(t *testing.T) {
	f := newPricingFixture(t)
	if err := f.settings(t, true, true); !errors.Is(err, ErrBoundsNotApproved) {
		t.Fatalf("auto without approved bounds: %v", err)
	}
	if err := f.settings(t, false, true); !errors.Is(err, ErrInvalidPricingSettings) {
		t.Fatalf("auto while disabled: %v", err)
	}
	f.approveBounds(t)
	if err := f.settings(t, true, true); err != nil {
		t.Fatalf("auto with approved bounds: %v", err)
	}
}

func TestPricing_AutoModeAdjustsWithinBoundsThenCoolsDown(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	f.approveBounds(t)
	f.hotZone(t, f.zones[0])
	if err := f.settings(t, true, true); err != nil {
		t.Fatal(err)
	}
	if err := f.engine.RunEvent(ctx, f.eventID); err != nil {
		t.Fatal(err)
	}

	raised := f.basePrice(t, f.zones[0])
	if raised <= 1_000_000 || raised > 1_100_000 {
		t.Fatalf("want a raise of at most 10%%, got %d", raised)
	}
	if n := f.count(t, `
		SELECT count(*) FROM event_seats es JOIN seats s ON s.id = es.seat_id
		WHERE es.event_id = $1 AND s.zone_id = $2 AND es.status = 'AVAILABLE' AND es.current_price <> $3`,
		f.eventID, f.zones[0], raised); n != 0 {
		t.Fatalf("%d available seats not repriced", n)
	}
	if n := f.count(t, `
		SELECT count(*) FROM price_changes
		WHERE event_id = $1 AND zone_id = $2 AND reason = $3 AND changed_by IS NULL AND details <> ''`,
		f.eventID, f.zones[0], PriceChangeAuto); n != 1 {
		t.Fatalf("automatic change not logged with its reason: %d rows", n)
	}
	if n := f.count(t, `SELECT count(*) FROM pricing_alerts WHERE event_id = $1 AND kind = $2`, f.eventID, AlertAutoAdjusted); n != int64(len(f.zones)) {
		t.Fatalf("want an auto-adjusted alert per zone, got %d", n)
	}
	if got := f.basePrice(t, f.zones[1]); got != 900_000 {
		t.Fatalf("unsold zone should drop by the 10%% step to 900.000đ, got %d", got)
	}

	// The cooldown holds the price on the next run.
	if err := f.engine.RunEvent(ctx, f.eventID); err != nil {
		t.Fatal(err)
	}
	if got := f.basePrice(t, f.zones[0]); got != raised {
		t.Fatalf("price moved again inside the cooldown: %d", got)
	}
}

func TestPricing_AutoModeRespectsManualOverride(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	f.approveBounds(t)
	f.hotZone(t, f.zones[0])
	if err := f.settings(t, true, true); err != nil {
		t.Fatal(err)
	}
	if _, err := f.organizer.UpdateZonePricing(ctx, f.eventID, f.zones[0], f.ownerID,
		ZonePricing{BasePrice: 950_000, FloorPrice: 800_000, CeilingPrice: 1_300_000}); err != nil {
		t.Fatal(err)
	}
	if err := f.engine.RunEvent(ctx, f.eventID); err != nil {
		t.Fatal(err)
	}
	if got := f.basePrice(t, f.zones[0]); got != 950_000 {
		t.Fatalf("automatic pricing overwrote the organizer's price within the cooldown: %d", got)
	}
	overview, err := f.engine.Overview(ctx, f.eventID)
	if err != nil {
		t.Fatal(err)
	}
	if overview.Mode != PricingModeAuto || overview.Zones[0].AutoBlockedBy != "cooldown" {
		t.Fatalf("dashboard should say the cooldown is holding: mode %s, blocked by %q", overview.Mode, overview.Zones[0].AutoBlockedBy)
	}
}

func TestPricing_InsufficientDataHoldsAndAlerts(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	mustExec(t, f.pool, `UPDATE events SET sales_starts_at = now() - interval '10 minutes' WHERE id = $1`, f.eventID)
	if err := f.settings(t, true, false); err != nil {
		t.Fatal(err)
	}
	if err := f.engine.RunEvent(ctx, f.eventID); err != nil {
		t.Fatal(err)
	}
	if n := f.count(t, `SELECT count(*) FROM price_suggestions WHERE event_id = $1`, f.eventID); n != 0 {
		t.Fatalf("%d suggestions without data", n)
	}
	if n := f.count(t, `SELECT count(*) FROM pricing_alerts WHERE event_id = $1 AND kind = $2`, f.eventID, AlertInsufficientData); n != int64(len(f.zones)) {
		t.Fatalf("want an insufficient-data alert per zone, got %d", n)
	}
}

func TestPricing_StaleSuggestionCannotBeApproved(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	var id pgtype.UUID
	mustScan(t, f.pool, `
		INSERT INTO price_suggestions (event_id, zone_id, current_price, suggested_price, reason)
		VALUES ($1, $2, 900000, 990000, 'test') RETURNING id`, []any{&id}, f.eventID, f.zones[0])
	if _, err := f.engine.Approve(ctx, id, f.ownerID); !errors.Is(err, ErrSuggestionStale) {
		t.Fatalf("stale approval: %v", err)
	}
	if _, err := f.engine.Reject(ctx, id, f.ownerID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.engine.Reject(ctx, id, f.ownerID); !errors.Is(err, ErrSuggestionNotPending) {
		t.Fatalf("second rejection: %v", err)
	}
	if got := f.basePrice(t, f.zones[0]); got != 1_000_000 {
		t.Fatalf("rejection changed the price to %d", got)
	}
}

// Holds, releases and price changes racing on one zone must never leave an
// available seat at a price other than the zone's base price.
func TestPricing_ConcurrentHoldsAndRepricingStayConsistent(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	zone := f.zones[0]
	seats := NewSeatService(f.pool, f.q, false)

	var seatIDs []pgtype.UUID
	rows, err := f.pool.Query(ctx, `
		SELECT es.seat_id FROM event_seats es JOIN seats s ON s.id = es.seat_id
		WHERE es.event_id = $1 AND s.zone_id = $2 ORDER BY s.seat_label LIMIT 12`, f.eventID, zone)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id pgtype.UUID
		if err := rows.Scan(&id); err != nil {
			t.Fatal(err)
		}
		seatIDs = append(seatIDs, id)
	}
	rows.Close()

	var wg sync.WaitGroup
	errs := make(chan error, 64)
	for i, seat := range seatIDs {
		user := createCustomer(t, f.q, 9100+i)
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 5 {
				if _, err := seats.HoldSeat(ctx, f.eventID, seat, user); err != nil && !errors.Is(err, ErrSeatNotAvailable) {
					errs <- err
					return
				}
				if err := seats.ReleaseSeat(ctx, f.eventID, seat, user); err != nil && !errors.Is(err, ErrHoldNotFound) {
					errs <- err
					return
				}
			}
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := range 10 {
			price := int64(900_000 + 20_000*i)
			if _, err := f.organizer.UpdateZonePricing(ctx, f.eventID, zone, f.ownerID,
				ZonePricing{BasePrice: price, FloorPrice: 800_000, CeilingPrice: 1_300_000}); err != nil {
				errs <- err
				return
			}
			time.Sleep(5 * time.Millisecond)
		}
	}()
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("concurrent operation failed: %v", err)
	}

	base := f.basePrice(t, zone)
	if n := f.count(t, `
		SELECT count(*) FROM event_seats es JOIN seats s ON s.id = es.seat_id
		WHERE es.event_id = $1 AND s.zone_id = $2 AND es.status = 'AVAILABLE' AND es.current_price <> $3`,
		f.eventID, zone, base); n != 0 {
		t.Fatalf("%d available seats priced differently from the zone's %d", n, base)
	}
}

func mustExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec: %v", err)
	}
}

func mustScan(t *testing.T, pool *pgxpool.Pool, sql string, dst []any, args ...any) {
	t.Helper()
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(dst...); err != nil {
		t.Fatalf("query: %v", err)
	}
}
