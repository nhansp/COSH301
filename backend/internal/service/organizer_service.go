package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"eventticketing/internal/store"
)

var (
	ErrEventNotFound        = errors.New("event_not_found")
	ErrZoneNotFound         = errors.New("zone_not_found")
	ErrNotEventOrganizer    = errors.New("not_event_organizer")
	ErrInvalidPriceBounds   = errors.New("invalid_price_bounds")
	ErrInvalidEventPayload  = errors.New("invalid_event_payload")
	ErrInvalidEventSchedule = errors.New("invalid_event_schedule")
	ErrInvalidZones         = errors.New("invalid_zones")
)

var hexColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type ZoneStyleConfig struct {
	Color       string `json:"color,omitempty"`
	Rows        int    `json:"rows,omitempty"`
	SeatsPerRow int    `json:"seatsPerRow,omitempty"`
}

type StageLayoutConfig struct {
	StageShape    string                     `json:"stageShape,omitempty"`    // standard | thrust | catwalk | center
	LayoutStyle   string                     `json:"layoutStyle,omitempty"`   // horseshoe | theater | amphitheater | arena360
	StageTheme    string                     `json:"stageTheme,omitempty"`    // electric | sunset | emerald | gold
	StageLabel    string                     `json:"stageLabel,omitempty"`
	StageWidth    float64                    `json:"stageWidth,omitempty"`    // 10..26m
	StageDepth    float64                    `json:"stageDepth,omitempty"`    // 4..10m
	StageHeight   float64                    `json:"stageHeight,omitempty"`   // 0.8..2.4m
	CatwalkLength float64                    `json:"catwalkLength,omitempty"` // 0..14m
	CatwalkWidth  float64                    `json:"catwalkWidth,omitempty"`  // 2.5..6m
	TierSpanDeg   float64                    `json:"tierSpanDeg,omitempty"`   // 70..320 deg
	ZonesPerRing  int                        `json:"zonesPerRing,omitempty"`  // 1..5
	PitWidth      float64                    `json:"pitWidth,omitempty"`      // 10..26m
	PitDepth      float64                    `json:"pitDepth,omitempty"`      // 2.4..6m
	ZoneStyles    map[string]ZoneStyleConfig `json:"zoneStyles,omitempty"`
}

type CreateEventZoneInput struct {
	Code                    string `json:"code"`
	Name                    string `json:"name"`
	Floor                   string `json:"floor,omitempty"`
	Kind                    string `json:"kind"` // seated | standing
	Rows                    int    `json:"rows"`
	SeatsPerRow             int    `json:"seatsPerRow"`
	BasePrice               int64  `json:"basePrice"`
	FloorPrice              int64  `json:"floorPrice"`
	CeilingPrice            int64  `json:"ceilingPrice"`
	IsDynamicPricingEnabled bool   `json:"isDynamicPricingEnabled"`
	Color                   string `json:"color,omitempty"`
}

type CreateOrganizerEventRequest struct {
	Name               string                 `json:"name"`
	Description        string                 `json:"description"`
	Genre              string                 `json:"genre"`
	City               string                 `json:"city"`
	VenueName          string                 `json:"venueName"`
	VenueAddress       string                 `json:"venueAddress"`
	ImageURL           string                 `json:"imageUrl"`
	ImageCredit        string                 `json:"imageCredit"`
	StartsAt           string                 `json:"startsAt"`
	EndsAt             string                 `json:"endsAt"`
	Status             string                 `json:"status"` // ON_SALE | DRAFT
	MaxTicketsPerUser  int32                  `json:"maxTicketsPerUser"`
	WaitingRoomEnabled bool                   `json:"waitingRoomEnabled"`
	LayoutConfig       *StageLayoutConfig     `json:"layoutConfig,omitempty"`
	Zones              []CreateEventZoneInput `json:"zones"`
}

type CreatedOrganizerEventDTO struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Slug          string            `json:"slug"`
	Status        string            `json:"status"`
	StartsAt      string            `json:"startsAt"`
	EndsAt        string            `json:"endsAt"`
	ImageURL      string            `json:"imageUrl"`
	VenueName     string            `json:"venueName"`
	City          string            `json:"city"`
	ZoneCount     int               `json:"zoneCount"`
	TotalCapacity int               `json:"totalCapacity"`
	LayoutConfig  StageLayoutConfig `json:"layoutConfig"`
}

func clampFloat(v, minV, maxV, fallback float64) float64 {
	if v <= 0 {
		return fallback
	}
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}

