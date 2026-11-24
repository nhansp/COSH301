package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/config"
	"eventticketing/internal/store"
)

const maxAssistantMessageRunes = 300

// ErrEmptyMessage is returned for a message with no text.
var ErrEmptyMessage = errors.New("empty_message")

// AssistantCaller is who is asking. The handler fills it from the server
// session; nothing in the request body can change it.
type AssistantCaller struct {
	Authenticated bool
	UserID        pgtype.UUID
	Role          store.UserRole
}

func (c AssistantCaller) isOrganizer() bool {
	return c.Authenticated && (c.Role == store.UserRoleORGANIZER || c.Role == store.UserRoleADMIN)
}

func (c AssistantCaller) roleName() string {
	if !c.Authenticated {
		return "anonymous"
	}
	return string(c.Role)
}

// AssistantContext tells the assistant which page the user is on.
type AssistantContext struct {
	// Event is the id or slug of the event page the widget sits on.
	Event string `json:"event"`
}

type AssistantRequest struct {
	Message string            `json:"message"`
	Context *AssistantContext `json:"context,omitempty"`
}

// AssistantReply is the response of POST /api/assistant/chat.
type AssistantReply struct {
	Reply string `json:"reply"`
	// Intent is what the assistant understood, one of the AssistantIntent values.
	Intent string `json:"intent"`
	// Mode is "llm" when the language model read the question, "fallback" when keywords did.
	Mode        string          `json:"mode"`
	Links       []AssistantLink `json:"links"`
	Suggestions []string        `json:"suggestions"`
}

// AssistantService answers questions about events, prices, seats and sales
// (FR-24). The language model only classifies the question; every fact in
// the reply is read from PostgreSQL and written from templates.
type AssistantService struct {
	queries  *store.Queries
	features *config.FeatureManager
	llm      *LLMClient
	now      func() time.Time
}

// NewAssistantService builds the service. llm may be nil: the assistant then
// runs on keywords alone.
func NewAssistantService(queries *store.Queries, features *config.FeatureManager, llm *LLMClient) *AssistantService {
	return &AssistantService{queries: queries, features: features, llm: llm, now: time.Now}
}

// LLMEnabled reports whether a model is configured.
func (s *AssistantService) LLMEnabled() bool { return s.llm != nil }

// Chat answers one message.
func (s *AssistantService) Chat(ctx context.Context, caller AssistantCaller, req AssistantRequest) (*AssistantReply, error) {
	start := time.Now()
	msg := truncateRunes(strings.TrimSpace(req.Message), maxAssistantMessageRunes)
	if msg == "" {
		return nil, ErrEmptyMessage
	}
	folded := foldText(msg)
	kw := matchKeywords(folded)

	intent, mode := kw.Intent, "fallback"
	var hint llmIntent
	var llmTime time.Duration
	if s.llm != nil {
		t := time.Now()
		got, err := s.llm.Classify(ctx, msg)
		llmTime = time.Since(t)
		if err != nil {
			// The error never contains the message, so it is safe to log.
			log.Printf("assistant: model skipped: %v", err)
		} else {
			hint, mode = got, "llm"
			intent = arbitrate(got.Intent, kw)
		}
	}

	ans, intent, err := s.answer(ctx, caller, intent, folded, hint, req.Context)
	if err != nil {
		return nil, err
	}
	log.Printf("assistant: intent=%s mode=%s role=%s model=%dms total=%dms",
		intent, mode, caller.roleName(), llmTime.Milliseconds(), time.Since(start).Milliseconds())

	if ans.Links == nil {
		ans.Links = []AssistantLink{}
	}
	if ans.Suggestions == nil {
		ans.Suggestions = []string{}
	}
	return &AssistantReply{
		Reply:       ans.Text,
		Intent:      string(intent),
		Mode:        mode,
		Links:       ans.Links,
		Suggestions: ans.Suggestions,
	}, nil
}

// answer picks the composer for the intent. It returns the intent it ended
// up answering, which differs from the input when a bare event name turns
// "unknown" into "event_info".
func (s *AssistantService) answer(ctx context.Context, caller AssistantCaller, intent AssistantIntent, folded string, hint llmIntent, page *AssistantContext) (answer, AssistantIntent, error) {
	now := s.now()
	tokens := strings.Fields(folded)

	switch intent {
	case IntentHowToBook:
		return composeHowToBook(s.bookingFlags(), 0), intent, nil
	case IntentMyHolds:
		a, err := s.myHolds(ctx, caller, now)
		return a, intent, err
	case IntentMyTickets:
		a, err := s.myTickets(ctx, caller)
		return a, intent, err
	case IntentOrganizerSales:
		a, err := s.organizerSales(ctx, caller, folded, hint)
		return a, intent, err
	}

	events, err := s.loadEvents(ctx)
	if err != nil {
		return answer{}, intent, err
	}

	switch intent {
	case IntentListEvents:
		return s.listEvents(events, folded, now), intent, nil
	case IntentEventInfo, IntentPrices, IntentAvailability:
		a, err := s.eventAnswer(ctx, intent, events, folded, tokens, hint, page, now)
		return a, intent, err
	}

	// Greeting or unknown: a bare event name still deserves an answer.
	if found := resolveEvents(newEventIndex(events), folded, hint.Event); len(found) == 1 {
		return composeEventInfo(found[0], now), IntentEventInfo, nil
	}
	thanks := containsPhrase(folded, "cam on") || containsPhrase(folded, "thanks")
	if intent == IntentGreeting {
		return composeGreeting(thanks, caller.isOrganizer()), intent, nil
	}
	return composeUnknown(caller.isOrganizer()), IntentUnknown, nil
}

