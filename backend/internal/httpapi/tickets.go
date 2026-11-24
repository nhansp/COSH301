package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type TicketHandler struct {
	tickets *service.TicketService
	events  *service.EventService
}

func NewTicketHandler(ts *service.TicketService, es *service.EventService) *TicketHandler {
	return &TicketHandler{tickets: ts, events: es}
}

type CancelTicketRequest struct {
	BookingID   string   `json:"bookingId"`
	BookingCode string   `json:"bookingCode"`
	EventID     string   `json:"eventId"`
	Reason      string   `json:"reason"`
	Seats       []string `json:"seats"`
}

// HandleCancelTicket handles POST /api/tickets/cancel. Only the caller's own
// holds and tickets are released; the cancellation is written to audit_logs.
func (h *TicketHandler) HandleCancelTicket(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	var req CancelTicketRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	eventID, err := h.events.ResolveEventID(r.Context(), req.EventID)
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrEventNotFound.Error())
		return
	}

	res, err := h.tickets.Cancel(r.Context(), sess.UserID, sess.Email.String, eventID, service.CancelRequest{
		BookingID:   req.BookingID,
		BookingCode: req.BookingCode,
		Reason:      req.Reason,
		Seats:       req.Seats,
	})
	switch {
	case errors.Is(err, service.ErrNothingToCancel):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case errors.Is(err, service.ErrTooManySeats):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":       true,
		"status":        "cancelled",
		"auditLogId":    res.AuditLogID,
		"bookingCode":   req.BookingCode,
		"concert":       res.Concert,
		"releasedSeats": res.ReleasedSeats,
		"cancelledAt":   res.CancelledAt.Format(time.RFC3339),
		"message":       "Hủy vé thành công và đã ghi nhận vào nhật ký hệ thống (audit_logs)",
	})
}

// HandleListAuditLogs handles GET /api/tickets/audit-logs for organizers and admins.
func (h *TicketHandler) HandleListAuditLogs(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	items, err := h.tickets.ListAuditLogs(r.Context(), sess.UserID, sess.Role == store.UserRoleADMIN)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

// HandleListUserCancelledTickets handles GET /api/tickets/cancelled.
func (h *TicketHandler) HandleListUserCancelledTickets(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	list, err := h.tickets.ListCancelled(r.Context(), sess.UserID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// HandleListMyTickets handles GET /api/me/tickets.
func (h *TicketHandler) HandleListMyTickets(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	list, err := h.tickets.ListMyTickets(r.Context(), sess.UserID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// HandleGetTicketQR handles GET /api/tickets/{id}/qr.
// Returns the deterministic fixed HMAC-signed QR payload for an active ticket.
func (h *TicketHandler) HandleGetTicketQR(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	ticketID, err := store.StringToUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_ticket_id")
		return
	}
	isStaff := sess.Role == store.UserRoleADMIN || sess.Role == store.UserRoleORGANIZER || sess.Role == store.UserRoleGATESTAFF
	qr, err := h.tickets.GetFixedQR(r.Context(), ticketID, sess.UserID, isStaff)
	switch {
	case errors.Is(err, service.ErrTicketNotFound):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case errors.Is(err, service.ErrTicketForbidden):
		writeError(w, http.StatusForbidden, err.Error())
		return
	case errors.Is(err, service.ErrTicketInactive):
		writeError(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, qr)
}

type VerifyQRRequest struct {
	Payload string `json:"payload"`
}

// HandleVerifyTicketQR handles POST /api/tickets/verify-qr for gate staff, organizers, and admins.
func (h *TicketHandler) HandleVerifyTicketQR(w http.ResponseWriter, r *http.Request, _ *store.GetSessionByTokenHashRow) {
	var req VerifyQRRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	res, err := h.tickets.VerifyTicketQR(r.Context(), req.Payload)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// HandleResetDemoTickets handles POST /api/tickets/reset-demo.
func (h *TicketHandler) HandleResetDemoTickets(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	if err := h.tickets.ResetDemo(r.Context(), sess.UserID); err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Demo tickets data cleared",
	})
}
