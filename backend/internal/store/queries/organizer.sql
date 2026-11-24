-- name: ListOrganizerEvents :many
SELECT e.id, e.name, e.slug, e.status, e.starts_at, e.image_url, v.name AS venue_name
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE sqlc.arg(is_admin)::bool OR e.organizer_id = sqlc.arg(organizer_id)
ORDER BY e.starts_at;

-- name: GetEventOrganizer :one
SELECT organizer_id FROM events WHERE id = $1;

-- name: GetEventZoneForUpdate :one
SELECT * FROM event_zones
WHERE event_id = $1 AND zone_id = $2
FOR UPDATE;

-- name: UpdateEventZonePricing :one
UPDATE event_zones
SET base_price = $3, floor_price = $4, ceiling_price = $5, updated_at = now()
WHERE event_id = $1 AND zone_id = $2
RETURNING *;

-- name: RepriceAvailableZoneSeats :execrows
UPDATE event_seats es
SET current_price = $3, version = es.version + 1, updated_at = now()
FROM seats s
WHERE es.seat_id = s.id
  AND es.event_id = $1
  AND s.zone_id = $2
  AND es.status = 'AVAILABLE';


-- name: InsertPriceChange :exec
INSERT INTO price_changes (event_id, zone_id, old_price, new_price, changed_by, reason)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: EventSlugExists :one
SELECT EXISTS (SELECT 1 FROM events WHERE slug = $1);

-- name: CreateVenue :one
INSERT INTO venues (name, address, timezone, layout_config)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateVenueLayoutConfigByEvent :one
UPDATE venues v
SET layout_config = $2
FROM events e
WHERE e.venue_id = v.id AND e.id = $1
RETURNING v.layout_config;

-- name: CreateEvent :one
INSERT INTO events (
    organizer_id, venue_id, name, slug, description, genre, image_url, image_credit,
    city, starts_at, ends_at, status, max_tickets_per_user, waiting_room_enabled
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: CreateVenueZone :one
INSERT INTO venue_zones (venue_id, code, name, floor, capacity, zone_kind)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CreateEventZone :one
INSERT INTO event_zones (event_id, zone_id, base_price, floor_price, ceiling_price, is_dynamic_pricing_enabled)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CreateSeat :one
INSERT INTO seats (zone_id, row_label, seat_number, seat_label, x_position, y_position)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: CreateEventSeat :exec
INSERT INTO event_seats (event_id, seat_id, status, current_price)
VALUES ($1, $2, 'AVAILABLE', $3);
