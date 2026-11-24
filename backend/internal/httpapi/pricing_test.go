package httpapi

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/pricing"
	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

// An organizer can only see and configure pricing for their own events.
func TestPricingHandler_OnlyTheEventsOrganizer(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	if err := store.RunMigrations(url); err != nil {
		t.Fatal(err)
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	q := store.New(pool)
	ctx := context.Background()

	var eventID, ownerID pgtype.UUID
	if err := pool.QueryRow(ctx, `SELECT id, organizer_id FROM events WHERE status = 'ON_SALE' ORDER BY slug LIMIT 1`).Scan(&eventID, &ownerID); err != nil {
		t.Fatal(err)
	}
	token, err := service.GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	other, err := q.CreateUser(ctx, store.CreateUserParams{
		Email:  pgtype.Text{String: "other-organizer-" + token[:8] + "@test.local", Valid: true},
		Role:   store.UserRoleORGANIZER,
		Status: store.UserStatusACTIVE,
	})
	if err != nil {
		t.Fatal(err)
	}

	engine := service.NewDynamicPricingEngine(pool, q, pricing.Default(), service.NewRecommendationService(q), false, 0)
	h := NewPricingHandler(service.NewOrganizerService(pool, q), service.NewEventService(q), engine, service.NewRealtimeHub(pool))
	call := func(handler func(http.ResponseWriter, *http.Request, *store.GetSessionByTokenHashRow), method, body string, userID pgtype.UUID) int {
		req := httptest.NewRequest(method, "/", bytes.NewBufferString(body))
		req.SetPathValue("id", store.UUIDToString(eventID))
		rec := httptest.NewRecorder()
		handler(rec, req, &store.GetSessionByTokenHashRow{UserID: userID, Role: store.UserRoleORGANIZER})
		return rec.Code
	}
	settings := `{"enabled":true,"autoAdjust":false,"maxStepPct":10,"cooldownMinutes":60}`

	if code := call(h.HandleOverview, http.MethodGet, "", other.ID); code != http.StatusForbidden {
		t.Fatalf("other organizer read the dashboard: %d", code)
	}
	if code := call(h.HandleUpdateSettings, http.MethodPut, settings, other.ID); code != http.StatusForbidden {
		t.Fatalf("other organizer changed settings: %d", code)
	}
	if code := call(h.HandleUpdateSettings, http.MethodPut, `{"enabled":true,"autoAdjust":false,"maxStepPct":90,"cooldownMinutes":60}`, ownerID); code != http.StatusBadRequest {
		t.Fatalf("a 90%% step was accepted: %d", code)
	}
	if code := call(h.HandleOverview, http.MethodGet, "", ownerID); code != http.StatusOK {
		t.Fatalf("owner could not read the dashboard: %d", code)
	}
}
