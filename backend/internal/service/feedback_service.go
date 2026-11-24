package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5/pgtype"
)

const (
	SUSItemCount       = 10
	maxFeedbackName    = 100
	maxFeedbackComment = 2000
	maxTaskSeconds     = 3600
	recentCommentLimit = 20
)

// Testers are either audience members or organizers, the two roles in the test plan.
var (
	feedbackRoles   = []string{"AUDIENCE", "ORGANIZER"}
	feedbackDevices = []string{"PHONE", "TABLET", "LAPTOP"}
)

// InvalidFeedbackError names the field that failed validation.
type InvalidFeedbackError struct{ Field string }

func (e *InvalidFeedbackError) Error() string { return "invalid_feedback: " + e.Field }

// ErrInvalidFeedback matches any InvalidFeedbackError with errors.Is.
var ErrInvalidFeedback = errors.New("invalid_feedback")

func (e *InvalidFeedbackError) Is(target error) bool { return target == ErrInvalidFeedback }

// FeedbackTasks records which test tasks the tester completed.
type FeedbackTasks struct {
	Login  bool `json:"login"`
	Hold   bool `json:"hold"`
	Pay    bool `json:"pay"`
	Ticket bool `json:"ticket"`
}

// FeedbackTimes holds the optional time per task, in seconds.
type FeedbackTimes struct {
	Login  *int `json:"login"`
	Hold   *int `json:"hold"`
	Pay    *int `json:"pay"`
	Ticket *int `json:"ticket"`
}

// FeedbackInput is one submission from the /khao-sat page.
type FeedbackInput struct {
	TesterRole string        `json:"testerRole"`
	TesterName string        `json:"testerName"`
	Device     string        `json:"device"`
	SUS        []int         `json:"sus"`
	Tasks      FeedbackTasks `json:"tasks"`
	TimesSec   FeedbackTimes `json:"timesSec"`
	Comment    string        `json:"comment"`
}

// SUSScore is the standard System Usability Scale score, 0 to 100. Odd items
// (indexes 0, 2, ...) are positively worded and contribute score-1; even items
// are negatively worded and contribute 5-score. The sum is scaled by 2.5.
func SUSScore(answers [SUSItemCount]int) float64 {
	sum := 0
	for i, a := range answers {
		if i%2 == 0 {
			sum += a - 1
		} else {
			sum += 5 - a
		}
	}
	return float64(sum) * 2.5
}

// validate checks the input and returns the SUS answers as a fixed array.
func (in *FeedbackInput) validate() ([SUSItemCount]int, error) {
	var sus [SUSItemCount]int
	if !slices.Contains(feedbackRoles, in.TesterRole) {
		return sus, &InvalidFeedbackError{"testerRole"}
	}
	if in.Device != "" && !slices.Contains(feedbackDevices, in.Device) {
		return sus, &InvalidFeedbackError{"device"}
	}
	if utf8.RuneCountInString(in.TesterName) > maxFeedbackName {
		return sus, &InvalidFeedbackError{"testerName"}
	}
	if utf8.RuneCountInString(in.Comment) > maxFeedbackComment {
		return sus, &InvalidFeedbackError{"comment"}
	}
	if len(in.SUS) != SUSItemCount {
		return sus, &InvalidFeedbackError{"sus"}
	}
	for i, a := range in.SUS {
		if a < 1 || a > 5 {
			return sus, &InvalidFeedbackError{fmt.Sprintf("sus[%d]", i)}
		}
		sus[i] = a
	}
	times := []struct {
		field string
		secs  *int
	}{
		{"timesSec.login", in.TimesSec.Login}, {"timesSec.hold", in.TimesSec.Hold},
		{"timesSec.pay", in.TimesSec.Pay}, {"timesSec.ticket", in.TimesSec.Ticket},
	}
	for _, t := range times {
		if t.secs != nil && (*t.secs < 0 || *t.secs > maxTaskSeconds) {
			return sus, &InvalidFeedbackError{t.field}
		}
	}
	return sus, nil
}

// FeedbackRecord is a stored response together with its SUS score.
type FeedbackRecord struct {
	ID         string
	CreatedAt  time.Time
	TesterRole string
	TesterName string
	Device     string
	SUS        [SUSItemCount]int
	Score      float64
	Tasks      FeedbackTasks
	TimesSec   FeedbackTimes
	Comment    string
}

