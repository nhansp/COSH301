package config

import (
	"os"
	"strings"
	"sync"
)

// List of all feature flags defined in docs/design/README.md
const (
	FlagOtpLogin         = "otp_login"
	FlagSeatMapRealtime  = "seat_map_realtime"
	FlagSeatHold         = "seat_hold"
	FlagZonePricing      = "zone_pricing"
	FlagOrganizerConsole = "organizer_console"
	FlagWaitingRoom      = "waiting_room"
	FlagBotCheck         = "bot_check"
	FlagTicketLimit      = "ticket_limit"
	FlagRotatingQR       = "rotating_qr"
	FlagPayments         = "payments"
	FlagTicketEmail      = "ticket_email"
	FlagReconciliation   = "reconciliation"
	FlagGateCheckin      = "gate_checkin"
	FlagOfflineCheckin   = "offline_checkin"
	FlagCeoDashboard     = "ceo_dashboard"
	FlagPriceLog         = "price_log"
	FlagReportsExport    = "reports_export"
	FlagDynamicPricing   = "dynamic_pricing"
	FlagPromoSuggestions = "promo_suggestions"
)

var allFlags = []string{
	FlagOtpLogin,
	FlagSeatMapRealtime,
	FlagSeatHold,
	FlagZonePricing,
	FlagOrganizerConsole,
	FlagWaitingRoom,
	FlagBotCheck,
	FlagTicketLimit,
	FlagRotatingQR,
	FlagPayments,
	FlagTicketEmail,
	FlagReconciliation,
	FlagGateCheckin,
	FlagOfflineCheckin,
	FlagCeoDashboard,
	FlagPriceLog,
	FlagReportsExport,
	FlagDynamicPricing,
	FlagPromoSuggestions,
}

var sprint2Flags = map[string]bool{
	FlagOtpLogin:         true,
	FlagSeatMapRealtime:  true,
	FlagSeatHold:         true,
	FlagZonePricing:      true,
	FlagOrganizerConsole: true,
}

var sprint3Flags = map[string]bool{
	FlagOtpLogin:         true,
	FlagSeatMapRealtime:  true,
	FlagSeatHold:         true,
	FlagZonePricing:      true,
	FlagOrganizerConsole: true,
	FlagWaitingRoom:      true,
	FlagBotCheck:         true,
	FlagTicketLimit:      true,
	FlagRotatingQR:       true,
}

var sprint4Flags = map[string]bool{
	FlagOtpLogin:         true,
	FlagSeatMapRealtime:  true,
	FlagSeatHold:         true,
	FlagZonePricing:      true,
	FlagOrganizerConsole: true,
	FlagWaitingRoom:      true,
	FlagBotCheck:         true,
	FlagTicketLimit:      true,
	FlagRotatingQR:       true,
	FlagPayments:         true,
	FlagTicketEmail:      true,
	FlagReconciliation:   true,
}

// FeatureManager manages runtime feature flags based on profile and environment overrides.
type FeatureManager struct {
	mu     sync.RWMutex
	flags  map[string]bool
	profile string
}

func NewFeatureManagerFromEnv() *FeatureManager {
	profile := strings.ToLower(strings.TrimSpace(os.Getenv("FEATURE_PROFILE")))
	if profile == "" {
		profile = "sprint2" // Default profile for current milestone
	}

	flags := make(map[string]bool)

	switch profile {
	case "sprint2":
		for _, flag := range allFlags {
			flags[flag] = sprint2Flags[flag]
		}
	case "sprint3":
		for _, flag := range allFlags {
			flags[flag] = sprint3Flags[flag]
		}
	case "sprint4":
		for _, flag := range allFlags {
			flags[flag] = sprint4Flags[flag]
		}
	case "final", "sprint5", "all":
		for _, flag := range allFlags {
			flags[flag] = true
		}
	default:
		// Fallback to sprint2
		for _, flag := range allFlags {
			flags[flag] = sprint2Flags[flag]
		}
	}

	// Apply explicit FEATURE_<NAME>=on|off overrides
	for _, flag := range allFlags {
		envKey := "FEATURE_" + strings.ToUpper(flag)
		if val := strings.ToLower(strings.TrimSpace(os.Getenv(envKey))); val != "" {
			switch val {
			case "on", "true", "1", "yes":
				flags[flag] = true
			case "off", "false", "0", "no":
				flags[flag] = false
			}
		}
	}

	return &FeatureManager{
		flags:   flags,
		profile: profile,
	}
}

// IsEnabled checks whether a feature flag is active.
func (fm *FeatureManager) IsEnabled(flagName string) bool {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	return fm.flags[flagName]
}

// All returns a copy of all current feature flags.
func (fm *FeatureManager) All() map[string]bool {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	res := make(map[string]bool, len(fm.flags))
	for k, v := range fm.flags {
		res[k] = v
	}
	return res
}

// Profile returns current active profile name.
func (fm *FeatureManager) Profile() string {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	return fm.profile
}
