package pricing

import (
	"math"
	"strings"
	"testing"
)

func near(t *testing.T, name string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 1e-9 {
		t.Errorf("%s = %v, want %v", name, got, want)
	}
}

// Scenario 1 of docs/dynamic-pricing.md: a Fanzone zone selling fast.
func TestEvaluate_DocsScenarioSurge(t *testing.T) {
	r, err := Evaluate(Inputs{
		Current: 1_200_000, Floor: 1_000_000, Ceiling: 2_000_000,
		Remaining: 300, Held: 120, DemandSeats: 150, WindowMinutes: 15, MinutesLeft: 60, Queue: 250,
	})
	if err != nil {
		t.Fatal(err)
	}
	near(t, "v_actual", r.VelocityActual, 10)
	near(t, "v_target", r.VelocityTarget, 5)
	near(t, "alpha", r.Alpha, 1.73)
	near(t, "delta", r.Delta, 0.1825)
	if r.Suggested != 1_420_000 {
		t.Errorf("suggested = %d, want 1420000", r.Suggested)
	}
	if !r.Significant {
		t.Error("an 18% change must be significant")
	}
}

// Scenario 2 of docs/dynamic-pricing.md: a stand selling slowly.
func TestEvaluate_DocsScenarioSlowSales(t *testing.T) {
	r, err := Evaluate(Inputs{
		Current: 500_000, Floor: 350_000, Ceiling: 700_000,
		Remaining: 800, Held: 16, DemandSeats: 30, WindowMinutes: 15, MinutesLeft: 80,
	})
	if err != nil {
		t.Fatal(err)
	}
	near(t, "alpha", r.Alpha, 0.604)
	near(t, "delta", r.Delta, -0.099)
	if r.Suggested != 450_000 {
		t.Errorf("suggested = %d, want 450000", r.Suggested)
	}
	if !r.Significant {
		t.Error("a 10% change must be significant")
	}
}

func TestEvaluate_SmallChangeIsNotSignificant(t *testing.T) {
	// Velocity on target, no queue, nothing held: alpha = 0.5 + 0.3 + 0.2 = 1.0.
	r, err := Evaluate(Inputs{
		Current: 800_000, Floor: 500_000, Ceiling: 1_000_000,
		Remaining: 100, DemandSeats: 15, WindowMinutes: 15, MinutesLeft: 100,
	})
	if err != nil {
		t.Fatal(err)
	}
	near(t, "alpha", r.Alpha, 1.0)
	if r.Suggested != 800_000 || r.Significant {
		t.Errorf("suggested %d significant %v, want an unchanged price", r.Suggested, r.Significant)
	}
}

func TestEvaluate_StepIsCappedAtTwentyPercent(t *testing.T) {
	r, err := Evaluate(Inputs{
		Current: 1_000_000, Floor: 100_000, Ceiling: 9_000_000,
		Remaining: 10, Held: 10, DemandSeats: 1000, WindowMinutes: 15, MinutesLeft: 10, Queue: 5000,
	})
	if err != nil {
		t.Fatal(err)
	}
	near(t, "delta", r.Delta, MaxStep)
	if r.Suggested != 1_200_000 {
		t.Errorf("suggested = %d, want 1200000", r.Suggested)
	}

	r, err = Evaluate(Inputs{
		Current: 1_000_000, Floor: 100_000, Ceiling: 9_000_000,
		Remaining: 1000, DemandSeats: 0, WindowMinutes: 15, MinutesLeft: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	// alpha = 0.5, so delta = -12.5%: inside the cap.
	near(t, "idle delta", r.Delta, -0.125)
	if r.Suggested != 880_000 {
		t.Errorf("idle suggested = %d, want 880000", r.Suggested)
	}
}

func TestEvaluate_StaysWithinFloorAndCeiling(t *testing.T) {
	hot := Inputs{
		Current: 1_950_000, Floor: 1_000_000, Ceiling: 2_000_000,
		Remaining: 10, Held: 5, DemandSeats: 500, WindowMinutes: 15, MinutesLeft: 10,
	}
	r, err := Evaluate(hot)
	if err != nil {
		t.Fatal(err)
	}
	if r.Suggested != 2_000_000 {
		t.Errorf("hot zone suggested %d, want the ceiling 2000000", r.Suggested)
	}

	cold := Inputs{
		Current: 1_020_000, Floor: 1_000_000, Ceiling: 2_000_000,
		Remaining: 500, DemandSeats: 0, WindowMinutes: 15, MinutesLeft: 10,
	}
	r, err = Evaluate(cold)
	if err != nil {
		t.Fatal(err)
	}
	if r.Suggested != 1_000_000 {
		t.Errorf("cold zone suggested %d, want the floor 1000000", r.Suggested)
	}
}

func TestRound(t *testing.T) {
	tests := []struct {
		name        string
		raw         float64
		floor, ceil int64
		want        int64
	}{
		{"half rounds up", 450_500, 350_000, 700_000, 450_000},
		{"above half rounds up", 455_000, 350_000, 700_000, 460_000},
		{"just below half rounds down", 454_999, 350_000, 700_000, 450_000},
		{"below floor is lifted", 100, 350_000, 700_000, 350_000},
		{"above ceiling is cut", 9_000_000, 350_000, 700_000, 700_000},
		{"rounding past an uneven ceiling uses the ceiling", 698_000, 350_000, 697_000, 697_000},
		{"rounding below an uneven floor uses the floor", 351_000, 353_000, 700_000, 353_000},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Round(tt.raw, tt.floor, tt.ceil); got != tt.want {
				t.Errorf("Round(%v, %d, %d) = %d, want %d", tt.raw, tt.floor, tt.ceil, got, tt.want)
			}
		})
	}
}

func TestEvaluate_RejectsUnusableInputs(t *testing.T) {
	ok := Inputs{Current: 500_000, Floor: 400_000, Ceiling: 600_000, Remaining: 10, WindowMinutes: 15, MinutesLeft: 60}
	if _, err := Evaluate(ok); err != nil {
		t.Fatalf("valid inputs rejected: %v", err)
	}
	for name, mutate := range map[string]func(*Inputs){
		"zero price":   func(in *Inputs) { in.Current = 0 },
		"floor>ceil":   func(in *Inputs) { in.Floor, in.Ceiling = 700_000, 600_000 },
		"no seats":     func(in *Inputs) { in.Remaining = 0 },
		"sales closed": func(in *Inputs) { in.MinutesLeft = 0 },
		"no window":    func(in *Inputs) { in.WindowMinutes = 0 },
	} {
		in := ok
		mutate(&in)
		if _, err := Evaluate(in); err == nil {
			t.Errorf("%s: want an error", name)
		}
	}
}

func TestExplain(t *testing.T) {
	in := Inputs{Remaining: 300, Queue: 250}
	got := Explain(in, Result{VelocityRatio: 2, HeldRatio: 0.4})
	want := "Tốc độ bán gấp 2.0 lần mục tiêu, 250 người xếp hàng chờ và 40% ghế đang bị giữ"
	if got != want {
		t.Errorf("Explain = %q, want %q", got, want)
	}
	got = Explain(Inputs{}, Result{VelocityRatio: 0.2, HeldRatio: 0.02})
	if !strings.HasPrefix(got, "Tốc độ bán chỉ đạt 20% mục tiêu") || !strings.Contains(got, "không có hàng chờ") {
		t.Errorf("Explain slow = %q", got)
	}
}
