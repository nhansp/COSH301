package service

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ClientChannel chan []byte

type RealtimeHub struct {
	dbPool    *pgxpool.Pool
	subMu     sync.RWMutex
	eventSubs map[string]map[ClientChannel]bool // eventId -> set of client channels
}

func NewRealtimeHub(dbPool *pgxpool.Pool) *RealtimeHub {
	return &RealtimeHub{
		dbPool:    dbPool,
		eventSubs: make(map[string]map[ClientChannel]bool),
	}
}

// Subscribe registers a new subscriber channel for a given event ID.
func (h *RealtimeHub) Subscribe(eventID string) ClientChannel {
	ch := make(ClientChannel, 16)
	h.subMu.Lock()
	defer h.subMu.Unlock()

	if _, ok := h.eventSubs[eventID]; !ok {
		h.eventSubs[eventID] = make(map[ClientChannel]bool)
	}
	h.eventSubs[eventID][ch] = true
	return ch
}

// Unsubscribe removes a subscriber channel.
func (h *RealtimeHub) Unsubscribe(eventID string, ch ClientChannel) {
	h.subMu.Lock()
	defer h.subMu.Unlock()

	if subs, ok := h.eventSubs[eventID]; ok {
		delete(subs, ch)
		close(ch)
		if len(subs) == 0 {
			delete(h.eventSubs, eventID)
		}
	}
}

// Broadcast sends a message to all active subscribers for an event.
func (h *RealtimeHub) Broadcast(eventID string, payload []byte) {
	h.subMu.RLock()
	defer h.subMu.RUnlock()

	if subs, ok := h.eventSubs[eventID]; ok {
		for ch := range subs {
			select {
			case ch <- payload:
			default:
				// Subscriber channel is full; drop to avoid blocking
			}
		}
	}
}

// StartListener relays notifications from event_seats_channel to subscribers,
// reconnecting with a dedicated connection whenever the current one fails.
func (h *RealtimeHub) StartListener(ctx context.Context) {
	go func() {
		const retryDelay = 3 * time.Second
		for {
			err := h.listen(ctx)
			if ctx.Err() != nil {
				return
			}
			log.Printf("[SSE Hub] listener stopped: %v; reconnecting in %s", err, retryDelay)
			select {
			case <-ctx.Done():
				return
			case <-time.After(retryDelay):
			}
		}
	}()
}

func (h *RealtimeHub) listen(ctx context.Context) error {
	pooled, err := h.dbPool.Acquire(ctx)
	if err != nil {
		return err
	}
	// A LISTENing connection must never go back to the pool.
	conn := pooled.Hijack()
	defer conn.Close(context.Background())

	if _, err := conn.Exec(ctx, "LISTEN "+SeatNotificationChannel); err != nil {
		return err
	}
	log.Printf("[SSE Hub] Listening on '%s'", SeatNotificationChannel)

	for {
		n, err := conn.WaitForNotification(ctx)
		if err != nil {
			return err
		}
		var msg SeatUpdateMessage
		if err := json.Unmarshal([]byte(n.Payload), &msg); err == nil && msg.EventID != "" {
			h.Broadcast(msg.EventID, []byte(n.Payload))
		}
	}
}
