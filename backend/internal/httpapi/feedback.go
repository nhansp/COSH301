package httpapi

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type FeedbackHandler struct {
	feedback *service.FeedbackService
}

func NewFeedbackHandler(fs *service.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{feedback: fs}
}

// HandleSubmit handles POST /api/feedback. Anyone may submit, signed in or not.
func (h *FeedbackHandler) HandleSubmit(w http.ResponseWriter, r *http.Request) {
	var in service.FeedbackInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_payload")
		return
	}
	rec, err := h.feedback.Submit(r.Context(), in)
	var invalid *service.InvalidFeedbackError
	switch {
	case errors.As(err, &invalid):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": service.ErrInvalidFeedback.Error(), "field": invalid.Field})
		return
	case err != nil:
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": rec.ID, "susScore": rec.Score})
}

// HandleSummary handles GET /api/feedback/summary for organizers and admins.
func (h *FeedbackHandler) HandleSummary(w http.ResponseWriter, r *http.Request, _ *store.GetSessionByTokenHashRow) {
	summary, err := h.feedback.Summary(r.Context())
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

// HandleExport handles GET /api/feedback/export.csv for organizers and admins.
func (h *FeedbackHandler) HandleExport(w http.ResponseWriter, r *http.Request, _ *store.GetSessionByTokenHashRow) {
	records, err := h.feedback.List(r.Context())
	if err != nil {
		internalError(w, r, err)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="khao-sat-sus.csv"`)
	w.Header().Set("Cache-Control", "no-store")
	// The byte order mark makes Excel read the Vietnamese text as UTF-8.
	_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
	cw := csv.NewWriter(w)
	_ = cw.Write(feedbackCSVHeader())
	for _, rec := range records {
		_ = cw.Write(feedbackCSVRow(rec))
	}
	cw.Flush()
}

func feedbackCSVHeader() []string {
	h := []string{"id", "created_at", "tester_role", "tester_name", "device"}
	for i := 1; i <= service.SUSItemCount; i++ {
		h = append(h, "sus_q"+strconv.Itoa(i))
	}
	h = append(h, "sus_score")
	for _, k := range service.TaskKeys {
		h = append(h, "task_"+k)
	}
	for _, k := range service.TaskKeys {
		h = append(h, "time_"+k+"_sec")
	}
	return append(h, "comment")
}

func feedbackCSVRow(rec service.FeedbackRecord) []string {
	row := []string{rec.ID, rec.CreatedAt.Format(time.RFC3339), rec.TesterRole, csvText(rec.TesterName), rec.Device}
	for _, a := range rec.SUS {
		row = append(row, strconv.Itoa(a))
	}
	row = append(row, strconv.FormatFloat(rec.Score, 'f', 1, 64))
	done := []bool{rec.Tasks.Login, rec.Tasks.Hold, rec.Tasks.Pay, rec.Tasks.Ticket}
	for _, d := range done {
		if d {
			row = append(row, "1")
		} else {
			row = append(row, "0")
		}
	}
	for _, t := range []*int{rec.TimesSec.Login, rec.TimesSec.Hold, rec.TimesSec.Pay, rec.TimesSec.Ticket} {
		if t == nil {
			row = append(row, "")
		} else {
			row = append(row, strconv.Itoa(*t))
		}
	}
	return append(row, csvText(rec.Comment))
}

// csvText stops spreadsheet programs from running a cell that starts like a formula.
func csvText(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}
