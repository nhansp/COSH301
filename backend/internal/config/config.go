package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port        int
	DatabaseURL string
	AppEnv      string
	// CORSAllowedOrigins lists origins allowed to call the API cross-origin.
	// Empty means same-origin only (the frontend proxies /api through nginx).
	CORSAllowedOrigins []string
	// OTPDemo shows customer login codes on screen instead of sending them.
	// Staff codes are only written to the server log, except for the staff
	// listed in OTPDemoStaff.
	OTPDemo bool
	// OTPDemoStaff lists staff emails or phones whose codes OTPDemo also shows,
	// for demo accounts (OTP_DEMO_STAFF, comma-separated). Empty by default.
	OTPDemoStaff []string
	CookieSecure bool
	// DemoMode exposes one-click demo login and demo data reset.
	// It is off when APP_ENV=production.
	DemoMode bool
	Features *FeatureManager
	// PricingInterval is how often the dynamic pricing job runs (DYNAMIC_PRICING_INTERVAL, default 5m).
	PricingInterval time.Duration
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

	pricingInterval, err := time.ParseDuration(os.Getenv("DYNAMIC_PRICING_INTERVAL"))
	if err != nil || pricingInterval < 10*time.Second {
		pricingInterval = 5 * time.Minute
	}

	return &Config{
		Port:               port,
		DatabaseURL:        dbURL,
		AppEnv:             appEnv,
		CORSAllowedOrigins: splitList(os.Getenv("CORS_ALLOWED_ORIGINS")),
		OTPDemo:            os.Getenv("OTP_DEMO") == "true",
		OTPDemoStaff:       splitList(os.Getenv("OTP_DEMO_STAFF")),
		CookieSecure:       os.Getenv("COOKIE_SECURE") == "true",
		DemoMode:           appEnv != "production",
		Features:           NewFeatureManagerFromEnv(),
		PricingInterval:    pricingInterval,
	}
}

// splitList reads a comma-separated setting, dropping blanks.
func splitList(v string) []string {
	var out []string
	for _, item := range strings.Split(v, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}
