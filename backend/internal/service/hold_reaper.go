package service

import (
	"context"
	"log"
	"time"
)

type HoldReaper struct {
	seatService *SeatService
	interval    time.Duration
}

func NewHoldReaper(seatService *SeatService, interval time.Duration) *HoldReaper {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &HoldReaper{
		seatService: seatService,
		interval:    interval,
	}
}

// Start launches the background ticker to expire stale holds.
func (r *HoldReaper) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(r.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				expired, err := r.seatService.ExpireStaleHolds(ctx)
				if err != nil {
					log.Printf("[HoldReaper] Error checking stale holds: %v", err)
				} else if len(expired) > 0 {
					log.Printf("[HoldReaper] Released %d expired seat holds back to AVAILABLE", len(expired))
				}
			}
		}
	}()
}
