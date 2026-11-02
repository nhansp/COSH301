-- +goose Up
-- EventTicketing PostgreSQL 18 Schema Migration
-- Strictly adheres to docs/design/README.md

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ORGANIZER', 'CEO', 'GATE_STAFF', 'ADMIN');
CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'LOCKED', 'DISABLED');
CREATE TYPE event_status AS ENUM ('DRAFT', 'ON_SALE', 'SOLD_OUT', 'PAUSED', 'ENDED', 'CANCELLED');
CREATE TYPE seat_status AS ENUM ('AVAILABLE', 'HELD', 'SOLD', 'BLOCKED');
CREATE TYPE hold_status AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED');
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');
CREATE TYPE payment_status AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE ticket_status AS ENUM ('ISSUED', 'ACTIVE', 'USED', 'REVOKED', 'VOID');
CREATE TYPE checkin_result AS ENUM ('VALID', 'ALREADY_USED', 'INVALID', 'VOID', 'OFFLINE_CONFLICT');

-- =========================================================
-- 1. Identity / users
-- =========================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone               VARCHAR(30) UNIQUE,
    email               VARCHAR(320) UNIQUE,
    full_name           VARCHAR(150),
    role                user_role NOT NULL DEFAULT 'CUSTOMER',
    status              user_status NOT NULL DEFAULT 'PENDING',
    phone_verified_at   TIMESTAMPTZ,
    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE otp_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination         VARCHAR(320) NOT NULL,
    channel             VARCHAR(20) NOT NULL, -- 'SMS', 'EMAIL'
    purpose             VARCHAR(30) NOT NULL, -- 'LOGIN', 'PURCHASE'
    code_hash           VARCHAR(255) NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    verified_at         TIMESTAMPTZ,
    attempt_count       INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_destination_purpose ON otp_verifications(destination, purpose, created_at DESC);

CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash          VARCHAR(255) NOT NULL UNIQUE,
    ip_address          VARCHAR(45),
    user_agent          TEXT,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);

-- =========================================================
-- 2. Event / venue / seat inventory
-- =========================================================

CREATE TABLE venues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    address             TEXT,
    timezone            VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venue_zones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id            UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    code                VARCHAR(50) NOT NULL,
    name                VARCHAR(120) NOT NULL,
    floor               VARCHAR(50),
    capacity            INT NOT NULL CHECK (capacity >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venue_id, code)
);

CREATE TABLE seats (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id             UUID NOT NULL REFERENCES venue_zones(id) ON DELETE CASCADE,
    row_label           VARCHAR(30),
    seat_number         VARCHAR(30),
    seat_label          VARCHAR(80) NOT NULL,
    x_position          NUMERIC(10,2),
    y_position          NUMERIC(10,2),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (zone_id, seat_label)
);

CREATE TABLE events (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id          UUID NOT NULL REFERENCES users(id),
    venue_id              UUID NOT NULL REFERENCES venues(id),
    name                  VARCHAR(255) NOT NULL,
    slug                  VARCHAR(255) NOT NULL UNIQUE,
    description           TEXT,
    genre                 VARCHAR(100),
    image_url             TEXT,
    city                  VARCHAR(100),
    starts_at             TIMESTAMPTZ NOT NULL,
    ends_at               TIMESTAMPTZ NOT NULL,
    sales_starts_at       TIMESTAMPTZ,
    sales_ends_at         TIMESTAMPTZ,
    status                event_status NOT NULL DEFAULT 'DRAFT',
    max_tickets_per_user  INT NOT NULL DEFAULT 4 CHECK (max_tickets_per_user > 0),
    waiting_room_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    waiting_room_capacity INT NOT NULL DEFAULT 500 CHECK (waiting_room_capacity >= 0),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    CHECK (sales_ends_at IS NULL OR sales_starts_at IS NULL OR sales_ends_at > sales_starts_at)
);

CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_status_time ON events(status, starts_at);

CREATE TABLE event_seats (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    seat_id             UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    status              seat_status NOT NULL DEFAULT 'AVAILABLE',
    current_price       NUMERIC(14,0) NOT NULL CHECK (current_price >= 0),
    version             BIGINT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, seat_id)
);

CREATE INDEX idx_event_seats_event_status ON event_seats(event_id, status);

CREATE TABLE event_zones (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone_id                     UUID NOT NULL REFERENCES venue_zones(id) ON DELETE CASCADE,
    base_price                  NUMERIC(14,0) NOT NULL CHECK (base_price >= 0),
    floor_price                 NUMERIC(14,0) NOT NULL CHECK (floor_price >= 0),
    ceiling_price               NUMERIC(14,0) NOT NULL CHECK (ceiling_price >= 0),
    is_dynamic_pricing_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, zone_id),
    CHECK (floor_price <= base_price AND base_price <= ceiling_price)
);