// SanitizeStageLayoutConfig normalizes and bounds stage/layout parameters before storing in JSONB.
func SanitizeStageLayoutConfig(in *StageLayoutConfig) StageLayoutConfig {
	out := StageLayoutConfig{
		StageShape:   "standard",
		LayoutStyle:  "horseshoe",
		StageTheme:   "electric",
		StageLabel:   "SÂN KHẤU",
		StageWidth:   16,
		StageDepth:   6,
		StageHeight:  1.2,
		TierSpanDeg:  150,
		ZonesPerRing: 3,
		PitWidth:     18,
		PitDepth:     3.4,
	}
	if in == nil {
		return out
	}

	switch in.StageShape {
	case "standard", "thrust", "catwalk", "center":
		out.StageShape = in.StageShape
	}
	switch in.LayoutStyle {
	case "horseshoe", "theater", "amphitheater", "arena360":
		out.LayoutStyle = in.LayoutStyle
	}
	switch in.StageTheme {
	case "electric", "sunset", "emerald", "gold":
		out.StageTheme = in.StageTheme
	}

	if lbl := strings.TrimSpace(in.StageLabel); lbl != "" {
		runes := []rune(lbl)
		if len(runes) > 36 {
			lbl = string(runes[:36])
		}
		out.StageLabel = lbl
	}

	defaultSpan := 150.0
	defaultPerRing := 3
	switch out.LayoutStyle {
	case "theater":
		defaultSpan = 92
		defaultPerRing = 2
	case "amphitheater":
		defaultSpan = 198
		defaultPerRing = 4
	case "arena360":
		defaultSpan = 310
		defaultPerRing = 4
	}
	if out.StageShape == "center" && in.TierSpanDeg == 0 {
		defaultSpan = 310
	}

	out.StageWidth = clampFloat(in.StageWidth, 8, 26, 16)
	out.StageDepth = clampFloat(in.StageDepth, 4, 14, 6)
	out.StageHeight = clampFloat(in.StageHeight, 0.8, 2.4, 1.2)
	if out.StageShape == "thrust" || out.StageShape == "catwalk" {
		out.CatwalkLength = clampFloat(in.CatwalkLength, 3.5, 14, 7.5)
		out.CatwalkWidth = clampFloat(in.CatwalkWidth, 2.4, 6, 3.4)
	}
	out.TierSpanDeg = clampFloat(in.TierSpanDeg, 70, 320, defaultSpan)
	if in.ZonesPerRing >= 1 && in.ZonesPerRing <= 5 {
		out.ZonesPerRing = in.ZonesPerRing
	} else {
		out.ZonesPerRing = defaultPerRing
	}
	out.PitWidth = clampFloat(in.PitWidth, 10, 26, 18)
	out.PitDepth = clampFloat(in.PitDepth, 2.4, 6, 3.4)

	if len(in.ZoneStyles) > 0 {
		styles := make(map[string]ZoneStyleConfig, len(in.ZoneStyles))
		for rawCode, st := range in.ZoneStyles {
			code := strings.ToUpper(strings.TrimSpace(rawCode))
			if code == "" || len(code) > 50 {
				continue
			}
			clean := ZoneStyleConfig{}
			if hexColorPattern.MatchString(strings.TrimSpace(st.Color)) {
				clean.Color = strings.ToLower(strings.TrimSpace(st.Color))
			}
			if st.Rows >= 1 && st.Rows <= 12 {
				clean.Rows = st.Rows
			}
			if st.SeatsPerRow >= 1 && st.SeatsPerRow <= 24 {
				clean.SeatsPerRow = st.SeatsPerRow
			}
			if clean.Color != "" || clean.Rows > 0 || clean.SeatsPerRow > 0 {
				styles[code] = clean
			}
		}
		if len(styles) > 0 {
			out.ZoneStyles = styles
		}
	}
	return out
}

func slugifyEventName(raw string) string {
	replacer := strings.NewReplacer(
		"đ", "d", "Đ", "d",
		"á", "a", "à", "a", "ả", "a", "ã", "a", "ạ", "a",
		"ă", "a", "ắ", "a", "ằ", "a", "ẳ", "a", "ẵ", "a", "ặ", "a",
		"â", "a", "ấ", "a", "ầ", "a", "ẩ", "a", "ẫ", "a", "ậ", "a",
		"é", "e", "è", "e", "ẻ", "e", "ẽ", "e", "ẹ", "e",
		"ê", "e", "ế", "e", "ề", "e", "ể", "e", "ễ", "e", "ệ", "e",
		"í", "i", "ì", "i", "ỉ", "i", "ĩ", "i", "ị", "i",
		"ó", "o", "ò", "o", "ỏ", "o", "õ", "o", "ọ", "o",
		"ô", "o", "ố", "o", "ồ", "o", "ổ", "o", "ỗ", "o", "ộ", "o",
		"ơ", "o", "ớ", "o", "ờ", "o", "ở", "o", "ỡ", "o", "ợ", "o",
		"ú", "u", "ù", "u", "ủ", "u", "ũ", "u", "ụ", "u",
		"ư", "u", "ứ", "u", "ừ", "u", "ử", "u", "ữ", "u", "ự", "u",
		"ý", "y", "ỳ", "y", "ỷ", "y", "ỹ", "y", "ỵ", "y",
	)
	lower := replacer.Replace(strings.ToLower(strings.TrimSpace(raw)))
	var b strings.Builder
	lastDash := true
	for _, r := range lower {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
		} else if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
		if b.Len() >= 64 {
			break
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		return "event"
	}
	return slug
}

