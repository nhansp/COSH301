package service

import (
	"cmp"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"
)

// Every sentence the assistant says is built here from database rows. The
// model never writes any of it, so no number or name can be invented.

// ict is Vietnam time. Events are shown in it whatever the server clock says.
var ict = time.FixedZone("ICT", 7*3600)

// AssistantLink is a page the answer points to.
type AssistantLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// answer is the composed reply before the service adds intent and mode.
type answer struct {
	Text        string
	Links       []AssistantLink
	Suggestions []string
}

var weekdayNames = [...]string{"Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"}

// formatVND writes 1500000 as "1.500.000 ₫".
func formatVND(n int64) string {
	neg := n < 0
	if neg {
		n = -n
	}
	digits := strconv.FormatInt(n, 10)
	var b strings.Builder
	for i, d := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(d)
	}
	out := b.String() + " ₫"
	if neg {
		return "-" + out
	}
	return out
}

// formatWhen writes an event time as "thứ Bảy, 13/12/2025 lúc 19:00".
func formatWhen(t time.Time) string {
	t = t.In(ict)
	return fmt.Sprintf("%s, %s lúc %s", weekdayNames[t.Weekday()], t.Format("02/01/2006"), t.Format("15:04"))
}

func formatDay(t time.Time) string { return t.In(ict).Format("02/01/2006") }

// shortName drops the parenthesised line-up and caps the length, for chips and links.
func shortName(name string) string {
	if i := strings.IndexByte(name, '('); i > 0 {
		name = strings.TrimSpace(name[:i])
	}
	if r := []rune(name); len(r) > 48 {
		name = strings.TrimSpace(string(r[:48])) + "…"
	}
	return name
}

func eventURL(e eventInfo) string   { return "/events/" + e.ID }
func ticketsURL(e eventInfo) string { return "/events/" + e.ID + "/tickets" }

// saleNote says why an event cannot be bought right now, or "" when it can.
func saleNote(e eventInfo, now time.Time) string {
	switch {
	case e.Status == "SOLD_OUT":
		return "đã hết vé"
	case e.Status == "PAUSED":
		return "tạm dừng bán"
	case e.SalesStart != nil && now.Before(*e.SalesStart):
		return "mở bán từ " + formatDay(*e.SalesStart)
	case e.SalesEnd != nil && !now.Before(*e.SalesEnd):
		return "đã đóng bán"
	}
	return ""
}

func quickQuestions() []string {
	return []string{"Tuần này có concert nào?", "Cách đặt vé thế nào?"}
}

// timeWindow is a span of dates a question asks about.
type timeWindow struct {
	From, To time.Time
	Label    string
}

func startOfDay(t time.Time) time.Time {
	t = t.In(ict)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, ict)
}

// parseWindow reads "tuần này", "cuối tuần", "tháng 12"... from a folded
// message. It returns nil when the message names no period.
func parseWindow(folded string, now time.Time) *timeWindow {
	today := startOfDay(now)
	monday := today.AddDate(0, 0, -((int(today.Weekday()) + 6) % 7))
	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, ict)

	switch {
	case containsPhrase(folded, "hom nay"):
		return &timeWindow{today, today.AddDate(0, 0, 1), "Hôm nay"}
	case containsPhrase(folded, "ngay mai"):
		return &timeWindow{today.AddDate(0, 0, 1), today.AddDate(0, 0, 2), "Ngày mai"}
	case containsPhrase(folded, "cuoi tuan"):
		sat := monday.AddDate(0, 0, 5)
		return &timeWindow{sat, sat.AddDate(0, 0, 2), "Cuối tuần này"}
	case containsPhrase(folded, "tuan sau"), containsPhrase(folded, "tuan toi"):
		return &timeWindow{monday.AddDate(0, 0, 7), monday.AddDate(0, 0, 14), "Tuần sau"}
	case containsPhrase(folded, "tuan nay"):
		return &timeWindow{monday, monday.AddDate(0, 0, 7), "Tuần này"}
	case containsPhrase(folded, "thang sau"), containsPhrase(folded, "thang toi"):
		return &timeWindow{monthStart.AddDate(0, 1, 0), monthStart.AddDate(0, 2, 0), "Tháng sau"}
	case containsPhrase(folded, "thang nay"):
		return &timeWindow{monthStart, monthStart.AddDate(0, 1, 0), "Tháng này"}
	}
	toks := strings.Fields(folded)
	for i := 0; i+1 < len(toks); i++ {
		if toks[i] != "thang" {
			continue
		}
		if m, err := strconv.Atoi(toks[i+1]); err == nil && m >= 1 && m <= 12 {
			year := today.Year()
			if m < int(today.Month()) {
				year++
			}
			from := time.Date(year, time.Month(m), 1, 0, 0, 0, 0, ict)
			return &timeWindow{from, from.AddDate(0, 1, 0), fmt.Sprintf("Tháng %d", m)}
		}
	}
	return nil
}

