package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	// llmTimeout bounds one classification. Past it the assistant answers from keywords.
	llmTimeout = 8 * time.Second
	// llmCooldown is how long the client skips the model after it failed to answer at all,
	// so a dead server does not add llmTimeout to every message.
	llmCooldown = 20 * time.Second
	// llmMaxConcurrent keeps a small model server from queueing requests.
	llmMaxConcurrent = 4
	llmMaxResponse   = 64 << 10
	llmMaxEntityLen  = 80
)

var errLLMUnavailable = errors.New("llm unavailable")

// llmIntent is the model's reading of a message: an intent and the words it
// thinks name an event and a zone. Nothing here reaches the user as text.
type llmIntent struct {
	Intent AssistantIntent `json:"intent"`
	Event  string          `json:"event"`
	Zone   string          `json:"zone"`
}

// LLMClient asks an OpenAI-compatible server (llama.cpp, vLLM, OpenAI) to
// classify a message. It never generates an answer for the user.
type LLMClient struct {
	baseURL string
	model   string
	apiKey  string
	http    *http.Client
	slots   chan struct{}

	mu        sync.Mutex
	downUntil time.Time
	now       func() time.Time
}

// NewLLMClient returns nil when baseURL is empty, which keeps the assistant in keyword mode.
func NewLLMClient(baseURL, model, apiKey string) *LLMClient {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil
	}
	return &LLMClient{
		baseURL: baseURL,
		model:   model,
		apiKey:  apiKey,
		http:    &http.Client{Timeout: llmTimeout},
		slots:   make(chan struct{}, llmMaxConcurrent),
		now:     time.Now,
	}
}

const classifyPrompt = `Bạn là bộ phân loại câu hỏi cho website bán vé concert. Chỉ trả về JSON, không giải thích.
intent là một trong:
- list_events: hỏi có sự kiện/concert nào, lịch diễn, tuần này, sắp tới
- event_info: hỏi thông tin một sự kiện cụ thể (ngày, địa điểm, giờ diễn)
- prices: hỏi giá vé
- availability: hỏi còn vé, còn ghế, còn khu nào
- how_to_book: hỏi cách đặt vé, mua vé, thanh toán
- my_holds: hỏi ghế mình đang giữ
- my_tickets: hỏi vé mình đã mua
- organizer_sales: ban tổ chức hỏi doanh số, bán được bao nhiêu vé
- greeting: chào hỏi, cảm ơn
- unknown: không liên quan đến vé và sự kiện
event: tên sự kiện hoặc nghệ sĩ người dùng nhắc tới, chép đúng từ câu hỏi, nếu không có thì "".
zone: tên khu vực hoặc hạng vé người dùng nhắc tới (VIP, CAT 1, GA...), nếu không có thì "".

Ví dụ:
"Tuần này có concert nào?" -> {"intent":"list_events","event":"","zone":""}
"Concert Mỹ Tâm còn vé khu nào?" -> {"intent":"availability","event":"Mỹ Tâm","zone":""}
"Giá vé VIP Blackpink bao nhiêu" -> {"intent":"prices","event":"Blackpink","zone":"VIP"}
"my tam bao gio dien" -> {"intent":"event_info","event":"my tam","zone":""}
"Cách đặt vé thế nào?" -> {"intent":"how_to_book","event":"","zone":""}
"Doanh số sự kiện của tôi" -> {"intent":"organizer_sales","event":"","zone":""}
"xin chào" -> {"intent":"greeting","event":"","zone":""}
"hôm nay trời đẹp nhỉ" -> {"intent":"unknown","event":"","zone":""}`

// classifySchema makes the server emit exactly one of the intents above.
func classifySchema() map[string]any {
	names := make([]string, len(assistantIntents))
	for i, k := range assistantIntents {
		names[i] = string(k)
	}
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"intent": map[string]any{"type": "string", "enum": names},
			"event":  map[string]any{"type": "string"},
			"zone":   map[string]any{"type": "string"},
		},
		"required":             []string{"intent", "event", "zone"},
		"additionalProperties": false,
	}
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model              string         `json:"model"`
	Messages           []chatMessage  `json:"messages"`
	Temperature        float64        `json:"temperature"`
	MaxTokens          int            `json:"max_tokens"`
	ResponseFormat     map[string]any `json:"response_format"`
	ChatTemplateKwargs map[string]any `json:"chat_template_kwargs"`
}

type chatResponse struct {
	Choices []struct {
		FinishReason string `json:"finish_reason"`
		Message      struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Classify reads one message. Any error means the caller should use keywords.
func (c *LLMClient) Classify(ctx context.Context, message string) (llmIntent, error) {
	if c.cooling() {
		return llmIntent{}, errLLMUnavailable
	}
	select {
	case c.slots <- struct{}{}:
		defer func() { <-c.slots }()
	default:
		return llmIntent{}, errLLMUnavailable
	}

	body, err := json.Marshal(chatRequest{
		Model:       c.model,
		Temperature: 0,
		MaxTokens:   96,
		Messages: []chatMessage{
			{Role: "system", Content: classifyPrompt},
			{Role: "user", Content: message},
		},
		ResponseFormat: map[string]any{
			"type":        "json_schema",
			"json_schema": map[string]any{"name": "intent", "strict": true, "schema": classifySchema()},
		},
		// Qwen3 models think before answering unless told not to; that costs seconds.
		ChatTemplateKwargs: map[string]any{"enable_thinking": false},
	})
	if err != nil {
		return llmIntent{}, fmt.Errorf("encode llm request: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, llmTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return llmIntent{}, fmt.Errorf("build llm request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		c.markDown()
		return llmIntent{}, fmt.Errorf("llm request: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, llmMaxResponse))
	if err != nil {
		c.markDown()
		return llmIntent{}, fmt.Errorf("read llm response: %w", err)
	}
	if resp.StatusCode >= 500 {
		c.markDown()
	}
	if resp.StatusCode != http.StatusOK {
		return llmIntent{}, fmt.Errorf("llm status %d", resp.StatusCode)
	}
	return parseClassification(raw)
}

// parseClassification turns a chat-completion body into a validated intent.
// A truncated body (llama.cpp can cut a multi-byte character when it hits
// max_tokens) or a reply outside the schema is an error, not a guess.
func parseClassification(raw []byte) (llmIntent, error) {
	var resp chatResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return llmIntent{}, fmt.Errorf("decode llm response: %w", err)
	}
	if len(resp.Choices) == 0 {
		return llmIntent{}, errors.New("llm returned no choices")
	}
	content := strings.TrimSpace(resp.Choices[0].Message.Content)
	var out llmIntent
	if err := json.Unmarshal([]byte(content), &out); err != nil {
		return llmIntent{}, fmt.Errorf("decode llm intent: %w", err)
	}
	if !out.Intent.valid() {
		return llmIntent{}, fmt.Errorf("llm intent %q is not one of the known intents", out.Intent)
	}
	out.Event = cleanEntity(out.Event)
	out.Zone = cleanEntity(out.Zone)
	return out, nil
}

// cleanEntity drops an entity string that is oversized or damaged.
func cleanEntity(s string) string {
	s = strings.TrimSpace(s)
	if strings.ContainsRune(s, '�') || len([]rune(s)) > llmMaxEntityLen {
		return ""
	}
	return s
}

func (c *LLMClient) cooling() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now().Before(c.downUntil)
}

func (c *LLMClient) markDown() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.downUntil = c.now().Add(llmCooldown)
}
