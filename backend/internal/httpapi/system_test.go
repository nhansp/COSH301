package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"eventticketing/internal/config"
)

func TestSystemHandler_HandleHealth(t *testing.T) {
	fm := config.NewFeatureManagerFromEnv()
	handler := NewSystemHandler(fm)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	handler.HandleHealth(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var res map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["status"] != "ok" {
		t.Errorf("expected status 'ok', got %v", res["status"])
	}
}

func TestSystemHandler_HandleFeatures(t *testing.T) {
	os.Setenv("FEATURE_PROFILE", "sprint2")
	defer os.Unsetenv("FEATURE_PROFILE")

	fm := config.NewFeatureManagerFromEnv()
	handler := NewSystemHandler(fm)

	req := httptest.NewRequest(http.MethodGet, "/api/features", nil)
	rec := httptest.NewRecorder()

	handler.HandleFeatures(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var res struct {
		Profile  string          `json:"profile"`
		Features map[string]bool `json:"features"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.Profile != "sprint2" {
		t.Errorf("expected profile 'sprint2', got %s", res.Profile)
	}
	if !res.Features[config.FlagSeatHold] {
		t.Errorf("expected seat_hold to be true in sprint2")
	}
	if res.Features[config.FlagPayments] {
		t.Errorf("expected payments to be false in sprint2")
	}
}

func TestRequireFeature_Middleware(t *testing.T) {
	os.Setenv("FEATURE_PROFILE", "sprint2")
	defer os.Unsetenv("FEATURE_PROFILE")

	fm := config.NewFeatureManagerFromEnv()

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("allowed"))
	})

	// Test enabled flag
	enabledHandler := RequireFeature(fm, config.FlagSeatHold, dummyHandler)
	req := httptest.NewRequest(http.MethodGet, "/api/holds", nil)
	rec := httptest.NewRecorder()
	enabledHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200 for enabled feature, got %d", rec.Code)
	}

	// Test disabled flag
	disabledHandler := RequireFeature(fm, config.FlagPayments, dummyHandler)
	reqDis := httptest.NewRequest(http.MethodPost, "/api/orders/1/payments", nil)
	recDis := httptest.NewRecorder()
	disabledHandler(recDis, reqDis)

	if recDis.Code != http.StatusNotFound {
		t.Errorf("expected status 404 for disabled feature, got %d", recDis.Code)
	}

	var errBody map[string]string
	_ = json.Unmarshal(recDis.Body.Bytes(), &errBody)
	if errBody["error"] != "feature_disabled" {
		t.Errorf("expected error 'feature_disabled', got %s", errBody["error"])
	}
	if errBody["feature"] != config.FlagPayments {
		t.Errorf("expected feature '%s', got %s", config.FlagPayments, errBody["feature"])
	}
}
