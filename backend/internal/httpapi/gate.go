package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5/pgtype"
)

// gateRoles may scan tickets at the gate.
var gateRoles = []store.UserRole{store.UserRoleGATESTAFF, store.UserRoleORGANIZER, store.UserRoleADMIN}

type GateHandler struct {
	gate   *service.GateService
	events *service.EventService
	hub    *service.RealtimeHub
}

func NewGateHandler(gs *service.GateService, es *service.EventService, hub *service.RealtimeHub) *GateHandler {
	return &GateHandler{gate: gs, events: es, hub: hub}
}

// HandleTicketStream handles GET /api/tickets/{id}/stream: the owner's screen
// learns the moment the gate admits the ticket.
func (h *GateHandler) HandleTicketStream(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	ticketID, err := store.StringToUUID(r.PathValue("id"))
	if err == nil {
		err = h.gate.OwnsTicket(r.Context(), sess.UserID, ticketID)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, "ticket_not_found")
		return
	}
	id := store.UUIDToString(ticketID)
	serveTopic(w, r, h.hub, service.TicketTopic(id), `{"status":"subscribed"}`)
}

// HandleTicketQR handles GET /api/tickets/{id}/qr: the rotating code of one of
// the caller's own tickets.
func (h *GateHandler) HandleTicketQR(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	ticketID, err := store.StringToUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "ticket_not_found")
		return
	}
	qr, err := h.gate.CurrentQR(r.Context(), sess.UserID, ticketID)
	switch {
	case errors.Is(err, service.ErrTicketNotFound):
		writeError(w, http.StatusNotFound, "ticket_not_found")
	case errors.Is(err, service.ErrTicketNotUsable):
		writeError(w, http.StatusConflict, "ticket_not_usable")
	case err != nil:
		internalError(w, r, err)
	default:
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, qr)
	}
}

type checkinRequest struct {
	Payload string `json:"payload"`
	EventID string `json:"eventId"`
}

// HandleCheckin handles POST /api/gate/checkin. The result is always 200: a
// refused ticket is a normal outcome for the gate, not an error.
func (h *GateHandler) HandleCheckin(w http.ResponseWriter, r *http.Request, _ *store.GetSessionByTokenHashRow) {
	var req checkinRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil || req.Payload == "" {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	var eventID pgtype.UUID
	if req.EventID != "" {
		id, err := h.events.ResolveEventID(r.Context(), req.EventID)
		if err != nil {
			writeError(w, http.StatusNotFound, "event_not_found")
			return
		}
		eventID = id
	}
	out, err := h.gate.CheckIn(r.Context(), req.Payload, eventID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}