func randomHexSuffix(nBytes int) string {
	buf := make([]byte, nBytes)
	if _, err := rand.Read(buf); err != nil {
		return strconv.FormatInt(time.Now().UnixNano()%10000, 16)
	}
	return hex.EncodeToString(buf)
}

func parseEventTimestamp(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, ErrInvalidEventSchedule
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02T15:04", raw); err == nil {
		loc, errLoc := time.LoadLocation("Asia/Ho_Chi_Minh")
		if errLoc != nil {
			loc = time.FixedZone("ICT", 7*3600)
		}
		return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), 0, 0, loc), nil
	}
	return time.Time{}, ErrInvalidEventSchedule
}

type validatedZone struct {
	Code                    string
	Name                    string
	Floor                   string
	Kind                    string
	Rows                    int
	SeatsPerRow             int
	BasePrice               int64
	FloorPrice              int64
	CeilingPrice            int64
	IsDynamicPricingEnabled bool
	Color                   string
}

type validatedCreateEvent struct {
	Name               string
	Description        string
	Genre              string
	City               string
	VenueName          string
	VenueAddress       string
	ImageURL           string
	ImageCredit        string
	StartsAt           time.Time
	EndsAt             time.Time
	Status             store.EventStatus
	MaxTicketsPerUser  int32
	WaitingRoomEnabled bool
	LayoutConfig       StageLayoutConfig
	Zones              []validatedZone
	TotalCapacity      int
}

// ValidateCreateOrganizerEvent validates event metadata, schedule, zones, and stage config.
func ValidateCreateOrganizerEvent(req CreateOrganizerEventRequest) (*validatedCreateEvent, error) {
	name := strings.TrimSpace(req.Name)
	venueName := strings.TrimSpace(req.VenueName)
	city := strings.TrimSpace(req.City)
	if name == "" || len([]rune(name)) > 200 || venueName == "" || len([]rune(venueName)) > 180 || city == "" {
		return nil, ErrInvalidEventPayload
	}

	startsAt, err := parseEventTimestamp(req.StartsAt)
	if err != nil {
		return nil, ErrInvalidEventSchedule
	}
	endsAt, err := parseEventTimestamp(req.EndsAt)
	if err != nil || !endsAt.After(startsAt) {
		return nil, ErrInvalidEventSchedule
	}

	status := store.EventStatusONSALE
	switch strings.ToUpper(strings.TrimSpace(req.Status)) {
	case "", "ON_SALE":
		status = store.EventStatusONSALE
	case "DRAFT":
		status = store.EventStatusDRAFT
	default:
		return nil, ErrInvalidEventPayload
	}

	maxTickets := req.MaxTicketsPerUser
	if maxTickets == 0 {
		maxTickets = 4
	}
	if maxTickets < 0 || maxTickets > 1500 {
		return nil, ErrInvalidEventPayload
	}

	if len(req.Zones) == 0 || len(req.Zones) > 16 {
		return nil, ErrInvalidZones
	}

	layoutCfg := SanitizeStageLayoutConfig(req.LayoutConfig)
	if layoutCfg.ZoneStyles == nil {
		layoutCfg.ZoneStyles = make(map[string]ZoneStyleConfig)
	}

	seenCodes := make(map[string]bool, len(req.Zones))
	zones := make([]validatedZone, 0, len(req.Zones))
	totalSeats := 0

	for idx, z := range req.Zones {
		zName := strings.TrimSpace(z.Name)
		if zName == "" || len([]rune(zName)) > 110 {
			return nil, ErrInvalidZones
		}
		code := strings.ToUpper(strings.TrimSpace(z.Code))
		if code == "" {
			code = fmt.Sprintf("Z%d", idx+1)
		}
		code = strings.ReplaceAll(code, " ", "_")
		if len(code) > 40 || seenCodes[code] {
			return nil, ErrInvalidZones
		}
		seenCodes[code] = true

		kind := strings.ToLower(strings.TrimSpace(z.Kind))
		if kind == "" {
			if isStandingZoneName(zName) {
				kind = "standing"
			} else {
				kind = "seated"
			}
		}
		if kind != "seated" && kind != "standing" {
			return nil, ErrInvalidZones
		}

		rows := z.Rows
		seatsPerRow := z.SeatsPerRow
		if rows < 1 || rows > 12 || seatsPerRow < 1 || seatsPerRow > 24 {
			return nil, ErrInvalidZones
		}
		capCount := rows * seatsPerRow
		totalSeats += capCount
		if totalSeats > 1500 {
			return nil, ErrInvalidZones
		}

		base := z.BasePrice
		floor := z.FloorPrice
		ceiling := z.CeilingPrice
		if base < 0 {
			return nil, ErrInvalidPriceBounds
		}
		if floor == 0 && base > 0 {
			floor = (base * 80) / 100
		}
		if ceiling == 0 && base > 0 {
			ceiling = (base * 120) / 100
		}
		if floor < 0 || floor > base || base > ceiling {
			return nil, ErrInvalidPriceBounds
		}

		color := strings.ToLower(strings.TrimSpace(z.Color))
		if color != "" && !hexColorPattern.MatchString(color) {
			color = ""
		}
		style := layoutCfg.ZoneStyles[code]
		if color != "" {
			style.Color = color
		}
		style.Rows = rows
		style.SeatsPerRow = seatsPerRow
		layoutCfg.ZoneStyles[code] = style

		zones = append(zones, validatedZone{
			Code:                    code,
			Name:                    zName,
			Floor:                   strings.TrimSpace(z.Floor),
			Kind:                    kind,
			Rows:                    rows,
			SeatsPerRow:             seatsPerRow,
			BasePrice:               base,
			FloorPrice:              floor,
			CeilingPrice:            ceiling,
			IsDynamicPricingEnabled: z.IsDynamicPricingEnabled,
			Color:                   color,
		})
	}

	genre := strings.TrimSpace(req.Genre)
	if genre == "" {
		genre = "Concert"
	}

	imageURL := strings.TrimSpace(req.ImageURL)
	if !isValidEventImageURL(imageURL) {
		return nil, ErrInvalidEventPayload
	}

	return &validatedCreateEvent{
		Name:               name,
		Description:        strings.TrimSpace(req.Description),
		Genre:              genre,
		City:               city,
		VenueName:          venueName,
		VenueAddress:       strings.TrimSpace(req.VenueAddress),
		ImageURL:           imageURL,
		ImageCredit:        strings.TrimSpace(req.ImageCredit),
		StartsAt:           startsAt,
		EndsAt:             endsAt,
		Status:             status,
		MaxTicketsPerUser:  maxTickets,
		WaitingRoomEnabled: req.WaitingRoomEnabled,
		LayoutConfig:       layoutCfg,
		Zones:              zones,
		TotalCapacity:      totalSeats,
	}, nil
}

