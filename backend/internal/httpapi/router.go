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
	Pricing      *service.DynamicPricingEngine
	Recommend    *service.RecommendationService
}

func NewRouter(deps RouterDependencies) http.Handler {
	mux := http.NewServeMux()
	fm := deps.Config.Features

	sysHandler := NewSystemHandler(fm, deps.Config.DemoMode)
	authHandler := NewAuthHandler(deps.AuthService, deps.Config.CookieSecure)
	organizerHandler := NewOrganizerHandler(deps.Organizer, deps.EventService)
	otpLimiter := NewRateLimiter(30, time.Minute)
	demoLimiter := NewRateLimiter(5, time.Minute)
	eventHandler := NewEventHandler(deps.EventService)
	seatHandler := NewSeatHandler(deps.SeatService, deps.AuthService, deps.EventService)
	streamHandler := NewStreamHandler(deps.RealtimeHub, deps.EventService)
	ticketHandler := NewTicketHandler(deps.Tickets, deps.EventService)
	pricingHandler := NewPricingHandler(deps.Organizer, deps.EventService, deps.Pricing, deps.RealtimeHub)
	recHandler := NewRecommendationHandler(deps.Recommend, deps.EventService, deps.AuthService)
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
	mux.HandleFunc("GET /api/organizer/events/{id}", RequireFeature(fm, config.FlagOrganizerConsole,
		RequireRole(authHandler, organizerRoles, organizerHandler.HandleGetEvent)))
	mux.HandleFunc("PUT /api/organizer/events/{id}", RequireFeature(fm, config.FlagOrganizerConsole,
		RequireRole(authHandler, organizerRoles, organizerHandler.HandleUpdateEvent)))
	mux.HandleFunc("PUT /api/organizer/events/{id}/zones/{zoneId}/pricing", RequireFeature(fm, config.FlagOrganizerConsole,
		RequireFeature(fm, config.FlagZonePricing, RequireRole(authHandler, organizerRoles, organizerHandler.HandleUpdateZonePricing))))

	// 6b. Dynamic pricing (FR-22): the organizer's pricing dashboard.
	pricingRoute := func(pattern string, handler func(http.ResponseWriter, *http.Request, *store.GetSessionByTokenHashRow)) {
		mux.HandleFunc(pattern, RequireFeature(fm, config.FlagOrganizerConsole,
			RequireFeature(fm, config.FlagDynamicPricing, RequireRole(authHandler, organizerRoles, handler))))
	}
	pricingRoute("GET /api/organizer/events/{id}/pricing", pricingHandler.HandleOverview)
	pricingRoute("PUT /api/organizer/events/{id}/pricing/settings", pricingHandler.HandleUpdateSettings)
	pricingRoute("POST /api/organizer/events/{id}/pricing/analyze", pricingHandler.HandleAnalyze)
	pricingRoute("GET /api/organizer/events/{id}/pricing/history", pricingHandler.HandleHistory)
	pricingRoute("GET /api/organizer/events/{id}/pricing/alerts", pricingHandler.HandleAlerts)
	pricingRoute("POST /api/organizer/events/{id}/pricing/alerts/read", pricingHandler.HandleReadAllAlerts)
	pricingRoute("POST /api/organizer/pricing/alerts/{id}/read", pricingHandler.HandleReadAlert)
	pricingRoute("GET /api/organizer/events/{id}/pricing/stream", pricingHandler.HandleStream)
	pricingRoute("GET /api/organizer/events/{id}/pricing/suggestions", pricingHandler.HandleListSuggestions)
	pricingRoute("PUT /api/organizer/events/{id}/zones/{zoneId}/dynamic-pricing", pricingHandler.HandleSetZoneIncluded)
	pricingRoute("POST /api/organizer/suggestions/{id}/approve", pricingHandler.HandleApproveSuggestion)
	pricingRoute("POST /api/organizer/suggestions/{id}/reject", pricingHandler.HandleRejectSuggestion)

	// 6c. Recommendations: personal picks, and the views they learn from.
	mux.HandleFunc("GET /api/recommendations/events", RequireFeature(fm, config.FlagRecommendations, recHandler.HandleEvents))
	mux.HandleFunc("POST /api/events/{id}/views", RequireFeature(fm, config.FlagRecommendations,
		RequireRole(authHandler, anyRole, recHandler.HandleView)))

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

	// Wrap with middlewares
	handler := LoggingMiddleware(mux)
	handler = CORSMiddleware(deps.Config.CORSAllowedOrigins)(handler)

	return handler
}
