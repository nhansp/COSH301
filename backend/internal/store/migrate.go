package store

import (
	"context"
	"database/sql"
	"fmt"

	"eventticketing/internal/store/migrations"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// migrationLockID is the advisory lock that serializes migrators on one database.
const migrationLockID = 301_000_007

// RunMigrations applies all pending migrations using goose.
//
// It holds a PostgreSQL advisory lock meanwhile, so processes started together
// (several API replicas, or test packages run in parallel) migrate one at a
// time: the others wait, then find nothing left to apply.
func RunMigrations(databaseURL string) error {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("failed to open database for migration: %w", err)
	}
	defer db.Close()

	ctx := context.Background()
	// The lock belongs to this connection; goose works on other connections of the pool.
	lockConn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("failed to open migration lock connection: %w", err)
	}
	defer lockConn.Close()
	if _, err := lockConn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("failed to take migration lock: %w", err)
	}
	defer lockConn.ExecContext(ctx, "SELECT pg_advisory_unlock($1)", migrationLockID) //nolint:errcheck // closing the connection releases it anyway

	goose.SetBaseFS(migrations.EmbedFS)

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}

	if err := goose.Up(db, "."); err != nil {
		return fmt.Errorf("failed to run goose up: %w", err)
	}

	return nil
}
