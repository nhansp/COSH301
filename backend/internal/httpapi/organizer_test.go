package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"eventticketing/internal/config"
	"eventticketing/internal/service"
)

func TestOrganizerEventAndLayoutRoutes_RequireAuth(t *testing.T) {
	t.Setenv("FEATURE_PROFILE", "sprint2")
	cfg := config.Load()
	authService := service.NewAuthService(nil, cfg)
	router := NewRouter(RouterDependencies{
		Config:       cfg,
		AuthService:  authService,
		Organizer:    service.NewOrganizerService(nil, nil),
		EventService: service.NewEventService(nil),
	})

	createBody, _ := json.Marshal(map[string]any{"name": "Test Concert"})
	createReq := httptest.NewRequest(http.MethodPost, "/api/organizer/events", bytes.NewReader(createBody))
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated POST /api/organizer/events, got %d", createRec.Code)
	}

	layoutBody, _ := json.Marshal(map[string]any{"stageShape": "thrust"})
	layoutReq := httptest.NewRequest(http.MethodPut, "/api/organizer/events/00000000-0000-0000-0000-000000000001/layout", bytes.NewReader(layoutBody))
	layoutRec := httptest.NewRecorder()
	router.ServeHTTP(layoutRec, layoutReq)
	if layoutRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated PUT /api/organizer/events/{id}/layout, got %d", layoutRec.Code)
	}
}

func TestSanitizeStageLayoutConfig(t *testing.T) {
	cfg := service.SanitizeStageLayoutConfig(&service.StageLayoutConfig{
		StageShape:    "thrust",
		LayoutStyle:   "arena360",
		StageTheme:    "sunset",
		StageLabel:    "  MAIN RUNWAY  ",
		StageWidth:    99,
		StageDepth:    1,
		StageHeight:   5,
		CatwalkLength: 20,
		TierSpanDeg:   400,
		ZonesPerRing:  9,
		ZoneStyles: map[string]service.ZoneStyleConfig{
			"vip": {Color: "#FFAA00", Rows: 3, SeatsPerRow: 10},
			"bad": {Color: "not-a-color"},
		},
	})
	if cfg.StageShape != "thrust" || cfg.LayoutStyle != "arena360" || cfg.StageTheme != "sunset" {
		t.Fatalf("unexpected enums: %+v", cfg)
	}
	if cfg.StageLabel != "MAIN RUNWAY" || cfg.StageWidth != 26 || cfg.StageDepth != 4 || cfg.StageHeight != 2.4 {
		t.Fatalf("expected clamped dimensions, got %+v", cfg)
	}
	if cfg.CatwalkLength != 14 || cfg.TierSpanDeg != 320 || cfg.ZonesPerRing != 4 {
		t.Fatalf("expected clamped runway/ring params, got %+v", cfg)
	}
	if cfg.ZoneStyles["VIP"].Color != "#ffaa00" {
		t.Fatalf("expected normalized zone color, got %+v", cfg.ZoneStyles)
	}
	if _, ok := cfg.ZoneStyles["BAD"]; ok {
		t.Fatalf("expected invalid zone style to be omitted, got %+v", cfg.ZoneStyles)
	}
}

