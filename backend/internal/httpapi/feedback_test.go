package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eventticketing/internal/service"
)

func TestFeedbackHandler_RejectsBadJSON(t *testing.T) {
	h := NewFeedbackHandler(nil)
	rec := httptest.NewRecorder()
	h.HandleSubmit(rec, httptest.NewRequest(http.MethodPost, "/api/feedback", strings.NewReader("{not json")))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "invalid_payload") {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
}

func TestFeedbackHandler_RejectsInvalidAnswers(t *testing.T) {
	// Validation runs before the service touches the database.
	h := NewFeedbackHandler(service.NewFeedbackService(nil))
	body := `{"testerRole":"AUDIENCE","sus":[1,2,3]}`
	rec := httptest.NewRecorder()
	h.HandleSubmit(rec, httptest.NewRequest(http.MethodPost, "/api/feedback", strings.NewReader(body)))
	if rec.Code != http.StatusBadRequest ||
		!strings.Contains(rec.Body.String(), "invalid_feedback") || !strings.Contains(rec.Body.String(), `"field":"sus"`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
}

func TestFeedbackCSVRow(t *testing.T) {
	login := 45
	rec := service.FeedbackRecord{
		ID:         "id-1",
		CreatedAt:  time.Date(2026, 11, 26, 9, 30, 0, 0, time.UTC),
		TesterRole: "AUDIENCE",
		TesterName: "=HYPERLINK(\"http://evil\")",
		SUS:        [service.SUSItemCount]int{4, 2, 4, 1, 5, 2, 4, 2, 5, 1},
		Score:      85,
		Tasks:      service.FeedbackTasks{Login: true, Pay: true},
		TimesSec:   service.FeedbackTimes{Login: &login},
		Comment:    "Tốt, dễ dùng",
	}
	header, row := feedbackCSVHeader(), feedbackCSVRow(rec)
	if len(header) != len(row) {
		t.Fatalf("header has %d columns, row has %d", len(header), len(row))
	}
	got := map[string]string{}
	for i, name := range header {
		got[name] = row[i]
	}
	want := map[string]string{
		"id":             "id-1",
		"tester_name":    "'=HYPERLINK(\"http://evil\")",
		"sus_q1":         "4",
		"sus_q10":        "1",
		"sus_score":      "85.0",
		"task_login":     "1",
		"task_hold":      "0",
		"task_pay":       "1",
		"time_login_sec": "45",
		"time_pay_sec":   "",
		"comment":        "Tốt, dễ dùng",
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %q, want %q", k, got[k], v)
		}
	}
}
