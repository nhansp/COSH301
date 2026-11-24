package store

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// Processes that start together (API replicas, parallel test packages) all call
// RunMigrations on the same database. They must queue on the lock, not collide.
func TestRunMigrations_ConcurrentCallersSucceed(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}

	const callers = 6
	errs := make(chan error, callers)
	var wg sync.WaitGroup
	for range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- RunMigrations(url)
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Errorf("RunMigrations: %v", err)
		}
	}

	// The lock is released. Test packages migrate the same database at the same time,
	// so it may be held briefly by someone else: only a lock that never frees is a leak.
	conn, err := pgx.Connect(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(context.Background())
	deadline := time.Now().Add(10 * time.Second)
	for {
		var got bool
		if err := conn.QueryRow(context.Background(), "SELECT pg_try_advisory_lock($1)", int64(migrationLockID)).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("migration lock is still held long after RunMigrations returned")
		}
		time.Sleep(50 * time.Millisecond)
	}
}