const maxEventImageDataBytes = 2 * 1024 * 1024 // 2 MB base64 cap for attached raster images

func isValidEventImageURL(raw string) bool {
	if raw == "" {
		return true
	}
	if len(raw) > maxEventImageDataBytes {
		return false
	}
	lower := strings.ToLower(raw)
	if strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "http://") || strings.HasPrefix(raw, "/") {
		return true
	}
	for _, prefix := range []string{
		"data:image/jpeg;base64,",
		"data:image/jpg;base64,",
		"data:image/png;base64,",
		"data:image/webp;base64,",
		"data:image/gif;base64,",
	} {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	return false
}

// OrganizerService lets organizers manage their events, layouts, and zone prices (FR-08).
type OrganizerService struct {
	dbPool  *pgxpool.Pool
	queries *store.Queries
}

func NewOrganizerService(dbPool *pgxpool.Pool, queries *store.Queries) *OrganizerService {
	return &OrganizerService{dbPool: dbPool, queries: queries}
}

type OrganizerEventDTO struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Status    string `json:"status"`
	StartsAt  string `json:"startsAt"`
	ImageURL  string `json:"imageUrl"`
	VenueName string `json:"venueName"`
}

// ListEvents returns the events the user organizes, or all events for admins.
func (s *OrganizerService) ListEvents(ctx context.Context, userID pgtype.UUID, isAdmin bool) ([]OrganizerEventDTO, error) {
	rows, err := s.queries.ListOrganizerEvents(ctx, store.ListOrganizerEventsParams{IsAdmin: isAdmin, OrganizerID: userID})
	if err != nil {
		return nil, fmt.Errorf("list organizer events: %w", err)
	}
	out := make([]OrganizerEventDTO, 0, len(rows))
	for _, e := range rows {
		out = append(out, OrganizerEventDTO{
			ID:        store.UUIDToString(e.ID),
			Name:      e.Name,
			Slug:      e.Slug,
			Status:    string(e.Status),
			StartsAt:  e.StartsAt.Time.Format(time.RFC3339),
			ImageURL:  e.ImageUrl.String,
			VenueName: e.VenueName,
		})
	}
	return out, nil
}

// AuthorizeEvent checks that the user may manage the event.
func (s *OrganizerService) AuthorizeEvent(ctx context.Context, eventID, userID pgtype.UUID, isAdmin bool) error {
	owner, err := s.queries.GetEventOrganizer(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrEventNotFound
	}
	if err != nil {
		return fmt.Errorf("load event organizer: %w", err)
	}
	if !isAdmin && owner != userID {
		return ErrNotEventOrganizer
	}
	return nil
}

type ZonePricing struct {
	BasePrice               int64 `json:"basePrice"`
	FloorPrice              int64 `json:"floorPrice"`
	CeilingPrice            int64 `json:"ceilingPrice"`
	IsDynamicPricingEnabled *bool `json:"isDynamicPricingEnabled,omitempty"`
}

