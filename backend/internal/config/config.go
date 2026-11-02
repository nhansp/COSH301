package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port               int
	DatabaseURL        string
	AppEnv             string
	CORSAllowedOrigins string
	OTPMock            bool
	Features           *FeatureManager
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

	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "*"
	}

	otpMock := os.Getenv("OTP_MOCK") != "false" // default to true in dev for convenience

	return &Config{
		Port:               port,
		DatabaseURL:        dbURL,
		AppEnv:             appEnv,
		CORSAllowedOrigins: corsOrigins,
		OTPMock:            otpMock,
		Features:           NewFeatureManagerFromEnv(),
	}
}
