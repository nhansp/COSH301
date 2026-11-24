package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

// PricingHandler serves the organizer's dynamic pricing dashboard (FR-22).
// Every endpoint checks that the caller organizes the event.
type PricingHandler struct {
	organizer *service.OrganizerService
	events    *service.EventService
	pricing   *service.DynamicPricingEngine
	hub       *service.RealtimeHub
}

func NewPricingHandler(os *service.OrganizerService, es *service.EventService, pe *service.DynamicPricingEngine, hub *service.RealtimeHub) *PricingHandler {
	return &PricingHandler{organizer: os, events: es, pricing: pe, hub: hub}
}

// authorizedEvent resolves {id} and checks the caller may manage it. It writes
// the error response and reports false when not.
func (h *PricingHandler) authorizedEvent(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) (pgtype.UUID, bool) {
	eventID, err := h.events.ResolveEventID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrEventNotFound.Error())
		return eventID, false
	}
	if err := h.organizer.AuthorizeEvent(r.Context(), eventID, sess.UserID, sess.Role == store.UserRoleADMIN); err != nil {
		h.writeErr(w, r, err)
		return eventID, false
	}
	return eventID, true
}

// HandleOverview handles GET /api/organizer/events/{id}/pricing.
func (h *PricingHandler) HandleOverview(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	overview, err := h.pricing.Overview(r.Context(), eventID)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, overview)
}

// HandleUpdateSettings handles PUT /api/organizer/events/{id}/pricing/settings.
func (h *PricingHandler) HandleUpdateSettings(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	var in service.PricingSettingsInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	if err := h.pricing.UpdateSettings(r.Context(), eventID, sess.UserID, in); err != nil {
		h.writeErr(w, r, err)
		return
	}
	h.HandleOverview(w, r, sess)
}

// HandleSetZoneIncluded handles PUT /api/organizer/events/{id}/zones/{zoneId}/dynamic-pricing.
func (h *PricingHandler) HandleSetZoneIncluded(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	zoneID, err := store.StringToUUID(r.PathValue("zoneId"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrZoneNotFound.Error())
		return
	}
	var in struct {
		Included *bool `json:"included"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Included == nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	if err := h.pricing.SetZoneIncluded(r.Context(), eventID, zoneID, *in.Included); err != nil {
		h.writeErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// HandleAnalyze handles POST /api/organizer/events/{id}/pricing/analyze: run the job for this event now.
func (h *PricingHandler) HandleAnalyze(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	if err := h.pricing.RunEvent(r.Context(), eventID); err != nil {
		h.writeErr(w, r, err)
		return
	}
	h.HandleOverview(w, r, sess)
}

// HandleHistory handles GET /api/organizer/events/{id}/pricing/history.
func (h *PricingHandler) HandleHistory(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	history, err := h.pricing.History(r.Context(), eventID, limitParam(r, 100))
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, history)
}

// HandleAlerts handles GET /api/organizer/events/{id}/pricing/alerts.
func (h *PricingHandler) HandleAlerts(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	alerts, err := h.pricing.Alerts(r.Context(), eventID, limitParam(r, 50))
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, alerts)
}

// HandleReadAllAlerts handles POST /api/organizer/events/{id}/pricing/alerts/read.
func (h *PricingHandler) HandleReadAllAlerts(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	if err := h.pricing.MarkAllAlertsRead(r.Context(), eventID); err != nil {
		internalError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// HandleReadAlert handles POST /api/organizer/pricing/alerts/{id}/read.
func (h *PricingHandler) HandleReadAlert(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	id, err := store.StringToUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrAlertNotFound.Error())
		return
	}
	eventID, err := h.pricing.AlertEvent(r.Context(), id)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	if err := h.organizer.AuthorizeEvent(r.Context(), eventID, sess.UserID, sess.Role == store.UserRoleADMIN); err != nil {
		h.writeErr(w, r, err)
		return
	}
	if err := h.pricing.MarkAlertRead(r.Context(), id); err != nil {
		internalError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// HandleStream handles GET /api/organizer/events/{id}/pricing/stream (SSE):
// alerts and pricing updates for the organizer's dashboard.
func (h *PricingHandler) HandleStream(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	id := store.UUIDToString(eventID)
	serveSSE(w, r, flusher, h.hub, service.PricingTopic(id), id)
}

// HandleListSuggestions handles GET /api/organizer/events/{id}/pricing/suggestions.
func (h *PricingHandler) HandleListSuggestions(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	suggestions, err := h.pricing.ListPending(r.Context(), eventID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, suggestions)
}

// HandleApproveSuggestion handles POST /api/organizer/suggestions/{id}/approve.
func (h *PricingHandler) HandleApproveSuggestion(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	h.reviewSuggestion(w, r, sess, h.pricing.Approve)
}

// HandleRejectSuggestion handles POST /api/organizer/suggestions/{id}/reject.
func (h *PricingHandler) HandleRejectSuggestion(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	h.reviewSuggestion(w, r, sess, h.pricing.Reject)
}

type reviewFunc func(ctx context.Context, id, userID pgtype.UUID) (*service.ReviewedSuggestion, error)

func (h *PricingHandler) reviewSuggestion(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow, review reviewFunc) {
	id, err := store.StringToUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrSuggestionNotFound.Error())
		return
	}
	eventID, err := h.pricing.SuggestionEvent(r.Context(), id)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	if err := h.organizer.AuthorizeEvent(r.Context(), eventID, sess.UserID, sess.Role == store.UserRoleADMIN); err != nil {
		h.writeErr(w, r, err)
		return
	}
	result, err := review(r.Context(), id, sess.UserID)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func limitParam(r *http.Request, fallback int32) int32 {
	n, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || n <= 0 || n > 500 {
		return fallback
	}
	return int32(n)
}

func (h *PricingHandler) writeErr(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, service.ErrEventNotFound), errors.Is(err, service.ErrZoneNotFound),
		errors.Is(err, service.ErrSuggestionNotFound), errors.Is(err, service.ErrAlertNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrNotEventOrganizer):
		writeError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrInvalidPricingSettings):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrSuggestionNotPending), errors.Is(err, service.ErrSuggestionStale),
		errors.Is(err, service.ErrBoundsNotApproved):
		writeError(w, http.StatusConflict, err.Error())
	default:
		internalError(w, r, err)
	}
}