// NormalizeZonePricing validates and normalizes a zone pricing update for either
// fixed pricing (floor == base == ceiling) or dynamic pricing (floor <= base <= ceiling).
func NormalizeZonePricing(p ZonePricing, currentDynamic bool) (ZonePricing, bool, error) {
	dynamicEnabled := currentDynamic
	if p.IsDynamicPricingEnabled != nil {
		dynamicEnabled = *p.IsDynamicPricingEnabled
	}
	if p.BasePrice < 0 {
		return ZonePricing{}, false, ErrInvalidPriceBounds
	}
	if !dynamicEnabled {
		p.FloorPrice = p.BasePrice
		p.CeilingPrice = p.BasePrice
	} else if p.FloorPrice < 0 || p.FloorPrice > p.BasePrice || p.BasePrice > p.CeilingPrice {
		return ZonePricing{}, false, ErrInvalidPriceBounds
	}
	p.IsDynamicPricingEnabled = &dynamicEnabled
	return p, dynamicEnabled, nil
}

func numeric(v int64) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(v), Valid: true}
}

// UpdateZonePricing sets a zone's pricing mode (fixed or dynamic) along with floor,
// ceiling and base price. A new base price reprices the zone's available seats and
// is written to the price log.
func (s *OrganizerService) UpdateZonePricing(ctx context.Context, eventID, zoneID, userID pgtype.UUID, p ZonePricing) (*ZonePricing, error) {
	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	current, err := qtx.GetEventZoneForUpdate(ctx, store.GetEventZoneForUpdateParams{EventID: eventID, ZoneID: zoneID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrZoneNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load event zone: %w", err)
	}

	normalized, dynamicEnabled, err := NormalizeZonePricing(p, current.IsDynamicPricingEnabled)
	if err != nil {
		return nil, err
	}

	if _, err := qtx.UpdateEventZonePricing(ctx, store.UpdateEventZonePricingParams{
		EventID:                 eventID,
		ZoneID:                  zoneID,
		BasePrice:               numeric(normalized.BasePrice),
		FloorPrice:              numeric(normalized.FloorPrice),
		CeilingPrice:            numeric(normalized.CeilingPrice),
		IsDynamicPricingEnabled: dynamicEnabled,
	}); err != nil {
		return nil, fmt.Errorf("update zone pricing: %w", err)
	}

	oldBase, err := current.BasePrice.Int64Value()
	if err != nil {
		return nil, fmt.Errorf("read base price: %w", err)
	}
	if oldBase.Int64 != normalized.BasePrice {
		if _, err := qtx.RepriceAvailableZoneSeats(ctx, store.RepriceAvailableZoneSeatsParams{
			EventID:      eventID,
			ZoneID:       zoneID,
			CurrentPrice: numeric(normalized.BasePrice),
		}); err != nil {
			return nil, fmt.Errorf("reprice seats: %w", err)
		}
		if err := qtx.InsertPriceChange(ctx, store.InsertPriceChangeParams{
			EventID:   eventID,
			ZoneID:    zoneID,
			OldPrice:  current.BasePrice,
			NewPrice:  numeric(normalized.BasePrice),
			ChangedBy: userID,
			Reason:    "MANUAL",
		}); err != nil {
			return nil, fmt.Errorf("log price change: %w", err)
		}
	}

	// Held seats keep the price their holder saw; they take the new base price
	// when they return to sale.

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit pricing: %w", err)
	}
	return &normalized, nil
}

type ZoneSalesSummaryDTO struct {
	ZoneID                  string  `json:"zoneId"`
	ZoneCode                string  `json:"zoneCode"`
	ZoneName                string  `json:"zoneName"`
	Kind                    string  `json:"kind"`
	Capacity                int     `json:"capacity"`
	Sold                    int     `json:"sold"`
	Held                    int     `json:"held"`
	Available               int     `json:"available"`
	FillRate                float64 `json:"fillRate"`
	BasePrice               int64   `json:"basePrice"`
	FloorPrice              int64   `json:"floorPrice"`
	CeilingPrice            int64   `json:"ceilingPrice"`
	IsDynamicPricingEnabled bool    `json:"isDynamicPricingEnabled"`
	RealizedRevenue         int64   `json:"realizedRevenue"`
	HeldPipelineRevenue     int64   `json:"heldPipelineRevenue"`
	PotentialRevenue        int64   `json:"potentialRevenue"`
	PriceHeadroomPct        float64 `json:"priceHeadroomPct"`
}

func textOrNull(s string) pgtype.Text {
	if strings.TrimSpace(s) == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: s, Valid: true}
}