func (s *AssistantService) bookingFlags() bookingFlags {
	return bookingFlags{
		OTPLogin: s.features.IsEnabled(config.FlagOtpLogin),
		SeatHold: s.features.IsEnabled(config.FlagSeatHold),
		Payments: s.features.IsEnabled(config.FlagPayments),
	}
}

func (s *AssistantService) loadEvents(ctx context.Context) ([]eventInfo, error) {
	rows, err := s.queries.ListAssistantEvents(ctx)
	if err != nil {
		return nil, fmt.Errorf("list events: %w", err)
	}
	events := make([]eventInfo, 0, len(rows))
	for _, r := range rows {
		e := eventInfo{
			ID:         store.UUIDToString(r.ID),
			Name:       r.Name,
			Slug:       r.Slug,
			Genre:      r.Genre.String,
			City:       r.City.String,
			Venue:      r.VenueName,
			Status:     string(r.Status),
			StartsAt:   r.StartsAt.Time,
			EndsAt:     r.EndsAt.Time,
			MaxTickets: r.MaxTicketsPerUser,
			PriceFrom:  r.PriceFrom,
		}
		if r.SalesStartsAt.Valid {
			e.SalesStart = &r.SalesStartsAt.Time
		}
		if r.SalesEndsAt.Valid {
			e.SalesEnd = &r.SalesEndsAt.Time
		}
		events = append(events, e)
	}
	return events, nil
}

func (s *AssistantService) listEvents(events []eventInfo, folded string, now time.Time) answer {
	picked, topic := filterByTopic(events, folded)
	if topic != "" && len(picked) == 0 {
		return answer{Text: fmt.Sprintf("Chưa có sự kiện %s nào đang mở bán.", topic), Suggestions: quickQuestions()}
	}
	return composeEventList(picked, parseWindow(folded, now), topic, now)
}

// eventAnswer handles the questions about one event.
func (s *AssistantService) eventAnswer(ctx context.Context, intent AssistantIntent, events []eventInfo, folded string, tokens []string, hint llmIntent, page *AssistantContext, now time.Time) (answer, error) {
	if len(events) == 0 {
		return answer{Text: "Hiện chưa có sự kiện nào đang mở bán.", Suggestions: []string{"Cách đặt vé thế nào?"}}, nil
	}
	verb := map[AssistantIntent]string{IntentEventInfo: "Thông tin", IntentPrices: "Giá vé", IntentAvailability: "Còn vé"}[intent]

	found := resolveEvents(newEventIndex(events), folded, hint.Event)
	if len(found) > 1 {
		return composeChooseEvent(found, verb), nil
	}
	var event *eventInfo
	switch {
	case len(found) == 1:
		event = &found[0]
	case page != nil && page.Event != "":
		for i, e := range events {
			if e.ID == page.Event || e.Slug == page.Event {
				event = &events[i]
			}
		}
	}
	if event == nil && len(events) == 1 {
		event = &events[0]
	}
	if event == nil {
		return composeChooseEvent(events, verb), nil
	}

	if intent == IntentEventInfo {
		return composeEventInfo(*event, now), nil
	}

	id, err := store.StringToUUID(event.ID)
	if err != nil {
		return answer{}, fmt.Errorf("event id: %w", err)
	}
	rows, err := s.queries.ListAssistantEventZones(ctx, id)
	if err != nil {
		return answer{}, fmt.Errorf("list zones: %w", err)
	}
	zones := make([]zoneInfo, 0, len(rows))
	for _, r := range rows {
		zones = append(zones, zoneInfo{
			Code: r.ZoneCode, Name: r.ZoneName, Price: fromNumeric(r.BasePrice),
			Total: r.TotalSeats, Available: r.AvailableSeats,
		})
	}

	asked := matchZones(zones, tokens, event.Venue)
	if z := strings.Fields(foldText(hint.Zone)); len(z) > 0 && hintGrounded(z, tokens) {
		if byHint := matchZones(zones, z, event.Venue); len(byHint) > 0 {
			asked = byHint
		}
	}
	missing := len(asked) == 0 && zoneMentioned(tokens)
	return composeZones(*event, zones, asked, missing, intent == IntentAvailability, now), nil
}

