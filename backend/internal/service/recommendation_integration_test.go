package service

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/recommend"
)

func TestRecommendations_FollowViewsAndHolds(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()
	recs := NewRecommendationService(q)
	user := createCustomer(t, q, 9500)

	var kpop pgtype.UUID
	mustScan(t, pool, `SELECT id FROM events WHERE genre = 'K-pop' AND status = 'ON_SALE' ORDER BY slug LIMIT 1`, []any{&kpop})

	// Views within 30 minutes of each other count once.
	for range 3 {
		if err := recs.RecordView(ctx, kpop, user); err != nil {
			t.Fatal(err)
		}
	}
	var views int64
	mustScan(t, pool, `SELECT count(*) FROM event_views WHERE user_id = $1`, []any{&views}, user)
	if views != 1 {
		t.Fatalf("repeated views stored %d times", views)
	}

	// Older views and a hold build a K-pop profile.
	mustExec(t, pool, `
		INSERT INTO event_views (event_id, user_id, viewed_at)
		SELECT id, $1, now() - interval '2 days' FROM events WHERE genre = 'K-pop'`, user)
	mustExec(t, pool, `
		INSERT INTO seat_holds (event_id, seat_id, user_id, hold_token, status, created_at, expires_at)
		SELECT es.event_id, es.seat_id, $1, 'rec-test-' || es.seat_id, 'RELEASED', now() - interval '1 day', now()
		FROM event_seats es WHERE es.event_id = $2 LIMIT 1`, user, kpop)

	got, err := recs.Recommend(ctx, user, 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) == 0 || got[0].Genre != "K-pop" || !got[0].Personalized || len(got[0].Reasons) == 0 {
		t.Fatalf("want a personal K-pop pick first, got %+v", got)
	}

	anonymous, err := recs.Recommend(ctx, pgtype.UUID{}, 3)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range anonymous {
		if r.Personalized || r.Tier != recommend.TierPopular {
			t.Fatalf("anonymous pick marked personal: %+v", r)
		}
	}
}
