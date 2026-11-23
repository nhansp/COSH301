package httpapi

import (
	"encoding/json"
	"net/http"

	"eventticketing/internal/config"
)

type SystemHandler struct {
	features  *config.FeatureManager
	demoLogin bool
}

// demoLogin tells clients whether POST /api/auth/demo-login is routed.
func NewSystemHandler(fm *config.FeatureManager, demoLogin bool) *SystemHandler {
	return &SystemHandler{features: fm, demoLogin: demoLogin}
}

func (h *SystemHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"service": "eventticketing-api",
		"profile": h.features.Profile(),
	})
}

func (h *SystemHandler) HandleFeatures(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"profile":   h.features.Profile(),
		"features":  h.features.All(),
		"demoLogin": h.demoLogin,
	})
}
