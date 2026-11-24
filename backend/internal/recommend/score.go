// Package recommend ranks events for one user from their past views, holds
// and tickets. It has no database code; docs/dynamic-pricing.md, section 8,
// describes the scoring.
package recommend

import (
	"cmp"
	"fmt"
	"math"
	"slices"
	"strings"
)

// Criterion weights of the Priority Score, out of 1.
const (
	WeightAffinity     = 0.35
	WeightBudget       = 0.25
	WeightGeo          = 0.15
	WeightAvailability = 0.15
	WeightFill         = 0.10

	// A user with this many interactions is scored fully on their own taste.
	FullProfileInteractions = 5
)

type Tier string

const (
	TierTopPick   Tier = "TOP_PICK"
	TierTrending  Tier = "TRENDING"
	TierDiscovery Tier = "DISCOVERY"
	TierMore      Tier = "MORE"
	// TierPopular marks a pick made from popularity alone, for users without history.
	TierPopular Tier = "POPULAR"
)

// Profile is a user's taste, weighted by interaction type and recency.
type Profile struct {
	Interactions int64
	Genres       map[string]float64
	Cities       map[string]float64
	// TypicalPrice is the median price of seats the user held or bought, 0 when unknown.
	TypicalPrice float64
}

type ZoneOffer struct {
	ZoneID    string `json:"zoneId"`
	Code      string `json:"zoneCode"`
	Name      string `json:"zoneName"`
	Price     int64  `json:"price"`
	Capacity  int64  `json:"-"`
	Available int64  `json:"available"`
}

type Candidate struct {
	EventID string
	Genre   string
	City    string
	Zones   []ZoneOffer
	Views7d int64
	Holds7d int64
	Sales7d int64
}

type Criteria struct {
	Affinity     float64 `json:"affinity"`
	Budget       float64 `json:"budget"`
	Geo          float64 `json:"geo"`
	Availability float64 `json:"availability"`
	Fill         float64 `json:"fill"`
}

type Scored struct {
	EventID string `json:"eventId"`
	// Score ranks the event: fit blended with popularity while the user's history is short.
	Score float64 `json:"score"`
	// Fit is how well the event matches the user's own taste, 0 to 100; it sets the tier.
	Fit          float64    `json:"fit"`
	Tier         Tier       `json:"tier"`
	Personalized bool       `json:"personalized"`
	Criteria     Criteria   `json:"criteria"`
	BestZone     *ZoneOffer `json:"bestZone,omitempty"`
	Reasons      []string   `json:"reasons"`
	// Popularity is the event's interest relative to the most watched event, in [0, 1].
	Popularity float64 `json:"popularity"`
}

// Rank scores every candidate with seats left and returns the best limit of them.
func Rank(p Profile, cands []Candidate, limit int) []Scored {
	maxInterest := 0.0
	for _, c := range cands {
		maxInterest = math.Max(maxInterest, interestOf(c))
	}
	// Below FullProfileInteractions the score blends toward popularity.
	personal := math.Min(1, float64(p.Interactions)/FullProfileInteractions)

	out := make([]Scored, 0, len(cands))
	for _, c := range cands {
		capacity, available := totals(c.Zones)
		if available == 0 {
			continue
		}
		popularity := 0.0
		if maxInterest > 0 {
			popularity = interestOf(c) / maxInterest
		}
		fill := 100 * float64(available) / float64(capacity)

		best := bestZone(c.Zones, p.TypicalPrice)
		cr := Criteria{
			Affinity:     100 * share(p.Genres, c.Genre),
			Budget:       budgetFit(best.Price, p.TypicalPrice),
			Geo:          100 * share(p.Cities, c.City),
			Availability: 100 * float64(best.Available) / float64(max(best.Capacity, 1)),
			Fill:         fill,
		}
		personalScore := WeightAffinity*cr.Affinity + WeightBudget*cr.Budget + WeightGeo*cr.Geo +
			WeightAvailability*cr.Availability + WeightFill*cr.Fill
		popularScore := 100 * (0.7*popularity + 0.3*fill/100)
		score := personal*personalScore + (1-personal)*popularScore

		s := Scored{
			EventID:      c.EventID,
			Score:        math.Round(score*10) / 10,
			Fit:          math.Round(personalScore*10) / 10,
			Personalized: personal > 0,
			Criteria:     cr,
			BestZone:     &best,
			Popularity:   popularity,
		}
		s.Tier = tierOf(s)
		s.Reasons = reasons(s, c, p)
		out = append(out, s)
	}

	slices.SortFunc(out, func(a, b Scored) int {
		return cmp.Or(cmp.Compare(b.Score, a.Score), cmp.Compare(b.Popularity, a.Popularity), strings.Compare(a.EventID, b.EventID))
	})
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}

func interestOf(c Candidate) float64 {
	return float64(c.Views7d) + 3*float64(c.Holds7d) + 5*float64(c.Sales7d)
}

func totals(zones []ZoneOffer) (capacity, available int64) {
	for _, z := range zones {
		capacity += z.Capacity
		available += z.Available
	}
	return capacity, available
}

// share is the cosine between the user's weights and a one-hot vector for key:
// the key's weight over the length of the weight vector.
func share(weights map[string]float64, key string) float64 {
	if key == "" || len(weights) == 0 {
		return 0
	}
	norm := 0.0
	for _, w := range weights {
		norm += w * w
	}
	if norm == 0 {
		return 0
	}
	return weights[key] / math.Sqrt(norm)
}

// bestZone is the zone with seats left whose price is closest to the user's
// typical price, or the cheapest such zone when that price is unknown.
func bestZone(zones []ZoneOffer, typical float64) ZoneOffer {
	var best ZoneOffer
	bestGap := math.Inf(1)
	for _, z := range zones {
		if z.Available == 0 {
			continue
		}
		gap := float64(z.Price)
		if typical > 0 {
			gap = math.Abs(float64(z.Price) - typical)
		}
		if gap < bestGap {
			best, bestGap = z, gap
		}
	}
	return best
}

func budgetFit(price int64, typical float64) float64 {
	if typical <= 0 {
		return 50
	}
	return math.Max(0, 100*(1-math.Abs(float64(price)-typical)/typical))
}

func tierOf(s Scored) Tier {
	switch {
	case !s.Personalized:
		return TierPopular
	case s.Fit >= 80:
		return TierTopPick
	case s.Fit >= 65:
		return TierTrending
	case s.Fit >= 50:
		return TierDiscovery
	default:
		return TierMore
	}
}

func reasons(s Scored, c Candidate, p Profile) []string {
	var out []string
	if s.Personalized {
		if s.Criteria.Affinity >= 50 && c.Genre != "" {
			out = append(out, fmt.Sprintf("Hợp gu %s bạn hay xem", c.Genre))
		}
		if s.Criteria.Budget >= 70 && p.TypicalPrice > 0 && s.BestZone != nil {
			out = append(out, fmt.Sprintf("Khu %s gần mức giá bạn thường chọn", s.BestZone.Name))
		}
		if s.Criteria.Geo >= 50 && c.City != "" {
			out = append(out, fmt.Sprintf("Diễn tại %s, nơi bạn hay đi xem", c.City))
		}
	}
	if len(out) < 2 && s.Popularity >= 0.5 {
		out = append(out, "Đang được nhiều người quan tâm")
	}
	if len(out) < 2 && s.Criteria.Fill >= 60 {
		out = append(out, "Còn nhiều ghế trống")
	}
	return out
}
