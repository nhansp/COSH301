package service

import (
	"testing"

	"eventticketing/internal/store"
)

func TestCancelledItemFromAudit_PrefersServerEventData(t *testing.T) {
	item := cancelledItemFromAudit(store.ListUserCancelledTicketsRow{
		ID: 1,
		OldData: []byte(`{
			"bookingCode": "BK1",
			"seats": ["A1"],
			"releasedSeats": ["A1"],
			"concert": {"name": "Server Name"},
			"client": {"concert": {"name": "Client Name", "imageUrl": "x.png"}, "ticketDetails": {"eventTitle": "T"}}
		}`),
	})
	if item.EventTitle != "Server Name" {
		t.Errorf("EventTitle = %q, want server event name", item.EventTitle)
	}
	if item.Concert["imageUrl"] != "x.png" {
		t.Errorf("client-only display fields should be kept, got %v", item.Concert)
	}
	if item.TicketDetails["eventTitle"] != "T" || item.BookingCode != "BK1" || len(item.ReleasedSeats) != 1 {
		t.Errorf("unexpected item: %+v", item)
	}
}

func TestCancelledItemFromAudit_LegacyRecord(t *testing.T) {
	item := cancelledItemFromAudit(store.ListUserCancelledTicketsRow{
		OldData: []byte(`{"ticketDetails": {"eventTitle": "Legacy"}}`),
	})
	if item.EventTitle != "Legacy" || item.Seats == nil || item.ReleasedSeats == nil {
		t.Errorf("unexpected item: %+v", item)
	}
}
