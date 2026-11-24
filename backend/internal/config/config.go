package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port        int
	DatabaseURL string
	AppEnv      string
	// CORSAllowedOrigins lists origins allowed to call the API cross-origin.
	// Empty means same-origin only (the frontend proxies /api through nginx).
	CORSAllowedOrigins []string
	// OTPDemo shows customer login codes on screen instead of sending them.
	// Staff codes are only ever written to the server log.
	OTPDemo bool
	// OTPAppDelivery hands phone login codes to the COSH301 OTP Android app
	// instead of the log or the screen. Email codes are unaffected.
	OTPAppDelivery bool
	CookieSecure   bool
	// DemoMode exposes one-click demo login and demo data reset.
	// It is off when APP_ENV=production.
	DemoMode bool
	// PublicURL is the address customers reach the site at, without a trailing slash.
	PublicURL string
	VNPay     VNPayConfig
	Features  *FeatureManager
}

// VNPayConfig holds the merchant credentials and URLs for the VNPay payment gateway.
type VNPayConfig struct {
	TmnCode    string
	HashSecret string
	PayURL     string
	ReturnURL  string
}

const (
	DefaultVNPayPayURL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
	VNPayReturnPath    = "/payment/vnpay/return"
)

// Validate reports why payments cannot start. The secret is never part of the message.
func (c VNPayConfig) Validate() error {
	if c.TmnCode == "" {
		return fmt.Errorf("VNPAY_TMN_CODE is empty")
	}
	if c.HashSecret == "" {
		return fmt.Errorf("VNPAY_HASH_SECRET is empty")
	}
	for name, raw := range map[string]string{"VNPAY_PAY_URL": c.PayURL, "VNPAY_RETURN_URL": c.ReturnURL} {
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
			return fmt.Errorf("%s must be an absolute http(s) URL (set PUBLIC_URL or %s)", name, name)
		}
	}
	return nil
}

func Load() *Config {
	port, err := strconv.Atoi(os.Getenv("PORT"))
	if err != nil || port <= 0 {
		port = 8080
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/event_ticketing?sslmode=disable"
	}

	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}

	var origins []string
	for _, o := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}

	publicURL := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_URL")), "/")
	vnpay := VNPayConfig{
		TmnCode:    strings.TrimSpace(os.Getenv("VNPAY_TMN_CODE")),
		HashSecret: strings.TrimSpace(os.Getenv("VNPAY_HASH_SECRET")),
		PayURL:     envOr("VNPAY_PAY_URL", DefaultVNPayPayURL),
		ReturnURL:  strings.TrimSpace(os.Getenv("VNPAY_RETURN_URL")),
	}
	if vnpay.ReturnURL == "" && publicURL != "" {
		vnpay.ReturnURL = publicURL + VNPayReturnPath
	}

	return &Config{
		Port:               port,
		DatabaseURL:        dbURL,
		AppEnv:             appEnv,
		CORSAllowedOrigins: origins,
		OTPDemo:            os.Getenv("OTP_DEMO") == "true",
		OTPAppDelivery:     os.Getenv("OTP_APP_DELIVERY") == "true",
		CookieSecure:       os.Getenv("COOKIE_SECURE") == "true",
		DemoMode:           appEnv != "production",
		PublicURL:          publicURL,
		VNPay:              vnpay,
		Features:           NewFeatureManagerFromEnv(),
	}
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