func TestValidateCreateOrganizerEvent(t *testing.T) {
	validReq := service.CreateOrganizerEventRequest{
		Name:      "Đêm Nhạc Mùa Thu Hà Nội",
		Genre:     "Indie",
		City:      "Hà Nội",
		VenueName: "Cung Thể Thao Quần Ngựa",
		StartsAt:  "2026-12-10T19:30:00+07:00",
		EndsAt:    "2026-12-10T22:30:00+07:00",
		LayoutConfig: &service.StageLayoutConfig{
			StageShape:  "catwalk",
			LayoutStyle: "horseshoe",
			StageTheme:  "emerald",
		},
		Zones: []service.CreateEventZoneInput{
			{Code: "VIP_PIT", Name: "VIP Standing", Kind: "standing", Rows: 2, SeatsPerRow: 10, BasePrice: 2500000, Color: "#f2c982"},
			{Code: "CAT1", Name: "CAT 1 Seated", Kind: "seated", Rows: 3, SeatsPerRow: 12, BasePrice: 1500000},
		},
	}

	got, err := service.ValidateCreateOrganizerEvent(validReq)
	if err != nil {
		t.Fatalf("expected valid event request, got error: %v", err)
	}
	if got.TotalCapacity != 56 || len(got.Zones) != 2 || got.Zones[0].FloorPrice != 2000000 || got.Zones[0].CeilingPrice != 3000000 {
		t.Fatalf("unexpected validated output: %+v", got)
	}

	badSchedule := validReq
	badSchedule.EndsAt = badSchedule.StartsAt
	if _, err := service.ValidateCreateOrganizerEvent(badSchedule); !errors.Is(err, service.ErrInvalidEventSchedule) {
		t.Fatalf("expected ErrInvalidEventSchedule, got %v", err)
	}

	dupZones := validReq
	dupZones.Zones = append(dupZones.Zones, validReq.Zones[0])
	if _, err := service.ValidateCreateOrganizerEvent(dupZones); !errors.Is(err, service.ErrInvalidZones) {
		t.Fatalf("expected ErrInvalidZones for duplicate code, got %v", err)
	}

	dataImg := validReq
	dataImg.ImageURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/"
	if _, err := service.ValidateCreateOrganizerEvent(dataImg); err != nil {
		t.Fatalf("expected attached raster data URL to be accepted, got %v", err)
	}

	svgImg := validReq
	svgImg.ImageURL = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
	if _, err := service.ValidateCreateOrganizerEvent(svgImg); !errors.Is(err, service.ErrInvalidEventPayload) {
		t.Fatalf("expected SVG data URL to be rejected with ErrInvalidEventPayload, got %v", err)
	}

	customLimit := validReq
	customLimit.MaxTicketsPerUser = 50
	gotLimit, err := service.ValidateCreateOrganizerEvent(customLimit)
	if err != nil || gotLimit.MaxTicketsPerUser != 50 {
		t.Fatalf("expected MaxTicketsPerUser=50 to be preserved, got %+v err=%v", gotLimit, err)
	}
}

func TestNormalizeZonePricing(t *testing.T) {
	f := false
	fixed, isDyn, err := service.NormalizeZonePricing(service.ZonePricing{
		BasePrice:               1800000,
		FloorPrice:              1200000,
		CeilingPrice:            2400000,
		IsDynamicPricingEnabled: &f,
	}, true)
	if err != nil {
		t.Fatalf("expected fixed pricing to succeed, got %v", err)
	}
	if isDyn || fixed.FloorPrice != 1800000 || fixed.CeilingPrice != 1800000 {
		t.Fatalf("expected fixed pricing to clamp floor/ceiling to base, got %+v dyn=%v", fixed, isDyn)
	}

	tr := true
	dyn, isDyn, err := service.NormalizeZonePricing(service.ZonePricing{
		BasePrice:               2000000,
		FloorPrice:              1600000,
		CeilingPrice:            2600000,
		IsDynamicPricingEnabled: &tr,
	}, false)
	if err != nil || !isDyn || dyn.FloorPrice != 1600000 || dyn.CeilingPrice != 2600000 {
		t.Fatalf("expected dynamic pricing bounds preserved, got %+v dyn=%v err=%v", dyn, isDyn, err)
	}

	if _, _, err := service.NormalizeZonePricing(service.ZonePricing{
		BasePrice:               2000000,
		FloorPrice:              2500000,
		CeilingPrice:            3000000,
		IsDynamicPricingEnabled: &tr,
	}, true); !errors.Is(err, service.ErrInvalidPriceBounds) {
		t.Fatalf("expected ErrInvalidPriceBounds for floor > base in dynamic mode, got %v", err)
	}
}
