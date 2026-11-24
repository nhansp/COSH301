package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

// An organizer can only read and edit their own events.
func TestOrganizerHandler_EventEditingIsOwnerOnly(t *testing.T) {
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
		Email:  pgtype.Text{String: "other-btc-" + token[:8] + "@test.local", Valid: true},
		Role:   store.UserRoleORGANIZER,
		Status: store.UserStatusACTIVE,
	})
	if err != nil {
		t.Fatal(err)
	}

	h := NewOrganizerHandler(service.NewOrganizerService(pool, q), service.NewEventService(q))
	call := func(handler func(http.ResponseWriter, *http.Request, *store.GetSessionByTokenHashRow), method string, body []byte, userID pgtype.UUID) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/", bytes.NewReader(body))
		req.SetPathValue("id", store.UUIDToString(eventID))
		rec := httptest.NewRecorder()
		handler(rec, req, &store.GetSessionByTokenHashRow{UserID: userID, Role: store.UserRoleORGANIZER})
		return rec
	}

	own := call(h.HandleGetEvent, http.MethodGet, nil, ownerID)
	if own.Code != http.StatusOK {
		t.Fatalf("owner read: %d", own.Code)
	}
	var detail service.OrganizerEventDetailDTO
	if err := json.Unmarshal(own.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(detail.EventInfo)

	if rec := call(h.HandleGetEvent, http.MethodGet, nil, other.ID); rec.Code != http.StatusForbidden {
		t.Fatalf("other organizer read: %d", rec.Code)
	}
	if rec := call(h.HandleUpdateEvent, http.MethodPut, body, other.ID); rec.Code != http.StatusForbidden {
		t.Fatalf("other organizer edit: %d", rec.Code)
	}

	bad := detail.EventInfo
	bad.EndsAt = bad.StartsAt
	badBody, _ := json.Marshal(bad)
	rec := call(h.HandleUpdateEvent, http.MethodPut, badBody, ownerID)
	if rec.Code != http.StatusBadRequest || !bytes.Contains(rec.Body.Bytes(), []byte(`"field":"endsAt"`)) {
		t.Fatalf("invalid edit: %d %s", rec.Code, rec.Body.String())
	}
}
