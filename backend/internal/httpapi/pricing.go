package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

// PricingHandler serves the dynamic pricing endpoints of the organizer console (FR-22).
type PricingHandler struct {
	pricing   *service.PricingService
	organizer *service.OrganizerService
	events    *service.EventService
}

func NewPricingHandler(p *service.PricingService, o *service.OrganizerService, e *service.EventService) *PricingHandler {
	return &PricingHandler{pricing: p, organizer: o, events: e}
}

// authorizeEvent resolves {id} and checks that the caller organizes the event.
// It writes the error response itself and reports whether the caller may go on.
func (h *PricingHandler) authorizeEvent(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) (eventID pgtype.UUID, ok bool) {
	id, err := h.events.ResolveEventID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrEventNotFound.Error())
		return eventID, false
	}
	if err := h.organizer.AuthorizeEvent(r.Context(), id, sess.UserID, sess.Role == store.UserRoleADMIN); err != nil {
		h.writeErr(w, r, err)
		return eventID, false
	}
	return id, true
}

// HandleOverview handles GET /api/organizer/events/{id}/pricing.
func (h *PricingHandler) HandleOverview(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizeEvent(w, r, sess)
	if !ok {
		return
	}
	overview, err := h.pricing.Overview(r.Context(), eventID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, overview)
}

// HandleRun handles POST /api/organizer/events/{id}/pricing/run: one analysis pass now.
func (h *PricingHandler) HandleRun(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizeEvent(w, r, sess)
	if !ok {
		return
	}
	summary, err := h.pricing.RunEvent(r.Context(), eventID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	overview, err := h.pricing.Overview(r.Context(), eventID)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"run": summary, "overview": overview})
}

// HandleSetZoneEnabled handles PUT /api/organizer/events/{id}/zones/{zoneId}/dynamic-pricing.
func (h *PricingHandler) HandleSetZoneEnabled(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizeEvent(w, r, sess)
	if !ok {
		return
	}
	zoneID, err := store.StringToUUID(r.PathValue("zoneId"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrZoneNotFound.Error())
		return
	}
	var body struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Enabled == nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	if err := h.pricing.SetZoneEnabled(r.Context(), eventID, zoneID, *body.Enabled); err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"enabled": *body.Enabled})
}

// HandleApprove handles POST /api/organizer/suggestions/{id}/approve.
func (h *PricingHandler) HandleApprove(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	id, ok := h.authorizeSuggestion(w, r, sess)
	if !ok {
		return
	}
	res, err := h.pricing.Approve(r.Context(), id, sess.UserID)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// HandleReject handles POST /api/organizer/suggestions/{id}/reject.
func (h *PricingHandler) HandleReject(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	id, ok := h.authorizeSuggestion(w, r, sess)
	if !ok {
		return
	}
	if err := h.pricing.Reject(r.Context(), id, sess.UserID); err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "REJECTED"})
}

// authorizeSuggestion checks that the caller organizes the event the suggestion belongs to.
func (h *PricingHandler) authorizeSuggestion(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) (id pgtype.UUID, ok bool) {
	sid, err := store.StringToUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrSuggestionNotFound.Error())
		return id, false
	}
	eventID, err := h.pricing.SuggestionEventID(r.Context(), sid)
	if err != nil {
		h.writeErr(w, r, err)
		return id, false
	}
	if err := h.organizer.AuthorizeEvent(r.Context(), eventID, sess.UserID, sess.Role == store.UserRoleADMIN); err != nil {
		h.writeErr(w, r, err)
		return id, false
	}
	return sid, true
}

func (h *PricingHandler) writeErr(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, service.ErrEventNotFound), errors.Is(err, service.ErrZoneNotFound), errors.Is(err, service.ErrSuggestionNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrNotEventOrganizer):
		writeError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrSuggestionNotPending), errors.Is(err, service.ErrSuggestionStale):
		writeError(w, http.StatusConflict, err.Error())
	default:
		internalError(w, r, err)
	}
}
