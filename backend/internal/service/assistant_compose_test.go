package service

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestFormatVND(t *testing.T) {
	cases := map[int64]string{
		0:        "0 ₫",
		500:      "500 ₫",
		1000:     "1.000 ₫",
		1500000:  "1.500.000 ₫",
		10000000: "10.000.000 ₫",
	}
	for in, want := range cases {
		if got := formatVND(in); got != want {
			t.Errorf("formatVND(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestFormatWhen(t *testing.T) {
	// 13 December 2026 is a Sunday. 12:30 UTC is 19:30 in Vietnam.
	got := formatWhen(time.Date(2026, 12, 13, 12, 30, 0, 0, time.UTC))
	if want := "Chủ nhật, 13/12/2026 lúc 19:30"; got != want {
		t.Errorf("formatWhen = %q, want %q", got, want)
	}
	got = formatWhen(time.Date(2026, 12, 12, 19, 0, 0, 0, ict))
	if want := "thứ Bảy, 12/12/2026 lúc 19:00"; got != want {
		t.Errorf("formatWhen = %q, want %q", got, want)
	}
}

func TestShortName(t *testing.T) {
	long := "VPBank K-Star Spark in Vietnam 2025 (G-Dragon, CL, DPR IAN, TEMPEST, tripleS)"
	if got, want := shortName(long), "VPBank K-Star Spark in Vietnam 2025"; got != want {
		t.Errorf("shortName = %q, want %q", got, want)
	}
}

func TestComposeEventListByWindow(t *testing.T) {
	now := time.Date(2026, 11, 25, 10, 0, 0, 0, ict) // Wednesday
	events := demoEvents()
	events[0].StartsAt = time.Date(2026, 11, 27, 19, 0, 0, 0, ict) // this week
	events[0].PriceFrom = 1500000
	for i := 1; i < len(events); i++ {
		events[i].StartsAt = time.Date(2026, 12, 10+i, 19, 0, 0, 0, ict)
	}

	w := parseWindow(foldText("Tuần này có concert nào?"), now)
	a := composeEventList(events, w, "", now)
	for _, want := range []string{"Tuần này có 1 sự kiện", "BLACKPINK", "thứ Sáu, 27/11/2026 lúc 19:00", "Giá từ 1.500.000 ₫"} {
		if !strings.Contains(a.Text, want) {
			t.Errorf("reply missing %q:\n%s", want, a.Text)
		}
	}
	if len(a.Links) != 1 || a.Links[0].URL != "/events/e1" {
		t.Errorf("links = %+v", a.Links)
	}

	// Nothing next week: say so, then show what is coming.
	a = composeEventList(events, parseWindow(foldText("tuần sau"), now), "", now)
	if !strings.Contains(a.Text, "Tuần sau chưa có sự kiện nào") || !strings.Contains(a.Text, "Các sự kiện gần nhất") {
		t.Errorf("empty window reply:\n%s", a.Text)
	}
	if strings.Count(a.Text, "•") != maxListedEvents || !strings.Contains(a.Text, "Và 1 sự kiện khác") {
		t.Errorf("long list must be capped at %d:\n%s", maxListedEvents, a.Text)
	}
}

func TestComposeZones(t *testing.T) {
	e := demoEvents()[3]
	now := time.Date(2026, 11, 25, 10, 0, 0, 0, ict)
	zones := demoZones()

	a := composeZones(e, zones, matchZones(zones, []string{"cat", "1"}, e.Venue), false, true, now)
	if !strings.Contains(a.Text, "CAT 1 (ngồi): còn 20/48 ghế, 3.000.000 ₫") || strings.Contains(a.Text, "VIP 1") {
		t.Errorf("availability for one zone:\n%s", a.Text)
	}

	a = composeZones(e, zones, nil, false, true, now)
	if !strings.Contains(a.Text, "VIP 2: 5.000.000 ₫, hết vé") {
		t.Errorf("a sold-out zone must say so:\n%s", a.Text)
	}

	a = composeZones(e, zones, nil, true, false, now)
	if !strings.Contains(a.Text, "không thấy khu bạn hỏi") || !strings.Contains(a.Text, "SVIP: 7.000.000 ₫") {
		t.Errorf("unknown zone must be admitted, then listed:\n%s", a.Text)
	}
	if len(a.Links) != 1 || a.Links[0].URL != "/events/e4/tickets" {
		t.Errorf("links = %+v", a.Links)
	}

	e.Status = "SOLD_OUT"
	a = composeZones(e, zones, nil, false, true, now)
	if !strings.Contains(a.Text, "Sự kiện này đã hết vé") {
		t.Errorf("sold-out event note missing:\n%s", a.Text)
	}
}

func TestComposeHowToBookFollowsFlags(t *testing.T) {
	full := composeHowToBook(bookingFlags{OTPLogin: true, SeatHold: true, Payments: true}, 4).Text
	for _, want := range []string{"1. ", "mã OTP", "5 phút", "VNPay", "tối đa 4 vé"} {
		if !strings.Contains(full, want) {
			t.Errorf("full flow missing %q:\n%s", want, full)
		}
	}
	demo := composeHowToBook(bookingFlags{OTPLogin: true, SeatHold: true}, 0).Text
	if strings.Contains(demo, "VNPay") || !strings.Contains(demo, "chưa mở thanh toán") {
		t.Errorf("without payments the answer must not promise it:\n%s", demo)
	}
}

func TestComposeMyHolds(t *testing.T) {
	now := time.Date(2026, 11, 25, 10, 0, 0, 0, ict)
	a := composeMyHolds([]myHold{{
		EventID: "e5", EventName: `Mỹ Tâm Live Concert "See The Light"`, SeatLabel: "A3", ZoneName: "VIP",
		Price: 9800000, ExpiresAt: now.Add(3*time.Minute + 5*time.Second),
	}}, now)
	for _, want := range []string{"đang giữ 1 ghế", "ghế A3 (VIP)", "9.800.000 ₫", "còn 3:05"} {
		if !strings.Contains(a.Text, want) {
			t.Errorf("holds reply missing %q:\n%s", want, a.Text)
		}
	}
	if a.Links[0].URL != "/checkout/e5" {
		t.Errorf("link = %+v", a.Links)
	}
	if !strings.Contains(composeMyHolds(nil, now).Text, "không giữ ghế nào") {
		t.Error("empty holds reply")
	}
}

func TestComposeOrganizerSales(t *testing.T) {
	a := composeOrganizerSales([]eventSales{
		{Event: eventInfo{Name: "Show A"}, TotalSeats: 200, SoldTickets: 50, ActiveHolds: 3, Revenue: 75000000},
		{Event: eventInfo{Name: "Show B"}, TotalSeats: 100, SoldTickets: 100, Revenue: 40000000},
	})
	for _, want := range []string{
		"Doanh số 2 sự kiện",
		"Show A: đã bán 50/200 vé (25%), doanh thu 75.000.000 ₫, đang giữ 3 ghế",
		"Show B: đã bán 100/100 vé (100%)",
		"Tổng: 150 vé, 115.000.000 ₫",
	} {
		if !strings.Contains(a.Text, want) {
			t.Errorf("sales reply missing %q:\n%s", want, a.Text)
		}
	}
	if !strings.Contains(composeOrganizerSales(nil).Text, "chưa có sự kiện") {
		t.Error("empty sales reply")
	}
}

func TestComposeOrganizerSalesListsBestSellersFirst(t *testing.T) {
	var sales []eventSales
	for i := range 7 {
		sales = append(sales, eventSales{Event: eventInfo{Name: fmt.Sprintf("Show %d", i)}, TotalSeats: 10, Revenue: int64(i) * 1000})
	}
	a := composeOrganizerSales(sales)
	if !strings.Contains(a.Text, "Show 6") || strings.Contains(a.Text, "Show 0") || !strings.Contains(a.Text, "Và 2 sự kiện khác") {
		t.Errorf("the cut-off list must keep the top sellers:\n%s", a.Text)
	}
}

func TestComposeUnknownMentionsOrganizerOnlyForOrganizer(t *testing.T) {
	if strings.Contains(composeUnknown(false).Text, "doanh số") {
		t.Error("customers must not be offered sales")
	}
	if !strings.Contains(composeUnknown(true).Text, "doanh số") {
		t.Error("organizers should be told about sales")
	}
	if strings.Contains(strings.Join(composeGreeting(false, false).Suggestions, "|"), "Doanh số") {
		t.Error("customers must not get the sales suggestion")
	}
}
