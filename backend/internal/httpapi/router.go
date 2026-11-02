package httpapi

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"eventticketing/internal/config"
	"eventticketing/internal/store"
)

type RouterDependencies struct {
	Config   *config.Config
	DBPool   *pgxpool.Pool
	Store    *store.Queries
}

func NewRouter(deps RouterDependencies) http.Handler {
	mux := http.NewServeMux()

	sysHandler := NewSystemHandler(deps.Config.Features)

	// System endpoints
	mux.HandleFunc("/api/health", sysHandler.HandleHealth)
	mux.HandleFunc("/api/features", sysHandler.HandleFeatures)

	// Wrap with middlewares
	handler := LoggingMiddleware(mux)
	handler = CORSMiddleware(deps.Config.CORSAllowedOrigins)(handler)

	return handler
}
