package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/config"
	"eventticketing/internal/service"
	"eventticketing/internal/store"
	"eventticketing/internal/testdb"
	"eventticketing/internal/vnpay"
)

// pricingAPI is the full router on a database holding one event on sale
// whose zone has 12 of 24 seats held, so the engine has a suggestion to make.
type pricingAPI struct {
	t       *testing.T
	pool    *pgxpool.Pool
	handler http.Handler
	fx      *testdb.Fixture
}

func newPricingAPI(t *testing.T) *pricingAPI {
	t.Helper()
	pool, q := testdb.Open(t)
	cfg := config.Load()
	cfg.DemoMode = false

	seats := service.NewSeatService(pool, q, false)
	handler := NewRouter(RouterDependencies{
		Config:       cfg,
		DBPool:       pool,
		Store:        q,
		AuthService:  service.NewAuthService(q, cfg),
		EventService: service.NewEventService(q),
		SeatService:  seats,
		RealtimeHub:  service.NewRealtimeHub(pool),
		Organizer:    service.NewOrganizerService(pool, q),
		Pricing: service.NewPricingService(pool, q, config.PricingConfig{
			Interval: 5 * time.Minute, WindowMinutes: 15, RejectCooldownMinutes: 60,
		}),
		Tickets:  service.NewTicketService(pool, q),
		Payments: service.NewPaymentService(pool, q, vnpay.Client{}),
	})

	fx := testdb.Event(t, pool, testdb.Options{})
	for _, seat := range fx.SeatIDs[:12] {
		if _, err := seats.HoldSeat(context.Background(), fx.EventID, seat, testdb.User(t, pool, "CUSTOMER")); err != nil {
			t.Fatalf("hold: %v", err)
		}
	}
	return &pricingAPI{t: t, pool: pool, handler: handler, fx: fx}
}

func (a *pricingAPI) login(userID pgtype.UUID) string {
	return testdb.Session(a.t, a.pool, userID)
}

func (a *pricingAPI) do(method, path, token string) (int, map[string]any) {
	a.t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(""))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func TestPricingAPI_OnlyTheEventOrganizerMayDecide(t *testing.T) {
	api := newPricingAPI(t)
	eventPath := "/api/organizer/events/" + store.UUIDToString(api.fx.EventID)

	owner := api.login(api.fx.OrganizerID)
	if code, _ := api.do("POST", eventPath+"/pricing/run", owner); code != http.StatusOK {
		t.Fatalf("owner run: status %d", code)
	}
	code, overview := api.do("GET", eventPath+"/pricing", owner)
	if code != http.StatusOK {
		t.Fatalf("owner overview: status %d", code)
	}
	zone := overview["zones"].([]any)[0].(map[string]any)
	pending, _ := zone["pending"].(map[string]any)
	if pending == nil {
		t.Fatalf("no pending suggestion in %v", zone)
	}
	approve := "/api/organizer/suggestions/" + pending["id"].(string) + "/approve"
	reject := "/api/organizer/suggestions/" + pending["id"].(string) + "/reject"

	customer := api.login(testdb.User(t, api.pool, "CUSTOMER"))
	otherOrganizer := api.login(testdb.User(t, api.pool, "ORGANIZER"))
	for name, token := range map[string]string{"customer": customer, "other organizer": otherOrganizer} {
		for _, req := range [][2]string{
			{"GET", eventPath + "/pricing"},
			{"POST", eventPath + "/pricing/run"},
			{"POST", approve},
			{"POST", reject},
		} {
			if code, _ := api.do(req[0], req[1], token); code != http.StatusForbidden {
				t.Errorf("%s %s %s: status %d, want 403", name, req[0], req[1], code)
			}
		}
	}
	if code, _ := api.do("POST", approve, ""); code != http.StatusUnauthorized {
		t.Errorf("anonymous approve: status %d, want 401", code)
	}

	// The refused calls changed nothing: the owner can still approve, once.
	code, res := api.do("POST", approve, owner)
	if code != http.StatusOK {
		t.Fatalf("owner approve: status %d, body %v", code, res)
	}
	if res["oldPrice"].(float64) != 1_000_000 || res["newPrice"].(float64) != pending["suggestedPrice"].(float64) {
		t.Fatalf("approval %v does not match suggestion %v", res, pending)
	}
	if code, res := api.do("POST", approve, owner); code != http.StatusConflict || res["error"] != "suggestion_not_pending" {
		t.Fatalf("second approve: status %d body %v, want 409 suggestion_not_pending", code, res)
	}
	if code, _ := api.do("POST", "/api/organizer/suggestions/not-a-uuid/approve", owner); code != http.StatusNotFound {
		t.Fatalf("unknown suggestion: status %d, want 404", code)
	}

	// Customers see the new price and that it changed just now.
	code, detail := api.do("GET", "/api/events/"+store.UUIDToString(api.fx.EventID), "")
	if code != http.StatusOK {
		t.Fatalf("event detail: status %d", code)
	}
	z := detail["zones"].([]any)[0].(map[string]any)
	if z["basePrice"].(float64) != pending["suggestedPrice"].(float64) {
		t.Fatalf("event detail shows base price %v, want the approved %v", z["basePrice"], pending["suggestedPrice"])
	}
	change, _ := z["recentChange"].(map[string]any)
	if change == nil || change["oldPrice"].(float64) != 1_000_000 || change["newPrice"].(float64) != pending["suggestedPrice"].(float64) {
		t.Fatalf("event detail has no recent change: %v", z)
	}
}

func TestPricingAPI_FeatureFlagOffHidesEndpoints(t *testing.T) {
	t.Setenv("FEATURE_DYNAMIC_PRICING", "off")
	api := newPricingAPI(t)
	owner := api.login(api.fx.OrganizerID)

	code, body := api.do("GET", "/api/organizer/events/"+store.UUIDToString(api.fx.EventID)+"/pricing", owner)
	if code != http.StatusNotFound || body["error"] != "feature_disabled" {
		t.Fatalf("flag off: status %d body %v, want 404 feature_disabled", code, body)
	}
}
