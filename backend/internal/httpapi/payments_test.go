package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"eventticketing/internal/service"
	"eventticketing/internal/vnpay"
)

// A forged IPN is rejected before the database is touched, so no database is needed.
func TestIPNEndpoint_ForgedSignature(t *testing.T) {
	client := vnpay.Client{TmnCode: "TESTCODE", HashSecret: "test-secret-not-a-real-one"}
	h := NewPaymentHandler(service.NewPaymentService(nil, nil, client), nil)

	req := httptest.NewRequest(http.MethodGet,
		"/api/payments/vnpay/ipn?vnp_Amount=1000000&vnp_ResponseCode=00&vnp_TmnCode=TESTCODE&vnp_TxnRef=X&vnp_SecureHash=deadbeef", nil)
	rec := httptest.NewRecorder()
	h.HandleVNPayIPN(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: VNPay reads only the JSON body", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["RspCode"] != "97" || body["Message"] == "" {
		t.Fatalf("body %v, want RspCode 97", body)
	}
}

func TestReturnEndpoint_ForgedSignature(t *testing.T) {
	client := vnpay.Client{TmnCode: "TESTCODE", HashSecret: "test-secret-not-a-real-one"}
	h := NewPaymentHandler(service.NewPaymentService(nil, nil, client), nil)

	rec := httptest.NewRecorder()
	h.HandleVNPayReturn(rec, httptest.NewRequest(http.MethodGet, "/api/payments/vnpay/return?vnp_TxnRef=X&vnp_SecureHash=00", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
}
