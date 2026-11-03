package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"eventticketing/internal/config"
	"eventticketing/internal/store"
)

var (
	ErrInvalidDestination = errors.New("invalid_destination")
	ErrOTPRateLimited     = errors.New("otp_rate_limited")
	ErrOTPInvalid         = errors.New("otp_invalid")
	ErrAccountInactive    = errors.New("account_inactive")
	ErrSessionNotFound    = errors.New("session_not_found")
)

const (
	otpPurposeLogin     = "LOGIN"
	otpTTLSeconds       = 5 * 60
	otpMaxAttempts      = 5
	otpCooldownSeconds  = 60
	otpWindowSeconds    = 60 * 60
	otpMaxPerWindow     = 5
	sessionTTLHours     = 7 * 24
	otpCodeDigitsModulo = 1_000_000
)

var (
	emailPattern = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	phonePattern = regexp.MustCompile(`^\+?[0-9]{9,15}$`)
)

type AuthService struct {
	queries *store.Queries
	cfg     *config.Config
}

func NewAuthService(queries *store.Queries, cfg *config.Config) *AuthService {
	return &AuthService{queries: queries, cfg: cfg}
}

// HashString computes a sha256 hex digest.
func HashString(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// GenerateToken returns a cryptographically random 32-byte hex string.
func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// NormalizeDestination validates an email or phone number and returns its
// canonical form and channel.
func NormalizeDestination(destination string) (string, string, error) {
	d := strings.TrimSpace(destination)
	if strings.Contains(d, "@") {
		d = strings.ToLower(d)
		if len(d) > 320 || !emailPattern.MatchString(d) {
			return "", "", ErrInvalidDestination
		}
		return d, "EMAIL", nil
	}
	d = strings.NewReplacer(" ", "", "-", "", ".", "").Replace(d)
	if !phonePattern.MatchString(d) {
		return "", "", ErrInvalidDestination
	}
	return d, "SMS", nil
}

func (s *AuthService) findUser(ctx context.Context, dest, channel string) (store.User, error) {
	v := pgtype.Text{String: dest, Valid: true}
	if channel == "EMAIL" {
		return s.queries.GetUserByEmail(ctx, v)
	}
	return s.queries.GetUserByPhone(ctx, v)
}

// OTPIssue is the result of a login code request. DemoCode is set only when
// the code may be shown to the requester.
type OTPIssue struct {
	Destination string
	DemoCode    string
}

// RequestOTP issues a 6-digit login code, limited per destination.
func (s *AuthService) RequestOTP(ctx context.Context, destination string) (*OTPIssue, error) {
	dest, channel, err := NormalizeDestination(destination)
	if err != nil {
		return nil, err
	}

	recent, err := s.queries.CountRecentOTPs(ctx, store.CountRecentOTPsParams{
		Destination:     dest,
		Purpose:         otpPurposeLogin,
		CooldownSeconds: otpCooldownSeconds,
		WindowSeconds:   otpWindowSeconds,
	})
	if err != nil {
		return nil, fmt.Errorf("count recent otps: %w", err)
	}
	if recent.InCooldown > 0 || recent.InWindow >= otpMaxPerWindow {
		return nil, ErrOTPRateLimited
	}

	n, err := rand.Int(rand.Reader, big.NewInt(otpCodeDigitsModulo))
	if err != nil {
		return nil, err
	}
	code := fmt.Sprintf("%06d", n.Int64())

	if _, err := s.queries.CreateOTP(ctx, store.CreateOTPParams{
		Destination: dest,
		Channel:     channel,
		Purpose:     otpPurposeLogin,
		CodeHash:    HashString(code),
		TtlSeconds:  otpTTLSeconds,
	}); err != nil {
		return nil, fmt.Errorf("store otp: %w", err)
	}

	isStaff := false
	if u, err := s.findUser(ctx, dest, channel); err == nil {
		isStaff = u.Role != store.UserRoleCUSTOMER
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("lookup user: %w", err)
	}

	issue := &OTPIssue{Destination: dest}
	if s.cfg.OTPDemo && !isStaff {
		issue.DemoCode = code
	} else {
		// No SMS or email provider is configured yet; the operator relays the code.
		log.Printf("otp: login code for %s (%s): %s", dest, channel, code)
	}
	return issue, nil
}

// VerifyOTP checks a login code and opens a session for the matching user,
// creating a customer account on first login.
func (s *AuthService) VerifyOTP(ctx context.Context, destination, code, ipAddress, userAgent string) (string, *store.User, error) {
	dest, channel, err := NormalizeDestination(destination)
	if err != nil {
		return "", nil, err
	}

	otp, err := s.queries.ConsumeOTPAttempt(ctx, store.ConsumeOTPAttemptParams{
		Destination: dest,
		Purpose:     otpPurposeLogin,
		MaxAttempts: otpMaxAttempts,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, ErrOTPInvalid
	}
	if err != nil {
		return "", nil, fmt.Errorf("consume otp attempt: %w", err)
	}

	given := HashString(strings.TrimSpace(code))
	if subtle.ConstantTimeCompare([]byte(given), []byte(otp.CodeHash)) != 1 {
		return "", nil, ErrOTPInvalid
	}
	if n, err := s.queries.MarkOTPVerified(ctx, otp.ID); err != nil {
		return "", nil, fmt.Errorf("mark otp verified: %w", err)
	} else if n == 0 {
		return "", nil, ErrOTPInvalid
	}

	user, err := s.findUser(ctx, dest, channel)
	switch {
	case err == nil:
		if user.Status == store.UserStatusLOCKED || user.Status == store.UserStatusDISABLED {
			return "", nil, ErrAccountInactive
		}
		if channel == "EMAIL" {
			err = s.queries.SetEmailVerified(ctx, user.ID)
		} else {
			err = s.queries.SetPhoneVerified(ctx, user.ID)
		}
		if err != nil {
			return "", nil, fmt.Errorf("mark destination verified: %w", err)
		}
	case errors.Is(err, pgx.ErrNoRows):
		params := store.CreateUserParams{Role: store.UserRoleCUSTOMER, Status: store.UserStatusACTIVE}
		verified := pgtype.Timestamptz{Time: time.Now(), Valid: true}
		if channel == "EMAIL" {
			params.Email = pgtype.Text{String: dest, Valid: true}
			params.EmailVerifiedAt = verified
		} else {
			params.Phone = pgtype.Text{String: dest, Valid: true}
			params.PhoneVerifiedAt = verified
		}
		if user, err = s.queries.CreateUser(ctx, params); err != nil {
			return "", nil, fmt.Errorf("create user: %w", err)
		}
	default:
		return "", nil, fmt.Errorf("lookup user: %w", err)
	}

	if err := s.queries.UpdateUserLastLogin(ctx, user.ID); err != nil {
		return "", nil, fmt.Errorf("update last login: %w", err)
	}

	rawToken, err := GenerateToken()
	if err != nil {
		return "", nil, fmt.Errorf("generate session token: %w", err)
	}
	if _, err := s.queries.CreateSession(ctx, store.CreateSessionParams{
		UserID:    user.ID,
		TokenHash: HashString(rawToken),
		IpAddress: pgtype.Text{String: ipAddress, Valid: ipAddress != ""},
		UserAgent: pgtype.Text{String: userAgent, Valid: userAgent != ""},
		TtlHours:  sessionTTLHours,
	}); err != nil {
		return "", nil, fmt.Errorf("create session: %w", err)
	}

	return rawToken, &user, nil
}

// GetUserByToken returns the session and user for a bearer or cookie token.
func (s *AuthService) GetUserByToken(ctx context.Context, rawToken string) (*store.GetSessionByTokenHashRow, error) {
	row, err := s.queries.GetSessionByTokenHash(ctx, HashString(strings.TrimSpace(rawToken)))
	if err != nil {
		return nil, ErrSessionNotFound
	}
	return &row, nil
}

// Logout invalidates a session token.
func (s *AuthService) Logout(ctx context.Context, rawToken string) error {
	return s.queries.DeleteSession(ctx, HashString(strings.TrimSpace(rawToken)))
}
