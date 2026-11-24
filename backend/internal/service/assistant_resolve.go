package service

import (
	"math"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

// eventInfo is an event as the assistant sees it.
type eventInfo struct {
	ID         string
	Name       string
	Slug       string
	Genre      string
	City       string
	Venue      string
	Status     string
	StartsAt   time.Time
	EndsAt     time.Time
	SalesStart *time.Time
	SalesEnd   *time.Time
	MaxTickets int32
	PriceFrom  int64
}

// zoneInfo is one priced zone of an event with its seats left.
type zoneInfo struct {
	Code      string
	Name      string
	Price     int64
	Total     int32
	Available int32
}

const (
	// An event is named only when its matched words are worth at least this much.
	// One rare long word ("blackpink") or two ordinary ones ("my tam") reach it;
	// a place name like "Mỹ Đình" does not.
	eventMatchThreshold = 1.5
	// Events scoring within this of the best one are the same guess.
	eventTieMargin = 0.3
	// The corpus is padded to this size so a single-event database still
	// gives rare words a high weight.
	minCorpusSize = 8
)

// nameStopTokens say nothing about which event is meant.
var nameStopTokens = map[string]bool{
	"concert": true, "live": true, "the": true, "in": true, "of": true, "tour": true, "world": true,
	"vietnam": true, "viet": true, "nam": true, "and": true, "va": true, "show": true, "dem": true,
}

// eventIndex finds events by the words of their names.
type eventIndex struct {
	events []eventInfo
	tokens [][]string
	weight map[string]float64
}

func newEventIndex(events []eventInfo) *eventIndex {
	ix := &eventIndex{events: events, tokens: make([][]string, len(events)), weight: map[string]float64{}}
	df := map[string]int{}
	for i, e := range events {
		city := map[string]bool{}
		for _, t := range strings.Fields(foldText(e.City)) {
			city[t] = true
		}
		seen := map[string]bool{}
		for _, t := range strings.Fields(foldText(e.Name)) {
			if nameStopTokens[t] || city[t] || seen[t] {
				continue
			}
			seen[t] = true
			ix.tokens[i] = append(ix.tokens[i], t)
			df[t]++
		}
	}
	n := float64(max(len(events), minCorpusSize))
	for t, d := range df {
		ix.weight[t] = math.Log(1+n/float64(d)) * tokenLengthFactor(t)
	}
	return ix
}

// tokenLengthFactor discounts short words, which match by accident.
func tokenLengthFactor(t string) float64 {
	n := utf8.RuneCountInString(t)
	switch {
	case n >= 4:
		return 1
	case n == 3:
		return 0.6
	case n == 2:
		return 0.35
	}
	if t[0] >= '0' && t[0] <= '9' {
		return 0.7
	}
	return 0.2
}

// match returns the events the message names. One result is a clear pick,
// several are an ambiguous one, none means no event was named.
func (ix *eventIndex) match(msgTokens []string) []eventInfo {
	if len(ix.events) == 0 || len(msgTokens) == 0 {
		return nil
	}
	scores := make([]float64, len(ix.events))
	best := 0.0
	for i, toks := range ix.tokens {
		for _, u := range toks {
			for _, t := range msgTokens {
				if tokenMatches(t, u) {
					scores[i] += ix.weight[u]
					break
				}
			}
		}
		best = max(best, scores[i])
	}
	if best < eventMatchThreshold {
		return nil
	}
	var out []eventInfo
	for i, s := range scores {
		if s >= best-eventTieMargin {
			out = append(out, ix.events[i])
		}
	}
	return out
}

// cityMentioned reports whether the folded message names the city, by its
// name or a common short form ("hcm", "sài gòn" for Hồ Chí Minh).
func cityMentioned(folded, city string) bool {
	c := foldText(city)
	if c == "" {
		return false
	}
	if containsPhrase(folded, c) {
		return true
	}
	if strings.Contains(c, "ho chi minh") {
		return containsPhrase(folded, "hcm") || containsPhrase(folded, "sai gon")
	}
	return false
}

// narrowByCity keeps the events in a city the message names. It leaves the
// list alone when that would drop every event.
func narrowByCity(events []eventInfo, folded string) []eventInfo {
	var kept []eventInfo
	for _, e := range events {
		if cityMentioned(folded, e.City) {
			kept = append(kept, e)
		}
	}
	if len(kept) == 0 {
		return events
	}
	return kept
}

// resolveEvents finds the events a message names. A model hint is used only
// when every word of it really is in the message, so the model cannot name an
// event the user never mentioned.
func resolveEvents(ix *eventIndex, folded, hint string) []eventInfo {
	msgTokens := strings.Fields(folded)
	if h := strings.Fields(foldText(hint)); len(h) > 0 && hintGrounded(h, msgTokens) {
		if found := ix.match(h); len(found) > 0 {
			return narrowTies(found, folded)
		}
	}
	return narrowTies(ix.match(msgTokens), folded)
}

func narrowTies(found []eventInfo, folded string) []eventInfo {
	if len(found) > 1 {
		return narrowByCity(found, folded)
	}
	return found
}

// hintGrounded reports whether every hint word appears in the message.
func hintGrounded(hint, msgTokens []string) bool {
	for _, h := range hint {
		ok := false
		for _, t := range msgTokens {
			if t == h || tokenMatches(t, h) || tokenMatches(h, t) {
				ok = true
				break
			}
		}
		if !ok {
			return false
		}
	}
	return true
}

// zoneStopTokens are descriptions of a seat, not part of a zone's name.
var zoneStopTokens = map[string]bool{
	"ghe": true, "ngoi": true, "dung": true, "khu": true, "hang": true, "ve": true, "ban": true, "combo": true,
}

// zoneKey is the words that name a zone: its name without the parenthesised
// description and the seat-type words.
func zoneKey(name string) []string {
	if i := strings.IndexByte(name, '('); i >= 0 {
		name = name[:i]
	}
	var key []string
	for _, t := range strings.Fields(foldText(name)) {
		if !zoneStopTokens[t] {
			key = append(key, t)
		}
	}
	return key
}

// zoneCodeBase turns CAT1_SEAT into "cat1": the part of the code a person types.
func zoneCodeBase(code string) string {
	base, _, _ := strings.Cut(code, "_")
	return strings.ReplaceAll(foldText(base), " ", "")
}

// matchZones picks the zones a message asks about. Exact names and codes win
// ("cat 1", "ga2"); otherwise a zone whose first word is in the message
// qualifies ("vip" finds VIP 1 and VIP 2). Words of the venue name are skipped
// so "Mỹ Đình" never selects a zone called "Đỉnh Nóc".
func matchZones(zones []zoneInfo, msgTokens []string, venue string) []zoneInfo {
	venueTokens := map[string]bool{}
	for _, t := range strings.Fields(foldText(venue)) {
		venueTokens[t] = true
	}

	joined := map[string]bool{}
	for i := range msgTokens {
		g := ""
		for j := i; j < len(msgTokens) && j < i+3; j++ {
			g += msgTokens[j]
			joined[g] = true
		}
	}

	var exact, loose []zoneInfo
	for _, z := range zones {
		key := zoneKey(z.Name)
		code := zoneCodeBase(z.Code)
		if (code != "" && joined[code]) || (len(key) > 0 && joined[strings.Join(key, "")]) {
			exact = append(exact, z)
			continue
		}
		if len(key) > 0 && utf8.RuneCountInString(key[0]) >= 3 {
			for _, t := range msgTokens {
				if t == key[0] && !venueTokens[t] {
					loose = append(loose, z)
					break
				}
			}
		}
	}
	if len(exact) > 0 {
		return exact
	}
	return loose
}

// zoneQuestionWords follow "khu" in a general question ("khu nào", "khu gì")
// and so do not name a zone.
var zoneQuestionWords = map[string]bool{
	"nao": true, "gi": true, "la": true, "co": true, "con": true, "cua": true, "nhat": true,
	"re": true, "dat": true, "tot": true, "ma": true, "k": true, "khong": true, "ko": true,
}

// zoneMentioned reports whether the message names a zone that matchZones did
// not find, so the assistant can say "no such zone" instead of listing all of them.
func zoneMentioned(msgTokens []string) bool {
	for i, t := range msgTokens {
		switch t {
		case "khu", "hang", "zone", "loai":
			if i+1 < len(msgTokens) && !zoneQuestionWords[msgTokens[i+1]] {
				return true
			}
		}
	}
	return false
}

// venueGenericTokens appear in many venue names and prove nothing alone.
var venueGenericTokens = map[string]bool{
	"san": true, "van": true, "dong": true, "quoc": true, "gia": true, "trung": true, "tam": true,
	"khu": true, "do": true, "thi": true, "nha": true, "dau": true, "cung": true, "the": true, "thao": true,
}

// venueMentioned reports whether the message names the venue: two
// neighbouring distinctive words of its name ("my dinh", "ocean park") are enough.
func venueMentioned(folded, venue string) bool {
	var key []string
	for _, t := range strings.Fields(foldText(venue)) {
		if !venueGenericTokens[t] {
			key = append(key, t)
		}
	}
	for i := 0; i+1 < len(key); i++ {
		if containsPhrase(folded, key[i]+" "+key[i+1]) {
			return true
		}
	}
	return false
}

// filterByTopic keeps the events in a city, at a venue or of a genre the
// message names. topic says how the list was narrowed ("ở Hà Nội tại Sân
// vận động Quốc gia Mỹ Đình thể loại K-pop"); it is "" when nothing matched.
func filterByTopic(events []eventInfo, folded string) ([]eventInfo, string) {
	out, topics := events, []string{}
	narrow := func(label string, keep func(eventInfo) bool) {
		out = slices.DeleteFunc(slices.Clone(out), func(e eventInfo) bool { return !keep(e) })
		topics = append(topics, label)
	}
	for _, e := range events {
		if cityMentioned(folded, e.City) {
			city := foldText(e.City)
			narrow("ở "+e.City, func(o eventInfo) bool { return foldText(o.City) == city })
			break
		}
	}
	for _, e := range out {
		if venueMentioned(folded, e.Venue) {
			venue := e.Venue
			narrow("tại "+venue, func(o eventInfo) bool { return o.Venue == venue })
			break
		}
	}
	for _, e := range out {
		g := foldText(e.Genre)
		if g != "" && (containsPhrase(folded, g) || containsPhrase(folded, strings.ReplaceAll(g, " ", ""))) {
			narrow("thể loại "+e.Genre, func(o eventInfo) bool { return foldText(o.Genre) == g })
			break
		}
	}
	return out, strings.Join(topics, " ")
}
