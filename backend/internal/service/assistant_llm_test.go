package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func chatBody(content string) string {
	b, _ := json.Marshal(map[string]any{
		"choices": []map[string]any{{"finish_reason": "stop", "message": map[string]string{"role": "assistant", "content": content}}},
	})
	return string(b)
}

func TestLLMClientClassify(t *testing.T) {
	var got chatRequest
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		if r.URL.Path != "/v1/chat/completions" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(chatBody(`{"intent":"availability","event":"Mỹ Tâm","zone":""}`)))
	}))
	defer srv.Close()

	c := NewLLMClient(srv.URL+"/v1/", "test-model", "secret")
	out, err := c.Classify(context.Background(), "Concert Mỹ Tâm còn vé khu nào?")
	if err != nil {
		t.Fatalf("Classify: %v", err)
	}
	if out.Intent != IntentAvailability || out.Event != "Mỹ Tâm" || out.Zone != "" {
		t.Errorf("intent = %+v", out)
	}
	if auth != "Bearer secret" {
		t.Errorf("Authorization = %q", auth)
	}
	if got.Model != "test-model" || got.Temperature != 0 {
		t.Errorf("request model/temperature = %q/%v", got.Model, got.Temperature)
	}
	if got.ChatTemplateKwargs["enable_thinking"] != false {
		t.Errorf("thinking must be off: %v", got.ChatTemplateKwargs)
	}
	if got.ResponseFormat["type"] != "json_schema" {
		t.Errorf("response_format = %v", got.ResponseFormat)
	}
	if n := len(got.Messages); n != 2 || got.Messages[1].Content != "Concert Mỹ Tâm còn vé khu nào?" {
		t.Errorf("messages = %+v", got.Messages)
	}
}

func TestLLMClientRejectsBadAnswers(t *testing.T) {
	long := strings.Repeat("a", llmMaxEntityLen+1)
	cases := []struct {
		name, body string
		status     int
	}{
		{"garbage content", chatBody("Xin chào! Tôi là trợ lý."), 200},
		{"intent outside the list", chatBody(`{"intent":"make_coffee","event":"","zone":""}`), 200},
		{"empty choices", `{"choices":[]}`, 200},
		// llama.cpp can cut the body in the middle of a multi-byte character.
		{"truncated body", `{"choices":[{"message":{"content":"{\"intent\":\"prices\",\"event\":\"M` + "\xe1\xbb", 200},
		{"truncated content", chatBody(`{"intent":"prices","event":"M`), 200},
		{"not json", "<html>502</html>", 200},
		{"server error", `{"error":"overloaded"}`, 503},
		{"wrong key", `{"error":"unauthorized"}`, 401},
		{"entity too long is not an error", chatBody(`{"intent":"prices","event":"` + long + `","zone":""}`), 200},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(c.status)
				_, _ = w.Write([]byte(c.body))
			}))
			defer srv.Close()
			out, err := NewLLMClient(srv.URL, "m", "").Classify(context.Background(), "hi")
			if strings.HasPrefix(c.name, "entity too long") {
				if err != nil || out.Intent != IntentPrices || out.Event != "" {
					t.Errorf("oversized entity must be dropped, got %+v, %v", out, err)
				}
				return
			}
			if err == nil {
				t.Errorf("expected an error, got %+v", out)
			}
		})
	}
}

func TestLLMClientDropsDamagedEntities(t *testing.T) {
	out, err := parseClassification([]byte(chatBody("{\"intent\":\"prices\",\"event\":\"M�\",\"zone\":\" VIP \"}")))
	if err != nil {
		t.Fatal(err)
	}
	if out.Event != "" || out.Zone != "VIP" {
		t.Errorf("entities = %+v", out)
	}
}

func TestLLMClientTimeoutThenCooldown(t *testing.T) {
	var calls atomic.Int32
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()
	defer close(release)

	c := NewLLMClient(srv.URL, "m", "")
	now := time.Now()
	c.now = func() time.Time { return now }

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := c.Classify(ctx, "hi"); err == nil {
		t.Fatal("a stalled server must time out")
	}
	// The next message skips the model without calling it.
	if _, err := c.Classify(context.Background(), "hi"); err != errLLMUnavailable {
		t.Errorf("during the cooldown want errLLMUnavailable, got %v", err)
	}
	if n := calls.Load(); n != 1 {
		t.Errorf("server saw %d calls, want 1", n)
	}
	now = now.Add(llmCooldown + time.Second)
	if c.cooling() {
		t.Error("the cooldown must end")
	}
}

func TestNewLLMClientWithoutURLIsNil(t *testing.T) {
	if NewLLMClient("  ", "m", "k") != nil {
		t.Error("an empty URL must leave the assistant in keyword mode")
	}
}
