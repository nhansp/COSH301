package httpapi

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"eventticketing/internal/config"
	"eventticketing/internal/service"
	"eventticketing/internal/store"
)

type RouterDependencies struct {
	Config       *config.Config
	DBPool       *pgxpool.Pool
	Store        *store.Queries
	AuthService  *service.AuthService
	EventService *service.EventService
	SeatService  *service.SeatService
	RealtimeHub  *service.RealtimeHub
}

func NewRouter(deps RouterDependencies) http.Handler {
	mux := http.NewServeMux()
	fm := deps.Config.Features

	sysHandler := NewSystemHandler(fm)
	authHandler := NewAuthHandler(deps.AuthService)
	eventHandler := NewEventHandler(deps.EventService)
	seatHandler := NewSeatHandler(deps.SeatService, deps.AuthService)
	streamHandler := NewStreamHandler(deps.RealtimeHub)

	// 1. System Endpoints
	mux.HandleFunc("GET /api/health", sysHandler.HandleHealth)
	mux.HandleFunc("GET /api/features", sysHandler.HandleFeatures)

	// 2. Authentication Endpoints (gated by otp_login feature flag)
	mux.HandleFunc("POST /api/auth/otp/request", RequireFeature(fm, config.FlagOtpLogin, authHandler.HandleRequestOTP))
	mux.HandleFunc("POST /api/auth/otp/verify", RequireFeature(fm, config.FlagOtpLogin, authHandler.HandleVerifyOTP))
	mux.HandleFunc("GET /api/auth/me", authHandler.HandleMe)
	mux.HandleFunc("POST /api/auth/logout", authHandler.HandleLogout)

	// 3. Events Endpoints (FR-02 always enabled)
	mux.HandleFunc("GET /api/events", eventHandler.HandleEvents)
	mux.HandleFunc("GET /api/events/{slug}", eventHandler.HandleEvents)

	// 4. Seats & Realtime Endpoints (gated by seat_map_realtime)
	mux.HandleFunc("GET /api/events/{id}/seats", RequireFeature(fm, config.FlagSeatMapRealtime, seatHandler.HandleEventSeats))
	mux.HandleFunc("GET /api/events/{id}/stream", RequireFeature(fm, config.FlagSeatMapRealtime, streamHandler.HandleEventStream))

	// 5. Seat Hold Endpoints (gated by seat_hold)
	mux.HandleFunc("POST /api/holds", RequireFeature(fm, config.FlagSeatHold, seatHandler.HandleHolds))
	mux.HandleFunc("DELETE /api/holds/{seatId}", RequireFeature(fm, config.FlagSeatHold, seatHandler.HandleHolds))

	// Wrap with middlewares
	handler := LoggingMiddleware(mux)
	handler = CORSMiddleware(deps.Config.CORSAllowedOrigins)(handler)

	return handler
}
