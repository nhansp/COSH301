package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

const maxAssistantBody = 4 << 10

// AssistantHandler serves POST /api/assistant/chat (FR-24).
type AssistantHandler struct {
	assistant *service.AssistantService
	auth      *service.AuthService
	// perCaller limits one account, or one address when signed out.
	perCaller *RateLimiter
}

func NewAssistantHandler(assistant *service.AssistantService, auth *service.AuthService) *AssistantHandler {
	return &AssistantHandler{assistant: assistant, auth: auth, perCaller: NewRateLimiter(20, time.Minute)}
}

// HandleChat answers one message. The caller's role comes from the server
// session only; a signed-out visitor gets public answers.
func (h *AssistantHandler) HandleChat(w http.ResponseWriter, r *http.Request) {
	var caller service.AssistantCaller
	key := "ip:" + clientIP(r)
	if token := extractToken(r); token != "" {
		if sess, err := h.auth.GetUserByToken(r.Context(), token); err == nil {
			caller = service.AssistantCaller{Authenticated: true, UserID: sess.UserID, Role: sess.Role}
			key = "user:" + store.UUIDToString(sess.UserID)
		}
	}
	if !h.perCaller.allow(key) {
		writeError(w, http.StatusTooManyRequests, "rate_limited")
		return
	}

	var req service.AssistantRequest
	r.Body = http.MaxBytesReader(w, r.Body, maxAssistantBody)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	reply, err := h.assistant.Chat(r.Context(), caller, req)
	switch {
	case errors.Is(err, service.ErrEmptyMessage):
		writeError(w, http.StatusBadRequest, "empty_message")
	case err != nil:
		internalError(w, r, err)
	default:
		writeJSON(w, http.StatusOK, reply)
	}
}
