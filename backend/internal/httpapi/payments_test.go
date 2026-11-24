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

func TestPaymentRoutes_FeatureFlagAndSignatureGuards(t *testing.T) {
	// 1. With payments=off, payment and ticket QR routes return 404 feature_disabled.
	t.Setenv("FEATURE_PROFILE", "sprint2")
	t.Setenv("FEATURE_PAYMENTS", "off")

	cfgOff := config.Load()
	routerOff := NewRouter(RouterDependencies{
		Config:   cfgOff,
		Payments: service.NewPaymentService(nil, nil, "unit-secret", true),
		Tickets:  service.NewTicketService(nil, nil),
	})

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/orders"},
		{http.MethodGet, "/api/orders"},
		{http.MethodGet, "/api/me/tickets"},
		{http.MethodGet, "/api/tickets/11111111-1111-1111-1111-111111111111/qr"},
		{http.MethodPost, "/api/payments/momo/ipn"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(`{}`))
		rec := httptest.NewRecorder()
		routerOff.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s %s with payments=off: status = %d, want 404", tc.method, tc.path, rec.Code)
		}
	}

	// 2. With payments=on, ticket QR requires auth (401) and IPN rejects forged signatures (401).
	t.Setenv("FEATURE_PAYMENTS", "on")
	cfgOn := config.Load()
	routerOn := NewRouter(RouterDependencies{
		Config:   cfgOn,
		Payments: service.NewPaymentService(nil, nil, "unit-secret", true),
		Tickets:  service.NewTicketService(nil, nil),
	})

	reqQR := httptest.NewRequest(http.MethodGet, "/api/tickets/11111111-1111-1111-1111-111111111111/qr", nil)
	recQR := httptest.NewRecorder()
	routerOn.ServeHTTP(recQR, reqQR)
	if recQR.Code != http.StatusUnauthorized {
		t.Errorf("GET /api/tickets/{id}/qr without auth: status = %d, want 401", recQR.Code)
	}

	body, _ := json.Marshal(map[string]any{
		"paymentCode":   "PAY-MOMO-0001",
		"providerTxnId": "TXN-1",
		"amount":        1030000,
		"result":        "SUCCESS",
		"signature":     "forged-signature",
	})
	reqIPN := httptest.NewRequest(http.MethodPost, "/api/payments/momo/ipn", bytes.NewReader(body))
	reqIPN.Header.Set("Content-Type", "application/json")
	recIPN := httptest.NewRecorder()
	routerOn.ServeHTTP(recIPN, reqIPN)
	if recIPN.Code != http.StatusUnauthorized {
		t.Errorf("POST /api/payments/momo/ipn with forged sig: status = %d, want 401 (body=%s)", recIPN.Code, recIPN.Body.String())
	}
}
