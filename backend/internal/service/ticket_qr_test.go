package service

import "testing"

func TestFixedQR_GenerateAndVerify(t *testing.T) {
	secret, err := GenerateQRSecret()
	if err != nil {
		t.Fatalf("GenerateQRSecret: %v", err)
	}
	if len(secret) != 64 {
		t.Fatalf("secret len = %d, want 64 hex chars", len(secret))
	}

	payload1 := GenerateFixedQRPayload("TKT-ABC12345", secret)
	payload2 := GenerateFixedQRPayload("TKT-ABC12345", secret)
	if payload1 != payload2 {
		t.Fatalf("fixed QR payload must be deterministic: %q != %q", payload1, payload2)
	}

	code, ok, reason := VerifyFixedQRPayload(payload1, secret)
	if !ok || reason != "valid" || code != "TKT-ABC12345" {
		t.Fatalf("verify fixed QR failed: ok=%v reason=%q code=%q", ok, reason, code)
	}

	tampered := payload1[:len(payload1)-1] + "0"
	if tampered == payload1 {
		tampered = payload1[:len(payload1)-1] + "1"
	}
	if _, ok, reason := VerifyFixedQRPayload(tampered, secret); ok || reason != "invalid_signature" {
		t.Errorf("tampered verify: ok=%v reason=%q, want false / invalid_signature", ok, reason)
	}

	if _, ok, reason := VerifyFixedQRPayload(payload1, "deadbeef"); ok || reason != "invalid_signature" {
		t.Errorf("wrong secret verify: ok=%v reason=%q, want false / invalid_signature", ok, reason)
	}
}

func TestPaymentService_IPNSignatureAndServiceFee(t *testing.T) {
	ps := NewPaymentService(nil, nil, "test-secret", true)
	sig := ps.SignIPN("momo", "PAY-MOMO-1234", "MOMO-TXN-999", 1_030_000, "SUCCESS")

	if !ps.VerifyIPNSignature("MOMO", "PAY-MOMO-1234", "MOMO-TXN-999", 1_030_000, "success", sig) {
		t.Fatal("expected valid canonical signature")
	}
	if ps.VerifyIPNSignature("MOMO", "PAY-MOMO-1234", "MOMO-TXN-999", 1_000_000, "SUCCESS", sig) {
		t.Fatal("expected altered amount to fail signature verification")
	}
	if ps.VerifyIPNSignature("VNPAY", "PAY-MOMO-1234", "MOMO-TXN-999", 1_030_000, "SUCCESS", sig) {
		t.Fatal("expected altered provider to fail signature verification")
	}

	if got := ServiceFeeOf(1_000_000); got != 30_000 {
		t.Errorf("ServiceFeeOf(1_000_000) = %d, want 30000", got)
	}
	if got := ServiceFeeOf(0); got != 0 {
		t.Errorf("ServiceFeeOf(0) = %d, want 0", got)
	}
}
