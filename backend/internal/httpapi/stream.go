package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"eventticketing/internal/service"
)

type StreamHandler struct {
	hub *service.RealtimeHub
}

func NewStreamHandler(hub *service.RealtimeHub) *StreamHandler {
	return &StreamHandler{hub: hub}
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
	eventID := parts[2]

	// SSE Headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Prevents Nginx response buffering

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
