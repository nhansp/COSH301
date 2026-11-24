package httpapi

import (
	"net/http"
	"time"

	"eventticketing/internal/config"
	"eventticketing/internal/service"
	"eventticketing/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RouterDependencies struct {
	Config       *config.Config
	DBPool       *pgxpool.Pool
	Store        *store.Queries
	AuthService  *service.AuthService
	EventService *service.EventService
	SeatService  *service.SeatService
	RealtimeHub  *service.RealtimeHub
	Organizer    *service.OrganizerService
	Tickets      *service.TicketService
	Assistant    *service.AssistantService
}

func NewRouter(deps RouterDependencies) http.Handler {
	mux := http.NewServeMux()
	fm := deps.Config.Features

	sysHandler := NewSystemHandler(fm, deps.Config.DemoMode)
	authHandler := NewAuthHandler(deps.AuthService, deps.Config.CookieSecure)
	organizerHandler := NewOrganizerHandler(deps.Organizer, deps.EventService)
	otpLimiter := NewRateLimiter(30, time.Minute)
	demoLimiter := NewRateLimiter(5, time.Minute)
	assistantLimiter := NewRateLimiter(30, time.Minute)
	eventHandler := NewEventHandler(deps.EventService)
	seatHandler := NewSeatHandler(deps.SeatService, deps.AuthService, deps.EventService)
	streamHandler := NewStreamHandler(deps.RealtimeHub, deps.EventService)
	ticketHandler := NewTicketHandler(deps.Tickets, deps.EventService)
	assistantHandler := NewAssistantHandler(deps.Assistant, deps.AuthService)
	anyRole := []store.UserRole{store.UserRoleCUSTOMER, store.UserRoleORGANIZER, store.UserRoleADMIN}

	// 1. System Endpoints
	mux.HandleFunc("GET /api/health", sysHandler.HandleHealth)
	mux.HandleFunc("GET /api/features", sysHandler.HandleFeatures)

	// 2. Authentication Endpoints (gated by otp_login feature flag)
	mux.HandleFunc("POST /api/auth/otp/request", RequireFeature(fm, config.FlagOtpLogin, otpLimiter.Wrap(authHandler.HandleRequestOTP)))
	mux.HandleFunc("POST /api/auth/otp/verify", RequireFeature(fm, config.FlagOtpLogin, otpLimiter.Wrap(authHandler.HandleVerifyOTP)))
	if deps.Config.DemoMode {
		mux.HandleFunc("POST /api/auth/demo-login", demoLimiter.Wrap(authHandler.HandleDemoLogin))
	}
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
	mux.HandleFunc("GET /api/holds", RequireFeature(fm, config.FlagSeatHold,
		RequireRole(authHandler, anyRole, seatHandler.HandleMyHolds)))

	// 6. Organizer console (FR-08)
	mux.HandleFunc("GET /api/organizer/events", RequireFeature(fm, config.FlagOrganizerConsole,
		RequireRole(authHandler, organizerRoles, organizerHandler.HandleListEvents)))
	mux.HandleFunc("GET /api/organizer/events/{id}/sales-summary", RequireFeature(fm, config.FlagOrganizerConsole,
		RequireRole(authHandler, organizerRoles, organizerHandler.HandleEventSalesSummary)))
	mux.HandleFunc("PUT /api/organizer/events/{id}/zones/{zoneId}/pricing", RequireFeature(fm, config.FlagOrganizerConsole,
		RequireFeature(fm, config.FlagZonePricing, RequireRole(authHandler, organizerRoles, organizerHandler.HandleUpdateZonePricing))))

	// 7. Tickets exist only once payment is on; audit logs belong to the organizer console.
	mux.HandleFunc("POST /api/tickets/cancel", RequireFeature(fm, config.FlagPayments,
		RequireRole(authHandler, anyRole, ticketHandler.HandleCancelTicket)))
	mux.HandleFunc("GET /api/tickets/cancelled", RequireFeature(fm, config.FlagPayments,
		RequireRole(authHandler, anyRole, ticketHandler.HandleListUserCancelledTickets)))
	mux.HandleFunc("GET /api/tickets/audit-logs", RequireFeature(fm, config.FlagOrganizerConsole,
		RequireRole(authHandler, organizerRoles, ticketHandler.HandleListAuditLogs)))
	if deps.Config.DemoMode {
		mux.HandleFunc("POST /api/tickets/reset-demo", RequireFeature(fm, config.FlagSeatHold,
			RequireRole(authHandler, anyRole, ticketHandler.HandleResetDemoTickets)))
	}

	// 8. Role-aware Assistant endpoint (optional grounded LLM prose)
	if deps.Assistant != nil {
		mux.HandleFunc("POST /api/assistant/chat", assistantLimiter.Wrap(assistantHandler.HandleChat))
	}

	// Wrap with middlewares
	handler := LoggingMiddleware(mux)
	handler = CORSMiddleware(deps.Config.CORSAllowedOrigins)(handler)

	return handler
}