-- =========================================================
-- 3. Virtual Waiting Room (FR-09, NFR-09)
-- =========================================================

CREATE TABLE queue_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position            INT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'ADMITTED', 'EXPIRED', 'LEFT'
    admitted_at         TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX idx_queue_event_status ON queue_entries(event_id, status, position);

-- =========================================================
-- 4. Seat Hold (FR-06, FR-07, NFR-03)
-- =========================================================

CREATE TABLE seat_holds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    seat_id             UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hold_token          VARCHAR(120) NOT NULL,
    status              hold_status NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL
);

-- Partial unique index ensures at most 1 active hold per seat per event
CREATE UNIQUE INDEX uq_seat_holds_active ON seat_holds(event_id, seat_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_seat_holds_expiry ON seat_holds(expires_at) WHERE status = 'ACTIVE';
CREATE INDEX idx_seat_holds_user_event ON seat_holds(user_id, event_id, status);

-- =========================================================
-- 5. Orders & Payments (FR-13, FR-15, NFR-04)
-- =========================================================

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    order_code          VARCHAR(32) NOT NULL UNIQUE,
    status              order_status NOT NULL DEFAULT 'PENDING',
    total_amount        NUMERIC(14,0) NOT NULL CHECK (total_amount >= 0),
    discount_amount     NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    final_amount        NUMERIC(14,0) NOT NULL CHECK (final_amount >= 0),
    currency            VARCHAR(10) NOT NULL DEFAULT 'VND',
    payment_method      VARCHAR(30),
    expires_at          TIMESTAMPTZ NOT NULL,
    paid_at             TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_event_status ON orders(event_id, status);

CREATE TABLE order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seat_id             UUID NOT NULL REFERENCES seats(id),
    price               NUMERIC(14,0) NOT NULL CHECK (price >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_id, seat_id)
);

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id),
    payment_code        VARCHAR(64) NOT NULL UNIQUE,
    provider            VARCHAR(30) NOT NULL, -- 'MOMO', 'VNPAY'
    provider_txn_id     VARCHAR(120),
    amount              NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
    status              payment_status NOT NULL DEFAULT 'INITIATED',
    raw_response        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index ensures duplicate IPN with same provider transaction ID is idempotent
CREATE UNIQUE INDEX uq_payment_provider_txn ON payments(provider, provider_txn_id) WHERE provider_txn_id IS NOT NULL;
CREATE INDEX idx_payments_order ON payments(order_id);

-- =========================================================
-- 6. Tickets & Rotating QR (FR-12, FR-14, NFR-08)
-- =========================================================

CREATE TABLE tickets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id),
    event_id            UUID NOT NULL REFERENCES events(id),
    seat_id             UUID NOT NULL REFERENCES seats(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    ticket_code         VARCHAR(64) NOT NULL UNIQUE,
    qr_secret           VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    status              ticket_status NOT NULL DEFAULT 'ISSUED',
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index ensures at most 1 active/issued/used ticket per seat
CREATE UNIQUE INDEX uq_tickets_active_seat ON tickets (event_id, seat_id) WHERE status <> 'VOID';
CREATE INDEX idx_tickets_user_event ON tickets(user_id, event_id, status);

-- =========================================================
-- 7. Gate check-in & Offline Sync (FR-16, FR-17, FR-18, NFR-05, NFR-06)
-- =========================================================

CREATE TABLE gate_devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id            UUID NOT NULL REFERENCES venues(id),
    gate_name           VARCHAR(80) NOT NULL,
    device_code         VARCHAR(80) NOT NULL UNIQUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checkins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id           UUID NOT NULL REFERENCES tickets(id),
    event_id            UUID NOT NULL REFERENCES events(id),
    gate_device_id      UUID REFERENCES gate_devices(id),
    scanned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    result              checkin_result NOT NULL,
    is_offline          BOOLEAN NOT NULL DEFAULT FALSE,
    client_event_id     VARCHAR(120),
    synced_at           TIMESTAMPTZ,
    CHECK ((is_offline = FALSE) OR client_event_id IS NOT NULL)
);

CREATE UNIQUE INDEX uq_checkin_client_event ON checkins(client_event_id) WHERE client_event_id IS NOT NULL;
CREATE INDEX idx_checkins_ticket_time ON checkins(ticket_id, scanned_at DESC);