const maxListedEvents = 5

func eventLine(e eventInfo, now time.Time) string {
	line := fmt.Sprintf("• %s", e.Name)
	if note := saleNote(e, now); note != "" {
		line += " (" + note + ")"
	}
	line += fmt.Sprintf(": %s, %s.", formatWhen(e.StartsAt), e.Venue)
	if e.PriceFrom > 0 {
		line += " Giá từ " + formatVND(e.PriceFrom) + "."
	}
	return line
}

func eventLinks(events []eventInfo) []AssistantLink {
	links := make([]AssistantLink, 0, len(events))
	for _, e := range events {
		links = append(links, AssistantLink{Label: shortName(e.Name), URL: eventURL(e)})
	}
	return links
}

// composeEventList answers "what is on". upcoming holds the events not yet
// over, soonest first; topic ("ở Hà Nội") says how they were filtered.
func composeEventList(upcoming []eventInfo, w *timeWindow, topic string, now time.Time) answer {
	picked := upcoming
	intro := "Các sự kiện sắp diễn ra"
	if topic != "" {
		topic = " " + topic
		intro = "Các sự kiện" + topic + " sắp diễn ra"
	}
	if w != nil {
		picked = nil
		for _, e := range upcoming {
			if !e.StartsAt.Before(w.From) && e.StartsAt.Before(w.To) {
				picked = append(picked, e)
			}
		}
		intro = w.Label + topic + " có"
	}

	if len(upcoming) == 0 {
		return answer{Text: "Hiện chưa có sự kiện nào đang mở bán.", Suggestions: []string{"Cách đặt vé thế nào?"}}
	}
	var b strings.Builder
	shown, total := picked, len(picked)
	if len(picked) == 0 {
		fmt.Fprintf(&b, "%s chưa có sự kiện%s nào. Các sự kiện gần nhất:\n", w.Label, topic)
		shown, total = upcoming, len(upcoming)
	} else if w != nil {
		fmt.Fprintf(&b, "%s %d sự kiện:\n", intro, len(picked))
	} else {
		b.WriteString(intro + ":\n")
	}
	if len(shown) > maxListedEvents {
		shown = shown[:maxListedEvents]
	}
	for _, e := range shown {
		b.WriteString(eventLine(e, now) + "\n")
	}
	if rest := total - len(shown); rest > 0 {
		fmt.Fprintf(&b, "Và %d sự kiện khác ở trang chủ.\n", rest)
	}
	return answer{
		Text:        strings.TrimSpace(b.String()),
		Links:       eventLinks(shown),
		Suggestions: []string{"Cách đặt vé thế nào?", "Giá vé " + shortName(shown[0].Name)},
	}
}

func composeEventInfo(e eventInfo, now time.Time) answer {
	var b strings.Builder
	b.WriteString(e.Name + "\n")
	fmt.Fprintf(&b, "Thời gian: %s\n", formatWhen(e.StartsAt))
	b.WriteString("Địa điểm: " + e.Venue)
	if e.City != "" {
		b.WriteString(", " + e.City)
	}
	b.WriteString("\n")
	if note := saleNote(e, now); note != "" {
		b.WriteString("Tình trạng: " + note + "\n")
	}
	if e.PriceFrom > 0 {
		b.WriteString("Giá từ " + formatVND(e.PriceFrom) + "\n")
	}
	if e.MaxTickets > 0 {
		fmt.Fprintf(&b, "Mỗi tài khoản mua tối đa %d vé.", e.MaxTickets)
	}
	name := shortName(e.Name)
	return answer{
		Text:        strings.TrimSpace(b.String()),
		Links:       []AssistantLink{{Label: "Xem " + name, URL: eventURL(e)}, {Label: "Chọn ghế", URL: ticketsURL(e)}},
		Suggestions: []string{"Giá vé " + name, "Còn vé khu nào? " + name},
	}
}

