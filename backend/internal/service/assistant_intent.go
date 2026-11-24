package service

import "strings"

// AssistantIntent is what the user wants. The model only picks one of these;
// it never writes the answer.
type AssistantIntent string

const (
	IntentListEvents     AssistantIntent = "list_events"
	IntentEventInfo      AssistantIntent = "event_info"
	IntentPrices         AssistantIntent = "prices"
	IntentAvailability   AssistantIntent = "availability"
	IntentHowToBook      AssistantIntent = "how_to_book"
	IntentMyHolds        AssistantIntent = "my_holds"
	IntentMyTickets      AssistantIntent = "my_tickets"
	IntentOrganizerSales AssistantIntent = "organizer_sales"
	IntentGreeting       AssistantIntent = "greeting"
	IntentUnknown        AssistantIntent = "unknown"
)

// assistantIntents lists every intent. The order is the tie-break when two
// intents score the same: the more specific one comes first.
var assistantIntents = []AssistantIntent{
	IntentMyHolds,
	IntentMyTickets,
	IntentOrganizerSales,
	IntentAvailability,
	IntentPrices,
	IntentHowToBook,
	IntentEventInfo,
	IntentListEvents,
	IntentGreeting,
	IntentUnknown,
}

func (i AssistantIntent) valid() bool {
	for _, k := range assistantIntents {
		if k == i {
			return true
		}
	}
	return false
}

// minCueScore is the least evidence the keyword matcher needs to name an intent.
const minCueScore = 2

type cue struct {
	phrase string // folded: no diacritics, lowercase
	weight int
}

