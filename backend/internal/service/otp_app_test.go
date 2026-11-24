package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"sync"
	"testing"
	"time"

	"eventticketing/internal/config"
)

func TestNormalizeDestination_PhoneCanonicalForm(t *testing.T) {
	for in, want := range map[string]string{
		"0912345678":      "+84912345678",
		"091 234-5678":    "+84912345678",
		"84912345678":     "+84912345678",
		"0084912345678":   "+84912345678",
		"+84912345678":    "+84912345678",
		"+1 415 555 0100": "+14155550100",
	} {
		got, channel, err := NormalizeDestination(in)
		if err != nil || got != want || channel != "SMS" {
			t.Errorf("NormalizeDestination(%q) = %q, %q, %v; want %q, SMS", in, got, channel, err, want)
		}
	}
	for _, in := range []string{"", "123", "abc", "+84", "09123"} {
		if _, _, err := NormalizeDestination(in); !errors.Is(err, ErrInvalidDestination) {
			t.Errorf("NormalizeDestination(%q): got %v, want ErrInvalidDestination", in, err)
		}
	}
}

func TestOTPAppHub_LimitsAndNotify(t *testing.T) {
	h := newOTPAppHub()
	var cancels []func()
	for range maxAppStreamsPerPhone {
		ch, cancel, err := h.subscribe("+84900000001")
		if err != nil {
			t.Fatalf("subscribe: %v", err)
		}
		cancels = append(cancels, cancel)
		h.notify("+84900000001")
		select {
		case <-ch:
		default:
			t.Fatal("subscriber was not notified")
		}
	}
	if _, _, err := h.subscribe("+84900000001"); !errors.Is(err, ErrTooManyAppStreams) {
		t.Fatalf("over the per-number limit: got %v", err)
	}
	other, cancelOther, err := h.subscribe("+84900000002")
	if err != nil {
		t.Fatalf("other number: %v", err)
	}
	defer cancelOther()
	h.notify("+84900000001")
	select {
	case <-other:
		t.Fatal("notified a subscriber of another number")
	default:
	}
	for _, c := range cancels {
		c()
		c()
	}
	if h.total != 1 {
		t.Fatalf("total subscribers = %d, want 1", h.total)
	}
}

func randomPhone() string {
	return fmt.Sprintf("+849%08d", rand.IntN(100_000_000))
}

func TestAppDelivery_ClaimOnceThenNothing(t *testing.T) {
	_, q := testDB(t)
	ctx := context.Background()
	svc := NewAuthService(q, &config.Config{OTPAppDelivery: true, OTPDemo: true})

	phone := randomPhone()
	pending, cancel, err := svc.SubscribeAppOTP(phone)
	if err != nil {
		t.Fatal(err)
	}
	defer cancel()

	if code, err := svc.ClaimAppOTP(ctx, phone); err != nil || code != "" {
		t.Fatalf("claim before any request: %q, %v", code, err)
	}

	issue, err := svc.RequestOTP(ctx, "0"+phone[3:])
	if err != nil {
		t.Fatalf("request otp: %v", err)
	}
	if issue.Delivery != DeliveryApp || issue.DemoCode != "" || issue.Destination != phone {
		t.Fatalf("issue = %+v, want app delivery without demo code for %s", issue, phone)
	}
	select {
	case <-pending:
	case <-time.After(time.Second):
		t.Fatal("app was not woken")
	}

	code, err := svc.ClaimAppOTP(ctx, "0"+phone[3:])
	if err != nil || len(code) != 6 {
		t.Fatalf("claim: %q, %v", code, err)
	}
	if again, err := svc.ClaimAppOTP(ctx, phone); err != nil || again != "" {
		t.Fatalf("second claim: %q, %v; want nothing", again, err)
	}
	if _, _, err := svc.VerifyOTP(ctx, phone, code, "", ""); err != nil {
		t.Fatalf("verify claimed code: %v", err)
	}
}

func TestAppDelivery_ConcurrentClaimsGetOneCode(t *testing.T) {
	_, q := testDB(t)
	ctx := context.Background()
	svc := NewAuthService(q, &config.Config{OTPAppDelivery: true})

	phone := randomPhone()
	if _, err := svc.RequestOTP(ctx, phone); err != nil {
		t.Fatal(err)
	}
	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		got  int
		errs []error
	)
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, err := svc.ClaimAppOTP(ctx, phone)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs = append(errs, err)
			} else if code != "" {
				got++
			}
		}()
	}
	wg.Wait()
	if len(errs) > 0 || got != 1 {
		t.Fatalf("claims delivered %d codes, errors %v; want exactly one", got, errs)
	}
}

func TestAppDelivery_NewRequestReplacesUnclaimedCode(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()
	svc := NewAuthService(q, &config.Config{OTPAppDelivery: true})

	phone := randomPhone()
	if _, err := svc.RequestOTP(ctx, phone); err != nil {
		t.Fatal(err)
	}
	// Skip the resend cooldown by aging the first request.
	if _, err := pool.Exec(ctx, `UPDATE otp_verifications SET created_at = now() - interval '2 minutes' WHERE destination = $1`, phone); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.RequestOTP(ctx, phone); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM otp_app_deliveries WHERE destination = $1`, phone).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("pending deliveries = %d, want 1", n)
	}
}

func TestAppDelivery_ExpiredCodeIsNotClaimableAndIsPurged(t *testing.T) {
	pool, q := testDB(t)
	ctx := context.Background()
	svc := NewAuthService(q, &config.Config{OTPAppDelivery: true})

	phone := randomPhone()
	if _, err := svc.RequestOTP(ctx, phone); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE otp_app_deliveries SET expires_at = now() - interval '1 second' WHERE destination = $1`, phone); err != nil {
		t.Fatal(err)
	}
	if code, err := svc.ClaimAppOTP(ctx, phone); err != nil || code != "" {
		t.Fatalf("claim expired: %q, %v", code, err)
	}
	if _, err := q.DeleteExpiredOTPAppDeliveries(ctx); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM otp_app_deliveries WHERE destination = $1`, phone).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("expired deliveries left = %d, want 0", n)
	}
}

func TestAppDelivery_EmailStaysOffTheApp(t *testing.T) {
	_, q := testDB(t)
	ctx := context.Background()
	svc := NewAuthService(q, &config.Config{OTPAppDelivery: true, OTPDemo: true})

	issue, err := svc.RequestOTP(ctx, fmt.Sprintf("app-%d@test.local", rand.IntN(1_000_000_000)))
	if err != nil {
		t.Fatal(err)
	}
	if issue.Delivery != "" || issue.DemoCode == "" {
		t.Fatalf("email issue = %+v, want demo code and no app delivery", issue)
	}
	if _, err := svc.ClaimAppOTP(ctx, "someone@test.local"); !errors.Is(err, ErrInvalidDestination) {
		t.Fatalf("claim with an email: got %v, want ErrInvalidDestination", err)
	}
}
