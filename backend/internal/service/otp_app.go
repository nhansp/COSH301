package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"eventticketing/internal/store"
)

var ErrTooManyAppStreams = errors.New("too_many_streams")

const (
	maxAppStreamsPerPhone = 4
	maxAppStreams         = 500
	appDeliveryPurgeEvery = time.Minute
)

// otpAppHub tells connected OTP apps that a code is waiting for their phone
// number. It carries no code: the app fetches it through ClaimAppOTP.
type otpAppHub struct {
	mu    sync.Mutex
	subs  map[string]map[chan struct{}]struct{}
	total int
}

func newOTPAppHub() *otpAppHub {
	return &otpAppHub{subs: make(map[string]map[chan struct{}]struct{})}
}

func (h *otpAppHub) subscribe(phone string) (<-chan struct{}, func(), error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.total >= maxAppStreams || len(h.subs[phone]) >= maxAppStreamsPerPhone {
		return nil, nil, ErrTooManyAppStreams
	}
	// One pending signal is enough: the app claims whatever is waiting.
	ch := make(chan struct{}, 1)
	if h.subs[phone] == nil {
		h.subs[phone] = make(map[chan struct{}]struct{})
	}
	h.subs[phone][ch] = struct{}{}
	h.total++

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			h.mu.Lock()
			defer h.mu.Unlock()
			delete(h.subs[phone], ch)
			if len(h.subs[phone]) == 0 {
				delete(h.subs, phone)
			}
			h.total--
		})
	}
	return ch, cancel, nil
}

func (h *otpAppHub) notify(phone string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs[phone] {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

// deliverToApp keeps the plaintext code for the app and wakes any app
// listening for this number. An older unclaimed code is dropped because the
// newest request invalidates it.
func (s *AuthService) deliverToApp(ctx context.Context, otp store.OtpVerification, code string) error {
	if err := s.queries.DeleteOTPAppDeliveries(ctx, otp.Destination); err != nil {
		return fmt.Errorf("clear app deliveries: %w", err)
	}
	if err := s.queries.CreateOTPAppDelivery(ctx, store.CreateOTPAppDeliveryParams{
		OtpID:       otp.ID,
		Destination: otp.Destination,
		Code:        code,
		ExpiresAt:   otp.ExpiresAt,
	}); err != nil {
		return fmt.Errorf("store app delivery: %w", err)
	}
	s.appHub.notify(otp.Destination)
	return nil
}

// SubscribeAppOTP registers an app for wake-ups about the given phone number.
// The caller must call the returned cancel function.
func (s *AuthService) SubscribeAppOTP(phone string) (<-chan struct{}, func(), error) {
	dest, err := appPhone(phone)
	if err != nil {
		return nil, nil, err
	}
	return s.appHub.subscribe(dest)
}

// ClaimAppOTP returns the pending login code for a phone number exactly once.
// It returns "" when nothing is pending, whether or not the number has an account.
func (s *AuthService) ClaimAppOTP(ctx context.Context, phone string) (string, error) {
	dest, err := appPhone(phone)
	if err != nil {
		return "", err
	}
	code, err := s.queries.ClaimOTPAppDelivery(ctx, dest)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("claim app delivery: %w", err)
	}
	return code, nil
}

func appPhone(phone string) (string, error) {
	dest, channel, err := NormalizeDestination(phone)
	if err != nil {
		return "", err
	}
	if channel != "SMS" {
		return "", ErrInvalidDestination
	}
	return dest, nil
}

// StartAppDeliveryReaper deletes codes the app never picked up once they expire.
func (s *AuthService) StartAppDeliveryReaper(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(appDeliveryPurgeEvery)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if _, err := s.queries.DeleteExpiredOTPAppDeliveries(ctx); err != nil && ctx.Err() == nil {
					log.Printf("[OTP app] purge expired deliveries: %v", err)
				}
			}
		}
	}()
}
