package service

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/pricing"
	"eventticketing/internal/recommend"
	"eventticketing/internal/store"
)

// RecommendationService ranks events for a user and reports the interest an
// event draws, which the pricing engine uses as a demand signal.
type RecommendationService struct {
	queries *store.Queries
}

func NewRecommendationService(queries *store.Queries) *RecommendationService {
	return &RecommendationService{queries: queries}
}

// RecordView notes that a signed-in user looked at an event.
func (s *RecommendationService) RecordView(ctx context.Context, eventID, userID pgtype.UUID) error {
	if err := s.queries.RecordEventView(ctx, store.RecordEventViewParams{EventID: eventID, UserID: userID}); err != nil {
		return fmt.Errorf("record view: %w", err)
	}
	return nil
}

type RecommendedEventDTO struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	Genre     string `json:"genre"`
	City      string `json:"city"`
	ImageURL  string `json:"imageUrl"`
	StartsAt  string `json:"startsAt"`
	VenueName string `json:"venueName"`
	PriceFrom int64  `json:"priceFrom"`
	recommend.Scored
}

// Recommend returns up to limit events for the user. An invalid userID, or a
// user without history, gets the most popular events.
func (s *RecommendationService) Recommend(ctx context.Context, userID pgtype.UUID, limit int) ([]RecommendedEventDTO, error) {
	events, err := s.queries.ListRecommendationCandidates(ctx)
	if err != nil {
		return nil, fmt.Errorf("list candidates: %w", err)
	}
	zoneRows, err := s.queries.ListCandidateZones(ctx)
	if err != nil {
		return nil, fmt.Errorf("list candidate zones: %w", err)
	}

	zones := make(map[pgtype.UUID][]recommend.ZoneOffer)
	for _, z := range zoneRows {
		price, err := int64Of(z.BasePrice)
		if err != nil {
			return nil, err
		}
		zones[z.EventID] = append(zones[z.EventID], recommend.ZoneOffer{
			ZoneID: store.UUIDToString(z.ZoneID), Code: z.ZoneCode, Name: z.ZoneName,
			Price: price, Capacity: z.Capacity, Available: z.Available,
		})
	}

	var profile recommend.Profile
	bought := map[pgtype.UUID]bool{}
	if userID.Valid {
		if profile, err = s.profile(ctx, userID); err != nil {
			return nil, err
		}
		owned, err := s.queries.ListUserPurchasedEvents(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("list purchased events: %w", err)
		}
		for _, id := range owned {
			bought[id] = true
		}
	}

	byID := make(map[string]store.ListRecommendationCandidatesRow, len(events))
	cands := make([]recommend.Candidate, 0, len(events))
	for _, e := range events {
		if bought[e.ID] {
			continue
		}
		id := store.UUIDToString(e.ID)
		byID[id] = e
		cands = append(cands, recommend.Candidate{
			EventID: id, Genre: e.Genre, City: e.City, Zones: zones[e.ID],
			Views7d: e.Views7d, Holds7d: e.Holds7d, Sales7d: e.Sales7d,
		})
	}

	ranked := recommend.Rank(profile, cands, limit)
	out := make([]RecommendedEventDTO, 0, len(ranked))
	for _, r := range ranked {
		e := byID[r.EventID]
		var from int64
		for _, z := range zones[e.ID] {
			if from == 0 || z.Price < from {
				from = z.Price
			}
		}
		out = append(out, RecommendedEventDTO{
			ID: r.EventID, Slug: e.Slug, Name: e.Name, Genre: e.Genre, City: e.City,
			ImageURL: e.ImageUrl, StartsAt: e.StartsAt.Time.Format(time.RFC3339), VenueName: e.VenueName,
			PriceFrom: from, Scored: r,
		})
	}
	return out, nil
}

func (s *RecommendationService) profile(ctx context.Context, userID pgtype.UUID) (recommend.Profile, error) {
	p := recommend.Profile{Genres: map[string]float64{}, Cities: map[string]float64{}}
	taste, err := s.queries.ListUserTaste(ctx, userID)
	if err != nil {
		return p, fmt.Errorf("load taste: %w", err)
	}
	for _, t := range taste {
		p.Interactions += t.Interactions
		if t.Genre != "" {
			p.Genres[t.Genre] += t.Weight
		}
		if t.City != "" {
			p.Cities[t.City] += t.Weight
		}
	}
	price, err := s.queries.GetUserTypicalPrice(ctx, userID)
	if err != nil {
		return p, fmt.Errorf("load typical price: %w", err)
	}
	p.TypicalPrice = price.TypicalPrice
	return p, nil
}

// EventInterest is the demand insight the pricing engine reads.
func (s *RecommendationService) EventInterest(ctx context.Context, eventID pgtype.UUID) (pricing.Interest, error) {
	i, err := s.queries.GetEventInterest(ctx, eventID)
	if err != nil {
		return pricing.Interest{}, fmt.Errorf("load event interest: %w", err)
	}
	return pricing.Interest{
		Views24h:         i.Views24h,
		Holds24h:         i.Holds24h,
		PlatformViews30d: i.PlatformViews30d,
		PlatformHolds30d: i.PlatformHolds30d,
	}, nil
}
