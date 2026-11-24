package pricing

import (
	"cmp"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"
)

// Params tune DemandModel. Default documents every value.
type Params struct {
	// Weights of the log demand index. They sum to 1, so a zone that meets
	// every target scores exactly 1.
	WeightPace       float64
	WeightTrajectory float64
	WeightQueue      float64
	WeightHeld       float64
	WeightInterest   float64

	// Elasticity is the assumed |price elasticity of demand|: to bring demand
	// back to target by a factor d, the price moves by d^(1/Elasticity).
	Elasticity float64

	// DefaultConversion is the hold-to-ticket rate assumed before payments
	// produce real tickets; ConversionPrior is how many holds that guess is worth.
	DefaultConversion float64
	ConversionPrior   float64

	// Confidence grows with evidence (holds, tickets, views / 10, or the sales
	// the curve expected by now) on this scale, and with time since sales opened.
	ConfidenceScale float64
	WarmupHours     float64
	MinConfidence   float64

	// Smoothing is the weight of this run's index against the previous run's.
	Smoothing float64

	MinChangePct int
	RoundTo      int64

	// The expected booking curve: a share of sales right after sales open,
	// decaying at CurveOnsaleRate, and the rest arriving late as t^CurveLateExponent.
	CurveOnsaleShare  float64
	CurveOnsaleRate   float64
	CurveLateExponent float64

	// A demand index above FastIndex or below SlowIndex raises an alert.
	FastIndex float64
	SlowIndex float64

	// Suggested bounds around the list price, before widening for demand.
	BoundsBelow float64
	BoundsAbove float64
}

func Default() DemandModel {
	return DemandModel{P: Params{
		WeightPace:        0.35,
		WeightTrajectory:  0.30,
		WeightQueue:       0.15,
		WeightHeld:        0.10,
		WeightInterest:    0.10,
		Elasticity:        2.0,
		DefaultConversion: 0.5,
		ConversionPrior:   10,
		ConfidenceScale:   8,
		WarmupHours:       2,
		MinConfidence:     0.35,
		Smoothing:         0.5,
		MinChangePct:      5,
		RoundTo:           10_000,
		CurveOnsaleShare:  0.55,
		CurveOnsaleRate:   6,
		CurveLateExponent: 3,
		FastIndex:         1.5,
		SlowIndex:         0.6,
		BoundsBelow:       0.20,
		BoundsAbove:       0.25,
	}}
}

// DemandModel compares a zone's sales with what it needs to sell out and with
// a typical booking curve, then moves the price toward the level where demand
// meets the remaining inventory.
type DemandModel struct{ P Params }

func (m DemandModel) SellingFast(r Recommendation) bool {
	return !r.InsufficientData && r.Confidence >= 0.5 && r.DemandIndex >= m.P.FastIndex
}

func (m DemandModel) SellingSlow(r Recommendation) bool {
	return !r.InsufficientData && r.Confidence >= 0.5 && r.DemandIndex <= m.P.SlowIndex
}

