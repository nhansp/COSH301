package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"eventticketing/internal/service"
)

// OTPAppHandler serves the COSH301 OTP Android app. The phone number goes in
// the body, not the URL, so it stays out of proxy access logs.
type OTPAppHandler struct {
	authService *service.AuthService
}

func NewOTPAppHandler(as *service.AuthService) *OTPAppHandler {
	return &OTPAppHandler{authService: as}
}

type otpAppPayload struct {
	Phone string `json:"phone"`
}

func readOTPAppPhone(w http.ResponseWriter, r *http.Request) (string, bool) {
	var payload otpAppPayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&payload); err != nil || payload.Phone == "" {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return "", false
	}
	return payload.Phone, true
}

// HandleClaim handles POST /api/otp-app/claim. It answers 204 when no code is
// waiting, which looks the same for every number.
func (h *OTPAppHandler) HandleClaim(w http.ResponseWriter, r *http.Request) {
	phone, ok := readOTPAppPhone(w, r)
	if !ok {
		return
	}
	code, err := h.authService.ClaimAppOTP(r.Context(), phone)
	switch {
	case errors.Is(err, service.ErrInvalidDestination):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	case code == "":
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

// HandleStream handles POST /api/otp-app/stream (SSE). It only signals that a
// code is waiting; the app then calls the claim endpoint.
func (h *OTPAppHandler) HandleStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}
	phone, ok := readOTPAppPhone(w, r)
	if !ok {
		return
	}
	pending, cancel, err := h.authService.SubscribeAppOTP(phone)
	switch {
	case errors.Is(err, service.ErrInvalidDestination):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, service.ErrTooManyAppStreams):
		writeError(w, http.StatusTooManyRequests, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	defer cancel()

	// The server-wide write timeout would cut this long-lived response.
	if err := http.NewResponseController(w).SetWriteDeadline(time.Time{}); err != nil {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}
	hdr := w.Header()
	hdr.Set("Content-Type", "text/event-stream")
	hdr.Set("Cache-Control", "no-cache")
	hdr.Set("X-Accel-Buffering", "no")

	fmt.Fprint(w, "event: connected\ndata: {}\n\n")
	flusher.Flush()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		case <-pending:
			fmt.Fprint(w, "event: pending\ndata: {}\n\n")
			flusher.Flush()
		}
	}
}
