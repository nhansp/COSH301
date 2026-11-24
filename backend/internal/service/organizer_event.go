package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/store"
)

// ErrVenueShared means the venue belongs to other events too, so one event cannot rename it.
var ErrVenueShared = errors.New("venue_shared")

// FieldError names the field an event update rejected.
type FieldError struct{ Field string }

func (e *FieldError) Error() string { return "invalid_event_field: " + e.Field }

// Statuses an organizer may set. SOLD_OUT is included so a sale can be closed as sold out by hand.
var editableStatuses = map[store.EventStatus]bool{
	store.EventStatusDRAFT: true, store.EventStatusONSALE: true, store.EventStatusPAUSED: true,
	store.EventStatusSOLDOUT: true, store.EventStatusENDED: true, store.EventStatusCANCELLED: true,
}

type ZoneInventoryDTO struct {
	ZoneID         string `json:"zoneId"`
	ZoneCode       string `json:"zoneCode"`
	ZoneName       string `json:"zoneName"`
	Floor          string `json:"floor,omitempty"`
	BasePrice      int64  `json:"basePrice"`
	FloorPrice     int64  `json:"floorPrice"`
	CeilingPrice   int64  `json:"ceilingPrice"`
	DynamicPricing bool   `json:"dynamicPricing"`
	Capacity       int64  `json:"capacity"`
	Available      int64  `json:"available"`
	Held           int64  `json:"held"`
	Sold           int64  `json:"sold"`
}

// OrganizerEventDetailDTO is everything the organizer can see and edit about one event.
type OrganizerEventDetailDTO struct {
	EventInfo
	ID          string             `json:"id"`
	Slug        string             `json:"slug"`
	VenueShared bool               `json:"venueShared"`
	UpdatedAt   string             `json:"updatedAt"`
	Zones       []ZoneInventoryDTO `json:"zones"`
}

// EventInfo is the editable part of an event.
type EventInfo struct {
	Name              string  `json:"name"`
	Description       string  `json:"description"`
	Genre             string  `json:"genre"`
	ImageURL          string  `json:"imageUrl"`
	ImageCredit       string  `json:"imageCredit"`
	City              string  `json:"city"`
	StartsAt          string  `json:"startsAt"`
	EndsAt            string  `json:"endsAt"`
	SalesStartsAt     *string `json:"salesStartsAt"`
	SalesEndsAt       *string `json:"salesEndsAt"`
	Status            string  `json:"status"`
	MaxTicketsPerUser int32   `json:"maxTicketsPerUser"`
	VenueName         string  `json:"venueName"`
	VenueAddress      string  `json:"venueAddress"`
}

// GetEvent returns one event for its organizer.
func (s *OrganizerService) GetEvent(ctx context.Context, eventID pgtype.UUID) (*OrganizerEventDetailDTO, error) {
	e, err := s.queries.GetOrganizerEvent(ctx, eventID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEventNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load event: %w", err)
	}
	zones, err := s.queries.ListEventZoneInventory(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load zones: %w", err)
	}

	out := &OrganizerEventDetailDTO{
		ID: store.UUIDToString(e.ID), Slug: e.Slug,
		VenueShared: e.VenueEvents > 1,
		UpdatedAt:   e.UpdatedAt.Time.Format(time.RFC3339),
		EventInfo: EventInfo{
			Name: e.Name, Description: e.Description.String, Genre: e.Genre.String,
			ImageURL: e.ImageUrl.String, ImageCredit: e.ImageCredit.String, City: e.City.String,
			StartsAt: e.StartsAt.Time.Format(time.RFC3339), EndsAt: e.EndsAt.Time.Format(time.RFC3339),
			SalesStartsAt: optionalTime(e.SalesStartsAt), SalesEndsAt: optionalTime(e.SalesEndsAt),
			Status: string(e.Status), MaxTicketsPerUser: e.MaxTicketsPerUser,
			VenueName: e.VenueName, VenueAddress: e.VenueAddress.String,
		},
	}
	for _, z := range zones {
		dto := ZoneInventoryDTO{
			ZoneID: store.UUIDToString(z.ZoneID), ZoneCode: z.ZoneCode, ZoneName: z.ZoneName, Floor: z.Floor.String,
			DynamicPricing: z.IsDynamicPricingEnabled,
			Capacity:       z.Capacity, Available: z.Available, Held: z.Held, Sold: z.Sold,
		}
		if dto.BasePrice, err = int64Of(z.BasePrice); err != nil {
			return nil, err
		}
		if dto.FloorPrice, err = int64Of(z.FloorPrice); err != nil {
			return nil, err
		}
		if dto.CeilingPrice, err = int64Of(z.CeilingPrice); err != nil {
			return nil, err
		}
		out.Zones = append(out.Zones, dto)
	}
	return out, nil
}

