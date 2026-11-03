package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type StreamHandler struct {
	hub          *service.RealtimeHub
	eventService *service.EventService
}

func NewStreamHandler(hub *service.RealtimeHub, es *service.EventService) *StreamHandler {
	return &StreamHandler{hub: hub, eventService: es}
}

// HandleEventStream handles GET /api/events/{id}/stream (SSE)
func (h *StreamHandler) HandleEventStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 || parts[1] == "" {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	rawID := parts[2]
	eventID := rawID
	if uid, err := h.eventService.ResolveEventID(r.Context(), rawID); err == nil {
		eventID = store.UUIDToString(uid)
	}

	// SSE Headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Prevents Nginx response buffering

	// The server-wide write timeout would cut this long-lived response.
	if err := http.NewResponseController(w).SetWriteDeadline(time.Time{}); err != nil {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	ch := h.hub.Subscribe(eventID)
	defer h.hub.Unsubscribe(eventID, ch)

	// Send initial connection event
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"subscribed\",\"eventId\":\"%s\"}\n\n", eventID)
	flusher.Flush()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case msg, ok := <-ch:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: update\ndata: %s\n\n", string(msg))
			flusher.Flush()
		}
	}
}
