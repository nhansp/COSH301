package recommend

import "testing"

func zones(prices ...int64) []ZoneOffer {
	out := make([]ZoneOffer, len(prices))
	for i, p := range prices {
		out[i] = ZoneOffer{ZoneID: string(rune('a' + i)), Name: string(rune('A' + i)), Price: p, Capacity: 100, Available: 80}
	}
	return out
}

var candidates = []Candidate{
	{EventID: "rock-hcm", Genre: "Rock", City: "TP. Hồ Chí Minh", Zones: zones(800_000, 2_000_000), Views7d: 200, Holds7d: 40},
	{EventID: "pop-hn", Genre: "Pop", City: "Hà Nội", Zones: zones(1_500_000, 3_000_000), Views7d: 20, Holds7d: 2},
	{EventID: "ballad-hn", Genre: "Ballad", City: "Hà Nội", Zones: zones(1_200_000), Views7d: 60, Holds7d: 5},
}

func TestRank_ColdStartFallsBackToPopularity(t *testing.T) {
	got := Rank(Profile{}, candidates, 10)
	if len(got) != 3 || got[0].EventID != "rock-hcm" {
		t.Fatalf("want the most watched event first, got %+v", got)
	}
	for _, s := range got {
		if s.Personalized || s.Tier != TierPopular {
			t.Fatalf("cold start result marked personal: %+v", s)
		}
	}
}

func TestRank_TasteBeatsPopularity(t *testing.T) {
	p := Profile{
		Interactions: 8,
		Genres:       map[string]float64{"Pop": 6, "Ballad": 1},
		Cities:       map[string]float64{"Hà Nội": 7},
		TypicalPrice: 1_500_000,
	}
	got := Rank(p, candidates, 10)
	if got[0].EventID != "pop-hn" {
		t.Fatalf("want the Pop show in Hà Nội first, got %s", got[0].EventID)
	}
	top := got[0]
	if !top.Personalized || top.BestZone == nil || top.BestZone.Price != 1_500_000 {
		t.Fatalf("want the 1.500.000đ zone as the budget fit, got %+v", top.BestZone)
	}
	if top.Criteria.Budget != 100 || len(top.Reasons) == 0 {
		t.Fatalf("criteria or reasons missing: %+v", top)
	}
	if top.Tier != TierTopPick {
		t.Fatalf("fit %.1f should be a top pick", top.Fit)
	}
	// A popular event outside the user's taste may rank, but is not labelled a match.
	for _, s := range got {
		if s.EventID == "rock-hcm" && s.Tier != TierMore {
			t.Fatalf("Rock in HCM labelled %s for a Pop fan in Hà Nội", s.Tier)
		}
	}
}

func TestRank_SkipsSoldOutAndHonoursLimit(t *testing.T) {
	soldOut := Candidate{EventID: "gone", Genre: "Pop", Zones: []ZoneOffer{{Price: 1, Capacity: 10, Available: 0}}}
	got := Rank(Profile{}, append([]Candidate{soldOut}, candidates...), 2)
	if len(got) != 2 {
		t.Fatalf("limit ignored: %d results", len(got))
	}
	for _, s := range got {
		if s.EventID == "gone" {
			t.Fatal("sold-out event recommended")
		}
	}
}

func TestRank_PartialHistoryBlends(t *testing.T) {
	p := Profile{Interactions: 2, Genres: map[string]float64{"Pop": 2}}
	got := Rank(p, candidates, 10)
	for _, s := range got {
		if !s.Personalized {
			t.Fatalf("partial history should count as personal: %+v", s)
		}
	}
}
