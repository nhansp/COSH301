package pricing

import (
	"math"
	"testing"
	"time"
)

var now = time.Date(2026, 11, 24, 12, 0, 0, 0, time.UTC)

var limits = Limits{MaxStepPct: 10, Cooldown: time.Hour}

// zone is a 100-seat zone at 1.000.000đ, halfway through a two-day sale.
func zone() ZoneInput {
	return ZoneInput{
		Now:          now,
		SalesOpen:    now.Add(-24 * time.Hour),
		SalesClose:   now.Add(24 * time.Hour),
		CurrentPrice: 1_000_000, FloorPrice: 800_000, CeilingPrice: 1_300_000, ListPrice: 1_000_000,
		Capacity: 100, Available: 100,
		PaymentsLive: true,
	}
}

func TestRecommend_ColdStartHoldsPrice(t *testing.T) {
	in := zone()
	in.SalesOpen = now.Add(-30 * time.Minute)
	r := Default().Recommend(in, limits)
	if !r.InsufficientData || r.Action != Maintain || r.Price != in.CurrentPrice {
		t.Fatalf("cold start: %+v", r)
	}
}

func TestRecommend_StrongDemandRaisesWithinStep(t *testing.T) {
	in := zone()
	in.Available, in.Held, in.Sold = 25, 10, 65
	in.Holds1h, in.Holds24h, in.HoldsTotal = 8, 70, 90
	in.Sales24h, in.SalesTotal = 60, 65
	r := Default().Recommend(in, limits)
	if r.Action != Increase {
		t.Fatalf("want increase, got %+v", r)
	}
	if r.Price > 1_100_000 || r.Price%10_000 != 0 {
		t.Fatalf("price %d breaks the 10%% step or rounding", r.Price)
	}
	if r.RangeLow > r.Price || r.Price > r.RangeHigh {
		t.Fatalf("price %d outside range [%d, %d]", r.Price, r.RangeLow, r.RangeHigh)
	}
	if r.Explanation == "" || len(r.Factors) == 0 {
		t.Fatal("recommendation has no explanation")
	}
}

// Selling fast is not enough when the seats left cannot sell in the time left.
func TestRecommend_FastSalesButTooMuchInventoryLowers(t *testing.T) {
	in := zone()
	in.Capacity, in.Available, in.Sold = 1000, 900, 100
	in.SalesOpen, in.SalesClose = now.Add(-46*time.Hour), now.Add(2*time.Hour)
	in.Holds1h, in.Holds24h, in.HoldsTotal = 40, 90, 200
	in.Sales24h, in.SalesTotal = 80, 100
	r := Default().Recommend(in, limits)
	if r.Velocity < 10 {
		t.Fatalf("setup should sell fast, velocity %.1f", r.Velocity)
	}
	if r.Action != Decrease {
		t.Fatalf("want decrease, got %s: %s", r.Action, r.Explanation)
	}
	if r.Price < 900_000 {
		t.Fatalf("price %d moved more than 10%%", r.Price)
	}
}

func TestRecommend_SlowSalesStopAtFloor(t *testing.T) {
	in := zone()
	in.CurrentPrice = 820_000
	in.SalesOpen, in.SalesClose = now.Add(-70*time.Hour), now.Add(2*time.Hour)
	r := Default().Recommend(in, limits)
	if r.Action != Decrease || r.Price != in.FloorPrice {
		t.Fatalf("want decrease to the floor, got %s %d", r.Action, r.Price)
	}

	in.CurrentPrice = in.FloorPrice
	r = Default().Recommend(in, limits)
	if r.Action != Maintain || !r.AtFloor {
		t.Fatalf("at the floor: %+v", r)
	}
}

func TestRecommend_AtCeilingMaintains(t *testing.T) {
	in := zone()
	in.CurrentPrice = in.CeilingPrice
	in.Available, in.Held, in.Sold = 25, 10, 65
	in.Holds1h, in.Holds24h, in.HoldsTotal = 8, 70, 90
	in.Sales24h, in.SalesTotal = 60, 65
	r := Default().Recommend(in, limits)
	if r.Action != Maintain || !r.AtCeiling {
		t.Fatalf("at the ceiling: %+v", r)
	}
}

