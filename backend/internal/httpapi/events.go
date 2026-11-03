package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type EventHandler struct {
	eventService *service.EventService
}

func NewEventHandler(es *service.EventService) *EventHandler {
	return &EventHandler{eventService: es}
}

func (h *EventHandler) HandleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check if this is a detail request: /api/events/{slug}
	path := strings.TrimPrefix(r.URL.Path, "/api/events")
	path = strings.Trim(path, "/")
	if path != "" {
		h.handleEventDetail(w, r, path)
		return
	}

	// List all events
	events, err := h.eventService.ListEvents(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed_to_fetch_events"}`, http.StatusInternalServerError)
		return
	}

	type EventSummaryDTO struct {
		ID            string `json:"id"`
		Name          string `json:"title"`
		Slug          string `json:"slug"`
		Description   string `json:"description"`
		Genre         string `json:"genre"`
		City          string `json:"city"`
		ImageURL      string `json:"imageUrl"`
		VenueName     string `json:"venue"`
		VenueAddress  string `json:"address"`
		StartsAt      string `json:"date"`
		Status        string `json:"status"`
	}

	dtos := make([]EventSummaryDTO, 0, len(events))
	for _, e := range events {
		dtos = append(dtos, EventSummaryDTO{
			ID:           store.UUIDToString(e.ID),
			Name:         e.Name,
			Slug:         e.Slug,
			Description:  e.Description.String,
			Genre:        e.Genre.String,
			City:         e.City.String,
			ImageURL:     e.ImageUrl.String,
			VenueName:    e.VenueName,
			VenueAddress: e.VenueAddress.String,
			StartsAt:     e.StartsAt.Time.Format("2006-01-02T15:04:05Z07:00"),
			Status:       string(e.Status),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dtos)
}

func (h *EventHandler) handleEventDetail(w http.ResponseWriter, r *http.Request, identifier string) {
	detail, err := h.eventService.GetEventDetail(r.Context(), identifier)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "event_not_found"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(detail)
}
