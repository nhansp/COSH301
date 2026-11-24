package service

import (
	"strings"
	"testing"
	"time"
)

func TestFoldText(t *testing.T) {
	cases := map[string]string{
		"Mỹ Tâm Live Concert \"See The Light\"": "my tam live concert see the light",
		"Đêm 9 (TP.HCM)":                        "dem 9 tp hcm",
		"  Còn   vé  KHÔNG???":                  "con ve khong",
		"G-Dragon":                              "g dragon",
		"":                                      "",
	}
	for in, want := range cases {
		if got := foldText(in); got != want {
			t.Errorf("foldText(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEditDistanceAndTokenMatches(t *testing.T) {
	if d := editDistance("blackping", "blackpink"); d != 1 {
		t.Errorf("distance = %d, want 1", d)
	}
	if !tokenMatches("blackping", "blackpink") {
		t.Error("one typo in a long name must still match")
	}
	if tokenMatches("tan", "tam") {
		t.Error("short words must match exactly")
	}
	if tokenMatches("khong", "chong") {
		t.Error("a short name word must match exactly")
	}
	if !tokenMatches("gdragon", "dragon") {
		t.Error("a glued prefix is one edit and should match")
	}
}

func TestMatchKeywords(t *testing.T) {
	cases := []struct {
		msg  string
		want AssistantIntent
	}{
		{"Tuần này có concert nào?", IntentListEvents},
		{"Concert Mỹ Tâm còn vé khu nào?", IntentAvailability},
		{"con ve khu nao", IntentAvailability},
		{"Cách đặt vé thế nào?", IntentHowToBook},
		{"cach dat ve the nao", IntentHowToBook},
		{"làm sao để thanh toán", IntentHowToBook},
		{"Giá vé VIP bao nhiêu", IntentPrices},
		{"gia ve g dragon", IntentPrices},
		{"vé blackpink bao nhiêu tiền vậy", IntentPrices},
		{"Mỹ Tâm bao giờ diễn?", IntentEventInfo},
		{"đêm nhạc diễn ở đâu", IntentEventInfo},
		{"mình đang giữ ghế nào", IntentMyHolds},
		{"vé của tôi đâu", IntentMyTickets},
		{"ve da mua cua minh", IntentMyTickets},
		{"Doanh số sự kiện của tôi", IntentOrganizerSales},
		{"bán được bao nhiêu vé rồi", IntentOrganizerSales},
		{"xin chào", IntentGreeting},
		{"cảm ơn nhé", IntentGreeting},
		{"thủ đô của Pháp là gì", IntentUnknown},
		{"Sân vận động Quốc gia Mỹ Đình", IntentUnknown},
		{"", IntentUnknown},
	}
	for _, c := range cases {
		if got := matchKeywords(foldText(c.msg)).Intent; got != c.want {
			t.Errorf("matchKeywords(%q) = %s, want %s", c.msg, got, c.want)
		}
	}
}

func TestArbitrate(t *testing.T) {
	kw := func(msg string) keywordMatch { return matchKeywords(foldText(msg)) }
	cases := []struct {
		name string
		llm  AssistantIntent
		msg  string
		want AssistantIntent
	}{
		{"model reads a paraphrase the keywords miss", IntentAvailability, "em muốn mua cho con", IntentAvailability},
		{"model and keywords agree", IntentPrices, "giá vé bao nhiêu", IntentPrices},
		{"keywords overrule an unsupported pick", IntentPrices, "my tam bao gio dien", IntentEventInfo},
		{"keywords catch what the model calls unknown", IntentUnknown, "doanh thu tháng này", IntentOrganizerSales},
		{"unknown stays unknown", IntentUnknown, "trời đẹp nhỉ", IntentUnknown},
		{"invalid pick falls back", AssistantIntent("make_coffee"), "giá vé bao nhiêu", IntentPrices},
	}
	for _, c := range cases {
		if got := arbitrate(c.llm, kw(c.msg)); got != c.want {
			t.Errorf("%s: arbitrate(%s, %q) = %s, want %s", c.name, c.llm, c.msg, got, c.want)
		}
	}
}

func demoEvents() []eventInfo {
	at := func(m time.Month, d int) time.Time { return time.Date(2026, m, d, 19, 0, 0, 0, ict) }
	return []eventInfo{
		{ID: "e1", Name: "BLACKPINK WORLD TOUR [BORN PINK] IN HANOI", City: "Hà Nội", Venue: "Sân vận động Quốc gia Mỹ Đình", StartsAt: at(12, 5)},
		{ID: "e2", Name: `Concert Anh Trai "Say Hi" - Hà Nội`, City: "Hà Nội", Venue: "Sân vận động Quốc gia Mỹ Đình", StartsAt: at(12, 7)},
		{ID: "e3", Name: "Concert Anh Trai Vượt Ngàn Chông Gai - Đêm 2", City: "Hưng Yên", Venue: "Vinhomes Ocean Park 3", StartsAt: at(12, 14)},
		{ID: "e4", Name: "VPBank K-Star Spark in Vietnam 2025 (G-Dragon, CL, DPR IAN, TEMPEST, tripleS)", City: "Hà Nội", Venue: "Sân vận động Quốc gia Mỹ Đình", StartsAt: at(12, 20)},
		{ID: "e5", Name: `Mỹ Tâm Live Concert "See The Light"`, City: "Hà Nội", Venue: "Sân vận động Quốc gia Mỹ Đình", StartsAt: at(12, 21)},
		{ID: "e6", Name: `Concert Anh Trai "Say Hi" - Đêm 9 (TP.HCM)`, City: "TP. Hồ Chí Minh", Venue: "Sân vận động Quân khu 7", StartsAt: at(12, 28)},
	}
}

func ids(es []eventInfo) string {
	out := make([]string, len(es))
	for i, e := range es {
		out[i] = e.ID
	}
	return strings.Join(out, ",")
}

func TestResolveEvents(t *testing.T) {
	ix := newEventIndex(demoEvents())
	cases := []struct {
		msg, hint, want string
	}{
		{"Concert Mỹ Tâm còn vé khu nào?", "", "e5"},
		{"my tam con ve khong", "", "e5"},
		{"giá vé blackpink", "", "e1"},
		{"blackping còn vé không", "", "e1"},
		{"gdragon bao giờ diễn", "", "e4"},
		{"g-dragon", "", "e4"},
		{"anh trai vượt ngàn chông gai", "", "e3"},
		{"anh trai say hi đêm 9", "", "e6"},
		// "Say Hi" names two events; the city breaks the tie.
		{"anh trai say hi ở hà nội", "", "e2"},
		{"anh trai say hi ở TPHCM mấy giờ", "", "e6"},
		{"anh trai say hi", "", "e2,e6"},
		{"anh trai", "", "e2,e3,e6"},
		// The model's hint narrows the search when it is in the message.
		{"giá vé mỹ tâm khu vip", "Mỹ Tâm", "e5"},
		// A place name must not pick an event.
		{"Sân vận động Quốc gia Mỹ Đình", "", ""},
		{"concert ở Hà Nội còn vé không", "", ""},
		{"thủ đô của Pháp", "", ""},
		// A hint the user never wrote is ignored: the model cannot name an event.
		{"còn vé không", "Mỹ Tâm", ""},
		{"còn vé không", "Blackpink", ""},
	}
	for _, c := range cases {
		got := ids(resolveEvents(ix, foldText(c.msg), c.hint))
		if got != c.want {
			t.Errorf("resolveEvents(%q, hint %q) = [%s], want [%s]", c.msg, c.hint, got, c.want)
		}
	}
}

func TestResolveEventsSingleEventDatabase(t *testing.T) {
	ix := newEventIndex(demoEvents()[4:5])
	if got := ids(resolveEvents(ix, foldText("my tam"), "")); got != "e5" {
		t.Errorf("a lone event must still be found by its name, got [%s]", got)
	}
}

func demoZones() []zoneInfo {
	return []zoneInfo{
		{Code: "VIP1", Name: "VIP 1", Price: 6000000, Total: 24, Available: 10},
		{Code: "VIP2", Name: "VIP 2", Price: 5000000, Total: 24, Available: 0},
		{Code: "SVIP", Name: "SVIP", Price: 7000000, Total: 24, Available: 3},
		{Code: "CAT1_SEAT", Name: "CAT 1 (ngồi)", Price: 3000000, Total: 48, Available: 20},
		{Code: "CAT1_STAND", Name: "CAT 1 (đứng)", Price: 2800000, Total: 48, Available: 40},
		{Code: "CAT2", Name: "CAT 2", Price: 2000000, Total: 48, Available: 48},
		{Code: "DINHNOC", Name: "Ngồi - Đỉnh Nóc, Kịch Trần", Price: 1000000, Total: 24, Available: 5},
	}
}

func zoneCodes(zs []zoneInfo) string {
	out := make([]string, len(zs))
	for i, z := range zs {
		out[i] = z.Code
	}
	return strings.Join(out, ",")
}

func TestMatchZones(t *testing.T) {
	venue := "Sân vận động Quốc gia Mỹ Đình"
	cases := []struct{ msg, want string }{
		{"còn vé khu cat 1 không", "CAT1_SEAT,CAT1_STAND"},
		{"cat2", "CAT2"},
		{"CAT 2 giá bao nhiêu", "CAT2"},
		{"vip 1", "VIP1"},
		{"svip", "SVIP"},
		{"còn ghế vip k", "VIP1,VIP2"},
		{"còn vé khu nào", ""},
		{"đỉnh nóc", "DINHNOC"},
		// "Mỹ Đình" is the venue, not the zone "Đỉnh Nóc".
		{"sân vận động mỹ đình còn vé không", ""},
	}
	for _, c := range cases {
		got := zoneCodes(matchZones(demoZones(), strings.Fields(foldText(c.msg)), venue))
		if got != c.want {
			t.Errorf("matchZones(%q) = [%s], want [%s]", c.msg, got, c.want)
		}
	}
}

func TestZoneMentioned(t *testing.T) {
	cases := map[string]bool{
		"còn vé khu nào":          false,
		"khu gì còn":              false,
		"còn vé khu zzz":          true,
		"còn hạng platinum không": true,
		"giá vé":                  false,
	}
	for msg, want := range cases {
		if got := zoneMentioned(strings.Fields(foldText(msg))); got != want {
			t.Errorf("zoneMentioned(%q) = %v, want %v", msg, got, want)
		}
	}
}

func TestParseWindow(t *testing.T) {
	// Wednesday 25 November 2026.
	now := time.Date(2026, 11, 25, 10, 0, 0, 0, ict)
	day := func(m time.Month, d int) time.Time { return time.Date(2026, m, d, 0, 0, 0, 0, ict) }
	cases := []struct {
		msg      string
		from, to time.Time
	}{
		{"hôm nay có gì", day(11, 25), day(11, 26)},
		{"ngày mai", day(11, 26), day(11, 27)},
		{"tuần này có concert nào", day(11, 23), day(11, 30)},
		{"tuần sau", day(11, 30), day(12, 7)},
		{"cuối tuần này", day(11, 28), day(11, 30)},
		{"tháng này", day(11, 1), day(12, 1)},
		{"tháng sau", day(12, 1), day(1, 1).AddDate(1, 0, 0)},
		{"có gì trong tháng 12", day(12, 1), day(1, 1).AddDate(1, 0, 0)},
		{"tháng 3", day(3, 1).AddDate(1, 0, 0), day(4, 1).AddDate(1, 0, 0)},
	}
	for _, c := range cases {
		w := parseWindow(foldText(c.msg), now)
		if w == nil {
			t.Errorf("parseWindow(%q) = nil", c.msg)
			continue
		}
		if !w.From.Equal(c.from) || !w.To.Equal(c.to) {
			t.Errorf("parseWindow(%q) = %v..%v, want %v..%v", c.msg, w.From, w.To, c.from, c.to)
		}
	}
	if w := parseWindow(foldText("còn vé không"), now); w != nil {
		t.Errorf("no period named, got %+v", w)
	}
}

func TestFilterByTopic(t *testing.T) {
	events := demoEvents()
	events[0].Genre, events[4].Genre = "K-pop", "V-pop"
	cases := []struct {
		msg, wantIDs, wantTopic string
	}{
		{"có concert nào không", "e1,e2,e3,e4,e5,e6", ""},
		{"sự kiện ở Hà Nội", "e1,e2,e4,e5", "ở Hà Nội"},
		{"sự kiện ở hưng yên", "e3", "ở Hưng Yên"},
		{"sự kiện ở sài gòn", "e6", "ở TP. Hồ Chí Minh"},
		{"Sân vận động Quốc gia Mỹ Đình", "e1,e2,e4,e5", "tại Sân vận động Quốc gia Mỹ Đình"},
		{"mỹ đình có gì", "e1,e2,e4,e5", "tại Sân vận động Quốc gia Mỹ Đình"},
		{"có show nào ở ocean park", "e3", "tại Vinhomes Ocean Park 3"},
		{"concert kpop", "e1", "thể loại K-pop"},
		{"concert k pop ở hà nội", "e1", "ở Hà Nội thể loại K-pop"},
	}
	for _, c := range cases {
		got, topic := filterByTopic(events, foldText(c.msg))
		if ids(got) != c.wantIDs || topic != c.wantTopic {
			t.Errorf("filterByTopic(%q) = [%s] %q, want [%s] %q", c.msg, ids(got), topic, c.wantIDs, c.wantTopic)
		}
	}
}
