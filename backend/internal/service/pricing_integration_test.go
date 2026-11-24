package service

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/config"
	"eventticketing/internal/store"
	"eventticketing/internal/testdb"
)

// pricingEnv is an isolated event on sale, 24 seats at 1.000.000 (floor 800.000, ceiling 1.200.000),
// whose sales close in two hours: the target pace is 24 / 120 = 0.2 seats per minute.
type pricingEnv struct {
	pool    *pgxpool.Pool
	q       *store.Queries
	pricing *PricingService
	seats   *SeatService
	org     *OrganizerService
	fx      *testdb.Fixture
}

func newPricingEnv(t *testing.T) *pricingEnv {
	t.Helper()
	pool, q := testdb.Open(t)
	return &pricingEnv{
		pool: pool,
		q:    q,
		pricing: NewPricingService(pool, q, config.PricingConfig{
			Interval:              5 * time.Minute,
			WindowMinutes:         15,
			RejectCooldownMinutes: 60,
		}),
		seats: NewSeatService(pool, q, false),
		org:   NewOrganizerService(pool, q),
		fx:    testdb.Event(t, pool, testdb.Options{}),
	}
}

// hold makes a fresh customer hold the first n seats that are free.
func (e *pricingEnv) hold(t *testing.T, n int) pgtype.UUID {
	t.Helper()
	user := testdb.User(t, e.pool, "CUSTOMER")
	for _, seat := range e.fx.SeatIDs {
		if n == 0 {
			break
		}
		if _, err := e.seats.HoldSeat(context.Background(), e.fx.EventID, seat, user); errors.Is(err, ErrSeatNotAvailable) {
			continue
		} else if err != nil {
			t.Fatalf("hold: %v", err)
		}
		n--
	}
	return user
}

func (e *pricingEnv) run(t *testing.T) RunSummary {
	t.Helper()
	sum, err := e.pricing.RunEvent(context.Background(), e.fx.EventID)
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	return sum
}

func (e *pricingEnv) zone(t *testing.T) ZonePricingState {
	t.Helper()
	ov, err := e.pricing.Overview(context.Background(), e.fx.EventID)
	if err != nil {
		t.Fatalf("overview: %v", err)
	}
	if len(ov.Zones) != 1 {
		t.Fatalf("overview has %d zones, want 1", len(ov.Zones))
	}
	return ov.Zones[0]
}

func (e *pricingEnv) pending(t *testing.T) *ZoneSuggestionDTO {
	t.Helper()
	return e.zone(t).Pending
}

