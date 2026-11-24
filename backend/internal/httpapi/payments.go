package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type PaymentHandler struct {
	payments *service.PaymentService
	events   *service.EventService
}

func NewPaymentHandler(ps *service.PaymentService, es *service.EventService) *PaymentHandler {
	return &PaymentHandler{payments: ps, events: es}
}

type createPaymentRequest struct {
	EventID string `json:"eventId"`
}

// HandleCreateVNPay handles POST /api/payments/vnpay/create. It prices the
// caller's holds on the event on the server and returns the VNPay URL to open.
func (h *PaymentHandler) HandleCreateVNPay(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	var req createPaymentRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil || req.EventID == "" {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	eventID, err := h.events.ResolveEventID(r.Context(), req.EventID)
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrEventNotFound.Error())
		return
	}

	checkout, err := h.payments.CreateVNPayCheckout(r.Context(), sess.UserID, eventID, vnpayClientIP(r))
	switch {
	case errors.Is(err, service.ErrEventNotFound):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case errors.Is(err, service.ErrNoActiveHolds), errors.Is(err, service.ErrHoldsExpiring), errors.Is(err, service.ErrEventNotOnSale):
		writeError(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, checkout)
}

// HandleVNPayIPN handles GET /api/payments/vnpay/ipn, called by VNPay. The
// body is always 200 with RspCode, as VNPay's retry logic reads only that.
func (h *PaymentHandler) HandleVNPayIPN(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.payments.HandleVNPayIPN(r.Context(), r.URL.Query()))
}

// HandleVNPayReturn handles GET /api/payments/vnpay/return. The browser lands
// on the frontend return page, which forwards the query here. It only reports
// the state the IPN recorded.
func (h *PaymentHandler) HandleVNPayReturn(w http.ResponseWriter, r *http.Request) {
	outcome, err := h.payments.VerifyVNPayReturn(r.Context(), r.URL.Query())
	switch {
	case errors.Is(err, service.ErrReturnInvalid):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, service.ErrPaymentNotFound):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, outcome)
}

// HandleMyTickets handles GET /api/tickets.
func (h *PaymentHandler) HandleMyTickets(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	tickets, err := h.payments.ListMyTickets(r.Context(), sess.UserID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, tickets)
}

// vnpayClientIP returns an address VNPay accepts for vnp_IpAddr (7 to 45 characters).
func vnpayClientIP(r *http.Request) string {
	if ip := clientIP(r); len(ip) >= 7 {
		return ip
	}
	return "127.0.0.1"
}
