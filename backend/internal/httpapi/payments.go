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

type CreateOrderRequest struct {
	EventID       string   `json:"eventId"`
	SeatIDs       []string `json:"seatIds,omitempty"`
	PaymentMethod string   `json:"paymentMethod,omitempty"`
}

// HandleCreateOrder handles POST /api/orders.
func (h *PaymentHandler) HandleCreateOrder(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	var req CreateOrderRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	eventID, err := h.events.ResolveEventID(r.Context(), req.EventID)
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrEventNotFound.Error())
		return
	}

	order, err := h.payments.CreateOrder(r.Context(), sess.UserID, eventID, req.SeatIDs, req.PaymentMethod)
	switch {
	case errors.Is(err, service.ErrNoActiveHolds):
		writeError(w, http.StatusConflict, err.Error())
		return
	case errors.Is(err, service.ErrInvalidProvider):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, order)
}

// HandleListOrders handles GET /api/orders.
func (h *PaymentHandler) HandleListOrders(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	orders, err := h.payments.ListOrders(r.Context(), sess.UserID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, orders)
}

// HandleGetOrder handles GET /api/orders/{id}.
func (h *PaymentHandler) HandleGetOrder(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	orderID, err := store.StringToUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_order_id")
		return
	}
	order, err := h.payments.GetOrder(r.Context(), sess.UserID, orderID, sess.Role == store.UserRoleADMIN)
	switch {
	case errors.Is(err, service.ErrOrderNotFound):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case errors.Is(err, service.ErrOrderForbidden):
		writeError(w, http.StatusForbidden, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, order)
}

type InitiatePaymentRequest struct {
	Provider string `json:"provider"`
}

// HandleInitiatePayment handles POST /api/orders/{id}/payments.
func (h *PaymentHandler) HandleInitiatePayment(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	orderID, err := store.StringToUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_order_id")
		return
	}
	var req InitiatePaymentRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	session, err := h.payments.InitiatePayment(r.Context(), sess.UserID, orderID, req.Provider)
	switch {
	case errors.Is(err, service.ErrInvalidProvider):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, service.ErrOrderNotFound):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case errors.Is(err, service.ErrOrderForbidden):
		writeError(w, http.StatusForbidden, err.Error())
		return
	case errors.Is(err, service.ErrOrderNotPending), errors.Is(err, service.ErrOrderExpired):
		writeError(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, session)
}

// HandlePaymentIPN handles POST /api/payments/{provider}/ipn.
// Authenticated by HMAC-SHA256 webhook signature rather than user cookie.
func (h *PaymentHandler) HandlePaymentIPN(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	var req service.IPNRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	res, err := h.payments.ProcessIPN(r.Context(), provider, req)
	switch {
	case errors.Is(err, service.ErrInvalidProvider), errors.Is(err, service.ErrAmountMismatch):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, service.ErrInvalidIPNSignature):
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	case errors.Is(err, service.ErrPaymentNotFound):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case errors.Is(err, service.ErrSeatConflictRefunded):
		writeError(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// HandlePaymentReturn handles GET /api/payments/{provider}/return for gateway browser redirects.
func (h *PaymentHandler) HandlePaymentReturn(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"provider":    r.PathValue("provider"),
		"orderId":     r.URL.Query().Get("orderId"),
		"paymentCode": r.URL.Query().Get("paymentCode"),
		"status":      "received",
	})
}
