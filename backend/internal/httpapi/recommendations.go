package httpapi

import (
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type RecommendationHandler struct {
	recs   *service.RecommendationService
	events *service.EventService
	auth   *service.AuthService
}

func NewRecommendationHandler(rs *service.RecommendationService, es *service.EventService, as *service.AuthService) *RecommendationHandler {
	return &RecommendationHandler{recs: rs, events: es, auth: as}
}

// HandleEvents handles GET /api/recommendations/events. Signed-in users get
// personal picks; everyone else gets the most popular events.
func (h *RecommendationHandler) HandleEvents(w http.ResponseWriter, r *http.Request) {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 || limit > 24 {
		limit = 6
	}
	var userID pgtype.UUID
	if token := extractToken(r); token != "" {
		if sess, err := h.auth.GetUserByToken(r.Context(), token); err == nil {
			userID = sess.UserID
		}
	}
	recs, err := h.recs.Recommend(r.Context(), userID, limit)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, recs)
}

// HandleView handles POST /api/events/{id}/views: the signed-in user opened the event.
func (h *RecommendationHandler) HandleView(w http.ResponseWriter, r *http.Request, sess *store.GetSessionByTokenHashRow) {
	eventID, err := h.events.ResolveEventID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, service.ErrEventNotFound.Error())
		return
	}
	if err := h.recs.RecordView(r.Context(), eventID, sess.UserID); err != nil {
		internalError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