// FeedbackService stores usability-test responses and summarises them.
type FeedbackService struct {
	queries *store.Queries
}

func NewFeedbackService(queries *store.Queries) *FeedbackService {
	return &FeedbackService{queries: queries}
}

func optText(s string) pgtype.Text {
	s = strings.TrimSpace(s)
	return pgtype.Text{String: s, Valid: s != ""}
}

func optInt(v *int) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*v), Valid: true}
}

// Submit validates and stores one response and returns it with its SUS score.
func (s *FeedbackService) Submit(ctx context.Context, in FeedbackInput) (*FeedbackRecord, error) {
	sus, err := in.validate()
	if err != nil {
		return nil, err
	}
	row, err := s.queries.CreateFeedback(ctx, store.CreateFeedbackParams{
		TesterRole: in.TesterRole,
		TesterName: optText(in.TesterName),
		Device:     optText(in.Device),
		SusQ1:      int16(sus[0]), SusQ2: int16(sus[1]), SusQ3: int16(sus[2]), SusQ4: int16(sus[3]), SusQ5: int16(sus[4]),
		SusQ6: int16(sus[5]), SusQ7: int16(sus[6]), SusQ8: int16(sus[7]), SusQ9: int16(sus[8]), SusQ10: int16(sus[9]),
		TaskLogin:  in.Tasks.Login,
		TaskHold:   in.Tasks.Hold,
		TaskPay:    in.Tasks.Pay,
		TaskTicket: in.Tasks.Ticket,
		TimeLogin:  optInt(in.TimesSec.Login),
		TimeHold:   optInt(in.TimesSec.Hold),
		TimePay:    optInt(in.TimesSec.Pay),
		TimeTicket: optInt(in.TimesSec.Ticket),
		Comment:    optText(in.Comment),
	})
	if err != nil {
		return nil, fmt.Errorf("store feedback: %w", err)
	}
	rec := recordFromRow(row)
	return &rec, nil
}

func fromInt4(v pgtype.Int4) *int {
	if !v.Valid {
		return nil
	}
	n := int(v.Int32)
	return &n
}

func recordFromRow(r store.FeedbackResponse) FeedbackRecord {
	sus := [SUSItemCount]int{
		int(r.SusQ1), int(r.SusQ2), int(r.SusQ3), int(r.SusQ4), int(r.SusQ5),
		int(r.SusQ6), int(r.SusQ7), int(r.SusQ8), int(r.SusQ9), int(r.SusQ10),
	}
	return FeedbackRecord{
		ID:         store.UUIDToString(r.ID),
		CreatedAt:  r.CreatedAt.Time,
		TesterRole: r.TesterRole,
		TesterName: r.TesterName.String,
		Device:     r.Device.String,
		SUS:        sus,
		Score:      SUSScore(sus),
		Tasks:      FeedbackTasks{Login: r.TaskLogin, Hold: r.TaskHold, Pay: r.TaskPay, Ticket: r.TaskTicket},
		TimesSec: FeedbackTimes{
			Login: fromInt4(r.TimeLogin), Hold: fromInt4(r.TimeHold),
			Pay: fromInt4(r.TimePay), Ticket: fromInt4(r.TimeTicket),
		},
		Comment: r.Comment.String,
	}
}

// List returns every stored response, oldest first.
func (s *FeedbackService) List(ctx context.Context) ([]FeedbackRecord, error) {
	rows, err := s.queries.ListFeedback(ctx)
	if err != nil {
		return nil, fmt.Errorf("list feedback: %w", err)
	}
	out := make([]FeedbackRecord, 0, len(rows))
	for _, r := range rows {
		out = append(out, recordFromRow(r))
	}
	return out, nil
}

// Summary reads all responses and aggregates them.
func (s *FeedbackService) Summary(ctx context.Context) (*FeedbackSummary, error) {
	records, err := s.List(ctx)
	if err != nil {
		return nil, err
	}
	sum := Summarize(records)
	return &sum, nil
}

type SUSStats struct {
	Mean   float64 `json:"mean"`
	Median float64 `json:"median"`
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
}

