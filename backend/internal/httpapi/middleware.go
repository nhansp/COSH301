package httpapi

import (
	"log"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"eventticketing/internal/config"
	"eventticketing/internal/store"
)

// LoggingMiddleware logs incoming HTTP requests.
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// CORSMiddleware allows credentialed cross-origin calls from the listed origins only.
func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && slices.Contains(allowedOrigins, origin) {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Add("Vary", "Origin")
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireFeature hides an endpoint while its feature flag is off.
func RequireFeature(fm *config.FeatureManager, flagName string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !fm.IsEnabled(flagName) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "feature_disabled", "feature": flagName})
			return
		}
		next(w, r)
	}
}

// RequireRole passes the session to next only when the caller has one of roles.
func RequireRole(auth *AuthHandler, roles []store.UserRole, next func(http.ResponseWriter, *http.Request, *store.GetSessionByTokenHashRow)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sess, ok := auth.session(w, r)
		if !ok {
			return
		}
		if !slices.Contains(roles, sess.Role) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		next(w, r, sess)
	}
}

// clientIP returns the caller address. The API is only reachable through the
// frontend nginx, which sets X-Real-IP.
func clientIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(ip) != nil {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return ""
	}
	return host
}

// RateLimiter allows up to limit requests per client IP in each fixed window.
type RateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	start  time.Time
	counts map[string]int
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{limit: limit, window: window, start: time.Now(), counts: map[string]int{}}
}

func (l *RateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if now := time.Now(); now.Sub(l.start) >= l.window {
		l.start = now
		clear(l.counts)
	}
	l.counts[key]++
	return l.counts[key] <= l.limit
}

func (l *RateLimiter) Wrap(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(clientIP(r)) {
			writeError(w, http.StatusTooManyRequests, "rate_limited")
			return
		}
		next(w, r)
	}
}
