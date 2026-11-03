package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

const sessionCookie = "session_token"

type AuthHandler struct {
	authService  *service.AuthService
	cookieSecure bool
}

func NewAuthHandler(as *service.AuthService, cookieSecure bool) *AuthHandler {
	return &AuthHandler{authService: as, cookieSecure: cookieSecure}
}

type OTPRequestPayload struct {
	Destination string `json:"destination"`
}

func (h *AuthHandler) HandleRequestOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	var payload OTPRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Destination == "" {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	issue, err := h.authService.RequestOTP(r.Context(), payload.Destination)
	switch {
	case errors.Is(err, service.ErrInvalidDestination):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, service.ErrOTPRateLimited):
		writeError(w, http.StatusTooManyRequests, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}

	resp := map[string]string{"status": "sent", "destination": issue.Destination}
	if issue.DemoCode != "" {
		resp["demoCode"] = issue.DemoCode
	}
	writeJSON(w, http.StatusOK, resp)
}

type OTPVerifyPayload struct {
	Destination string `json:"destination"`
	Code        string `json:"code"`
}

func (h *AuthHandler) HandleVerifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	var payload OTPVerifyPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Destination == "" || payload.Code == "" {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	token, user, err := h.authService.VerifyOTP(r.Context(), payload.Destination, payload.Code, clientIP(r), r.UserAgent())
	switch {
	case errors.Is(err, service.ErrInvalidDestination), errors.Is(err, service.ErrOTPInvalid):
		writeError(w, http.StatusUnauthorized, service.ErrOTPInvalid.Error())
		return
	case errors.Is(err, service.ErrAccountInactive):
		writeError(w, http.StatusForbidden, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"user": map[string]string{
			"id":       store.UUIDToString(user.ID),
			"phone":    user.Phone.String,
			"email":    user.Email.String,
			"fullName": user.FullName.String,
			"role":     string(user.Role),
		},
	})
}

func (h *AuthHandler) HandleMe(w http.ResponseWriter, r *http.Request) {
	sess, ok := h.session(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user": map[string]string{
			"id":       store.UUIDToString(sess.UserID),
			"phone":    sess.Phone.String,
			"email":    sess.Email.String,
			"fullName": sess.FullName.String,
			"role":     string(sess.Role),
		},
	})
}

func (h *AuthHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	if token := extractToken(r); token != "" {
		if err := h.authService.Logout(r.Context(), token); err != nil {
			internalError(w, r, err)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

// session resolves the caller's session or writes a 401.
func (h *AuthHandler) session(w http.ResponseWriter, r *http.Request) (*store.GetSessionByTokenHashRow, bool) {
	token := extractToken(r)
	if token == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return nil, false
	}
	sess, err := h.authService.GetUserByToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return nil, false
	}
	return sess, true
}

func extractToken(r *http.Request) string {
	if scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " "); ok && strings.EqualFold(scheme, "Bearer") {
		return strings.TrimSpace(token)
	}
	if c, err := r.Cookie(sessionCookie); err == nil {
		return c.Value
	}
	return ""
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func internalError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("%s %s: %v", r.Method, r.URL.Path, err)
	writeError(w, http.StatusInternalServerError, "internal_error")
}
