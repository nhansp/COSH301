package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"eventticketing/internal/config"
	"eventticketing/internal/store"
)

var (
	ErrInvalidDestination = errors.New("invalid_destination")
	ErrOTPNotFound        = errors.New("otp_not_found")
	ErrOTPExpired         = errors.New("otp_expired")
	ErrOTPIncorrect       = errors.New("otp_incorrect")
	ErrSessionNotFound    = errors.New("session_not_found")
)

type AuthService struct {
	queries *store.Queries
	cfg     *config.Config
}

func NewAuthService(queries *store.Queries, cfg *config.Config) *AuthService {
	return &AuthService{
		queries: queries,
		cfg:     cfg,
	}
}

// HashString computes sha256 hex string.
func HashString(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// GenerateToken generates a cryptographically random 32-byte hex string.
func GenerateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// RequestOTP generates and sends or mocks a 6-digit OTP code.
func (s *AuthService) RequestOTP(ctx context.Context, destination, channel string) (string, error) {
	dest := strings.TrimSpace(destination)
	if dest == "" {
		return "", ErrInvalidDestination
	}

	chanUpper := strings.ToUpper(strings.TrimSpace(channel))
	if chanUpper == "" {
		if strings.Contains(dest, "@") {
			chanUpper = "EMAIL"
		} else {
			chanUpper = "SMS"
		}
	}

	var code string
	if s.cfg.OTPMock {
		code = "123456" // Default mock OTP in dev
	} else {
		n, err := rand.Int(rand.Reader, big.NewInt(900000))
		if err != nil {
			return "", err
		}
		code = fmt.Sprintf("%06d", n.Int64()+100000)
	}

	codeHash := HashString(code)
	expiresAt := pgtype.Timestamptz{Time: time.Now().Add(5 * time.Minute), Valid: true}

	_, err := s.queries.CreateOTP(ctx, store.CreateOTPParams{
		Destination: dest,
		Channel:     chanUpper,
		Purpose:     "LOGIN",
		CodeHash:    codeHash,
		ExpiresAt:   expiresAt,
	})
	if err != nil {
		return "", fmt.Errorf("failed to store OTP: %w", err)
	}

	log.Printf("[OTP] Generated for %s (%s): %s", dest, chanUpper, code)
	return code, nil
}

// VerifyOTP checks the provided OTP, activates the user, and creates a new session.
func (s *AuthService) VerifyOTP(ctx context.Context, destination, code, ipAddress, userAgent string) (string, *store.User, error) {
	dest := strings.TrimSpace(destination)
	otpRow, err := s.queries.GetLatestOTP(ctx, store.GetLatestOTPParams{
		Destination: dest,
		Purpose:     "LOGIN",
	})
	if err != nil {
		return "", nil, ErrOTPNotFound
	}

	if time.Now().After(otpRow.ExpiresAt.Time) {
		return "", nil, ErrOTPExpired
	}

	if HashString(strings.TrimSpace(code)) != otpRow.CodeHash {
		_ = s.queries.IncrementOTPAttempts(ctx, otpRow.ID)
		return "", nil, ErrOTPIncorrect
	}

	// Mark OTP as verified
	_ = s.queries.MarkOTPVerified(ctx, otpRow.ID)

	// Find or create user
	var user store.User
	isEmail := strings.Contains(dest, "@")

	if isEmail {
		u, err := s.queries.GetUserByEmail(ctx, pgtype.Text{String: dest, Valid: true})
		if err == nil {
			user = u
			_ = s.queries.SetEmailVerified(ctx, user.ID)
		} else {
			// Create user with email
			user, err = s.queries.CreateUser(ctx, store.CreateUserParams{
				Email:           pgtype.Text{String: dest, Valid: true},
				Role:            store.UserRoleCUSTOMER,
				Status:          store.UserStatusACTIVE,
				EmailVerifiedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
			})
			if err != nil {
				return "", nil, fmt.Errorf("failed to create user: %w", err)
			}
		}
	} else {
		u, err := s.queries.GetUserByPhone(ctx, pgtype.Text{String: dest, Valid: true})
		if err == nil {
			user = u
			_ = s.queries.SetPhoneVerified(ctx, user.ID)
		} else {
			// Create user with phone
			user, err = s.queries.CreateUser(ctx, store.CreateUserParams{
				Phone:           pgtype.Text{String: dest, Valid: true},
				Role:            store.UserRoleCUSTOMER,
				Status:          store.UserStatusACTIVE,
				PhoneVerifiedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
			})
			if err != nil {
				return "", nil, fmt.Errorf("failed to create user: %w", err)
			}
		}
	}

	// Update last login
	_ = s.queries.UpdateUserLastLogin(ctx, user.ID)

	// Create session (valid 7 days)
	rawToken, err := GenerateToken()
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate session token: %w", err)
	}

	tokenHash := HashString(rawToken)
	expiresAt := pgtype.Timestamptz{Time: time.Now().Add(7 * 24 * time.Hour), Valid: true}

	_, err = s.queries.CreateSession(ctx, store.CreateSessionParams{
		UserID:    user.ID,
		TokenHash: tokenHash,
		IpAddress: pgtype.Text{String: ipAddress, Valid: ipAddress != ""},
		UserAgent: pgtype.Text{String: userAgent, Valid: userAgent != ""},
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return "", nil, fmt.Errorf("failed to create session: %w", err)
	}

	return rawToken, &user, nil
}

// GetUserByToken fetches the authenticated user for a bearer/cookie token.
func (s *AuthService) GetUserByToken(ctx context.Context, rawToken string) (*store.GetSessionByTokenHashRow, error) {
	tokenHash := HashString(strings.TrimSpace(rawToken))
	row, err := s.queries.GetSessionByTokenHash(ctx, tokenHash)
	if err != nil {
		return nil, ErrSessionNotFound
	}
	return &row, nil
}

// Logout invalidates a session token.
func (s *AuthService) Logout(ctx context.Context, rawToken string) error {
	tokenHash := HashString(strings.TrimSpace(rawToken))
	return s.queries.DeleteSession(ctx, tokenHash)
}