func (m DemandModel) Recommend(in ZoneInput, lim Limits) Recommendation {
	p := m.P
	cur := in.CurrentPrice
	rec := Recommendation{
		Action: Maintain, Price: cur, RangeLow: cur, RangeHigh: cur,
		DemandIndex: 1, DemandLevel: DemandOnTrack, Performance: 1,
	}
	rec.SuggestedFloor, rec.SuggestedCeiling = m.suggestedBounds(in, 1, cur)

	hoursLeft := in.SalesClose.Sub(in.Now).Hours()
	switch {
	case hoursLeft <= 0:
		rec.SalesClosed = true
		rec.Explanation = "Đã hết thời gian bán vé, không đề xuất giá."
		return rec
	case in.Capacity <= 0 || cur <= 0:
		rec.InsufficientData = true
		rec.Explanation = "Khu vực chưa có ghế hoặc chưa có giá."
		return rec
	case in.Available+in.Held == 0:
		rec.SoldOut = true
		rec.Explanation = "Khu vực đã bán hết, không còn ghế để định giá."
		return rec
	}

	elapsed := math.Max(in.Now.Sub(in.SalesOpen).Hours(), 0)
	conv := m.conversion(in)
	committed := float64(in.Sold) + conv*float64(in.Held)
	remaining := math.Max(float64(in.Capacity)-committed, 0)

	// Two windows: the last hour reacts quickly, the last day steadies it.
	short := conv * float64(in.Holds1h) / clampF(elapsed, 0.25, 1)
	long := conv * float64(in.Holds24h) / clampF(elapsed, 0.25, 24)
	velocity := 0.6*short + 0.4*long
	required := remaining / hoursLeft
	pace := (velocity + 0.1) / (required + 0.1)

	t := elapsed / (elapsed + hoursLeft)
	expected := m.expectedShare(t)
	actual := committed / float64(in.Capacity)
	trajectory := (actual + 0.02) / (expected + 0.02)

	queue := 1.0
	if in.QueueCapacity > 0 {
		queue = 1 + float64(in.QueueWaiting)/float64(in.QueueCapacity)
	}
	heldPressure := 1 + float64(in.Held)/float64(in.Available+in.Held)
	interest, viewRate, baseRate, interestKnown := m.interest(in.Interest)

	factors := []Factor{
		{Key: "pace", Value: pace, Effect: p.WeightPace * math.Log(pace),
			Text: fmt.Sprintf("bán %.1f vé/giờ, cần %.1f vé/giờ để hết ghế trước giờ đóng bán", velocity, required)},
		{Key: "trajectory", Value: trajectory, Effect: p.WeightTrajectory * math.Log(trajectory),
			Text: fmt.Sprintf("đã bán %.0f%% sức chứa, kế hoạch lúc này là %.0f%%", actual*100, expected*100)},
		{Key: "queue", Value: queue, Effect: p.WeightQueue * math.Log(queue),
			Text: fmt.Sprintf("%d người đang chờ trong phòng chờ", in.QueueWaiting)},
		{Key: "held", Value: heldPressure, Effect: p.WeightHeld * math.Log(heldPressure),
			Text: fmt.Sprintf("%d ghế đang được giữ", in.Held)},
	}
	if interestKnown {
		factors = append(factors, Factor{Key: "interest", Value: interest, Effect: p.WeightInterest * math.Log(interest),
			Text: fmt.Sprintf("%.0f%% lượt xem dẫn tới giữ ghế, mức chung là %.0f%%", viewRate*100, baseRate*100)})
	}

	lnDemand := 0.0
	for _, f := range factors {
		lnDemand += f.Effect
	}
	lnDemand = clampF(lnDemand, math.Log(0.25), math.Log(4))

	// No sales after hours of selling is evidence too, so the expected count counts.
	evidence := math.Max(float64(in.Holds24h+in.Sales24h)+float64(in.Interest.Views24h)/10, expected*float64(in.Capacity))
	confidence := (1 - math.Exp(-evidence/p.ConfidenceScale)) * math.Min(1, elapsed/p.WarmupHours)

	// Low confidence shrinks the index toward 1 (no change), and the previous
	// run's index damps swings between runs.
	effective := confidence * lnDemand
	if in.PreviousDemand > 0 {
		effective = p.Smoothing*effective + (1-p.Smoothing)*math.Log(in.PreviousDemand)
	}
	demand := math.Exp(effective)

	rec.Factors = factors
	rec.DemandIndex = demand
	rec.DemandLevel = levelOf(demand)
	rec.Performance = trajectory
	rec.ActualShare = actual
	rec.ExpectedShare = expected
	rec.Velocity = velocity
	rec.RequiredVelocity = required
	rec.Conversion = conv
	rec.Confidence = confidence
	rec.SuggestedFloor, rec.SuggestedCeiling = m.suggestedBounds(in, demand, cur)

	if confidence < p.MinConfidence {
		rec.InsufficientData = true
		rec.Explanation = fmt.Sprintf("Chưa đủ dữ liệu để đề xuất (độ tin cậy %.0f%%): mới có %d lượt giữ ghế trong 24 giờ. Giữ nguyên giá.",
			confidence*100, in.Holds24h)
		return rec
	}

	maxStep := float64(lim.MaxStepPct) / 100
	stepFor := func(d float64) float64 { return clampF(math.Pow(d, 1/p.Elasticity)-1, -maxStep, maxStep) }
	priceFor := func(d float64) int64 { return m.bounded(float64(cur)*(1+stepFor(d)), in) }
	spread := 0.05 + 0.4*(1-confidence)
	rec.RangeLow = min(priceFor(demand*math.Exp(-spread)), cur)
	rec.RangeHigh = max(priceFor(demand*math.Exp(spread)), cur)

	// The noise threshold applies to the signal, not to the move left after
	// the bounds, so a strong signal can still take the last step to a bound.
	price := priceFor(demand)
	change := price - cur
	if change != 0 && math.Abs(stepFor(demand))*100 >= float64(p.MinChangePct) {
		rec.Price = price
		rec.Action = Increase
		if change < 0 {
			rec.Action = Decrease
		}
	}
	rec.AtCeiling = demand > 1.05 && cur >= in.CeilingPrice
	rec.AtFloor = demand < 0.95 && cur <= in.FloorPrice
	rec.Explanation = m.explain(rec, factors)
	return rec
}

