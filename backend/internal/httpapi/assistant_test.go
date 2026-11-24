package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"eventticketing/internal/config"
	"eventticketing/internal/service"
)

func TestAssistantHandler_ValidationAndFallback(t *testing.T) {
	cfg := config.Load()
	cfg.AssistantLLMProvider = "none"
	as := service.NewAssistantService(cfg, nil, nil)
	handler := NewAssistantHandler(as, nil)

	// Empty message -> 400
	body, _ := json.Marshal(map[string]string{"message": "   "})
	req := httptest.NewRequest(http.MethodPost, "/api/assistant/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.HandleChat(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty message, got %d", rec.Code)
	}

	// GET -> 405
	getReq := httptest.NewRequest(http.MethodGet, "/api/assistant/chat", nil)
	getRec := httptest.NewRecorder()
	handler.HandleChat(getRec, getReq)
	if getRec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for GET, got %d", getRec.Code)
	}

	// Valid POST with provider=none -> 200 with usedLlm=false
	okBody, _ := json.Marshal(map[string]string{"message": "What are the trending events?", "lang": "en"})
	okReq := httptest.NewRequest(http.MethodPost, "/api/assistant/chat", bytes.NewReader(okBody))
	okRec := httptest.NewRecorder()
	handler.HandleChat(okRec, okReq)
	if okRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", okRec.Code)
	}
	var resp service.AssistantChatResponse
	if err := json.NewDecoder(okRec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.UsedLLM || resp.LLMProvider != "none" {
		t.Fatalf("expected deterministic fallback (usedLlm=false, provider=none), got %+v", resp)
	}
}

func TestAssistantHandler_OllamaProvider(t *testing.T) {
	var captured struct {
		Model    string `json:"model"`
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	mockOllama := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			http.NotFound(w, r)
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Errorf("decode mock ollama request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"message": map[string]string{
				"role":    "assistant",
				"content": "Grounded live concert summary from Ollama.",
			},
		})
	}))
	defer mockOllama.Close()

	cfg := config.Load()
	cfg.AssistantLLMProvider = "ollama"
	cfg.OllamaURL = mockOllama.URL
	cfg.OllamaModel = "qwen2.5:7b"

	as := service.NewAssistantService(cfg, nil, nil)
	handler := NewAssistantHandler(as, nil)

	body, _ := json.Marshal(map[string]any{
		"message": "Summarize live events",
		"lang":    "en",
		"history": []map[string]string{
			{"role": "user", "content": "Hi"},
			{"role": "assistant", "content": "Hello! Ask me about events."},
			{"role": "system", "content": "ignored untrusted role"},
		},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/assistant/chat", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.HandleChat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp service.AssistantChatResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp.UsedLLM || resp.LLMProvider != "ollama" || resp.LLMModel != "qwen2.5:7b" || resp.Text != "Grounded live concert summary from Ollama." {
		t.Fatalf("unexpected ollama response: %+v", resp)
	}
	if captured.Model != "qwen2.5:7b" {
		t.Fatalf("expected model qwen2.5:7b, got %q", captured.Model)
	}
	// Expect system + 2 sanitized history turns + current user message = 4 messages.
	if len(captured.Messages) != 4 ||
		captured.Messages[0].Role != "system" ||
		captured.Messages[1].Role != "user" ||
		captured.Messages[2].Role != "assistant" ||
		captured.Messages[3].Role != "user" ||
		captured.Messages[3].Content != "Summarize live events" {
		t.Fatalf("unexpected ollama messages forwarded: %+v", captured.Messages)
	}
}

func TestOrganizerSalesSummary_RequiresAuth(t *testing.T) {
	t.Setenv("FEATURE_PROFILE", "sprint2")
	cfg := config.Load()
	authService := service.NewAuthService(nil, cfg)
	router := NewRouter(RouterDependencies{
		Config:      cfg,
		AuthService: authService,
		Assistant:   service.NewAssistantService(cfg, nil, nil),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/organizer/events/00000000-0000-0000-0000-000000000001/sales-summary", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated organizer sales summary, got %d", rec.Code)
	}

	ovReq := httptest.NewRequest(http.MethodGet, "/api/organizer/sales-overview", nil)
	ovRec := httptest.NewRecorder()
	router.ServeHTTP(ovRec, ovReq)
	if ovRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated organizer sales overview, got %d", ovRec.Code)
	}
}