// TaskStat is the success rate of one test task, plus its mean time when testers reported it.
type TaskStat struct {
	Key         string   `json:"key"`
	Done        int      `json:"done"`
	Total       int      `json:"total"`
	Rate        float64  `json:"rate"`
	TimedCount  int      `json:"timedCount"`
	MeanSeconds *float64 `json:"meanSeconds"`
}

type FeedbackComment struct {
	ID         string  `json:"id"`
	CreatedAt  string  `json:"createdAt"`
	TesterRole string  `json:"testerRole"`
	TesterName string  `json:"testerName"`
	Score      float64 `json:"score"`
	Comment    string  `json:"comment"`
}

type FeedbackSummary struct {
	Count     int               `json:"count"`
	ByRole    map[string]int    `json:"byRole"`
	SUS       *SUSStats         `json:"sus"`
	ItemMeans []float64         `json:"itemMeans"`
	Tasks     []TaskStat        `json:"tasks"`
	Recent    []FeedbackComment `json:"recent"`
}

// TaskKeys lists the test tasks in the order of the test plan.
var TaskKeys = []string{"login", "hold", "pay", "ticket"}

func (r FeedbackRecord) taskResult(key string) (bool, *int) {
	switch key {
	case "login":
		return r.Tasks.Login, r.TimesSec.Login
	case "hold":
		return r.Tasks.Hold, r.TimesSec.Hold
	case "pay":
		return r.Tasks.Pay, r.TimesSec.Pay
	default:
		return r.Tasks.Ticket, r.TimesSec.Ticket
	}
}

// Summarize aggregates records, given oldest first, into the figures shown on
// the organizer page. With no records the SUS statistics and item means are empty.
func Summarize(records []FeedbackRecord) FeedbackSummary {
	sum := FeedbackSummary{
		Count:     len(records),
		ByRole:    map[string]int{},
		ItemMeans: []float64{},
		Tasks:     make([]TaskStat, 0, len(TaskKeys)),
		Recent:    []FeedbackComment{},
	}
	for _, key := range TaskKeys {
		sum.Tasks = append(sum.Tasks, TaskStat{Key: key, Total: len(records)})
	}
	if len(records) == 0 {
		return sum
	}

	scores := make([]float64, 0, len(records))
	itemTotals := make([]int, SUSItemCount)
	timeTotals := make([]int, len(TaskKeys))
	for _, r := range records {
		sum.ByRole[r.TesterRole]++
		scores = append(scores, r.Score)
		for i, a := range r.SUS {
			itemTotals[i] += a
		}
		for i, key := range TaskKeys {
			done, secs := r.taskResult(key)
			if done {
				sum.Tasks[i].Done++
			}
			if secs != nil {
				sum.Tasks[i].TimedCount++
				timeTotals[i] += *secs
			}
		}
	}

	for _, t := range itemTotals {
		sum.ItemMeans = append(sum.ItemMeans, float64(t)/float64(len(records)))
	}
	for i := range sum.Tasks {
		t := &sum.Tasks[i]
		t.Rate = float64(t.Done) / float64(t.Total)
		if t.TimedCount > 0 {
			mean := float64(timeTotals[i]) / float64(t.TimedCount)
			t.MeanSeconds = &mean
		}
	}
	sum.SUS = susStats(scores)

	for i := len(records) - 1; i >= 0 && len(sum.Recent) < recentCommentLimit; i-- {
		r := records[i]
		if r.Comment == "" {
			continue
		}
		sum.Recent = append(sum.Recent, FeedbackComment{
			ID:         r.ID,
			CreatedAt:  r.CreatedAt.Format(time.RFC3339),
			TesterRole: r.TesterRole,
			TesterName: r.TesterName,
			Score:      r.Score,
			Comment:    r.Comment,
		})
	}
	return sum
}

func susStats(scores []float64) *SUSStats {
	sorted := slices.Clone(scores)
	slices.Sort(sorted)
	total := 0.0
	for _, s := range sorted {
		total += s
	}
	n := len(sorted)
	median := sorted[n/2]
	if n%2 == 0 {
		median = (sorted[n/2-1] + sorted[n/2]) / 2
	}
	return &SUSStats{Mean: total / float64(n), Median: median, Min: sorted[0], Max: sorted[n-1]}
}