func zoneLine(z zoneInfo, withSeats bool) string {
	if z.Available == 0 && z.Total > 0 {
		return fmt.Sprintf("• %s: %s, hết vé", z.Name, formatVND(z.Price))
	}
	if withSeats {
		return fmt.Sprintf("• %s: còn %d/%d ghế, %s", z.Name, z.Available, z.Total, formatVND(z.Price))
	}
	return fmt.Sprintf("• %s: %s", z.Name, formatVND(z.Price))
}

// composeZones answers prices (withSeats false) and availability (true).
// asked holds the zones the user named; missing is a zone name that matched
// nothing, so the full list is shown with a note.
func composeZones(e eventInfo, zones, asked []zoneInfo, zoneMissing, withSeats bool, now time.Time) answer {
	name := shortName(e.Name)
	links := []AssistantLink{{Label: "Chọn ghế " + name, URL: ticketsURL(e)}}
	if len(zones) == 0 {
		return answer{Text: fmt.Sprintf("%s chưa có khu vé nào để bán.", e.Name), Links: links}
	}

	shown := zones
	var b strings.Builder
	switch {
	case len(asked) > 0:
		shown = asked
		fmt.Fprintf(&b, "%s, %s:\n", e.Name, zoneTopic(withSeats))
	case zoneMissing:
		fmt.Fprintf(&b, "Mình không thấy khu bạn hỏi. %s, %s:\n", e.Name, zoneTopic(withSeats))
	default:
		fmt.Fprintf(&b, "%s, %s:\n", e.Name, zoneTopic(withSeats))
	}
	for _, z := range shown {
		b.WriteString(zoneLine(z, withSeats) + "\n")
	}
	if note := saleNote(e, now); note != "" {
		b.WriteString("Sự kiện này " + note + ".")
	}

	next := "Còn vé khu nào? " + name
	if withSeats {
		next = "Giá vé " + name
	}
	return answer{
		Text:        strings.TrimSpace(b.String()),
		Links:       links,
		Suggestions: []string{next, "Cách đặt vé thế nào?"},
	}
}

func zoneTopic(withSeats bool) string {
	if withSeats {
		return "số ghế còn lại theo khu"
	}
	return "giá vé theo khu"
}

// composeChooseEvent asks which event is meant, offering the likely ones.
func composeChooseEvent(candidates []eventInfo, verb string) answer {
	var b strings.Builder
	b.WriteString("Bạn muốn hỏi sự kiện nào?")
	shown := candidates
	if len(shown) > 4 {
		shown = shown[:4]
	}
	sugg := make([]string, 0, len(shown))
	for _, e := range shown {
		b.WriteString("\n• " + e.Name)
		sugg = append(sugg, verb+" "+shortName(e.Name))
	}
	return answer{Text: b.String(), Suggestions: sugg}
}

type bookingFlags struct {
	OTPLogin bool
	SeatHold bool
	Payments bool
}

func composeHowToBook(f bookingFlags, maxTickets int32) answer {
	steps := []string{`Chọn sự kiện ở trang chủ rồi bấm "Chọn vé".`}
	pick := "Chọn khu và ghế trên sơ đồ."
	if maxTickets > 0 {
		pick += fmt.Sprintf(" Mỗi tài khoản mua tối đa %d vé cho một sự kiện.", maxTickets)
	}
	steps = append(steps, pick)
	if f.OTPLogin {
		steps = append(steps, "Đăng nhập bằng mã OTP gửi về số điện thoại hoặc email.")
	}
	if f.SeatHold {
		steps = append(steps, "Ghế được giữ cho bạn trong 5 phút. Quá 5 phút chưa thanh toán, ghế sẽ được trả lại.")
	}
	if f.Payments {
		steps = append(steps, `Thanh toán qua VNPay. Vé hiện trong mục "Vé của tôi".`)
	}
	var b strings.Builder
	b.WriteString("Để đặt vé, bạn làm theo các bước sau:\n")
	for i, s := range steps {
		fmt.Fprintf(&b, "%d. %s\n", i+1, s)
	}
	text := strings.TrimSpace(b.String())
	if !f.Payments {
		text += "\nBản này chưa mở thanh toán."
	}
	return answer{
		Text:        text,
		Links:       []AssistantLink{{Label: "Trang chủ", URL: "/"}},
		Suggestions: []string{"Tuần này có concert nào?", "Giá vé các sự kiện"},
	}
}

