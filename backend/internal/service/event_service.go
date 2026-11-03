package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"eventticketing/internal/store"
)

type EventService struct {
	queries *store.Queries
}

func NewEventService(queries *store.Queries) *EventService {
	return &EventService{queries: queries}
}

type EventDetailDTO struct {
	ID                 string                  `json:"id"`
	Name               string                  `json:"name"`
	Slug               string                  `json:"slug"`
	Description        string                  `json:"description"`
	Genre              string                  `json:"genre"`
	ImageURL           string                  `json:"imageUrl"`
	City               string                  `json:"city"`
	VenueName          string                  `json:"venueName"`
	VenueAddress       string                  `json:"venueAddress"`
	VenueTimezone      string                  `json:"venueTimezone"`
	StartsAt           string                  `json:"startsAt"`
	EndsAt             string                  `json:"endsAt"`
	Status             string                  `json:"status"`
	MaxTicketsPerUser  int32                   `json:"maxTicketsPerUser"`
	WaitingRoomEnabled bool                    `json:"waitingRoomEnabled"`
	Zones              []EventZonePriceDTO     `json:"zones"`
}

type EventZonePriceDTO struct {
	ZoneID                  string `json:"zoneId"`
	ZoneCode                string `json:"zoneCode"`
	ZoneName                string `json:"zoneName"`
	Floor                   string `json:"floor"`
	Capacity                int32  `json:"capacity"`
	BasePrice               int64  `json:"basePrice"`
	FloorPrice              int64  `json:"floorPrice"`
	CeilingPrice            int64  `json:"ceilingPrice"`
	IsDynamicPricingEnabled bool   `json:"isDynamicPricingEnabled"`
}

func (s *EventService) ListEvents(ctx context.Context) ([]store.ListPublishedEventsRow, error) {
	return s.queries.ListPublishedEvents(ctx)
}

func (s *EventService) buildEventDetailDTO(
	ctx context.Context,
	id pgtype.UUID,
	name, slug string,
	desc, genre, img, city pgtype.Text,
	venueName string,
	venueAddress pgtype.Text,
	venueTimezone string,
	startsAt, endsAt pgtype.Timestamptz,
	status string,
	maxTickets int32,
	waitingRoom bool,
) (*EventDetailDTO, error) {
	zones, err := s.queries.ListEventZonesWithPrices(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch event zones: %w", err)
	}

	zoneDTOs := make([]EventZonePriceDTO, 0, len(zones))
	for _, z := range zones {
		basePrice, _ := z.BasePrice.Int64Value()
		floorPrice, _ := z.FloorPrice.Int64Value()
		ceilPrice, _ := z.CeilingPrice.Int64Value()

		zoneDTOs = append(zoneDTOs, EventZonePriceDTO{
			ZoneID:                  store.UUIDToString(z.ZoneID),
			ZoneCode:                z.Code,
			ZoneName:                z.ZoneName,
			Floor:                   z.Floor.String,
			Capacity:                z.Capacity,
			BasePrice:               basePrice.Int64,
			FloorPrice:              floorPrice.Int64,
			CeilingPrice:            ceilPrice.Int64,
			IsDynamicPricingEnabled: z.IsDynamicPricingEnabled,
		})
	}

	dto := &EventDetailDTO{
		ID:                 store.UUIDToString(id),
		Name:               name,
		Slug:               slug,
		Description:        desc.String,
		Genre:              genre.String,
		ImageURL:           img.String,
		City:               city.String,
		VenueName:          venueName,
		VenueAddress:       venueAddress.String,
		VenueTimezone:      venueTimezone,
		StartsAt:           startsAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		EndsAt:             endsAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		Status:             status,
		MaxTicketsPerUser:  maxTickets,
		WaitingRoomEnabled: waitingRoom,
		Zones:              zoneDTOs,
	}

	return dto, nil
}

// GetEventDetail retrieves event detail by either UUID or slug string.
func (s *EventService) GetEventDetail(ctx context.Context, identifier string) (*EventDetailDTO, error) {
	if uid, err := store.StringToUUID(identifier); err == nil {
		e, err := s.queries.GetEventByID(ctx, uid)
		if err == nil {
			return s.buildEventDetailDTO(ctx, e.ID, e.Name, e.Slug, e.Description, e.Genre, e.ImageUrl, e.City, e.VenueName, e.VenueAddress, e.VenueTimezone, e.StartsAt, e.EndsAt, string(e.Status), e.MaxTicketsPerUser, e.WaitingRoomEnabled)
		}
	}

	e, err := s.queries.GetEventBySlug(ctx, identifier)
	if err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}
	return s.buildEventDetailDTO(ctx, e.ID, e.Name, e.Slug, e.Description, e.Genre, e.ImageUrl, e.City, e.VenueName, e.VenueAddress, e.VenueTimezone, e.StartsAt, e.EndsAt, string(e.Status), e.MaxTicketsPerUser, e.WaitingRoomEnabled)
}

// ResolveEventID resolves an identifier (UUID or slug) to a pgtype.UUID.
func (s *EventService) ResolveEventID(ctx context.Context, identifier string) (pgtype.UUID, error) {
	if uid, err := store.StringToUUID(identifier); err == nil {
		return uid, nil
	}
	e, err := s.queries.GetEventBySlug(ctx, identifier)
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("event not found: %w", err)
	}
	return e.ID, nil
}

func (s *EventService) GetEventDetailBySlug(ctx context.Context, slug string) (*EventDetailDTO, error) {
	return s.GetEventDetail(ctx, slug)
}

func (s *EventService) GetEventByID(ctx context.Context, id pgtype.UUID) (store.GetEventByIDRow, error) {
	return s.queries.GetEventByID(ctx, id)
}