// UpdateEvent saves an event's editable information and records the change in
// the audit log. The venue's name and address can only change when no other
// event uses that venue.
func (s *OrganizerService) UpdateEvent(ctx context.Context, eventID, userID pgtype.UUID, in EventInfo) (*OrganizerEventDetailDTO, error) {
	p, err := validateEventInfo(in)
	if err != nil {
		return nil, err
	}

	tx, err := s.dbPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := s.queries.WithTx(tx)

	if _, err := qtx.LockEvent(ctx, eventID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrEventNotFound
	} else if err != nil {
		return nil, fmt.Errorf("lock event: %w", err)
	}
	before, err := qtx.GetOrganizerEvent(ctx, eventID)
	if err != nil {
		return nil, fmt.Errorf("load event: %w", err)
	}

	venueName, venueAddress := strings.TrimSpace(in.VenueName), strings.TrimSpace(in.VenueAddress)
	if venueName != before.VenueName || venueAddress != before.VenueAddress.String {
		if before.VenueEvents > 1 {
			return nil, ErrVenueShared
		}
		if err := qtx.UpdateVenueInfo(ctx, store.UpdateVenueInfoParams{
			ID: before.VenueID, Name: venueName, Address: text(venueAddress),
		}); err != nil {
			return nil, fmt.Errorf("update venue: %w", err)
		}
	}

	p.ID = eventID
	if err := qtx.UpdateEventInfo(ctx, p); err != nil {
		return nil, fmt.Errorf("update event: %w", err)
	}

	oldData, _ := json.Marshal(before)
	newData, _ := json.Marshal(in)
	if _, err := qtx.CreateAuditLog(ctx, store.CreateAuditLogParams{
		ActorUserID: userID, EventID: eventID, Action: "EVENT_UPDATED",
		EntityType: "event", EntityID: eventID, OldData: oldData, NewData: newData,
	}); err != nil {
		return nil, fmt.Errorf("audit event update: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit event: %w", err)
	}
	return s.GetEvent(ctx, eventID)
}

func validateEventInfo(in EventInfo) (store.UpdateEventInfoParams, error) {
	var p store.UpdateEventInfoParams
	name := strings.TrimSpace(in.Name)
	switch {
	case name == "" || utf8.RuneCountInString(name) > 255:
		return p, &FieldError{"name"}
	case utf8.RuneCountInString(in.Description) > 10_000:
		return p, &FieldError{"description"}
	case utf8.RuneCountInString(strings.TrimSpace(in.Genre)) > 100:
		return p, &FieldError{"genre"}
	case utf8.RuneCountInString(strings.TrimSpace(in.City)) > 100:
		return p, &FieldError{"city"}
	case !validImageURL(strings.TrimSpace(in.ImageURL)):
		return p, &FieldError{"imageUrl"}
	case utf8.RuneCountInString(in.ImageCredit) > 500:
		return p, &FieldError{"imageCredit"}
	case strings.TrimSpace(in.VenueName) == "" || utf8.RuneCountInString(in.VenueName) > 200:
		return p, &FieldError{"venueName"}
	case utf8.RuneCountInString(in.VenueAddress) > 500:
		return p, &FieldError{"venueAddress"}
	case !editableStatuses[store.EventStatus(in.Status)]:
		return p, &FieldError{"status"}
	case in.MaxTicketsPerUser < 1 || in.MaxTicketsPerUser > 20:
		return p, &FieldError{"maxTicketsPerUser"}
	}

	starts, err := time.Parse(time.RFC3339, in.StartsAt)
	if err != nil {
		return p, &FieldError{"startsAt"}
	}
	ends, err := time.Parse(time.RFC3339, in.EndsAt)
	if err != nil || !ends.After(starts) {
		return p, &FieldError{"endsAt"}
	}
	salesStarts, err := optionalParse(in.SalesStartsAt)
	if err != nil {
		return p, &FieldError{"salesStartsAt"}
	}
	salesEnds, err := optionalParse(in.SalesEndsAt)
	if err != nil || (salesEnds.Valid && salesStarts.Valid && !salesEnds.Time.After(salesStarts.Time)) {
		return p, &FieldError{"salesEndsAt"}
	}
	if salesEnds.Valid && salesEnds.Time.After(ends) {
		return p, &FieldError{"salesEndsAt"}
	}

	return store.UpdateEventInfoParams{
		Name: name, Description: text(strings.TrimSpace(in.Description)), Genre: text(strings.TrimSpace(in.Genre)),
		ImageUrl: text(strings.TrimSpace(in.ImageURL)), ImageCredit: text(strings.TrimSpace(in.ImageCredit)),
		City:          text(strings.TrimSpace(in.City)),
		StartsAt:      pgtype.Timestamptz{Time: starts, Valid: true},
		EndsAt:        pgtype.Timestamptz{Time: ends, Valid: true},
		SalesStartsAt: salesStarts, SalesEndsAt: salesEnds,
		Status: store.EventStatus(in.Status), MaxTicketsPerUser: in.MaxTicketsPerUser,
	}, nil
}

// validImageURL accepts no image, an image served by the site (/events/…) or an http(s) URL.
func validImageURL(v string) bool {
	if v == "" {
		return true
	}
	if len(v) > 2000 {
		return false
	}
	if strings.HasPrefix(v, "/") && !strings.HasPrefix(v, "//") {
		return true
	}
	u, err := url.Parse(v)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != ""
}

func optionalParse(v *string) (pgtype.Timestamptz, error) {
	if v == nil || strings.TrimSpace(*v) == "" {
		return pgtype.Timestamptz{}, nil
	}
	t, err := time.Parse(time.RFC3339, *v)
	if err != nil {
		return pgtype.Timestamptz{}, err
	}
	return pgtype.Timestamptz{Time: t, Valid: true}, nil
}

func optionalTime(t pgtype.Timestamptz) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.Format(time.RFC3339)
	return &s
}

func text(v string) pgtype.Text { return pgtype.Text{String: v, Valid: v != ""} }
