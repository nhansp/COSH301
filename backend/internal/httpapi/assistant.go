package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"eventticketing/internal/service"
)

type AssistantHandler struct {
	assistant *service.AssistantService
	auth      *service.AuthService
}

func NewAssistantHandler(assistant *service.AssistantService, auth *service.AuthService) *AssistantHandler {
	return &AssistantHandler{assistant: assistant, auth: auth}
}

// HandleChat handles POST /api/assistant/chat.
// Role is derived solely from the verified server session cookie, never from request body fields.
func (h *AssistantHandler) HandleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	var req service.AssistantChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	var caller service.AssistantCaller
	if h.auth != nil {
		if token := extractToken(r); token != "" {
			if sess, err := h.auth.GetUserByToken(r.Context(), token); err == nil {
				caller = service.AssistantCaller{
					Authenticated: true,
					UserID:        sess.UserID,
					Role:          sess.Role,
				}
			}
		}
	}

	// Local LLM inference on CPU may exceed the server's 15s default WriteTimeout on cold loads.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(50 * time.Second))

	resp, err := h.assistant.Chat(r.Context(), caller, req)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
