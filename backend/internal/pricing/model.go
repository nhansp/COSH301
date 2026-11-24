// Package pricing turns a zone's sales and demand figures into a price
// recommendation. It has no database or HTTP code, so a strategy can be
// replaced or tuned on its own. The model is described in docs/dynamic-pricing.md.
package pricing

import (
	"math"
	"time"
)

type Action string

const (
	Increase Action = "INCREASE"
	Decrease Action = "DECREASE"
	Maintain Action = "MAINTAIN"
)

type DemandLevel string

const (
	DemandLow     DemandLevel = "LOW"
	DemandOnTrack DemandLevel = "ON_TRACK"
	DemandHigh    DemandLevel = "HIGH"
)

// Interest is what the recommendation data shows about an event: how many
// people look at it and how often a look turns into a held seat.
type Interest struct {
	Views24h         int64
	Holds24h         int64
	PlatformViews30d int64
	PlatformHolds30d int64
}

// ZoneInput is one zone at one moment.
type ZoneInput struct {
	Now        time.Time
	SalesOpen  time.Time
	SalesClose time.Time

	CurrentPrice int64
	FloorPrice   int64
	CeilingPrice int64
	// ListPrice is the price before the first logged change.
	ListPrice int64

	Capacity  int64
	Available int64
	Held      int64
	Sold      int64

	Holds1h    int64
	Holds24h   int64
	HoldsTotal int64
	Sales1h    int64
	Sales24h   int64
	SalesTotal int64
	// PaymentsLive says tickets can be bought, so the hold-to-ticket rate is measurable.
	PaymentsLive bool

	QueueWaiting  int64
	QueueCapacity int64
	Interest      Interest

	// PreviousDemand is the smoothed index from the last run, 0 when there is none.
	PreviousDemand      float64
	LastChangeAt        time.Time
	LastChangeDirection int
}

// Limits are the organizer's settings for an event.
type Limits struct {
	MaxStepPct int
	Cooldown   time.Duration
}

type Factor struct {
	Key   string  `json:"key"`
	Value float64 `json:"value"`
	// Effect is the factor's weighted log contribution: above 0 pushes the price up.
	Effect float64 `json:"effect"`
	Text   string  `json:"text"`
}

type Recommendation struct {
	Action    Action `json:"action"`
	Price     int64  `json:"price"`
	RangeLow  int64  `json:"rangeLow"`
	RangeHigh int64  `json:"rangeHigh"`

	SuggestedFloor   int64 `json:"suggestedFloor"`
	SuggestedCeiling int64 `json:"suggestedCeiling"`

	DemandIndex float64     `json:"demandIndex"`
	DemandLevel DemandLevel `json:"demandLevel"`
	// Performance is actual sell-through divided by the expected sell-through at this point of the sale.
	Performance      float64 `json:"performance"`
	ActualShare      float64 `json:"actualShare"`
	ExpectedShare    float64 `json:"expectedShare"`
	Velocity         float64 `json:"velocity"`
	RequiredVelocity float64 `json:"requiredVelocity"`
	Conversion       float64 `json:"conversion"`
	Confidence       float64 `json:"confidence"`

	InsufficientData bool `json:"insufficientData"`
	SalesClosed      bool `json:"salesClosed"`
	SoldOut          bool `json:"soldOut"`
	AtFloor          bool `json:"atFloor"`
	AtCeiling        bool `json:"atCeiling"`

	Factors     []Factor `json:"factors"`
	Explanation string   `json:"explanation"`
}

// Strategy is anything that can price a zone.
type Strategy interface {
	Recommend(in ZoneInput, lim Limits) Recommendation
	// SellingFast and SellingSlow classify a recommendation's sales performance for alerts.
	SellingFast(r Recommendation) bool
	SellingSlow(r Recommendation) bool
}

func clampF(v, lo, hi float64) float64 { return math.Min(math.Max(v, lo), hi) }

func clampI(v, lo, hi int64) int64 { return min(max(v, lo), hi) }
