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

// StartListener starts the PostgreSQL LISTEN loop on event_seats_channel.
func (h *RealtimeHub) StartListener(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			if h.dbPool == nil {
				time.Sleep(2 * time.Second)
				continue
			}

			conn, err := h.dbPool.Acquire(ctx)
			if err != nil {
				log.Printf("[SSE Hub] Acquire connection failed: %v. Retrying in 3s...", err)
				time.Sleep(3 * time.Second)
				continue
			}

			_, err = conn.Exec(ctx, "LISTEN "+SeatNotificationChannel)
			if err != nil {
				conn.Release()
				log.Printf("[SSE Hub] LISTEN failed: %v. Retrying in 3s...", err)
				time.Sleep(3 * time.Second)
				continue
			}

			log.Printf("[SSE Hub] Listening for PostgreSQL notifications on '%s'", SeatNotificationChannel)

			for {
				notification, err := conn.Conn().WaitForNotification(ctx)
				if err != nil {
					log.Printf("[SSE Hub] Connection interrupted: %v", err)
					conn.Release()
					break
				}

				var msg SeatUpdateMessage
				if err := json.Unmarshal([]byte(notification.Payload), &msg); err == nil && msg.EventID != "" {
					h.Broadcast(msg.EventID, []byte(notification.Payload))
				}
			}
		}
	}()
}
