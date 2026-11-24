package service

import (
	"context"
	"log"
	"time"
)

type HoldReaper struct {
	seatService *SeatService
	payments    *PaymentService
	interval    time.Duration
}

// NewHoldReaper expires stale holds and, when payments is set, the pending orders built on them.
func NewHoldReaper(seatService *SeatService, payments *PaymentService, interval time.Duration) *HoldReaper {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &HoldReaper{
		seatService: seatService,
		payments:    payments,
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
				if r.payments != nil {
					if n, err := r.payments.ExpireStaleOrders(ctx); err != nil {
						log.Printf("[HoldReaper] Error expiring pending orders: %v", err)
					} else if n > 0 {
						log.Printf("[HoldReaper] Expired %d pending orders", n)
					}
				}
			}
		}
	}()
}
