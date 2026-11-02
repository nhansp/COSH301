package config

import (
	"os"
	"testing"
)

func TestFeatureManager_Profiles(t *testing.T) {
	// Test sprint2 profile (default)
	os.Setenv("FEATURE_PROFILE", "sprint2")
	defer os.Unsetenv("FEATURE_PROFILE")

	fm := NewFeatureManagerFromEnv()
	if !fm.IsEnabled(FlagOtpLogin) {
		t.Errorf("expected %s to be enabled in sprint2", FlagOtpLogin)
	}
	if !fm.IsEnabled(FlagSeatHold) {
		t.Errorf("expected %s to be enabled in sprint2", FlagSeatHold)
	}
	if fm.IsEnabled(FlagWaitingRoom) {
		t.Errorf("expected %s to be disabled in sprint2", FlagWaitingRoom)
	}
	if fm.IsEnabled(FlagPayments) {
		t.Errorf("expected %s to be disabled in sprint2", FlagPayments)
	}

	// Test sprint3 profile
	os.Setenv("FEATURE_PROFILE", "sprint3")
	fm3 := NewFeatureManagerFromEnv()
	if !fm3.IsEnabled(FlagWaitingRoom) {
		t.Errorf("expected %s to be enabled in sprint3", FlagWaitingRoom)
	}
	if !fm3.IsEnabled(FlagRotatingQR) {
		t.Errorf("expected %s to be enabled in sprint3", FlagRotatingQR)
	}
	if fm3.IsEnabled(FlagPayments) {
		t.Errorf("expected %s to be disabled in sprint3", FlagPayments)
	}

	// Test final profile
	os.Setenv("FEATURE_PROFILE", "final")
	fmFinal := NewFeatureManagerFromEnv()
	for _, flag := range allFlags {
		if !fmFinal.IsEnabled(flag) {
			t.Errorf("expected %s to be enabled in final profile", flag)
		}
	}
}

func TestFeatureManager_EnvOverride(t *testing.T) {
	os.Setenv("FEATURE_PROFILE", "sprint2")
	os.Setenv("FEATURE_PAYMENTS", "on") // Override disabled flag in sprint2
	os.Setenv("FEATURE_SEAT_HOLD", "off") // Override enabled flag in sprint2
	defer func() {
		os.Unsetenv("FEATURE_PROFILE")
		os.Unsetenv("FEATURE_PAYMENTS")
		os.Unsetenv("FEATURE_SEAT_HOLD")
	}()

	fm := NewFeatureManagerFromEnv()
	if !fm.IsEnabled(FlagPayments) {
		t.Errorf("expected %s to be overridden to ON", FlagPayments)
	}
	if fm.IsEnabled(FlagSeatHold) {
		t.Errorf("expected %s to be overridden to OFF", FlagSeatHold)
	}
}
