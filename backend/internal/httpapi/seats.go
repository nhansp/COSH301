package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type SeatHandler struct {
	seatService *service.SeatService
	authService *service.AuthService
}

func NewSeatHandler(ss *service.SeatService, as *service.AuthService) *SeatHandler {
	return &SeatHandler{
		seatService: ss,
		authService: as,
	}
}

// HandleEventSeats handles GET /api/events/{id}/seats
func (h *SeatHandler) HandleEventSeats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse /api/events/{id}/seats
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 || parts[1] == "" {
		http.Error(w, `{"error":"invalid_event_id"}`, http.StatusBadRequest)
		return
	}

	eventID, err := store.StringToUUID(parts[2])
	if err != nil {
		http.Error(w, `{"error":"invalid_event_uuid"}`, http.StatusBadRequest)
		return
	}

	var currentUserID *pgtype.UUID
	token := extractToken(r)
	if token != "" {
		if sess, err := h.authService.GetUserByToken(r.Context(), token); err == nil {
			uid := sess.UserID
			currentUserID = &uid
		}
	}

	seats, err := h.seatService.GetSeatMap(r.Context(), eventID, currentUserID)
	if err != nil {
		http.Error(w, `{"error":"failed_to_fetch_seats"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(seats)
}

type HoldRequestPayload struct {
	EventID string `json:"eventId"`
	SeatID  string `json:"seatId"`
}

// HandleHolds handles POST /api/holds and DELETE /api/holds/{seatId}
func (h *SeatHandler) HandleHolds(w http.ResponseWriter, r *http.Request) {
	token := extractToken(r)
	if token == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	sess, err := h.authService.GetUserByToken(r.Context(), token)
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case http.MethodPost:
		var payload HoldRequestPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, `{"error":"invalid_payload"}`, http.StatusBadRequest)
			return
		}

		eventID, err := store.StringToUUID(payload.EventID)
		if err != nil {
			http.Error(w, `{"error":"invalid_event_id"}`, http.StatusBadRequest)
			return
		}

		seatID, err := store.StringToUUID(payload.SeatID)
		if err != nil {
			http.Error(w, `{"error":"invalid_seat_id"}`, http.StatusBadRequest)
			return
		}

		hold, err := h.seatService.HoldSeat(r.Context(), eventID, seatID, sess.UserID)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			if errors.Is(err, service.ErrSeatNotAvailable) {
				w.WriteHeader(http.StatusConflict) // 409 Conflict
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "seat_not_available"})
				return
			}
			if errors.Is(err, service.ErrTicketLimitReached) {
				w.WriteHeader(http.StatusBadRequest) // 400 Bad Request
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "ticket_limit_reached"})
				return
			}
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"holdId":    store.UUIDToString(hold.ID),
			"holdToken": hold.HoldToken,
			"seatId":    store.UUIDToString(hold.SeatID),
			"eventId":   store.UUIDToString(hold.EventID),
			"expiresAt": hold.ExpiresAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})

	case http.MethodDelete:
		path := strings.TrimPrefix(r.URL.Path, "/api/holds")
		seatIDStr := strings.Trim(path, "/")
		if seatIDStr == "" {
			http.Error(w, `{"error":"missing_seat_id"}`, http.StatusBadRequest)
			return
		}

		seatID, err := store.StringToUUID(seatIDStr)
		if err != nil {
			http.Error(w, `{"error":"invalid_seat_id"}`, http.StatusBadRequest)
			return
		}

		eventIDStr := r.URL.Query().Get("eventId")
		eventID, err := store.StringToUUID(eventIDStr)
		if err != nil {
			http.Error(w, `{"error":"missing_or_invalid_event_id"}`, http.StatusBadRequest)
			return
		}

		if err := h.seatService.ReleaseSeat(r.Context(), eventID, seatID, sess.UserID); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "released"})

	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}
