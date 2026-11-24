-- +goose Up
-- Persist custom stage and seating layout designs on venues, plus explicit zone kinds.
ALTER TABLE venues
    ADD COLUMN IF NOT EXISTS layout_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE venue_zones
    ADD COLUMN IF NOT EXISTS zone_kind VARCHAR(20) NOT NULL DEFAULT 'seated'
        CHECK (zone_kind IN ('seated', 'standing'));

UPDATE venue_zones
SET zone_kind = 'standing'
WHERE lower(name) LIKE '%đứng%' AND zone_kind = 'seated';

-- +goose Down
ALTER TABLE venue_zones DROP COLUMN IF EXISTS zone_kind;
ALTER TABLE venues DROP COLUMN IF EXISTS layout_config;
