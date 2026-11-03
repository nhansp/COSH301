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

func (s *EventService) GetEventDetailBySlug(ctx context.Context, slug string) (*EventDetailDTO, error) {
	e, err := s.queries.GetEventBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}

	zones, err := s.queries.ListEventZonesWithPrices(ctx, e.ID)
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
		ID:                 store.UUIDToString(e.ID),
		Name:               e.Name,
		Slug:               e.Slug,
		Description:        e.Description.String,
		Genre:              e.Genre.String,
		ImageURL:           e.ImageUrl.String,
		City:               e.City.String,
		VenueName:          e.VenueName,
		VenueAddress:       e.VenueAddress.String,
		VenueTimezone:      e.VenueTimezone,
		StartsAt:           e.StartsAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		EndsAt:             e.EndsAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		Status:             string(e.Status),
		MaxTicketsPerUser:  e.MaxTicketsPerUser,
		WaitingRoomEnabled: e.WaitingRoomEnabled,
		Zones:              zoneDTOs,
	}

	return dto, nil
}

func (s *EventService) GetEventByID(ctx context.Context, id pgtype.UUID) (store.GetEventByIDRow, error) {
	return s.queries.GetEventByID(ctx, id)
}
