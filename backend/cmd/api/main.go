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

	"github.com/jackc/pgx/v5/pgxpool"
	"eventticketing/internal/config"
	"eventticketing/internal/httpapi"
	"eventticketing/internal/store"
)

func main() {
	cfg := config.Load()
	log.Printf("Starting EventTicketing API on port %d [env: %s, profile: %s]", cfg.Port, cfg.AppEnv, cfg.Features.Profile())

	// Run migrations
	log.Println("Checking & running database migrations...")
	if err := store.RunMigrations(cfg.DatabaseURL); err != nil {
		log.Printf("Warning: Database migration failed (will proceed if database is still starting): %v", err)
	} else {
		log.Println("Database migrations applied successfully")
	}

	// Connect to PGX pool
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to parse DATABASE_URL: %v", err)
	}
	poolConfig.MaxConns = 30
	poolConfig.MinConns = 5

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Printf("Warning: Failed to connect to PostgreSQL pool: %v", err)
	} else {
		defer dbPool.Close()
		log.Println("Connected to PostgreSQL pool successfully")
	}

	queries := store.New(dbPool)

	router := httpapi.NewRouter(httpapi.RouterDependencies{
		Config: cfg,
		DBPool: dbPool,
		Store:  queries,
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
