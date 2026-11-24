package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"eventticketing/internal/config"
	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5/pgtype"
)

type AssistantService struct {
	cfg       *config.Config
	events    *EventService
	organizer *OrganizerService
	client    *http.Client
}

func NewAssistantService(cfg *config.Config, events *EventService, organizer *OrganizerService) *AssistantService {
	return &AssistantService{
		cfg:       cfg,
		events:    events,
		organizer: organizer,
		client:    &http.Client{Timeout: 45 * time.Second},
	}
}

type AssistantChatRequest struct {
	Message        string `json:"message"`
	CurrentEventID string `json:"currentEventId,omitempty"`
	TargetEventID  string `json:"targetEventId,omitempty"`
	Intent         string `json:"intent,omitempty"`
	Lang           string `json:"lang,omitempty"`
}

type AssistantChatResponse struct {
	Text        string `json:"text"`
	LLMProvider string `json:"llmProvider"`
	UsedLLM     bool   `json:"usedLlm"`
}

type AssistantCaller struct {
	Authenticated bool
	UserID        pgtype.UUID
	Role          store.UserRole
}

func (c AssistantCaller) IsOrganizer() bool {
	return c.Authenticated && (c.Role == store.UserRoleORGANIZER || c.Role == store.UserRoleADMIN)
}

func (s *AssistantService) provider() string {
	if s.cfg == nil {
		return "none"
	}
	switch s.cfg.AssistantLLMProvider {
	case "ollama":
		return "ollama"
	case "gemini":
		if s.cfg.GeminiAPIKey != "" && s.cfg.GeminiAPIKey != "MY_GEMINI_API_KEY" {
			return "gemini"
		}
		return "none"
	default:
		return "none"
	}
}

// Chat returns optional LLM-generated prose strictly grounded in live PostgreSQL data.
// When no LLM is configured or the upstream provider is unreachable, UsedLLM is false
// so the caller seamlessly falls back to deterministic copy.
func (s *AssistantService) Chat(ctx context.Context, caller AssistantCaller, req AssistantChatRequest) (*AssistantChatResponse, error) {
	prov := s.provider()
	if prov == "none" {
		return &AssistantChatResponse{LLMProvider: "none", UsedLLM: false}, nil
	}

	contextJSON, err := s.buildGroundedContext(ctx, caller, req)
	if err != nil {
		return &AssistantChatResponse{LLMProvider: prov, UsedLLM: false}, nil
	}

	roleLabel := "Customer"
	if caller.IsOrganizer() {
		roleLabel = "Organizer"
	}
	langInstruction := "Reply in Vietnamese."
	if strings.EqualFold(req.Lang, "en") {
		langInstruction = "Reply in English."
	}

	systemPrompt := fmt.Sprintf(
		"You are the SortMyScene EventTicketing assistant speaking to a %s. %s "+
			"Use ONLY the live PostgreSQL JSON data below. Never invent events, prices, seat counts, or revenue figures. "+
			"All prices and revenue are strictly in Vietnamese Dong (VND / ₫), NEVER USD or $. "+
			"Keep your reply concise (2 to 4 sentences) because interactive UI cards and stage charts display the detailed breakdown right beneath your message.\n\n"+
			"LIVE DATABASE CONTEXT:\n%s",
		roleLabel,
		langInstruction,
		contextJSON,
	)

	var text string
	switch prov {
	case "ollama":
		text, err = s.callOllama(ctx, systemPrompt, req.Message)
	case "gemini":
		text, err = s.callGemini(ctx, systemPrompt, req.Message)
	}
	if err != nil || strings.TrimSpace(text) == "" {
		return &AssistantChatResponse{LLMProvider: prov, UsedLLM: false}, nil
	}

	return &AssistantChatResponse{
		Text:        strings.TrimSpace(text),
		LLMProvider: prov,
		UsedLLM:     true,
	}, nil
}

func (s *AssistantService) buildGroundedContext(ctx context.Context, caller AssistantCaller, req AssistantChatRequest) (string, error) {
	payload := map[string]any{
		"role": "CUSTOMER",
	}
	if caller.IsOrganizer() {
		payload["role"] = string(caller.Role)
	}

	if s.events != nil {
		rows, err := s.events.ListEvents(ctx)
		if err == nil {
			type compactEvent struct {
				ID           string `json:"id"`
				Title        string `json:"title"`
				Genre        string `json:"genre"`
				City         string `json:"city"`
				Venue        string `json:"venue"`
				Date         string `json:"date"`
				PriceFromVND int64  `json:"priceFromVnd"`
				Currency     string `json:"currency"`
			}
			list := make([]compactEvent, 0, len(rows))
			for _, e := range rows {
				list = append(list, compactEvent{
					ID:           store.UUIDToString(e.ID),
					Title:        e.Name,
					Genre:        e.Genre.String,
					City:         e.City.String,
					Venue:        e.VenueName,
					Date:         e.StartsAt.Time.Format(time.RFC3339),
					PriceFromVND: e.PriceFrom,
					Currency:     "VND",
				})
			}
			payload["events"] = list
		}
	}

	// Only attach organizer sales telemetry when the server-verified caller is an organizer/admin
	// authorized for the requested event.
	if caller.IsOrganizer() && s.organizer != nil && s.events != nil {
		targetRef := req.TargetEventID
		if targetRef == "" {
			targetRef = req.CurrentEventID
		}
		if targetRef != "" {
			if eventID, err := s.events.ResolveEventID(ctx, targetRef); err == nil {
				isAdmin := caller.Role == store.UserRoleADMIN
				if err := s.organizer.AuthorizeEvent(ctx, eventID, caller.UserID, isAdmin); err == nil {
					if summary, err := s.organizer.GetEventSalesSummary(ctx, eventID); err == nil {
						payload["organizerSalesSummary"] = summary
					}
				}
			}
		}
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func (s *AssistantService) callOllama(ctx context.Context, systemPrompt, userMsg string) (string, error) {
	body := map[string]any{
		"model":      s.cfg.OllamaModel,
		"stream":     false,
		"keep_alive": "30m",
		"options": map[string]any{
			"num_predict": 180,
			"temperature": 0.3,
		},
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMsg},
		},
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	endpoint := strings.TrimRight(s.cfg.OllamaURL, "/") + "/api/chat"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama status %d", resp.StatusCode)
	}

	var parsed struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&parsed); err != nil {
		return "", err
	}
	return parsed.Message.Content, nil
}

func (s *AssistantService) callGemini(ctx context.Context, systemPrompt, userMsg string) (string, error) {
	body := map[string]any{
		"systemInstruction": map[string]any{
			"parts": []map[string]string{{"text": systemPrompt}},
		},
		"contents": []map[string]any{
			{
				"role":  "user",
				"parts": []map[string]string{{"text": userMsg}},
			},
		},
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	endpoint := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		s.cfg.GeminiModel,
		s.cfg.GeminiAPIKey,
	)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini status %d", resp.StatusCode)
	}

	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&parsed); err != nil {
		return "", err
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return "", nil
	}
	return parsed.Candidates[0].Content.Parts[0].Text, nil
}
