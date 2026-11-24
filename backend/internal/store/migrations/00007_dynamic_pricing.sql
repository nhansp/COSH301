-- +goose Up

-- A suggestion is refreshed in place while it waits, so it needs a change time.
-- EXPIRED marks one the engine withdrew because the data no longer supports it.
ALTER TABLE price_suggestions
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD CONSTRAINT chk_price_suggestions_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    ADD CONSTRAINT chk_price_suggestions_reviewed CHECK ((status IN ('APPROVED', 'REJECTED')) = (reviewed_at IS NOT NULL));

-- At most one open suggestion per zone: a new analysis updates it instead of piling up rows.
CREATE UNIQUE INDEX uq_price_suggestions_pending ON price_suggestions(event_id, zone_id) WHERE status = 'PENDING';
CREATE INDEX idx_price_suggestions_zone_status ON price_suggestions(event_id, zone_id, status, reviewed_at DESC);

-- The engine counts the seats held or sold in a sliding window.
CREATE INDEX idx_seat_holds_event_created ON seat_holds(event_id, created_at);
CREATE INDEX idx_tickets_event_issued ON tickets(event_id, issued_at);

-- Dynamic pricing is opt-out per zone; the dynamic_pricing flag still decides whether the engine runs.
ALTER TABLE event_zones ALTER COLUMN is_dynamic_pricing_enabled SET DEFAULT TRUE;
UPDATE event_zones SET is_dynamic_pricing_enabled = TRUE;

-- +goose Down
ALTER TABLE event_zones ALTER COLUMN is_dynamic_pricing_enabled SET DEFAULT FALSE;
DROP INDEX IF EXISTS idx_tickets_event_issued;
DROP INDEX IF EXISTS idx_seat_holds_event_created;
DROP INDEX IF EXISTS idx_price_suggestions_zone_status;
DROP INDEX IF EXISTS uq_price_suggestions_pending;
ALTER TABLE price_suggestions
    DROP CONSTRAINT IF EXISTS chk_price_suggestions_reviewed,
    DROP CONSTRAINT IF EXISTS chk_price_suggestions_status,
    DROP COLUMN IF EXISTS updated_at;
