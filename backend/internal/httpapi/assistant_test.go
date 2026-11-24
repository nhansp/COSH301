package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"eventticketing/internal/config"
	"eventticketing/internal/service"
)

func assistantRouter(t *testing.T) http.Handler {
	t.Helper()
	cfg := config.Load()
	return NewRouter(RouterDependencies{
		Config:      cfg,
		AuthService: service.NewAuthService(nil, cfg),
		Assistant:   service.NewAssistantService(nil, cfg.Features, nil),
	})
}

func postChat(h http.Handler, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/assistant/chat", strings.NewReader(body))
	req.Header.Set("X-Real-IP", "203.0.113.7")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestAssistantRoute_FeatureFlag(t *testing.T) {
	t.Setenv("FEATURE_PROFILE", "sprint2")
	if rec := postChat(assistantRouter(t), `{"message":""}`); rec.Code != http.StatusBadRequest {
		t.Errorf("chatbot is on in sprint2: want the request validated (400), got %d", rec.Code)
	}

	t.Setenv("FEATURE_CHATBOT", "off")
	rec := postChat(assistantRouter(t), `{"message":"xin chào"}`)
	if rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), "feature_disabled") {
		t.Errorf("flag off: got %d %s", rec.Code, rec.Body.String())
	}
}

func TestAssistantRoute_RejectsBadInput(t *testing.T) {
	router := assistantRouter(t)
	cases := map[string]struct {
		body string
		want string
	}{
		"empty message": {`{"message":"   "}`, "empty_message"},
		"missing":       {`{}`, "empty_message"},
		"not json":      {`hello`, "invalid_payload"},
		"too large":     {`{"message":"` + strings.Repeat("a", 5000) + `"}`, "invalid_payload"},
	}
	for name, c := range cases {
		rec := postChat(router, c.body)
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), c.want) {
			t.Errorf("%s: got %d %s, want 400 %s", name, rec.Code, rec.Body.String(), c.want)
		}
	}
}

func TestAssistantRoute_RateLimitPerCaller(t *testing.T) {
	router := assistantRouter(t)
	var limited int
	for range 25 {
		if postChat(router, `{"message":""}`).Code == http.StatusTooManyRequests {
			limited++
		}
	}
	if limited != 5 {
		t.Errorf("25 requests from one address: %d were limited, want 5 (limit is 20 a minute)", limited)
	}
}

func TestAssistantRoute_OnlyPost(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/assistant/chat", nil)
	rec := httptest.NewRecorder()
	assistantRouter(t).ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET: got %d, want 405", rec.Code)
	}
}
