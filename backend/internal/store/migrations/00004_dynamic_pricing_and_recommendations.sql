-- +goose Up
-- Dynamic pricing (FR-22): per-event modes, organizer-approved bounds, demand state and alerts.
-- Recommendations: event views as a behaviour signal.

ALTER TABLE price_suggestions
    ADD CONSTRAINT chk_price_suggestions_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'));

-- One open suggestion per zone: the pricing job refreshes it instead of stacking new ones.
CREATE UNIQUE INDEX uq_price_suggestions_pending ON price_suggestions(event_id, zone_id) WHERE status = 'PENDING';

-- Off until the organizer turns it on. auto_adjust is Mode A; enabled without it is Mode B.
CREATE TABLE event_pricing_settings (
    event_id          UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    auto_adjust       BOOLEAN NOT NULL DEFAULT FALSE,
    max_step_pct      INT NOT NULL DEFAULT 10 CHECK (max_step_pct BETWEEN 1 AND 20),
    cooldown_minutes  INT NOT NULL DEFAULT 60 CHECK (cooldown_minutes BETWEEN 5 AND 1440),
    updated_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (enabled OR NOT auto_adjust)
);

-- Automatic pricing only moves a zone whose floor and ceiling an organizer has saved.
ALTER TABLE event_zones
    ADD COLUMN bounds_approved_at TIMESTAMPTZ,
    ADD COLUMN bounds_approved_by UUID REFERENCES users(id);

-- price_changes.reason keeps the trigger (MANUAL, SUGGESTION, AUTO); details says why.
ALTER TABLE price_changes ADD COLUMN details TEXT;

-- Smoothed demand index from the last pricing run, so one noisy hour cannot swing a price.
CREATE TABLE zone_demand_state (
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone_id       UUID NOT NULL REFERENCES venue_zones(id) ON DELETE CASCADE,
    demand_index  DOUBLE PRECISION NOT NULL CHECK (demand_index > 0),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, zone_id)
);

CREATE TABLE pricing_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone_id     UUID REFERENCES venue_zones(id) ON DELETE CASCADE,
    kind        VARCHAR(40) NOT NULL,
    message     TEXT NOT NULL,
    data        JSONB NOT NULL DEFAULT '{}',
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_alerts_event_time ON pricing_alerts(event_id, created_at DESC);

CREATE TABLE event_views (
    id         BIGSERIAL PRIMARY KEY,
    event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_views_user_time ON event_views(user_id, viewed_at DESC);
CREATE INDEX idx_event_views_event_time ON event_views(event_id, viewed_at DESC);

-- +goose Down
DROP TABLE IF EXISTS event_views;
DROP TABLE IF EXISTS pricing_alerts;
DROP TABLE IF EXISTS zone_demand_state;
ALTER TABLE price_changes DROP COLUMN IF EXISTS details;
ALTER TABLE event_zones DROP COLUMN IF EXISTS bounds_approved_by, DROP COLUMN IF EXISTS bounds_approved_at;
DROP TABLE IF EXISTS event_pricing_settings;
DROP INDEX IF EXISTS uq_price_suggestions_pending;
ALTER TABLE price_suggestions DROP CONSTRAINT IF EXISTS chk_price_suggestions_status;