func (e *pricingEnv) seatPrices(t *testing.T) map[string]int64 {
	t.Helper()
	rows, err := e.pool.Query(context.Background(),
		`SELECT status, current_price::bigint FROM event_seats WHERE event_id = $1 ORDER BY status, current_price`, e.fx.EventID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	prices := map[string]int64{}
	for rows.Next() {
		var status string
		var price int64
		if err := rows.Scan(&status, &price); err != nil {
			t.Fatal(err)
		}
		if old, seen := prices[status]; seen && old != price {
			t.Fatalf("%s seats have different prices (%d and %d)", status, old, price)
		}
		prices[status] = price
	}
	return prices
}

func (e *pricingEnv) basePrice(t *testing.T) int64 {
	t.Helper()
	var p int64
	if err := e.pool.QueryRow(context.Background(),
		`SELECT base_price::bigint FROM event_zones WHERE event_id = $1`, e.fx.EventID).Scan(&p); err != nil {
		t.Fatal(err)
	}
	return p
}

func (e *pricingEnv) priceChanges(t *testing.T) (count int, reason string, by pgtype.UUID) {
	t.Helper()
	err := e.pool.QueryRow(context.Background(),
		`SELECT count(*), coalesce(max(reason), ''), (array_agg(changed_by))[1] FROM price_changes WHERE event_id = $1`,
		e.fx.EventID).Scan(&count, &reason, &by)
	if err != nil {
		t.Fatal(err)
	}
	return count, reason, by
}

func TestPricing_SuggestionFollowsRealHoldsAndSales(t *testing.T) {
	e := newPricingEnv(t)

	// Nobody has held or bought anything: alpha = 0 + 0.3 + 0.2 = 0.5, so the model suggests -12.5%.
	if sum := e.run(t); sum.Created != 1 {
		t.Fatalf("first run: %+v, want one created suggestion", sum)
	}
	idle := e.pending(t)
	if idle == nil {
		t.Fatal("no suggestion for an idle zone")
	}
	if idle.CurrentPrice != 1_000_000 || idle.SuggestedPrice != 880_000 {
		t.Fatalf("idle suggestion %d -> %d, want 1000000 -> 880000", idle.CurrentPrice, idle.SuggestedPrice)
	}

	// 12 of 24 seats get held: v_actual = 12/15 = 0.8 against v_target 0.2, so the model suggests +20% (the cap).
	e.hold(t, 12)
	if sum := e.run(t); sum.Updated != 1 || sum.Created != 0 {
		t.Fatalf("second run: %+v, want the open suggestion refreshed", sum)
	}
	hot := e.pending(t)
	if hot.ID != idle.ID {
		t.Fatalf("a new suggestion %s replaced %s; one open suggestion per zone must be refreshed in place", hot.ID, idle.ID)
	}
	if hot.SuggestedPrice != 1_200_000 {
		t.Fatalf("hot suggestion = %d, want 1200000", hot.SuggestedPrice)
	}
	var in ZoneInputs
	if err := json.Unmarshal(hot.Inputs, &in); err != nil {
		t.Fatal(err)
	}
	if in.DemandSeats != 12 || in.Held != 12 || in.Remaining != 24 || in.Sold != 0 {
		t.Fatalf("stored inputs %+v do not match 12 held of 24 seats", in)
	}

	// Seats that are sold count as demand and leave the stock.
	if _, err := e.pool.Exec(context.Background(),
		`UPDATE event_seats SET status = 'SOLD' WHERE event_id = $1 AND status = 'AVAILABLE' AND seat_id IN (
			SELECT seat_id FROM event_seats WHERE event_id = $1 AND status = 'AVAILABLE' LIMIT 4)`, e.fx.EventID); err != nil {
		t.Fatal(err)
	}
	z := e.zone(t)
	if z.Inputs.Sold != 4 || z.Inputs.Remaining != 20 || z.Inputs.FillRate < 0.16 || z.Inputs.FillRate > 0.17 {
		t.Fatalf("live inputs %+v, want 4 sold, 20 left, fill rate 4/24", *z.Inputs)
	}

	// W-01: the engine never touches a price by itself.
	if got := e.basePrice(t); got != 1_000_000 {
		t.Fatalf("base price changed to %d without approval", got)
	}
	if n, _, _ := e.priceChanges(t); n != 0 {
		t.Fatalf("%d price changes logged without approval", n)
	}
}

func TestPricing_ApproveReprices_AvailableSeatsOnly(t *testing.T) {
	e := newPricingEnv(t)
	ctx := context.Background()
	e.hold(t, 12)
	if _, err := e.pool.Exec(ctx,
		`UPDATE event_seats SET status = 'SOLD' WHERE event_id = $1 AND status = 'AVAILABLE' AND seat_id IN (
			SELECT seat_id FROM event_seats WHERE event_id = $1 AND status = 'AVAILABLE' LIMIT 3)`, e.fx.EventID); err != nil {
		t.Fatal(err)
	}
	e.run(t)
	sg := e.pending(t)
	if sg == nil || sg.SuggestedPrice <= sg.CurrentPrice {
		t.Fatalf("expected a price increase, got %+v", sg)
	}

	// Listen for the price announcement the seat map relies on.
	listener, err := pgx.Connect(ctx, testdb.URL())
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close(ctx)
	if _, err := listener.Exec(ctx, "LISTEN "+SeatNotificationChannel); err != nil {
		t.Fatal(err)
	}

	approver := e.fx.OrganizerID
	res, err := e.pricing.Approve(ctx, store.MustStringToUUID(sg.ID), approver)
	if err != nil {
		t.Fatalf("approve: %v", err)
	}
	if res.OldPrice != 1_000_000 || res.NewPrice != sg.SuggestedPrice || res.RepricedSeats != 9 {
		t.Fatalf("approval %+v, want 9 available seats repriced to %d", *res, sg.SuggestedPrice)
	}

	if got := e.basePrice(t); got != sg.SuggestedPrice {
		t.Fatalf("base price %d, want %d", got, sg.SuggestedPrice)
	}
	prices := e.seatPrices(t)
	if prices["AVAILABLE"] != sg.SuggestedPrice {
		t.Fatalf("available seats cost %d, want %d", prices["AVAILABLE"], sg.SuggestedPrice)
	}
	if prices["HELD"] != 1_000_000 || prices["SOLD"] != 1_000_000 {
		t.Fatalf("held seats cost %d and sold seats %d, both must keep 1000000", prices["HELD"], prices["SOLD"])
	}

	n, reason, by := e.priceChanges(t)
	if n != 1 || reason != ReasonDynamic || by != approver {
		t.Fatalf("price log: %d rows, reason %q, by %v; want one DYNAMIC row by the approver", n, reason, by)
	}
	if z := e.zone(t); z.Pending != nil {
		t.Fatalf("approved suggestion is still open: %+v", z.Pending)
	}

	waitCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	// Test packages share the database, so skip announcements about other events.
	var msg PriceChangeMessage
	for msg.EventID != store.UUIDToString(e.fx.EventID) {
		note, err := listener.WaitForNotification(waitCtx)
		if err != nil {
			t.Fatalf("no price announcement for this event: %v", err)
		}
		if err := json.Unmarshal([]byte(note.Payload), &msg); err != nil {
			t.Fatal(err)
		}
	}
	if msg.Type != PriceChangedType || msg.OldPrice != 1_000_000 || msg.NewPrice != sg.SuggestedPrice {
		t.Fatalf("announcement %+v does not describe the approved change", msg)
	}

	// A held seat takes the new price once it returns to sale.
	var heldSeat pgtype.UUID
	var holder pgtype.UUID
	if err := e.pool.QueryRow(ctx,
		`SELECT seat_id, user_id FROM seat_holds WHERE event_id = $1 AND status = 'ACTIVE' LIMIT 1`, e.fx.EventID).Scan(&heldSeat, &holder); err != nil {
		t.Fatal(err)
	}
	if err := e.seats.ReleaseSeat(ctx, e.fx.EventID, heldSeat, holder); err != nil {
		t.Fatal(err)
	}
	var price int64
	if err := e.pool.QueryRow(ctx, `SELECT current_price::bigint FROM event_seats WHERE event_id = $1 AND seat_id = $2`,
		e.fx.EventID, heldSeat).Scan(&price); err != nil {
		t.Fatal(err)
	}
	if price != sg.SuggestedPrice {
		t.Fatalf("released seat costs %d, want %d", price, sg.SuggestedPrice)
	}
}

func TestPricing_RejectLeavesPrices(t *testing.T) {
	e := newPricingEnv(t)
	ctx := context.Background()
	e.hold(t, 12)
	e.run(t)
	sg := e.pending(t)
	if sg == nil {
		t.Fatal("no suggestion")
	}

	if err := e.pricing.Reject(ctx, store.MustStringToUUID(sg.ID), e.fx.OrganizerID); err != nil {
		t.Fatalf("reject: %v", err)
	}
	if got := e.basePrice(t); got != 1_000_000 {
		t.Fatalf("base price %d after a rejection", got)
	}
	if p := e.seatPrices(t); p["AVAILABLE"] != 1_000_000 || p["HELD"] != 1_000_000 {
		t.Fatalf("seat prices %v changed by a rejection", p)
	}
	if n, _, _ := e.priceChanges(t); n != 0 {
		t.Fatalf("%d price changes after a rejection", n)
	}
	if err := e.pricing.Reject(ctx, store.MustStringToUUID(sg.ID), e.fx.OrganizerID); !errors.Is(err, ErrSuggestionNotPending) {
		t.Fatalf("second reject: %v, want ErrSuggestionNotPending", err)
	}
	if _, err := e.pricing.Approve(ctx, store.MustStringToUUID(sg.ID), e.fx.OrganizerID); !errors.Is(err, ErrSuggestionNotPending) {
		t.Fatalf("approve after reject: %v, want ErrSuggestionNotPending", err)
	}

	// The same change is not offered again right away, but different data gives a new suggestion.
	if sum := e.run(t); sum.Created != 0 {
		t.Fatalf("a rejected suggestion came back: %+v", sum)
	}
	if e.pending(t) != nil {
		t.Fatal("a rejected suggestion is open again")
	}
}

func TestPricing_ConcurrentApproveAppliesOnce(t *testing.T) {
	e := newPricingEnv(t)
	ctx := context.Background()
	e.hold(t, 12)
	e.run(t)
	sg := e.pending(t)
	if sg == nil {
		t.Fatal("no suggestion")
	}
	id := store.MustStringToUUID(sg.ID)

	const clickers = 8
	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		applied int
		others  []error
	)
	start := make(chan struct{})
	for range clickers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := e.pricing.Approve(ctx, id, e.fx.OrganizerID)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				applied++
			} else {
				others = append(others, err)
			}
		}()
	}
	close(start)
	wg.Wait()

	if applied != 1 {
		t.Fatalf("%d approvals applied, want exactly 1", applied)
	}
	for _, err := range others {
		if !errors.Is(err, ErrSuggestionNotPending) {
			t.Errorf("losing approval returned %v, want ErrSuggestionNotPending", err)
		}
	}
	if n, _, _ := e.priceChanges(t); n != 1 {
		t.Fatalf("%d price changes logged, want 1", n)
	}
	if got := e.basePrice(t); got != sg.SuggestedPrice {
		t.Fatalf("base price %d, want %d (applied once, not compounded)", got, sg.SuggestedPrice)
	}
}