func (s *AssistantService) myHolds(ctx context.Context, caller AssistantCaller, now time.Time) (answer, error) {
	if !s.features.IsEnabled(config.FlagSeatHold) {
		return composeFeatureOff("giữ ghế"), nil
	}
	if !caller.Authenticated {
		return composeNeedLogin("ghế bạn đang giữ"), nil
	}
	rows, err := s.queries.ListMyActiveHolds(ctx, caller.UserID)
	if err != nil {
		return answer{}, fmt.Errorf("list holds: %w", err)
	}
	holds := make([]myHold, 0, len(rows))
	for _, r := range rows {
		holds = append(holds, myHold{
			EventID:   store.UUIDToString(r.EventID),
			EventName: r.EventName,
			SeatLabel: r.SeatLabel,
			ZoneName:  r.ZoneName,
			Price:     fromNumeric(r.CurrentPrice),
			ExpiresAt: r.ExpiresAt.Time,
		})
	}
	return composeMyHolds(holds, now), nil
}

func (s *AssistantService) myTickets(ctx context.Context, caller AssistantCaller) (answer, error) {
	if !s.features.IsEnabled(config.FlagPayments) {
		return composeFeatureOff("vé đã mua"), nil
	}
	if !caller.Authenticated {
		return composeNeedLogin("vé của bạn"), nil
	}
	rows, err := s.queries.ListUserTickets(ctx, caller.UserID)
	if err != nil {
		return answer{}, fmt.Errorf("list tickets: %w", err)
	}
	tickets := make([]myTicket, 0, len(rows))
	for _, r := range rows {
		tickets = append(tickets, myTicket{
			EventName: r.EventName, StartsAt: r.StartsAt.Time, SeatLabel: r.SeatLabel, ZoneName: r.ZoneName,
		})
	}
	return composeMyTickets(tickets), nil
}

// organizerSales summarises sales. The query itself is limited to the
// caller's own events (all events for an admin), so a customer or another
// organizer can never read them whatever the message says.
func (s *AssistantService) organizerSales(ctx context.Context, caller AssistantCaller, folded string, hint llmIntent) (answer, error) {
	if !caller.Authenticated {
		return composeNeedLogin("doanh số"), nil
	}
	if !caller.isOrganizer() {
		return composeNotOrganizer(), nil
	}
	if !s.features.IsEnabled(config.FlagOrganizerConsole) {
		return composeFeatureOff("Ban Tổ chức"), nil
	}
	isAdmin := caller.Role == store.UserRoleADMIN

	rows, err := s.queries.ListAssistantEventSales(ctx, store.ListAssistantEventSalesParams{
		IsAdmin: isAdmin, OrganizerID: caller.UserID,
	})
	if err != nil {
		return answer{}, fmt.Errorf("list sales: %w", err)
	}
	sales := make([]eventSales, 0, len(rows))
	for _, r := range rows {
		sales = append(sales, eventSales{
			Event:       eventInfo{ID: store.UUIDToString(r.ID), Name: r.Name, Slug: r.Slug, Status: string(r.Status), StartsAt: r.StartsAt.Time},
			TotalSeats:  r.TotalSeats,
			SoldTickets: r.SoldTickets,
			ActiveHolds: r.ActiveHolds,
			Revenue:     r.Revenue,
		})
	}

	// A named event narrows the summary, but only among the caller's own events.
	own := make([]eventInfo, len(sales))
	for i, e := range sales {
		own[i] = e.Event
	}
	if named := resolveEvents(newEventIndex(own), folded, hint.Event); len(named) > 0 {
		sales = slices.DeleteFunc(sales, func(e eventSales) bool {
			return !slices.ContainsFunc(named, func(n eventInfo) bool { return n.ID == e.Event.ID })
		})
	} else if !isAdmin {
		// Say "not yours" without revealing sales of someone else's event.
		public, err := s.loadEvents(ctx)
		if err != nil {
			return answer{}, err
		}
		if len(resolveEvents(newEventIndex(public), folded, hint.Event)) > 0 {
			return answer{
				Text:        "Mình chỉ thống kê được các sự kiện do bạn tổ chức, và không thấy sự kiện đó trong danh sách của bạn.",
				Suggestions: []string{"Doanh số sự kiện của tôi"},
			}, nil
		}
	}

	if len(sales) == 1 {
		id, err := store.StringToUUID(sales[0].Event.ID)
		if err != nil {
			return answer{}, fmt.Errorf("event id: %w", err)
		}
		zones, err := s.queries.ListAssistantZoneSales(ctx, store.ListAssistantZoneSalesParams{
			EventID: id, IsAdmin: isAdmin, OrganizerID: caller.UserID,
		})
		if err != nil {
			return answer{}, fmt.Errorf("list zone sales: %w", err)
		}
		for _, z := range zones[:min(len(zones), 3)] {
			sales[0].TopZones = append(sales[0].TopZones, zoneSales{Name: z.ZoneName, Sold: z.SoldTickets, Revenue: z.Revenue})
		}
	}
	return composeOrganizerSales(sales), nil
}