func TestRecommend_OnTrackMaintains(t *testing.T) {
	in := zone()
	m := Default()
	// Sold exactly what the curve expects, at exactly the pace needed to sell out.
	expected := m.expectedShare(0.5)
	in.Sold = int64(math.Round(expected * 100))
	in.Available = 100 - in.Sold
	perHour := float64(in.Available) / 24
	in.Holds1h = int64(math.Round(perHour / m.P.DefaultConversion))
	in.Holds24h = in.Holds1h * 24
	in.PaymentsLive = false
	r := m.Recommend(in, limits)
	if r.Action != Maintain || r.DemandLevel != DemandOnTrack {
		t.Fatalf("on track: %s %.2f %s", r.Action, r.DemandIndex, r.Explanation)
	}
}

func TestRecommend_PreviousDemandDampsSwing(t *testing.T) {
	in := zone()
	in.Available, in.Held, in.Sold = 25, 10, 65
	in.Holds1h, in.Holds24h, in.HoldsTotal = 8, 70, 90
	in.Sales24h, in.SalesTotal = 60, 65
	fresh := Default().Recommend(in, limits)
	in.PreviousDemand = 0.8
	damped := Default().Recommend(in, limits)
	if damped.DemandIndex >= fresh.DemandIndex {
		t.Fatalf("smoothing did not damp: %.2f vs %.2f", damped.DemandIndex, fresh.DemandIndex)
	}
}

func TestRecommend_SalesClosedAndSoldOut(t *testing.T) {
	in := zone()
	in.SalesClose = now.Add(-time.Minute)
	if r := Default().Recommend(in, limits); !r.SalesClosed || r.Action != Maintain {
		t.Fatalf("closed: %+v", r)
	}
	in = zone()
	in.Available, in.Sold = 0, 100
	if r := Default().Recommend(in, limits); !r.SoldOut || r.Action != Maintain {
		t.Fatalf("sold out: %+v", r)
	}
}

func TestAutoDecision(t *testing.T) {
	in := zone()
	up := Recommendation{Action: Increase}
	down := Recommendation{Action: Decrease}

	if ok, _ := AutoDecision(up, in, limits); !ok {
		t.Fatal("first change should apply")
	}
	if ok, why := AutoDecision(Recommendation{Action: Increase, InsufficientData: true}, in, limits); ok || why != "insufficient_data" {
		t.Fatalf("insufficient data applied: %v %s", ok, why)
	}

	in.LastChangeAt, in.LastChangeDirection = now.Add(-30*time.Minute), 1
	if ok, why := AutoDecision(up, in, limits); ok || why != "cooldown" {
		t.Fatalf("cooldown: %v %s", ok, why)
	}

	in.LastChangeAt = now.Add(-90 * time.Minute)
	if ok, _ := AutoDecision(up, in, limits); !ok {
		t.Fatal("same direction after cooldown should apply")
	}
	if ok, why := AutoDecision(down, in, limits); ok || why != "reversal_guard" {
		t.Fatalf("reversal: %v %s", ok, why)
	}

	in.LastChangeAt = now.Add(-3 * time.Hour)
	if ok, _ := AutoDecision(down, in, limits); !ok {
		t.Fatal("reversal after twice the cooldown should apply")
	}
}

func TestExpectedShare(t *testing.T) {
	m := Default()
	if m.expectedShare(0) != 0 || math.Abs(m.expectedShare(1)-1) > 1e-9 {
		t.Fatalf("curve ends: %v %v", m.expectedShare(0), m.expectedShare(1))
	}
	prev := 0.0
	for i := 1; i <= 100; i++ {
		v := m.expectedShare(float64(i) / 100)
		if v < prev {
			t.Fatalf("curve falls at t=%.2f", float64(i)/100)
		}
		prev = v
	}
}

func TestFormatVND(t *testing.T) {
	for in, want := range map[int64]string{1_420_000: "1.420.000đ", 0: "0đ", 950: "950đ", 12_000_000: "12.000.000đ"} {
		if got := FormatVND(in); got != want {
			t.Errorf("FormatVND(%d) = %q, want %q", in, got, want)
		}
	}
}
