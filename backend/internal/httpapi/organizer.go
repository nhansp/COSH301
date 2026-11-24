package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

var organizerRoles = []store.UserRole{store.UserRoleORGANIZER, store.UserRoleADMIN}

type OrganizerHandler struct {
	organizer *service.OrganizerService
	events    *service.EventService
}

func NewOrganizerHandler(os *service.OrganizerService, es *service.EventService) *OrganizerHandler {
	return &OrganizerHandler{organizer: os, events: es}
}

// HandleListEvents handles GET /api/organizer/events.
func (h *OrganizerHandler) HandleListEvents(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	events, err := h.organizer.ListEvents(r.Context(), sess.UserID, sess.Role == store.UserRoleADMIN)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, events)
}

// HandleUpdateZonePricing handles PUT /api/organizer/events/{id}/zones/{zoneId}/pricing.
func (h *OrganizerHandler) HandleUpdateZonePricing(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, err := h.events.ResolveEventID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrEventNotFound.Error())
		return
	}
	zoneID, err := store.StringToUUID(r.PathValue("zoneId"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrZoneNotFound.Error())
		return
	}

	var p service.ZonePricing
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}

	isAdmin := sess.Role == store.UserRoleADMIN
	if err := h.organizer.AuthorizeEvent(r.Context(), eventID, sess.UserID, isAdmin); err != nil {
		h.writeErr(w, r, err)
		return
	}
	updated, err := h.organizer.UpdateZonePricing(r.Context(), eventID, zoneID, sess.UserID, p)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// HandleGetEvent handles GET /api/organizer/events/{id}.
func (h *OrganizerHandler) HandleGetEvent(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	event, err := h.organizer.GetEvent(r.Context(), eventID)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, event)
}

// HandleUpdateEvent handles PUT /api/organizer/events/{id}.
func (h *OrganizerHandler) HandleUpdateEvent(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, ok := h.authorizedEvent(w, r, sess)
	if !ok {
		return
	}
	var in service.EventInfo
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	event, err := h.organizer.UpdateEvent(r.Context(), eventID, sess.UserID, in)
	if err != nil {
		h.writeErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, event)
}

func (h *OrganizerHandler) authorizedEvent(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) (pgtype.UUID, bool) {
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

func (h *OrganizerHandler) writeErr(w http.ResponseWriter, r *http.Request, err error) {
	var field *service.FieldError
	switch {
	case errors.As(err, &field):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_event_field", "field": field.Field})
	case errors.Is(err, service.ErrVenueShared):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, service.ErrEventNotFound), errors.Is(err, service.ErrZoneNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrNotEventOrganizer):
		writeError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrInvalidPriceBounds):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		internalError(w, r, err)
	}
}
