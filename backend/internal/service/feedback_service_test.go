package service

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"
)

func TestSUSScore(t *testing.T) {
	tests := []struct {
		name    string
		answers [SUSItemCount]int
		want    float64
	}{
		{"best possible", [SUSItemCount]int{5, 1, 5, 1, 5, 1, 5, 1, 5, 1}, 100},
		{"worst possible", [SUSItemCount]int{1, 5, 1, 5, 1, 5, 1, 5, 1, 5}, 0},
		{"all neutral", [SUSItemCount]int{3, 3, 3, 3, 3, 3, 3, 3, 3, 3}, 50},
		// Odd items give 3+3+4+3+4 = 17, even items give 3+4+3+3+4 = 17, so 34 * 2.5.
		{"worked example", [SUSItemCount]int{4, 2, 4, 1, 5, 2, 4, 2, 5, 1}, 85},
		// Agreeing with every item: only the five odd items score, 4 each.
		{"all agree", [SUSItemCount]int{5, 5, 5, 5, 5, 5, 5, 5, 5, 5}, 50},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := SUSScore(tt.answers); got != tt.want {
				t.Errorf("SUSScore(%v) = %v, want %v", tt.answers, got, tt.want)
			}
		})
	}
}

func TestFeedbackInput_Validate(t *testing.T) {
	valid := func() FeedbackInput {
		return FeedbackInput{TesterRole: "AUDIENCE", SUS: []int{3, 3, 3, 3, 3, 3, 3, 3, 3, 3}}
	}
	secs := func(n int) *int { return &n }

	tests := []struct {
		name      string
		mutate    func(*FeedbackInput)
		wantField string
	}{
		{"valid", func(*FeedbackInput) {}, ""},
		{"unknown role", func(in *FeedbackInput) { in.TesterRole = "CEO" }, "testerRole"},
		{"unknown device", func(in *FeedbackInput) { in.Device = "WATCH" }, "device"},
		{"too few answers", func(in *FeedbackInput) { in.SUS = in.SUS[:9] }, "sus"},
		{"answer too high", func(in *FeedbackInput) { in.SUS[4] = 6 }, "sus[4]"},
		{"answer zero", func(in *FeedbackInput) { in.SUS[0] = 0 }, "sus[0]"},
		{"negative time", func(in *FeedbackInput) { in.TimesSec.Pay = secs(-1) }, "timesSec.pay"},
		{"time over an hour", func(in *FeedbackInput) { in.TimesSec.Hold = secs(3601) }, "timesSec.hold"},
		{"long comment", func(in *FeedbackInput) {
			c := make([]rune, maxFeedbackComment+1)
			for i := range c {
				c[i] = 'ạ'
			}
			in.Comment = string(c)
		}, "comment"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := valid()
			tt.mutate(&in)
			_, err := in.validate()
			if tt.wantField == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			var invalid *InvalidFeedbackError
			if !errors.As(err, &invalid) || invalid.Field != tt.wantField || !errors.Is(err, ErrInvalidFeedback) {
				t.Fatalf("error = %v, want invalid field %q", err, tt.wantField)
			}
		})
	}
}

func TestSummarize_Empty(t *testing.T) {
	sum := Summarize(nil)
	if sum.Count != 0 || sum.SUS != nil || len(sum.ItemMeans) != 0 || len(sum.Recent) != 0 {
		t.Fatalf("empty summary has data: %+v", sum)
	}
	if len(sum.Tasks) != len(TaskKeys) || sum.Tasks[0].Total != 0 {
		t.Fatalf("task rows = %+v", sum.Tasks)
	}
}

func record(role string, sus [SUSItemCount]int, tasks FeedbackTasks, comment string, at time.Time) FeedbackRecord {
	return FeedbackRecord{TesterRole: role, SUS: sus, Score: SUSScore(sus), Tasks: tasks, Comment: comment, CreatedAt: at}
}

func TestSummarize(t *testing.T) {
	secs := func(n int) *int { return &n }
	base := time.Date(2026, 11, 26, 9, 0, 0, 0, time.UTC)

	best := [SUSItemCount]int{5, 1, 5, 1, 5, 1, 5, 1, 5, 1}   // 100
	mid := [SUSItemCount]int{3, 3, 3, 3, 3, 3, 3, 3, 3, 3}    // 50
	worked := [SUSItemCount]int{4, 2, 4, 1, 5, 2, 4, 2, 5, 1} // 85

	records := []FeedbackRecord{
		record("AUDIENCE", best, FeedbackTasks{Login: true, Hold: true, Pay: true, Ticket: true}, "", base),
		record("AUDIENCE", mid, FeedbackTasks{Login: true, Hold: true}, "Khó tìm nút thanh toán", base.Add(time.Minute)),
		record("ORGANIZER", worked, FeedbackTasks{Login: true}, "Màn hình giá rõ ràng", base.Add(2*time.Minute)),
	}
	records[0].TimesSec = FeedbackTimes{Login: secs(30), Pay: secs(100)}
	records[1].TimesSec = FeedbackTimes{Login: secs(50)}

	sum := Summarize(records)

	if sum.Count != 3 || sum.ByRole["AUDIENCE"] != 2 || sum.ByRole["ORGANIZER"] != 1 {
		t.Fatalf("counts = %d %v", sum.Count, sum.ByRole)
	}
	// Scores are 100, 50 and 85.
	want := SUSStats{Mean: 235.0 / 3, Median: 85, Min: 50, Max: 100}
	if sum.SUS == nil || math.Abs(sum.SUS.Mean-want.Mean) > 1e-9 || sum.SUS.Median != want.Median ||
		sum.SUS.Min != want.Min || sum.SUS.Max != want.Max {
		t.Fatalf("SUS = %+v, want %+v", sum.SUS, want)
	}
	// Item 1 answers are 5, 3, 4.
	if len(sum.ItemMeans) != SUSItemCount || sum.ItemMeans[0] != 4 {
		t.Fatalf("item means = %v", sum.ItemMeans)
	}

	done := map[string]int{}
	for _, task := range sum.Tasks {
		done[task.Key] = task.Done
	}
	if done["login"] != 3 || done["hold"] != 2 || done["pay"] != 1 || done["ticket"] != 1 {
		t.Fatalf("task successes = %v", done)
	}
	login := sum.Tasks[0]
	if login.Rate != 1 || login.TimedCount != 2 || login.MeanSeconds == nil || *login.MeanSeconds != 40 {
		t.Fatalf("login stat = %+v", login)
	}
	if hold := sum.Tasks[1]; hold.TimedCount != 0 || hold.MeanSeconds != nil {
		t.Fatalf("hold reported times by nobody: %+v", hold)
	}

	// Only responses with a comment, newest first.
	if len(sum.Recent) != 2 || sum.Recent[0].Comment != "Màn hình giá rõ ràng" || sum.Recent[1].Score != 50 {
		t.Fatalf("recent = %+v", sum.Recent)
	}
}