// intentCues are the fallback matcher's evidence. Phrases are folded, so
// "còn vé" and "con ve" are the same cue.
var intentCues = map[AssistantIntent][]cue{
	IntentPrices: {
		{"gia", 3}, {"bao nhieu tien", 4}, {"ve bao nhieu", 3}, {"bao nhieu", 1}, {"re nhat", 3},
		{"dat nhat", 3}, {"chi phi", 3}, {"het bao nhieu", 3}, {"bao tien", 3}, {"tien ve", 3},
	},
	IntentAvailability: {
		{"con ve", 4}, {"con cho", 3}, {"con ghe", 4}, {"con khu", 4}, {"con hang", 3},
		{"het ve", 3}, {"het cho", 3}, {"con trong", 3}, {"ghe trong", 3}, {"con khong", 2},
		{"khu nao", 2}, {"hang nao", 2}, {"ve con lai", 3}, {"con lai", 2}, {"con bao nhieu", 4},
		{"co ve khong", 3}, {"sold out", 3},
	},
	IntentHowToBook: {
		{"cach dat", 4}, {"dat ve", 3}, {"mua ve", 3}, {"cach mua", 4}, {"lam sao", 2},
		{"lam the nao", 2}, {"huong dan", 3}, {"thanh toan", 3}, {"dat cho", 3}, {"quy trinh", 3},
		{"book", 2}, {"vnpay", 3}, {"giu ghe bao lau", 4}, {"cach thuc", 2}, {"mua sao", 2}, {"dat sao", 2},
	},
	IntentEventInfo: {
		{"khi nao", 3}, {"bao gio", 3}, {"ngay nao", 3}, {"may gio", 3}, {"o dau", 3},
		{"dia diem", 3}, {"dien ra", 2}, {"thoi gian", 2}, {"tai dau", 3}, {"thong tin", 3},
		{"gioi thieu", 3}, {"chi tiet", 3}, {"dia chi", 3}, {"bat dau", 2}, {"ket thuc", 2},
		{"line up", 3}, {"lineup", 3}, {"chuong trinh", 2}, {"nghe si", 2},
	},
	IntentListEvents: {
		{"concert nao", 4}, {"su kien nao", 4}, {"show nao", 4}, {"co concert", 3}, {"co su kien", 3},
		{"co show", 3}, {"co gi", 2}, {"nhung su kien", 3}, {"nhung concert", 3}, {"lich dien", 3},
		{"sap toi", 3}, {"sap dien ra", 3}, {"tuan nay", 3}, {"tuan sau", 3}, {"tuan toi", 3},
		{"cuoi tuan", 3}, {"thang nay", 3}, {"thang sau", 3}, {"thang toi", 3}, {"hom nay", 2},
		{"ngay mai", 2}, {"danh sach", 3}, {"dang mo ban", 3}, {"dang ban", 3}, {"goi y", 3},
		{"nen xem", 3}, {"dem nhac", 2}, {"co nhung", 2}, {"xem gi", 2}, {"mo ban", 2},
	},
	IntentMyHolds: {
		{"dang giu", 4}, {"giu cho", 2}, {"ghe cua toi", 3}, {"ghe cua minh", 3}, {"ghe minh", 3},
		{"ghe da giu", 4}, {"ghe giu", 3}, {"luot giu", 3}, {"cho dang giu", 4}, {"gio hang", 3},
	},
	IntentMyTickets: {
		{"ve cua toi", 4}, {"ve cua minh", 4}, {"ve cua em", 4}, {"ve toi", 3}, {"ve minh", 3},
		{"ve da mua", 4}, {"ve da dat", 4}, {"da mua", 3}, {"ma ve", 3}, {"don hang", 3},
		{"lich su", 2}, {"my ticket", 3}, {"da thanh toan", 3}, {"ve dau", 2},
	},
	IntentOrganizerSales: {
		{"doanh so", 5}, {"doanh thu", 5}, {"ban duoc", 4}, {"da ban", 4}, {"ve da ban", 5},
		{"so ve ban", 4}, {"ban chay", 3}, {"thong ke", 3}, {"bao cao", 3}, {"tinh hinh ban", 4},
		{"lap day", 3}, {"ty le", 2}, {"tong ket", 2}, {"su kien cua toi", 4}, {"su kien cua minh", 4},
		{"ban ve", 2},
	},
	IntentGreeting: {
		{"xin chao", 4}, {"chao", 3}, {"hello", 4}, {"hey", 3}, {"alo", 3}, {"cam on", 4},
		{"thanks", 3}, {"tam biet", 3}, {"ban la ai", 4}, {"ban lam duoc gi", 4}, {"giup gi", 3},
		{"ho tro", 2}, {"tro ly", 3},
	},
}

// keywordMatch is the fallback matcher's verdict on one message.
type keywordMatch struct {
	Intent AssistantIntent
	Score  int
	Scores map[AssistantIntent]int
}

// matchKeywords scores every intent against the folded message. It is the
// fallback when the model is off, and the check on the model's answer.
func matchKeywords(folded string) keywordMatch {
	// "Quốc gia" is part of a venue name, not a question about "giá".
	folded = strings.ReplaceAll(folded, "quoc gia", "quocgia")
	m := keywordMatch{Intent: IntentUnknown, Scores: map[AssistantIntent]int{}}
	for intent, cues := range intentCues {
		for _, c := range cues {
			if containsPhrase(folded, c.phrase) {
				m.Scores[intent] += c.weight
			}
		}
	}
	for _, intent := range assistantIntents {
		if s := m.Scores[intent]; s >= minCueScore && s > m.Score {
			m.Intent, m.Score = intent, s
		}
	}
	return m
}

// arbitrate decides the final intent from the model's pick and the keyword
// evidence. The model wins unless the message clearly says something else:
// then the keywords decide, because the model is small and sometimes wrong.
func arbitrate(llm AssistantIntent, kw keywordMatch) AssistantIntent {
	if !llm.valid() {
		return kw.Intent
	}
	if kw.Score < minCueScore || kw.Intent == llm {
		if llm == IntentUnknown {
			return kw.Intent
		}
		return llm
	}
	if llm != IntentUnknown && kw.Scores[llm] >= kw.Score-1 {
		return llm
	}
	return kw.Intent
}