// CreateEvent creates a venue (with custom stage/layout JSONB), event, zones, and
// generated seat inventory atomically in one PostgreSQL transaction.
func (s *OrganizerService) CreateEvent(ctx context.Context, organizerID pgtype.UUID, req CreateOrganizerEventRequest) (*CreatedOrganizerEventDTO, error) {
	v, err := ValidateCreateOrganizerEvent(req)
	if err != nil {
		return nil, err
	}

	layoutBytes, err := json.Marshal(v.LayoutConfig)
	if err != nil {
		return nil, fmt.Errorf("marshal layout config: %w", err)
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin create event tx: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	baseSlug := slugifyEventName(v.Name)
	slug := baseSlug
	for attempt := 0; attempt < 6; attempt++ {
		exists, err := qtx.EventSlugExists(ctx, slug)
		if err != nil {
			return nil, fmt.Errorf("check event slug: %w", err)
		}
		if !exists {
			break
		}
		slug = fmt.Sprintf("%s-%s", baseSlug, randomHexSuffix(2))
	}

	venue, err := qtx.CreateVenue(ctx, store.CreateVenueParams{
		Name:         v.VenueName,
		Address:      textOrNull(v.VenueAddress),
		Timezone:     "Asia/Ho_Chi_Minh",
		LayoutConfig: layoutBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("create venue: %w", err)
	}

	ev, err := qtx.CreateEvent(ctx, store.CreateEventParams{
		OrganizerID:        organizerID,
		VenueID:            venue.ID,
		Name:               v.Name,
		Slug:               slug,
		Description:        textOrNull(v.Description),
		Genre:              textOrNull(v.Genre),
		ImageUrl:           textOrNull(v.ImageURL),
		ImageCredit:        textOrNull(v.ImageCredit),
		City:               textOrNull(v.City),
		StartsAt:           pgtype.Timestamptz{Time: v.StartsAt, Valid: true},
		EndsAt:             pgtype.Timestamptz{Time: v.EndsAt, Valid: true},
		Status:             v.Status,
		MaxTicketsPerUser:  v.MaxTicketsPerUser,
		WaitingRoomEnabled: v.WaitingRoomEnabled,
	})
	if err != nil {
		return nil, fmt.Errorf("create event: %w", err)
	}

	for zIdx, z := range v.Zones {
		capCount := int32(z.Rows * z.SeatsPerRow)
		vz, err := qtx.CreateVenueZone(ctx, store.CreateVenueZoneParams{
			VenueID:  venue.ID,
			Code:     z.Code,
			Name:     z.Name,
			Floor:    textOrNull(z.Floor),
			Capacity: capCount,
			ZoneKind: z.Kind,
		})
		if err != nil {
			return nil, fmt.Errorf("create venue zone %s: %w", z.Code, err)
		}

		if _, err := qtx.CreateEventZone(ctx, store.CreateEventZoneParams{
			EventID:                 ev.ID,
			ZoneID:                  vz.ID,
			BasePrice:               numeric(z.BasePrice),
			FloorPrice:              numeric(z.FloorPrice),
			CeilingPrice:            numeric(z.CeilingPrice),
			IsDynamicPricingEnabled: z.IsDynamicPricingEnabled,
		}); err != nil {
			return nil, fmt.Errorf("create event zone %s: %w", z.Code, err)
		}

		for r := 1; r <= z.Rows; r++ {
			rowLabel := string(rune('A' + r - 1))
			for n := 1; n <= z.SeatsPerRow; n++ {
				seatNum := strconv.Itoa(n)
				seatLabel := rowLabel + seatNum
				seat, err := qtx.CreateSeat(ctx, store.CreateSeatParams{
					ZoneID:     vz.ID,
					RowLabel:   pgtype.Text{String: rowLabel, Valid: true},
					SeatNumber: pgtype.Text{String: seatNum, Valid: true},
					SeatLabel:  seatLabel,
					XPosition:  numeric(int64(n)),
					YPosition:  numeric(int64(zIdx*14 + r)),
				})
				if err != nil {
					return nil, fmt.Errorf("create seat %s/%s: %w", z.Code, seatLabel, err)
				}
				if err := qtx.CreateEventSeat(ctx, store.CreateEventSeatParams{
					EventID:      ev.ID,
					SeatID:       seat.ID,
					CurrentPrice: numeric(z.BasePrice),
				}); err != nil {
					return nil, fmt.Errorf("create event seat %s/%s: %w", z.Code, seatLabel, err)
				}
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit create event: %w", err)
	}

	return &CreatedOrganizerEventDTO{
		ID:            store.UUIDToString(ev.ID),
		Name:          ev.Name,
		Slug:          ev.Slug,
		Status:        string(ev.Status),
		StartsAt:      ev.StartsAt.Time.Format(time.RFC3339),
		EndsAt:        ev.EndsAt.Time.Format(time.RFC3339),
		ImageURL:      ev.ImageUrl.String,
		VenueName:     venue.Name,
		City:          ev.City.String,
		ZoneCount:     len(v.Zones),
		TotalCapacity: v.TotalCapacity,
		LayoutConfig:  v.LayoutConfig,
	}, nil
}

// UpdateEventLayout persists a new stage and venue layout design for an existing event.
func (s *OrganizerService) UpdateEventLayout(ctx context.Context, eventID pgtype.UUID, cfg StageLayoutConfig) (*StageLayoutConfig, error) {
	sanitized := SanitizeStageLayoutConfig(&cfg)
	raw, err := json.Marshal(sanitized)
	if err != nil {
		return nil, fmt.Errorf("marshal layout config: %w", err)
	}
	if _, err := s.queries.UpdateVenueLayoutConfigByEvent(ctx, store.UpdateVenueLayoutConfigByEventParams{
		ID:           eventID,
		LayoutConfig: raw,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrEventNotFound
		}
		return nil, fmt.Errorf("update venue layout config: %w", err)
	}
	return &sanitized, nil
}

type EventSalesSummaryDTO struct {
	EventID             string                `json:"eventId"`
	EventName           string                `json:"eventName"`
	Slug                string                `json:"slug"`
	City                string                `json:"city"`
	VenueName           string                `json:"venueName"`
	StartsAt            string                `json:"startsAt"`
	LayoutConfig        json.RawMessage       `json:"layoutConfig,omitempty"`
	TotalCapacity       int                   `json:"totalCapacity"`
	SoldCount           int                   `json:"soldCount"`
	HeldCount           int                   `json:"heldCount"`
	AvailableCount      int                   `json:"availableCount"`
	FillRate            float64               `json:"fillRate"`
	RealizedRevenue     int64                 `json:"realizedRevenue"`
	HeldPipelineRevenue int64                 `json:"heldPipelineRevenue"`
	PotentialRevenue    int64                 `json:"potentialRevenue"`
	RemainingRevenue    int64                 `json:"remainingRevenue"`
	StandingFillRate    float64               `json:"standingFillRate"`
	SeatedFillRate      float64               `json:"seatedFillRate"`
	HotZones            []string              `json:"hotZones"`
	SlowZones           []string              `json:"slowZones"`
	Zones               []ZoneSalesSummaryDTO `json:"zones"`
}

func isStandingZoneName(name string) bool {
	return strings.Contains(strings.ToLower(name), "đứng")
}

// GetEventSalesSummary aggregates live seat occupancy, realized/pipeline revenue,
// and pricing corridor headroom for an organizer's event directly from PostgreSQL.
func (s *OrganizerService) GetEventSalesSummary(ctx context.Context, eventID pgtype.UUID) (*EventSalesSummaryDTO, error) {
	ev, err := s.queries.GetEventByID(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEventNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load event for sales summary: %w", err)
	}

	zones, err := s.queries.ListEventZonesWithPrices(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load event zones for sales summary: %w", err)
	}
	seats, err := s.queries.GetEventSeatMap(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load seat map for sales summary: %w", err)
	}

	type seatAgg struct {
		total     int
		sold      int
		held      int
		available int
		soldRev   int64
		heldRev   int64
		availRev  int64
	}
	byZone := make(map[string]*seatAgg, len(zones))
	for _, st := range seats {
		zid := store.UUIDToString(st.ZoneID)
		agg := byZone[zid]
		if agg == nil {
			agg = &seatAgg{}
			byZone[zid] = agg
		}
		priceVal, _ := st.CurrentPrice.Int64Value()
		price := priceVal.Int64
		agg.total++
		switch st.Status {
		case store.SeatStatusSOLD:
			agg.sold++
			agg.soldRev += price
		case store.SeatStatusHELD:
			agg.held++
			agg.heldRev += price
		case store.SeatStatusAVAILABLE:
			agg.available++
			agg.availRev += price
		}
	}

	out := &EventSalesSummaryDTO{
		EventID:      store.UUIDToString(ev.ID),
		EventName:    ev.Name,
		Slug:         ev.Slug,
		City:         ev.City.String,
		VenueName:    ev.VenueName,
		StartsAt:     ev.StartsAt.Time.Format(time.RFC3339),
		LayoutConfig: rawLayoutConfig(ev.VenueLayoutConfig),
		HotZones:     []string{},
		SlowZones:    []string{},
		Zones:        make([]ZoneSalesSummaryDTO, 0, len(zones)),
	}

	var standingTotal, standingTaken, seatedTotal, seatedTaken int

	for _, z := range zones {
		zid := store.UUIDToString(z.ZoneID)
		baseVal, _ := z.BasePrice.Int64Value()
		floorVal, _ := z.FloorPrice.Int64Value()
		ceilVal, _ := z.CeilingPrice.Int64Value()
		basePrice := baseVal.Int64
		floorPrice := floorVal.Int64
		ceilPrice := ceilVal.Int64

		agg := byZone[zid]
		capCount := int(z.Capacity)
		sold, held, avail := 0, 0, capCount
		var soldRev, heldRev, potRev int64
		if agg != nil && agg.total > 0 {
			capCount = agg.total
			sold = agg.sold
			held = agg.held
			avail = agg.available
			soldRev = agg.soldRev
			heldRev = agg.heldRev
			potRev = agg.soldRev + agg.heldRev + agg.availRev
		} else {
			potRev = int64(capCount) * basePrice
		}

		fill := 0.0
		if capCount > 0 {
			fill = float64(sold+held) / float64(capCount)
		}
		headroom := 0.0
		if basePrice > 0 && ceilPrice > basePrice {
			headroom = float64(ceilPrice-basePrice) / float64(basePrice)
		}

		kind := "seated"
		if z.ZoneKind == "standing" || (z.ZoneKind == "" && isStandingZoneName(z.ZoneName)) {
			kind = "standing"
			standingTotal += capCount
			standingTaken += sold + held
		} else {
			seatedTotal += capCount
			seatedTaken += sold + held
		}

		if fill >= 0.70 {
			out.HotZones = append(out.HotZones, z.ZoneName)
		} else if fill < 0.20 {
			out.SlowZones = append(out.SlowZones, z.ZoneName)
		}

		out.TotalCapacity += capCount
		out.SoldCount += sold
		out.HeldCount += held
		out.AvailableCount += avail
		out.RealizedRevenue += soldRev
		out.HeldPipelineRevenue += heldRev
		out.PotentialRevenue += potRev

		out.Zones = append(out.Zones, ZoneSalesSummaryDTO{
			ZoneID:                  zid,
			ZoneCode:                z.Code,
			ZoneName:                z.ZoneName,
			Kind:                    kind,
			Capacity:                capCount,
			Sold:                    sold,
			Held:                    held,
			Available:               avail,
			FillRate:                fill,
			BasePrice:               basePrice,
			FloorPrice:              floorPrice,
			CeilingPrice:            ceilPrice,
			IsDynamicPricingEnabled: z.IsDynamicPricingEnabled,
			RealizedRevenue:         soldRev,
			HeldPipelineRevenue:     heldRev,
			PotentialRevenue:        potRev,
			PriceHeadroomPct:        headroom,
		})
	}

	sort.Slice(out.Zones, func(i, j int) bool {
		return out.Zones[i].BasePrice > out.Zones[j].BasePrice
	})

	if out.TotalCapacity > 0 {
		out.FillRate = float64(out.SoldCount+out.HeldCount) / float64(out.TotalCapacity)
	}
	if standingTotal > 0 {
		out.StandingFillRate = float64(standingTaken) / float64(standingTotal)
	}
	if seatedTotal > 0 {
		out.SeatedFillRate = float64(seatedTaken) / float64(seatedTotal)
	}
	out.RemainingRevenue = out.PotentialRevenue - out.RealizedRevenue
	if out.RemainingRevenue < 0 {
		out.RemainingRevenue = 0
	}
	return out, nil
}

type OrganizerSalesOverviewDTO struct {
	EventCount          int                    `json:"eventCount"`
	TotalCapacity       int                    `json:"totalCapacity"`
	SoldCount           int                    `json:"soldCount"`
	HeldCount           int                    `json:"heldCount"`
	AvailableCount      int                    `json:"availableCount"`
	FillRate            float64                `json:"fillRate"`
	RealizedRevenue     int64                  `json:"realizedRevenue"`
	HeldPipelineRevenue int64                  `json:"heldPipelineRevenue"`
	PotentialRevenue    int64                  `json:"potentialRevenue"`
	RemainingRevenue    int64                  `json:"remainingRevenue"`
	Events              []EventSalesSummaryDTO `json:"events"`
}

// GetSalesOverview aggregates live sales summaries across every event owned by the caller.
func (s *OrganizerService) GetSalesOverview(ctx context.Context, userID pgtype.UUID, isAdmin bool) (*OrganizerSalesOverviewDTO, error) {
	rows, err := s.queries.ListOrganizerEvents(ctx, store.ListOrganizerEventsParams{IsAdmin: isAdmin, OrganizerID: userID})
	if err != nil {
		return nil, fmt.Errorf("list organizer events for overview: %w", err)
	}

	overview := &OrganizerSalesOverviewDTO{
		Events: make([]EventSalesSummaryDTO, 0, len(rows)),
	}
	for _, row := range rows {
		summary, err := s.GetEventSalesSummary(ctx, row.ID)
		if err != nil {
			return nil, err
		}
		overview.EventCount++
		overview.TotalCapacity += summary.TotalCapacity
		overview.SoldCount += summary.SoldCount
		overview.HeldCount += summary.HeldCount
		overview.AvailableCount += summary.AvailableCount
		overview.RealizedRevenue += summary.RealizedRevenue
		overview.HeldPipelineRevenue += summary.HeldPipelineRevenue
		overview.PotentialRevenue += summary.PotentialRevenue
		overview.RemainingRevenue += summary.RemainingRevenue
		overview.Events = append(overview.Events, *summary)
	}
	if overview.TotalCapacity > 0 {
		overview.FillRate = float64(overview.SoldCount+overview.HeldCount) / float64(overview.TotalCapacity)
	}
	return overview, nil
}