func TestSummarize_EvenMedianAndRecentLimit(t *testing.T) {
	base := time.Date(2026, 11, 26, 9, 0, 0, 0, time.UTC)
	mid := [SUSItemCount]int{3, 3, 3, 3, 3, 3, 3, 3, 3, 3}
	best := [SUSItemCount]int{5, 1, 5, 1, 5, 1, 5, 1, 5, 1}

	sum := Summarize([]FeedbackRecord{
		record("AUDIENCE", mid, FeedbackTasks{}, "", base),
		record("AUDIENCE", best, FeedbackTasks{}, "", base),
	})
	if sum.SUS.Median != 75 {
		t.Fatalf("median of 50 and 100 = %v, want 75", sum.SUS.Median)
	}

	many := make([]FeedbackRecord, recentCommentLimit+5)
	for i := range many {
		many[i] = record("AUDIENCE", mid, FeedbackTasks{}, "ý kiến", base.Add(time.Duration(i)*time.Second))
	}
	if got := len(Summarize(many).Recent); got != recentCommentLimit {
		t.Fatalf("recent comments = %d, want %d", got, recentCommentLimit)
	}
}

// Needs TEST_DATABASE_URL. Other tests share the database, so this reads back
// only the rows it created.
func TestFeedbackService_SubmitAndList(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()
	svc := NewFeedbackService(q)

	login, pay := 42, 130
	first, err := svc.Submit(ctx, FeedbackInput{
		TesterRole: "AUDIENCE",
		TesterName: "  Lan  ",
		Device:     "PHONE",
		SUS:        []int{4, 2, 4, 1, 5, 2, 4, 2, 5, 1},
		Tasks:      FeedbackTasks{Login: true, Hold: true, Pay: true},
		TimesSec:   FeedbackTimes{Login: &login, Pay: &pay},
		Comment:    "Trang thanh toán chạy tốt",
	})
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	if first.Score != 85 {
		t.Fatalf("score = %v, want 85", first.Score)
	}
	second, err := svc.Submit(ctx, FeedbackInput{
		TesterRole: "ORGANIZER",
		SUS:        []int{3, 3, 3, 3, 3, 3, 3, 3, 3, 3},
	})
	if err != nil {
		t.Fatalf("submit anonymous: %v", err)
	}

	if _, err := svc.Submit(ctx, FeedbackInput{TesterRole: "AUDIENCE", SUS: []int{1, 2, 3}}); !errors.Is(err, ErrInvalidFeedback) {
		t.Fatalf("short SUS answers: err = %v, want ErrInvalidFeedback", err)
	}

	all, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	byID := map[string]FeedbackRecord{}
	for _, r := range all {
		byID[r.ID] = r
	}

	a, ok := byID[first.ID]
	if !ok {
		t.Fatal("first response missing from list")
	}
	if a.TesterName != "Lan" || a.Device != "PHONE" || a.Score != 85 || !a.Tasks.Pay || a.Tasks.Ticket {
		t.Fatalf("stored first = %+v", a)
	}
	if a.TimesSec.Login == nil || *a.TimesSec.Login != 42 || a.TimesSec.Hold != nil {
		t.Fatalf("stored times = %+v", a.TimesSec)
	}
	b, ok := byID[second.ID]
	if !ok {
		t.Fatal("second response missing from list")
	}
	if b.TesterName != "" || b.Device != "" || b.Comment != "" || b.Score != 50 {
		t.Fatalf("stored anonymous = %+v", b)
	}

	// The two rows alone: 85 and 50.
	sum := Summarize([]FeedbackRecord{a, b})
	if sum.SUS.Mean != 67.5 || sum.SUS.Median != 67.5 {
		t.Fatalf("summary of stored rows = %+v", sum.SUS)
	}

	// The database rejects what validation would have caught.
	if _, err := pool.Exec(ctx, `UPDATE feedback_responses SET sus_q1 = 6 WHERE id = $1`, first.ID); err == nil {
		t.Fatal("database accepted a SUS answer of 6")
	}
}
