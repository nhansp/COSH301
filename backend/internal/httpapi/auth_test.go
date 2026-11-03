package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"eventticketing/internal/config"
	"eventticketing/internal/service"
)

func TestAuthHandler_RequestOTP_Validation(t *testing.T) {
	cfg := config.Load()
	cfg.OTPDemo = true
	as := service.NewAuthService(nil, cfg)
	handler := NewAuthHandler(as, false)

	// Missing destination
	body, _ := json.Marshal(map[string]string{"destination": ""})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/otp/request", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.HandleRequestOTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for empty destination, got %d", rec.Code)
	}

	// Method not allowed
	getReq := httptest.NewRequest(http.MethodGet, "/api/auth/otp/request", nil)
	getRec := httptest.NewRecorder()
	handler.HandleRequestOTP(getRec, getReq)
	if getRec.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405 for GET, got %d", getRec.Code)
	}
}

func TestAuthHandler_Me_Unauthorized(t *testing.T) {
	as := service.NewAuthService(nil, config.Load())
	handler := NewAuthHandler(as, false)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()

	handler.HandleMe(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 for unauthenticated request, got %d", rec.Code)
	}
}

func TestAuthHandler_DemoLogin_MethodNotAllowed(t *testing.T) {
	as := service.NewAuthService(nil, config.Load())
	handler := NewAuthHandler(as, false)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/demo-login", nil)
	rec := httptest.NewRecorder()

	handler.HandleDemoLogin(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405 for GET demo login, got %d", rec.Code)
	}
}
