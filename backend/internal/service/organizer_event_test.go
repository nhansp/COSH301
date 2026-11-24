package service

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestUpdateEvent_SavesAndShowsOnTheCustomerPage(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	events := NewEventService(f.q)

	before, err := f.organizer.GetEvent(ctx, f.eventID)
	if err != nil {
		t.Fatal(err)
	}
	var eventsBefore int64
	mustScan(t, f.pool, `SELECT count(*) FROM events`, []any{&eventsBefore})

	in := before.EventInfo
	in.Name = "Đêm nhạc đã sửa"
	in.Description = "Mô tả mới"
	in.Genre = "Ballad"
	in.ImageURL = "/events/new-poster.jpg"
	starts := time.Now().Add(72 * time.Hour).Truncate(time.Minute)
	in.StartsAt = starts.Format(time.RFC3339)
	in.EndsAt = starts.Add(3 * time.Hour).Format(time.RFC3339)
	in.MaxTicketsPerUser = 6

	after, err := f.organizer.UpdateEvent(ctx, f.eventID, f.ownerID, in)
	if err != nil {
		t.Fatal(err)
	}
	if after.Name != in.Name || after.Genre != "Ballad" || after.MaxTicketsPerUser != 6 || after.Slug != before.Slug {
		t.Fatalf("update not saved as sent: %+v", after.EventInfo)
	}

	var eventsAfter, audits int64
	mustScan(t, f.pool, `SELECT count(*) FROM events`, []any{&eventsAfter})
	mustScan(t, f.pool, `SELECT count(*) FROM audit_logs WHERE event_id = $1 AND action = 'EVENT_UPDATED'`, []any{&audits}, f.eventID)
	if eventsAfter != eventsBefore || audits != 1 {
		t.Fatalf("events %d → %d, audit rows %d", eventsBefore, eventsAfter, audits)
	}

	public, err := events.GetEventDetail(ctx, before.Slug)
	if err != nil {
		t.Fatal(err)
	}
	if public.Name != in.Name || public.Description != "Mô tả mới" || public.ImageURL != "/events/new-poster.jpg" {
		t.Fatalf("customer page shows old data: %s / %s", public.Name, public.ImageURL)
	}
}

func TestUpdateEvent_RejectsBadInput(t *testing.T) {
	f := newPricingFixture(t)
	ctx := context.Background()
	before, err := f.organizer.GetEvent(ctx, f.eventID)
	if err != nil {
		t.Fatal(err)
	}

	cases := map[string]func(*EventInfo){
		"name":              func(e *EventInfo) { e.Name = "  " },
		"endsAt":            func(e *EventInfo) { e.EndsAt = e.StartsAt },
		"imageUrl":          func(e *EventInfo) { e.ImageURL = "javascript:alert(1)" },
		"status":            func(e *EventInfo) { e.Status = "DELETED" },
		"maxTicketsPerUser": func(e *EventInfo) { e.MaxTicketsPerUser = 0 },
	}
	for field, breakIt := range cases {
		in := before.EventInfo
		breakIt(&in)
		var fe *FieldError
		if _, err := f.organizer.UpdateEvent(ctx, f.eventID, f.ownerID, in); !errors.As(err, &fe) || fe.Field != field {
			t.Errorf("%s: got %v", field, err)
		}
	}

	// The fixture's venue is shared with the event it was copied from.
	in := before.EventInfo
	in.VenueName = "Tên địa điểm mới"
	if !before.VenueShared {
		t.Fatal("fixture venue should be shared")
	}
	if _, err := f.organizer.UpdateEvent(ctx, f.eventID, f.ownerID, in); !errors.Is(err, ErrVenueShared) {
		t.Fatalf("renaming a shared venue: %v", err)
	}
}
