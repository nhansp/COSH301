package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"eventticketing/internal/config"
	"eventticketing/internal/httpapi"
	"eventticketing/internal/service"
	"eventticketing/internal/store"
	"eventticketing/internal/vnpay"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()
	log.Printf("Starting EventTicketing API on port %d [env: %s, profile: %s]", cfg.Port, cfg.AppEnv, cfg.Features.Profile())

	// Payments never start without merchant credentials.
	if cfg.Features.IsEnabled(config.FlagPayments) {
		if err := cfg.VNPay.Validate(); err != nil {
			log.Fatalf("Feature %q is on but VNPay is not configured: %v", config.FlagPayments, err)
		}
	}

	if cfg.Features.IsEnabled(config.FlagChatbot) {
		mode := "keywords only"
		if cfg.LLM.BaseURL != "" {
			mode = "language model " + cfg.LLM.Model
		}
		log.Printf("Assistant is on: %s", mode)
	}

	// Run migrations
	if err := store.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("Database migration failed: %v", err)
	}

	// Connect to PGX pool
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to parse DATABASE_URL: %v", err)
	}
	poolConfig.MaxConns = 30
	poolConfig.MinConns = 5

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("Failed to create PostgreSQL pool: %v", err)
	}
	defer dbPool.Close()

	queries := store.New(dbPool)

	// Initialize BCE Control services
	authService := service.NewAuthService(queries, cfg)
	eventService := service.NewEventService(queries)
	seatService := service.NewSeatService(dbPool, queries, cfg.Features.IsEnabled(config.FlagTicketLimit))
	organizerService := service.NewOrganizerService(dbPool, queries)
	pricingService := service.NewPricingService(dbPool, queries, cfg.Pricing)
	realtimeHub := service.NewRealtimeHub(dbPool)
	paymentService := service.NewPaymentService(dbPool, queries, vnpay.Client{
		TmnCode:    cfg.VNPay.TmnCode,
		HashSecret: cfg.VNPay.HashSecret,
		PayURL:     cfg.VNPay.PayURL,
		ReturnURL:  cfg.VNPay.ReturnURL,
	})
	holdReaper := service.NewHoldReaper(seatService, paymentService, 5*time.Second)

	// Start background workers
	realtimeHub.StartListener(ctx)
	holdReaper.Start(ctx)
	if cfg.Features.IsEnabled(config.FlagDynamicPricing) {
		pricingService.Start(ctx)
	}
	if cfg.OTPAppDelivery {
		authService.StartAppDeliveryReaper(ctx)
	}

	router := httpapi.NewRouter(httpapi.RouterDependencies{
		Config:       cfg,
		DBPool:       dbPool,
		Store:        queries,
		AuthService:  authService,
		EventService: eventService,
		SeatService:  seatService,
		RealtimeHub:  realtimeHub,
		Organizer:    organizerService,
		Pricing:      pricingService,
		Tickets:      service.NewTicketService(dbPool, queries),
		Payments:     paymentService,
		Assistant: service.NewAssistantService(queries, cfg.Features,
			service.NewLLMClient(cfg.LLM.BaseURL, cfg.LLM.Model, cfg.LLM.APIKey)),
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown channel
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Server listening on :%d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down server gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped cleanly")
}