func TestPricing_PriceStaysWithinFloorAndCeiling(t *testing.T) {
	e := newPricingEnv(t)
	ctx := context.Background()
	e.hold(t, 12)

	// Keep approving while demand stays hot: the price climbs to the ceiling and stops there.
	for range 6 {
		e.run(t)
		sg := e.pending(t)
		if sg == nil {
			break
		}
		if sg.SuggestedPrice > 1_200_000 || sg.SuggestedPrice < 800_000 {
			t.Fatalf("suggested %d is outside [800000, 1200000]", sg.SuggestedPrice)
		}
		if _, err := e.pricing.Approve(ctx, store.MustStringToUUID(sg.ID), e.fx.OrganizerID); err != nil {
			t.Fatalf("approve: %v", err)
		}
	}
	if got := e.basePrice(t); got != 1_200_000 {
		t.Fatalf("base price %d, want the ceiling 1200000", got)
	}
	e.run(t)
	if e.pending(t) != nil {
		t.Fatal("a suggestion exists although the price is at the ceiling")
	}
}

func TestPricing_ManualChangeInvalidatesSuggestion(t *testing.T) {
	e := newPricingEnv(t)
	ctx := context.Background()
	e.hold(t, 12)
	e.run(t)
	sg := e.pending(t)
	if sg == nil {
		t.Fatal("no suggestion")
	}

	// The organizer sets a price by hand: the suggestion made for the old price is withdrawn.
	if _, err := e.org.UpdateZonePricing(ctx, e.fx.EventID, e.fx.ZoneID, e.fx.OrganizerID,
		ZonePricing{BasePrice: 900_000, FloorPrice: 800_000, CeilingPrice: 1_200_000}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.pricing.Approve(ctx, store.MustStringToUUID(sg.ID), e.fx.OrganizerID); !errors.Is(err, ErrSuggestionNotPending) {
		t.Fatalf("approve after a manual change: %v, want ErrSuggestionNotPending", err)
	}
	if got := e.basePrice(t); got != 900_000 {
		t.Fatalf("base price %d, want the manual 900000", got)
	}
}

func TestPricing_StaleSuggestionIsRefused(t *testing.T) {
	e := newPricingEnv(t)
	ctx := context.Background()
	e.hold(t, 12)
	e.run(t)
	sg := e.pending(t)
	if sg == nil {
		t.Fatal("no suggestion")
	}

	// The ceiling drops below the suggestion without going through the service.
	if _, err := e.pool.Exec(ctx,
		`UPDATE event_zones SET ceiling_price = 1050000 WHERE event_id = $1`, e.fx.EventID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.pricing.Approve(ctx, store.MustStringToUUID(sg.ID), e.fx.OrganizerID); !errors.Is(err, ErrSuggestionStale) {
		t.Fatalf("approve above the ceiling: %v, want ErrSuggestionStale", err)
	}
	if got := e.basePrice(t); got != 1_000_000 {
		t.Fatalf("base price %d changed by a refused approval", got)
	}
	if n, _, _ := e.priceChanges(t); n != 0 {
		t.Fatalf("%d price changes after a refused approval", n)
	}
}

func TestPricing_DisabledZoneAndClosedSalesGetNoSuggestion(t *testing.T) {
	e := newPricingEnv(t)
	ctx := context.Background()
	e.hold(t, 12)
	e.run(t)
	if e.pending(t) == nil {
		t.Fatal("no suggestion")
	}

	if err := e.pricing.SetZoneEnabled(ctx, e.fx.EventID, e.fx.ZoneID, false); err != nil {
		t.Fatal(err)
	}
	if e.pending(t) != nil {
		t.Fatal("turning the zone off left its suggestion open")
	}
	if sum := e.run(t); sum.Created != 0 {
		t.Fatalf("a disabled zone got a suggestion: %+v", sum)
	}

	if err := e.pricing.SetZoneEnabled(ctx, e.fx.EventID, e.fx.ZoneID, true); err != nil {
		t.Fatal(err)
	}
	if sum := e.run(t); sum.Created != 1 {
		t.Fatalf("re-enabled zone: %+v, want a suggestion", sum)
	}

	if _, err := e.pool.Exec(ctx, `UPDATE events SET status = 'PAUSED' WHERE id = $1`, e.fx.EventID); err != nil {
		t.Fatal(err)
	}
	e.run(t)
	z := e.zone(t)
	if z.Pending != nil || z.Analysis != "sales_closed" {
		t.Fatalf("paused event: pending %v, analysis %q; want no suggestion and sales_closed", z.Pending, z.Analysis)
	}
}

func TestPricing_TargetHorizonCapsTimeLeft(t *testing.T) {
	e := newPricingEnv(t)
	e.pricing.cfg.TargetHorizonMinutes = 30
	z := e.zone(t)
	if z.Inputs == nil || z.Inputs.MinutesLeft != 30 {
		t.Fatalf("minutes left %+v, want the 30 minute horizon", z.Inputs)
	}
	// 24 seats in 30 minutes: 0.8 per minute.
	if z.Inputs.VelocityTarget < 0.79 || z.Inputs.VelocityTarget > 0.81 {
		t.Fatalf("target velocity %v, want 0.8", z.Inputs.VelocityTarget)
	}
}
