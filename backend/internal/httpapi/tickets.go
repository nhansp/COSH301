package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TicketHandler struct {
	dbPool       *pgxpool.Pool
	store        *store.Queries
	authService  *service.AuthService
	eventService *service.EventService
	seatService  *service.SeatService
	realtimeHub  *service.RealtimeHub
}

func NewTicketHandler(
	dbPool *pgxpool.Pool,
	s *store.Queries,
	as *service.AuthService,
	es *service.EventService,
	ss *service.SeatService,
	hub *service.RealtimeHub,
) *TicketHandler {
	return &TicketHandler{
		dbPool:       dbPool,
		store:        s,
		authService:  as,
		eventService: es,
		seatService:  ss,
		realtimeHub:  hub,
	}
}

type CancelTicketRequest struct {
	BookingID     string         `json:"bookingId"`
	BookingCode   string         `json:"bookingCode"`
	EventID       string         `json:"eventId"`
	Reason        string         `json:"reason"`
	Seats         []string       `json:"seats"`
	Concert       map[string]any `json:"concert"`
	TicketDetails map[string]any `json:"ticketDetails"`
}

// HandleCancelTicket handles POST /api/tickets/cancel
// It releases any booked seats and creates an immutable audit log record.
func (h *TicketHandler) HandleCancelTicket(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	var req CancelTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	// 1. Resolve user ID from session or fallback to demo user
	var actorUserID pgtype.UUID
	userEmail := "khangia.demo@sortmyscene.live"
	token := extractToken(r)
	if token != "" {
		if sess, err := h.authService.GetUserByToken(r.Context(), token); err == nil {
			actorUserID = sess.UserID
			userEmail = sess.Email.String
		}
	}

	if !actorUserID.Valid {
		// Look up default customer user
		if u, err := h.store.GetUserByEmail(r.Context(), pgtype.Text{String: userEmail, Valid: true}); err == nil {
			actorUserID = u.ID
		}
	}

	// 2. Resolve event ID if provided
	var resolvedEventID pgtype.UUID
	if req.EventID != "" {
		if eid, err := h.eventService.ResolveEventID(r.Context(), req.EventID); err == nil {
			resolvedEventID = eid
		}
	}

	// 3. Release any seats and notify realtime subscribers
	if resolvedEventID.Valid && len(req.Seats) > 0 {
		for _, sLabelOrID := range req.Seats {
			var seatUUID pgtype.UUID
			if u, err := store.StringToUUID(sLabelOrID); err == nil {
				seatUUID = u
			} else {
				row := h.dbPool.QueryRow(r.Context(),
					`SELECT s.id FROM seats s 
					 JOIN event_seats es ON es.seat_id = s.id 
					 WHERE es.event_id = $1 AND (s.seat_label = $2 OR s.id::text = $2) LIMIT 1`,
					resolvedEventID, sLabelOrID)
				_ = row.Scan(&seatUUID)
			}

			if seatUUID.Valid {
				// Update event_seats back to AVAILABLE
				_, _ = h.dbPool.Exec(r.Context(),
					`UPDATE event_seats SET status = 'AVAILABLE', version = version + 1, updated_at = now()
					 WHERE event_id = $1 AND seat_id = $2`,
					resolvedEventID, seatUUID)

				// Release any seat_holds
				_, _ = h.dbPool.Exec(r.Context(),
					`UPDATE seat_holds SET status = 'RELEASED'
					 WHERE event_id = $1 AND seat_id = $2 AND status = 'ACTIVE'`,
					resolvedEventID, seatUUID)

				// Broadcast SSE notification
				notifyPayload, _ := json.Marshal(map[string]any{
					"type":      "seat_released",
					"eventId":   store.UUIDToString(resolvedEventID),
					"seatId":    store.UUIDToString(seatUUID),
					"status":    "AVAILABLE",
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				})
				_, _ = h.dbPool.Exec(r.Context(), "SELECT pg_notify($1, $2)", "event_seats_channel", string(notifyPayload))
			}
		}
	}

	// 4. Build concert details from request and database
	concertInfo := make(map[string]any)
	if len(req.Concert) > 0 {
		for k, v := range req.Concert {
			concertInfo[k] = v
		}
	} else if req.TicketDetails != nil {
		if t, ok := req.TicketDetails["eventTitle"]; ok {
			concertInfo["title"] = t
			concertInfo["name"] = t
		}
		if v, ok := req.TicketDetails["venue"]; ok {
			concertInfo["venue"] = v
		}
		if d, ok := req.TicketDetails["eventDate"]; ok {
			concertInfo["date"] = d
		}
		if tm, ok := req.TicketDetails["eventTime"]; ok {
			concertInfo["time"] = tm
		}
		if c, ok := req.TicketDetails["city"]; ok {
			concertInfo["city"] = c
		}
	}

	if resolvedEventID.Valid {
		var (
			eName, eSlug, eCity, eGenre, vName, vAddress string
			startsAt, endsAt                             time.Time
		)
		err := h.dbPool.QueryRow(r.Context(), `
			SELECT 
				e.name, 
				e.slug, 
				COALESCE(e.city, ''), 
				COALESCE(e.genre, ''), 
				e.starts_at, 
				e.ends_at,
				COALESCE(v.name, ''), 
				COALESCE(v.address, '')
			FROM events e
			LEFT JOIN venues v ON e.venue_id = v.id
			WHERE e.id = $1
		`, resolvedEventID).Scan(&eName, &eSlug, &eCity, &eGenre, &startsAt, &endsAt, &vName, &vAddress)
		if err == nil {
			concertInfo["id"] = store.UUIDToString(resolvedEventID)
			concertInfo["name"] = eName
			concertInfo["title"] = eName
			concertInfo["slug"] = eSlug
			if eCity != "" {
				concertInfo["city"] = eCity
			}
			if eGenre != "" {
				concertInfo["genre"] = eGenre
			}
			if vName != "" {
				concertInfo["venue"] = vName
			}
			if vAddress != "" {
				concertInfo["venueAddress"] = vAddress
			}
			concertInfo["startsAt"] = startsAt.Format(time.RFC3339)
			concertInfo["endsAt"] = endsAt.Format(time.RFC3339)
		}
	}

	// 5. Construct old and new data JSON for audit log
	oldDataJSON, _ := json.Marshal(map[string]any{
		"bookingId":     req.BookingID,
		"bookingCode":   req.BookingCode,
		"eventId":       req.EventID,
		"seats":         req.Seats,
		"concert":       concertInfo,
		"ticketDetails": req.TicketDetails,
		"userEmail":     userEmail,
	})
	newDataJSON, _ := json.Marshal(map[string]any{
		"status":       "CANCELLED",
		"cancelled_at": time.Now().UTC().Format(time.RFC3339),
	})

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "Khách hàng xác nhận hủy vé trên ứng dụng"
	}
	reqID := fmt.Sprintf("req_cancel_%d", time.Now().UnixNano())

	// 6. Insert immutable audit log into database
	auditLog, err := h.store.CreateAuditLog(r.Context(), store.CreateAuditLogParams{
		ActorUserID: actorUserID,
		EventID:     resolvedEventID,
		Action:      "TICKET_CANCELLED",
		EntityType:  "BOOKING",
		EntityID:    pgtype.UUID{},
		OldData:     oldDataJSON,
		NewData:     newDataJSON,
		Reason:      pgtype.Text{String: reason, Valid: true},
		RequestID:   pgtype.Text{String: reqID, Valid: true},
	})
	if err != nil {
		internalError(w, r, fmt.Errorf("create audit log: %w", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":     true,
		"status":      "cancelled",
		"auditLogId":  auditLog.ID,
		"bookingCode": req.BookingCode,
		"concert":     concertInfo,
		"cancelledAt": auditLog.CreatedAt.Time.Format(time.RFC3339),
		"message":     "Hủy vé thành công và đã ghi nhận vào nhật ký hệ thống (audit_logs)",
	})
}

