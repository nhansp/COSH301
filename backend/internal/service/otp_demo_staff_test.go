package service

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/config"
	"eventticketing/internal/store"
)

// Staff login codes stay off screen unless the account is listed in OTP_DEMO_STAFF.
func TestRequestOTP_StaffDemoCodeOnlyWhenListed(t *testing.T) {
	_, q := testDB(t)
	ctx := context.Background()

	newOrganizer := func() string {
		token, err := GenerateToken()
		if err != nil {
			t.Fatal(err)
		}
		email := "btc-" + token[:8] + "@test.local"
		if _, err := q.CreateUser(ctx, store.CreateUserParams{
			Email:  pgtype.Text{String: email, Valid: true},
			Role:   store.UserRoleORGANIZER,
			Status: store.UserStatusACTIVE,
		}); err != nil {
			t.Fatal(err)
		}
		return email
	}

	hidden := newOrganizer()
	listed := newOrganizer()
	svc := NewAuthService(q, &config.Config{OTPDemo: true, OTPDemoStaff: []string{" " + strings.ToUpper(listed) + " "}})

	issue, err := svc.RequestOTP(ctx, hidden)
	if err != nil {
		t.Fatal(err)
	}
	if issue.DemoCode != "" {
		t.Fatal("unlisted staff account was shown its code")
	}

	issue, err = svc.RequestOTP(ctx, listed)
	if err != nil {
		t.Fatal(err)
	}
	if issue.DemoCode == "" {
		t.Fatal("listed staff account was not shown its code")
	}
	if _, _, err := svc.VerifyOTP(ctx, listed, issue.DemoCode, "127.0.0.1", "test"); err != nil {
		t.Fatalf("listed staff account could not sign in with the shown code: %v", err)
	}

	off := NewAuthService(q, &config.Config{OTPDemo: false, OTPDemoStaff: []string{listed}})
	issue, err = off.RequestOTP(ctx, newOrganizer())
	if err != nil {
		t.Fatal(err)
	}
	if issue.DemoCode != "" {
		t.Fatal("a code was shown with OTP_DEMO off")
	}
}