// AutoDecision says whether automatic pricing may apply rec now, and if not, why.
func AutoDecision(rec Recommendation, in ZoneInput, lim Limits) (bool, string) {
	switch {
	case rec.InsufficientData || rec.SalesClosed || rec.SoldOut:
		return false, "insufficient_data"
	case rec.Action == Maintain:
		return false, "maintain"
	}
	if in.LastChangeAt.IsZero() {
		return true, ""
	}
	since := in.Now.Sub(in.LastChangeAt)
	if since < lim.Cooldown {
		return false, "cooldown"
	}
	dir := 1
	if rec.Action == Decrease {
		dir = -1
	}
	// Turning a price straight back the other way is how prices oscillate.
	if in.LastChangeDirection != 0 && dir != in.LastChangeDirection && since < 2*lim.Cooldown {
		return false, "reversal_guard"
	}
	return true, ""
}

func (m DemandModel) conversion(in ZoneInput) float64 {
	p := m.P
	if !in.PaymentsLive {
		return p.DefaultConversion
	}
	c := (float64(in.SalesTotal) + p.ConversionPrior*p.DefaultConversion) / (float64(in.HoldsTotal) + p.ConversionPrior)
	return clampF(c, 0.05, 1)
}

// expectedShare is the share of capacity a typical sale has sold at time t in [0, 1].
func (m DemandModel) expectedShare(t float64) float64 {
	p := m.P
	t = clampF(t, 0, 1)
	onsale := (1 - math.Exp(-p.CurveOnsaleRate*t)) / (1 - math.Exp(-p.CurveOnsaleRate))
	return p.CurveOnsaleShare*onsale + (1-p.CurveOnsaleShare)*math.Pow(t, p.CurveLateExponent)
}

// interest compares the event's view-to-hold rate with the platform's. Many
// views but few holds suggests buyers find the price high.
func (m DemandModel) interest(i Interest) (factor, rate, base float64, known bool) {
	if i.Views24h < 20 || i.PlatformViews30d < 50 {
		return 1, 0, 0, false
	}
	rate = float64(i.Holds24h) / float64(i.Views24h)
	base = float64(i.PlatformHolds30d) / float64(i.PlatformViews30d)
	return clampF((rate+0.01)/(base+0.01), 0.5, 2), rate, base, true
}

func (m DemandModel) suggestedBounds(in ZoneInput, demand float64, cur int64) (int64, int64) {
	list := float64(in.ListPrice)
	if list <= 0 {
		list = float64(cur)
	}
	widen := clampF(0.5*math.Log(demand), 0, 0.25)
	floor := m.round(list * (1 - m.P.BoundsBelow))
	ceiling := m.round(list * (1 + m.P.BoundsAbove + widen))
	return min(floor, cur), max(ceiling, cur)
}

func (m DemandModel) round(v float64) int64 {
	r := float64(m.P.RoundTo)
	return int64(math.Floor((v+r/2)/r)) * m.P.RoundTo
}

// bounded rounds v and keeps it inside the zone's floor and ceiling.
func (m DemandModel) bounded(v float64, in ZoneInput) int64 {
	v = clampF(v, float64(in.FloorPrice), float64(in.CeilingPrice))
	return clampI(m.round(v), in.FloorPrice, in.CeilingPrice)
}

func (m DemandModel) explain(rec Recommendation, factors []Factor) string {
	ranked := slices.Clone(factors)
	slices.SortFunc(ranked, func(a, b Factor) int { return cmp.Compare(math.Abs(b.Effect), math.Abs(a.Effect)) })
	var reasons []string
	for _, f := range ranked {
		if len(reasons) == 2 || math.Abs(f.Effect) < 0.02 {
			break
		}
		reasons = append(reasons, f.Text)
	}
	why := ""
	if len(reasons) > 0 {
		why = ": " + strings.Join(reasons, "; ")
	}

	switch {
	case rec.Action == Increase:
		return fmt.Sprintf("Đề xuất tăng giá lên %s%s.", FormatVND(rec.Price), why)
	case rec.Action == Decrease:
		return fmt.Sprintf("Đề xuất giảm giá xuống %s%s.", FormatVND(rec.Price), why)
	case rec.AtCeiling:
		return fmt.Sprintf("Nhu cầu cao nhưng giá đã chạm giá trần%s.", why)
	case rec.AtFloor:
		return fmt.Sprintf("Nhu cầu thấp nhưng giá đã ở giá sàn%s.", why)
	default:
		return "Giữ giá: nhu cầu đang khớp với số ghế còn lại."
	}
}

func levelOf(d float64) DemandLevel {
	switch {
	case d < 0.85:
		return DemandLow
	case d > 1.15:
		return DemandHigh
	default:
		return DemandOnTrack
	}
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}

// FormatVND writes 1420000 as "1.420.000đ".
func FormatVND(v int64) string {
	s := fmt.Sprintf("%d", abs(v))
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(r)
	}
	if v < 0 {
		return "-" + b.String() + "đ"
	}
	return b.String() + "đ"
}

var _ Strategy = DemandModel{}

// Cooldown converts minutes from the settings table.
func Cooldown(minutes int32) time.Duration { return time.Duration(minutes) * time.Minute }
