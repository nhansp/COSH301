package config

import (
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
	OTPDemo      bool
	CookieSecure bool
	Features     *FeatureManager
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

	return &Config{
		Port:               port,
		DatabaseURL:        dbURL,
		AppEnv:             appEnv,
		CORSAllowedOrigins: origins,
		OTPDemo:            os.Getenv("OTP_DEMO") == "true",
		CookieSecure:       os.Getenv("COOKIE_SECURE") == "true",
		Features:           NewFeatureManagerFromEnv(),
	}
}
