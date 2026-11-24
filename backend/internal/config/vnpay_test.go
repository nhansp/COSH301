package config

import (
	"strings"
	"testing"
)

func setVNPayEnv(t *testing.T, env map[string]string) {
	t.Helper()
	for _, k := range []string{"PUBLIC_URL", "VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_PAY_URL", "VNPAY_RETURN_URL"} {
		t.Setenv(k, env[k])
	}
}

func TestLoad_VNPayDefaults(t *testing.T) {
	setVNPayEnv(t, map[string]string{
		"PUBLIC_URL":        "https://shop.example.test/",
		"VNPAY_TMN_CODE":    "TESTCODE",
		"VNPAY_HASH_SECRET": "s3cret",
	})
	cfg := Load()
	if cfg.VNPay.PayURL != DefaultVNPayPayURL {
		t.Errorf("PayURL = %q", cfg.VNPay.PayURL)
	}
	if want := "https://shop.example.test/payment/vnpay/return"; cfg.VNPay.ReturnURL != want {
		t.Errorf("ReturnURL = %q, want %q", cfg.VNPay.ReturnURL, want)
	}
	if err := cfg.VNPay.Validate(); err != nil {
		t.Errorf("valid config rejected: %v", err)
	}
}

func TestLoad_VNPayExplicitReturnURLWins(t *testing.T) {
	setVNPayEnv(t, map[string]string{
		"PUBLIC_URL":       "https://shop.example.test",
		"VNPAY_RETURN_URL": "https://other.example.test/back",
	})
	if got := Load().VNPay.ReturnURL; got != "https://other.example.test/back" {
		t.Errorf("ReturnURL = %q", got)
	}
}

func TestVNPayValidate_RefusesIncompleteConfig(t *testing.T) {
	ok := VNPayConfig{TmnCode: "T", HashSecret: "s3cret", PayURL: DefaultVNPayPayURL, ReturnURL: "https://x.test/r"}
	cases := map[string]func(*VNPayConfig){
		"VNPAY_TMN_CODE":    func(c *VNPayConfig) { c.TmnCode = "" },
		"VNPAY_HASH_SECRET": func(c *VNPayConfig) { c.HashSecret = "" },
		"VNPAY_RETURN_URL":  func(c *VNPayConfig) { c.ReturnURL = "" },
		"VNPAY_PAY_URL":     func(c *VNPayConfig) { c.PayURL = "not a url" },
	}
	for want, mutate := range cases {
		c := ok
		mutate(&c)
		err := c.Validate()
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("%s: got %v", want, err)
		}
	}
}

func TestVNPayValidate_NeverPrintsSecret(t *testing.T) {
	c := VNPayConfig{TmnCode: "", HashSecret: "s3cret-value", PayURL: "x", ReturnURL: "y"}
	if err := c.Validate(); err != nil && strings.Contains(err.Error(), "s3cret-value") {
		t.Fatal("secret leaked into error")
	}
}