func composeGreeting(thanks, organizer bool) answer {
	if thanks {
		return answer{Text: "Không có gì. Cần hỏi thêm gì cứ nhắn mình nhé.", Suggestions: quickQuestions()}
	}
	text := "Chào bạn, mình là trợ lý của COSH301. Mình xem giúp lịch diễn, giá vé, ghế còn trống và cách đặt vé."
	sugg := quickQuestions()
	if organizer {
		text += " Mình cũng tóm tắt được doanh số sự kiện của bạn."
		sugg = append(sugg, "Doanh số sự kiện của tôi")
	}
	return answer{Text: text, Suggestions: sugg}
}

func composeUnknown(organizer bool) answer {
	text := "Mình chưa hiểu câu hỏi này. Mình chỉ trả lời về lịch diễn, giá vé, ghế còn trống và cách đặt vé."
	sugg := quickQuestions()
	if organizer {
		text += " Với Ban Tổ chức, mình còn tóm tắt được doanh số."
		sugg = append(sugg, "Doanh số sự kiện của tôi")
	}
	return answer{Text: text, Suggestions: sugg}
}

func composeNeedLogin(what string) answer {
	return answer{
		Text:        fmt.Sprintf("Bạn cần đăng nhập để xem %s.", what),
		Links:       []AssistantLink{{Label: "Đăng nhập", URL: "/login"}},
		Suggestions: quickQuestions(),
	}
}

func composeFeatureOff(what string) answer {
	return answer{Text: fmt.Sprintf("Phần %s chưa mở trong bản này.", what), Suggestions: quickQuestions()}
}

func composeNotOrganizer() answer {
	return answer{
		Text:        "Thống kê doanh số chỉ dành cho Ban Tổ chức. Mình có thể giúp bạn xem lịch diễn, giá vé và ghế còn trống.",
		Suggestions: quickQuestions(),
	}
}

func composeEventNotFound() answer {
	return answer{
		Text:        "Mình không thấy sự kiện nào đang mở bán khớp với tên bạn nhắc. Bạn thử gõ lại tên sự kiện hoặc xem danh sách.",
		Suggestions: []string{"Tuần này có concert nào?"},
	}
}

// myHold is one seat the caller is holding.
type myHold struct {
	EventID   string
	EventName string
	SeatLabel string
	ZoneName  string
	Price     int64
	ExpiresAt time.Time
}

