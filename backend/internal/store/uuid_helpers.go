package store

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// UUIDToString converts pgtype.UUID to string.
func UUIDToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return uuid.UUID(u.Bytes).String()
}

// StringToUUID converts standard string to pgtype.UUID.
func StringToUUID(s string) (pgtype.UUID, error) {
	parsed, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}, err
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}, nil
}

// MustStringToUUID converts string to pgtype.UUID or panics.
func MustStringToUUID(s string) pgtype.UUID {
	u, err := StringToUUID(s)
	if err != nil {
		panic(err)
	}
	return u
}
