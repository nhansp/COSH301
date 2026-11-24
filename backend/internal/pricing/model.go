// Package pricing computes dynamic price suggestions (FR-22).
//
// It is a pure model: it reads no database and has no side effects. The
// formulas and constants follow docs/dynamic-pricing.md, section 4.
package pricing

import (
	"fmt"
	"math"
	"strings"
)

const (
	// WeightVelocity, WeightQueue and WeightHeld weigh the three demand signals in alpha. They sum to 1.
	WeightVelocity = 0.50
	WeightQueue    = 0.30
	WeightHeld     = 0.20

	// QueueTarget is the waiting-room size that doubles the queue signal.
	QueueTarget = 500

	// Sensitivity is how far one unit of alpha above or below 1 moves the price.
	Sensitivity = 0.25
	// MaxStep caps the price change of one cycle (20%).
	MaxStep = 0.20
	// MinChange is the smallest relative change worth suggesting (5%).
	MinChange = 0.05
	// RoundTo is the VND step suggested prices are rounded to.
	RoundTo = 10_000
)

// Inputs are the measurements of one zone at one moment.
type Inputs struct {
	Current int64 // P_current: price now
	Floor   int64 // P_floor
	Ceiling int64 // P_ceiling

	Remaining int // S_rem: seats not sold yet (AVAILABLE and HELD)
	Held      int // S_held: seats currently held
	// DemandSeats is the number of distinct seats held or sold during the window.
	DemandSeats   int
	WindowMinutes float64 // length of the sliding window
	MinutesLeft   float64 // T_rem: time until sales close
	Queue         int     // Q: people waiting in the waiting room
}

// Result is the outcome of evaluating one zone.
type Result struct {
	VelocityActual float64 // v_actual, seats per minute
	VelocityTarget float64 // v_target, seats per minute
	VelocityRatio  float64 // v_actual / v_target
	HeldRatio      float64 // r_held
	Alpha          float64 // market pressure
	Delta          float64 // clamped price adjustment
	Raw            float64 // P_raw before clamping and rounding
	Suggested      int64   // P_suggested, always within [Floor, Ceiling]
	// Change is (Suggested - Current) / Current.
	Change float64
	// Significant is true when |Change| reaches MinChange, so a suggestion is worth making.
	Significant bool
}

// Evaluate computes the suggested price for a zone.
func Evaluate(in Inputs) (Result, error) {
	switch {
	case in.Current <= 0:
		return Result{}, fmt.Errorf("current price must be positive, got %d", in.Current)
	case in.Floor > in.Ceiling:
		return Result{}, fmt.Errorf("floor %d is above ceiling %d", in.Floor, in.Ceiling)
	case in.Remaining <= 0:
		return Result{}, fmt.Errorf("no seats left to price")
	case in.MinutesLeft <= 0 || in.WindowMinutes <= 0:
		return Result{}, fmt.Errorf("time left and window must be positive")
	}

	var r Result
	r.VelocityActual = float64(in.DemandSeats) / in.WindowMinutes
	r.VelocityTarget = float64(in.Remaining) / in.MinutesLeft
	r.VelocityRatio = r.VelocityActual / r.VelocityTarget
	r.HeldRatio = float64(in.Held) / float64(in.Remaining)

	r.Alpha = WeightVelocity*r.VelocityRatio +
		WeightQueue*(1+float64(in.Queue)/QueueTarget) +
		WeightHeld*(1+r.HeldRatio)
	r.Delta = clamp(Sensitivity*(r.Alpha-1), -MaxStep, MaxStep)
	r.Raw = float64(in.Current) * (1 + r.Delta)

	r.Suggested = Round(r.Raw, in.Floor, in.Ceiling)
	r.Change = float64(r.Suggested-in.Current) / float64(in.Current)
	r.Significant = math.Abs(r.Change) >= MinChange
	return r, nil
}

// Round limits raw to [floor, ceiling], rounds it to a multiple of RoundTo
// and limits it again, so that a bound that is not a multiple of RoundTo wins.
func Round(raw float64, floor, ceiling int64) int64 {
	limited := math.Max(float64(floor), math.Min(float64(ceiling), raw))
	rounded := int64(math.Floor(limited/RoundTo+0.5)) * RoundTo
	return max(floor, min(ceiling, rounded))
}

func clamp(v, lo, hi float64) float64 {
	return math.Max(lo, math.Min(hi, v))
}

// Explain describes in Vietnamese why the model suggests the price it does.
func Explain(in Inputs, r Result) string {
	var parts []string
	switch ratio := r.VelocityRatio; {
	case ratio >= 1.2:
		parts = append(parts, fmt.Sprintf("Tốc độ bán gấp %.1f lần mục tiêu", ratio))
	case ratio <= 0.8:
		parts = append(parts, fmt.Sprintf("Tốc độ bán chỉ đạt %.0f%% mục tiêu", ratio*100))
	default:
		parts = append(parts, fmt.Sprintf("Tốc độ bán sát mục tiêu (%.0f%%)", ratio*100))
	}
	if in.Queue > 0 {
		parts = append(parts, fmt.Sprintf("%d người xếp hàng chờ", in.Queue))
	} else {
		parts = append(parts, "không có hàng chờ")
	}
	parts = append(parts, fmt.Sprintf("%.0f%% ghế đang bị giữ", r.HeldRatio*100))

	last := len(parts) - 1
	return strings.Join(parts[:last], ", ") + " và " + parts[last]
}