-- =========================================================
-- 8. Dynamic Pricing & Price Log (FR-20, FR-22, W-01, NFR-12)
-- =========================================================

CREATE TABLE price_changes (
    id                  BIGSERIAL PRIMARY KEY,
    event_id            UUID NOT NULL REFERENCES events(id),
    zone_id             UUID NOT NULL REFERENCES venue_zones(id),
    old_price           NUMERIC(14,0) NOT NULL,
    new_price           NUMERIC(14,0) NOT NULL,
    changed_by          UUID REFERENCES users(id),
    reason              TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_changes_event_zone ON price_changes(event_id, zone_id, created_at DESC);

CREATE TABLE price_suggestions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    zone_id             UUID NOT NULL REFERENCES venue_zones(id) ON DELETE CASCADE,
    current_price       NUMERIC(14,0) NOT NULL,
    suggested_price     NUMERIC(14,0) NOT NULL,
    reason              TEXT NOT NULL,
    metrics             JSONB NOT NULL DEFAULT '{}',
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_suggestions_event_status ON price_suggestions(event_id, status);

-- =========================================================
-- 9. Promotions (FR-23)
-- =========================================================

CREATE TABLE promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    code                VARCHAR(80),
    name                VARCHAR(150) NOT NULL,
    discount_type       VARCHAR(20) NOT NULL, -- 'PERCENT', 'FIXED'
    discount_value      NUMERIC(14,0) NOT NULL CHECK (discount_value > 0),
    starts_at           TIMESTAMPTZ,
    ends_at             TIMESTAMPTZ,
    usage_limit         INT,
    used_count          INT NOT NULL DEFAULT 0,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (event_id, code)
);

CREATE TABLE promotion_usages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id        UUID NOT NULL REFERENCES promotions(id),
    order_id            UUID NOT NULL REFERENCES orders(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    discount_amount     NUMERIC(14,0) NOT NULL CHECK (discount_amount >= 0),
    used_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (promotion_id, order_id)
);

-- =========================================================
-- 10. Audit Logs & Immutable History (NFR-12)
-- =========================================================

CREATE TABLE audit_logs (
    id                  BIGSERIAL PRIMARY KEY,
    actor_user_id       UUID REFERENCES users(id),
    event_id            UUID REFERENCES events(id),
    action              VARCHAR(80) NOT NULL,
    entity_type         VARCHAR(80) NOT NULL,
    entity_id           UUID,
    old_data            JSONB,
    new_data            JSONB,
    reason              TEXT,
    request_id          VARCHAR(120),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_event_time ON audit_logs(event_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- Trigger function to enforce append-only immutability
CREATE OR REPLACE FUNCTION prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Modification or deletion is strictly forbidden on audit log table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_price_changes
BEFORE UPDATE OR DELETE ON price_changes
FOR EACH ROW EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_modification();

-- =========================================================
-- 11. Analytics & Snapshots (FR-19, CEO Dashboard)
-- =========================================================

CREATE TABLE sales_snapshots (
    id                    BIGSERIAL PRIMARY KEY,
    event_id              UUID NOT NULL REFERENCES events(id),
    captured_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    tickets_sold          INT NOT NULL DEFAULT 0,
    tickets_available     INT NOT NULL DEFAULT 0,
    tickets_held          INT NOT NULL DEFAULT 0,
    gross_revenue         NUMERIC(18,0) NOT NULL DEFAULT 0,
    net_revenue           NUMERIC(18,0) NOT NULL DEFAULT 0,
    payment_success_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_sales_snapshot_event_time ON sales_snapshots(event_id, captured_at DESC);

-- +goose Down
DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON audit_logs;
DROP TRIGGER IF EXISTS trg_immutable_price_changes ON price_changes;
DROP FUNCTION IF EXISTS prevent_modification();

DROP TABLE IF EXISTS sales_snapshots CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS promotion_usages CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS price_suggestions CASCADE;
DROP TABLE IF EXISTS price_changes CASCADE;
DROP TABLE IF EXISTS checkins CASCADE;
DROP TABLE IF EXISTS gate_devices CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS seat_holds CASCADE;
DROP TABLE IF EXISTS queue_entries CASCADE;
DROP TABLE IF EXISTS event_zones CASCADE;
DROP TABLE IF EXISTS event_seats CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS venue_zones CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS checkin_result;
DROP TYPE IF EXISTS ticket_status;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS hold_status;
DROP TYPE IF EXISTS seat_status;
DROP TYPE IF EXISTS event_status;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;
