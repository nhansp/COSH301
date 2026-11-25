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

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 || parts[1] == "" {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	uid, err := h.eventService.ResolveEventID(r.Context(), parts[2])
	if err != nil {
		writeError(w, http.StatusNotFound, "event_not_found")
		return
	}
	eventID := store.UUIDToString(uid)

	serveTopic(w, r, h.hub, eventID, fmt.Sprintf(`{"status":"subscribed","eventId":"%s"}`, eventID))
}

// serveTopic streams a realtime hub topic as server-sent events until the client leaves.
func serveTopic(w http.ResponseWriter, r *http.Request, hub *service.RealtimeHub, topic, hello string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Prevents Nginx response buffering

	// The server-wide write timeout would cut this long-lived response.
	if err := http.NewResponseController(w).SetWriteDeadline(time.Time{}); err != nil {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	ch := hub.Subscribe(topic)
	defer hub.Unsubscribe(topic, ch)

	fmt.Fprintf(w, "event: connected\ndata: %s\n\n", hello)
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