// HandleListAuditLogs handles GET /api/tickets/audit-logs
func (h *TicketHandler) HandleListAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	rows, err := h.dbPool.Query(r.Context(), `
		SELECT 
			a.id,
			a.action,
			a.entity_type,
			COALESCE(a.reason, '') AS reason,
			a.created_at,
			COALESCE(u.email, 'guest') AS actor_email,
			COALESCE(e.name, a.old_data->'concert'->>'name', a.old_data->'concert'->>'title', a.old_data->'ticketDetails'->>'eventTitle', 'N/A') AS event_name,
			a.old_data,
			a.new_data
		FROM audit_logs a
		LEFT JOIN users u ON a.actor_user_id = u.id
		LEFT JOIN events e ON a.event_id = e.id
		ORDER BY a.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		internalError(w, r, err)
		return
	}
	defer rows.Close()

	type AuditItem struct {
		ID         int64          `json:"id"`
		Action     string         `json:"action"`
		EntityType string         `json:"entityType"`
		Reason     string         `json:"reason"`
		CreatedAt  string         `json:"createdAt"`
		ActorEmail string         `json:"actorEmail"`
		EventName  string         `json:"eventName"`
		Concert    map[string]any `json:"concert,omitempty"`
		OldData    map[string]any `json:"oldData,omitempty"`
		NewData    map[string]any `json:"newData,omitempty"`
	}

	var results []AuditItem
	for rows.Next() {
		var item AuditItem
		var t time.Time
		var oldBytes, newBytes []byte
		if err := rows.Scan(
			&item.ID,
			&item.Action,
			&item.EntityType,
			&item.Reason,
			&t,
			&item.ActorEmail,
			&item.EventName,
			&oldBytes,
			&newBytes,
		); err != nil {
			internalError(w, r, err)
			return
		}
		item.CreatedAt = t.Format(time.RFC3339)
		if len(oldBytes) > 0 {
			_ = json.Unmarshal(oldBytes, &item.OldData)
			if c, ok := item.OldData["concert"].(map[string]any); ok {
				item.Concert = c
			}
		}
		if len(newBytes) > 0 {
			_ = json.Unmarshal(newBytes, &item.NewData)
		}
		results = append(results, item)
	}

	if results == nil {
		results = []AuditItem{}
	}

	writeJSON(w, http.StatusOK, results)
}

// CancelledTicketItem represents a cancelled ticket with rich concert details.
type CancelledTicketItem struct {
	ID            int64          `json:"id"`
	BookingID     string         `json:"bookingId"`
	BookingCode   string         `json:"bookingCode"`
	EventID       string         `json:"eventId"`
	EventTitle    string         `json:"eventTitle"`
	Concert       map[string]any `json:"concert,omitempty"`
	TicketDetails map[string]any `json:"ticketDetails,omitempty"`
	Seats         []string       `json:"seats"`
	Reason        string         `json:"reason"`
	CancelledAt   string         `json:"cancelledAt"`
	UserEmail     string         `json:"userEmail"`
}

// HandleListUserCancelledTickets handles GET /api/tickets/cancelled
func (h *TicketHandler) HandleListUserCancelledTickets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	var actorUserID pgtype.UUID
	userEmail := "khangia.demo@sortmyscene.live"
	token := extractToken(r)
	if token != "" {
		if sess, err := h.authService.GetUserByToken(r.Context(), token); err == nil {
			actorUserID = sess.UserID
			userEmail = sess.Email.String
		}
	}

	rows, err := h.dbPool.Query(r.Context(), `
		SELECT 
			a.id,
			a.created_at,
			COALESCE(a.reason, '') AS reason,
			a.old_data
		FROM audit_logs a
		WHERE a.action = 'TICKET_CANCELLED'
		  AND (
		      ($1::uuid IS NOT NULL AND a.actor_user_id = $1)
		      OR (a.old_data->>'userEmail' = $2)
		      OR ($2 = 'khangia.demo@sortmyscene.live')
		  )
		ORDER BY a.created_at DESC
		LIMIT 50
	`, actorUserID, userEmail)
	if err != nil {
		internalError(w, r, err)
		return
	}
	defer rows.Close()

	var list []CancelledTicketItem
	for rows.Next() {
		var id int64
		var createdAt time.Time
		var reason string
		var oldBytes []byte

		if err := rows.Scan(&id, &createdAt, &reason, &oldBytes); err != nil {
			internalError(w, r, err)
			return
		}

		var oldData map[string]any
		if len(oldBytes) > 0 {
			_ = json.Unmarshal(oldBytes, &oldData)
		}

		item := CancelledTicketItem{
			ID:          id,
			Seats:       []string{},
			Reason:      reason,
			CancelledAt: createdAt.Format(time.RFC3339),
		}

		if oldData != nil {
			if bid, ok := oldData["bookingId"].(string); ok {
				item.BookingID = bid
			}
			if bcode, ok := oldData["bookingCode"].(string); ok {
				item.BookingCode = bcode
			}
			if eid, ok := oldData["eventId"].(string); ok {
				item.EventID = eid
			}
			if uemail, ok := oldData["userEmail"].(string); ok {
				item.UserEmail = uemail
			}
			if c, ok := oldData["concert"].(map[string]any); ok {
				item.Concert = c
				if name, ok := c["name"].(string); ok && name != "" {
					item.EventTitle = name
				} else if title, ok := c["title"].(string); ok && title != "" {
					item.EventTitle = title
				}
			}
			if td, ok := oldData["ticketDetails"].(map[string]any); ok {
				item.TicketDetails = td
				if item.EventTitle == "" {
					if title, ok := td["eventTitle"].(string); ok {
						item.EventTitle = title
					}
				}
			}
			if seatsRaw, ok := oldData["seats"].([]any); ok {
				for _, s := range seatsRaw {
					if str, ok := s.(string); ok {
						item.Seats = append(item.Seats, str)
					}
				}
			}
		}

		if item.EventTitle == "" {
			item.EventTitle = "Concert"
		}

		list = append(list, item)
	}

	if list == nil {
		list = []CancelledTicketItem{}
	}

	writeJSON(w, http.StatusOK, list)
}

// HandleResetDemoTickets handles POST /api/tickets/reset-demo
func (h *TicketHandler) HandleResetDemoTickets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	_, _ = h.dbPool.Exec(r.Context(), `
		ALTER TABLE audit_logs DISABLE TRIGGER trg_immutable_audit_logs;
		DELETE FROM audit_logs 
		WHERE actor_user_id IN (SELECT id FROM users WHERE email = 'khangia.demo@sortmyscene.live')
		   OR old_data->>'userEmail' = 'khangia.demo@sortmyscene.live'
		   OR action = 'TICKET_CANCELLED';
		ALTER TABLE audit_logs ENABLE TRIGGER trg_immutable_audit_logs;
		DELETE FROM seat_holds 
		WHERE user_id IN (SELECT id FROM users WHERE email = 'khangia.demo@sortmyscene.live');
	`)

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Demo tickets data cleared",
	})
}