func composeMyHolds(holds []myHold, now time.Time) answer {
	if len(holds) == 0 {
		return answer{
			Text:        "Hiện bạn không giữ ghế nào.",
			Links:       []AssistantLink{{Label: "Trang chủ", URL: "/"}},
			Suggestions: []string{"Cách đặt vé thế nào?"},
		}
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Bạn đang giữ %d ghế:\n", len(holds))
	var links []AssistantLink
	seen := map[string]bool{}
	for _, h := range holds {
		left := max(int(h.ExpiresAt.Sub(now).Round(time.Second).Seconds()), 0)
		fmt.Fprintf(&b, "• %s: ghế %s (%s), %s, còn %d:%02d\n",
			shortName(h.EventName), h.SeatLabel, h.ZoneName, formatVND(h.Price), left/60, left%60)
		if !seen[h.EventID] {
			seen[h.EventID] = true
			links = append(links, AssistantLink{Label: "Thanh toán " + shortName(h.EventName), URL: "/checkout/" + h.EventID})
		}
	}
	return answer{Text: strings.TrimSpace(b.String()), Links: links, Suggestions: []string{"Cách đặt vé thế nào?"}}
}

// myTicket is one ticket the caller owns.
type myTicket struct {
	EventName string
	StartsAt  time.Time
	SeatLabel string
	ZoneName  string
}

func composeMyTickets(tickets []myTicket) answer {
	if len(tickets) == 0 {
		return answer{
			Text:        "Bạn chưa có vé nào.",
			Links:       []AssistantLink{{Label: "Trang chủ", URL: "/"}},
			Suggestions: []string{"Cách đặt vé thế nào?"},
		}
	}
	type group struct {
		name  string
		when  time.Time
		seats []string
	}
	var groups []*group
	index := map[string]*group{}
	for _, t := range tickets {
		g := index[t.EventName]
		if g == nil {
			g = &group{name: t.EventName, when: t.StartsAt}
			index[t.EventName] = g
			groups = append(groups, g)
		}
		g.seats = append(g.seats, fmt.Sprintf("%s (%s)", t.SeatLabel, t.ZoneName))
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Bạn có %d vé:\n", len(tickets))
	for i, g := range groups {
		if i == maxListedEvents {
			fmt.Fprintf(&b, "Và %d sự kiện khác trong mục Vé của tôi.\n", len(groups)-i)
			break
		}
		fmt.Fprintf(&b, "• %s, %s: ghế %s\n", shortName(g.name), formatWhen(g.when), strings.Join(g.seats, ", "))
	}
	return answer{
		Text:        strings.TrimSpace(b.String()),
		Links:       []AssistantLink{{Label: "Vé của tôi", URL: "/my-tickets"}},
		Suggestions: []string{"Tuần này có concert nào?"},
	}
}

// eventSales is one event's sales as the organizer sees them.
type eventSales struct {
	Event       eventInfo
	TotalSeats  int32
	SoldTickets int32
	ActiveHolds int32
	Revenue     int64
	TopZones    []zoneSales
}

type zoneSales struct {
	Name    string
	Sold    int32
	Revenue int64
}

func percent(part, whole int32) int {
	if whole <= 0 {
		return 0
	}
	return int(float64(part)/float64(whole)*100 + 0.5)
}

func composeOrganizerSales(sales []eventSales) answer {
	if len(sales) == 0 {
		return answer{
			Text:        "Bạn chưa có sự kiện nào đang bán để thống kê.",
			Links:       []AssistantLink{{Label: "Trang Ban Tổ chức", URL: "/organizer"}},
			Suggestions: quickQuestions(),
		}
	}
	var b strings.Builder
	var totalSold int32
	var totalRevenue int64
	// Best sellers first, so the cut-off list keeps the events that matter.
	sales = slices.SortedStableFunc(slices.Values(sales), func(a, b eventSales) int { return cmp.Compare(b.Revenue, a.Revenue) })
	shown := sales
	if len(shown) > maxListedEvents {
		shown = shown[:maxListedEvents]
	}
	if len(sales) == 1 {
		b.WriteString("Doanh số sự kiện:\n")
	} else {
		fmt.Fprintf(&b, "Doanh số %d sự kiện:\n", len(sales))
	}
	for _, s := range sales {
		totalSold += s.SoldTickets
		totalRevenue += s.Revenue
	}
	for _, s := range shown {
		fmt.Fprintf(&b, "• %s: đã bán %d/%d vé (%d%%), doanh thu %s",
			shortName(s.Event.Name), s.SoldTickets, s.TotalSeats, percent(s.SoldTickets, s.TotalSeats), formatVND(s.Revenue))
		if s.ActiveHolds > 0 {
			fmt.Fprintf(&b, ", đang giữ %d ghế", s.ActiveHolds)
		}
		b.WriteString("\n")
		for _, z := range s.TopZones {
			fmt.Fprintf(&b, "  Khu %s: %d vé, %s\n", z.Name, z.Sold, formatVND(z.Revenue))
		}
	}
	if len(sales) > len(shown) {
		fmt.Fprintf(&b, "Và %d sự kiện khác.\n", len(sales)-len(shown))
	}
	if len(sales) > 1 {
		fmt.Fprintf(&b, "Tổng: %d vé, %s.", totalSold, formatVND(totalRevenue))
	}
	return answer{
		Text:        strings.TrimSpace(b.String()),
		Links:       []AssistantLink{{Label: "Trang Ban Tổ chức", URL: "/organizer"}},
		Suggestions: []string{"Doanh số " + shortName(sales[0].Event.Name)},
	}
}
