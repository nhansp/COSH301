-- name: ListOrganizerEvents :many
SELECT e.id, e.name, e.slug, e.status, e.starts_at, e.ends_at, e.image_url, e.genre, e.city,
       v.name AS venue_name, v.address AS venue_address,
       (SELECT count(*) FROM pricing_alerts a WHERE a.event_id = e.id AND a.read_at IS NULL)::bigint AS unread_alerts,
       inv.capacity::bigint AS capacity,
       inv.available::bigint AS available,
       inv.held::bigint AS held,
       inv.sold::bigint AS sold
FROM events e
JOIN venues v ON e.venue_id = v.id
CROSS JOIN LATERAL (
    SELECT count(*) AS capacity,
           count(*) FILTER (WHERE es.status = 'AVAILABLE') AS available,
           count(*) FILTER (WHERE es.status = 'HELD') AS held,
           count(*) FILTER (WHERE es.status = 'SOLD') AS sold
    FROM event_seats es WHERE es.event_id = e.id
) inv
WHERE sqlc.arg(is_admin)::bool OR e.organizer_id = sqlc.arg(organizer_id)
ORDER BY e.starts_at;

-- name: GetOrganizerEvent :one
-- One event with its venue; venue_events counts the events sharing that venue.
SELECT e.*, v.name AS venue_name, v.address AS venue_address,
       (SELECT count(*) FROM events o WHERE o.venue_id = e.venue_id)::bigint AS venue_events
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE e.id = $1;

-- name: ListEventZoneInventory :many
SELECT ez.zone_id, vz.code AS zone_code, vz.name AS zone_name, vz.floor,
       ez.base_price, ez.floor_price, ez.ceiling_price, ez.is_dynamic_pricing_enabled,
       inv.capacity::bigint AS capacity,
       inv.available::bigint AS available,
       inv.held::bigint AS held,
       inv.sold::bigint AS sold
FROM event_zones ez
JOIN venue_zones vz ON vz.id = ez.zone_id
CROSS JOIN LATERAL (
    SELECT count(*) AS capacity,
           count(*) FILTER (WHERE es.status = 'AVAILABLE') AS available,
           count(*) FILTER (WHERE es.status = 'HELD') AS held,
           count(*) FILTER (WHERE es.status = 'SOLD') AS sold
    FROM event_seats es JOIN seats s ON s.id = es.seat_id
    WHERE es.event_id = ez.event_id AND s.zone_id = ez.zone_id
) inv
WHERE ez.event_id = $1
ORDER BY ez.base_price DESC;

-- name: LockEvent :one
SELECT * FROM events WHERE id = $1 FOR UPDATE;

-- name: UpdateEventInfo :exec
UPDATE events
SET name = $2, description = $3, genre = $4, image_url = $5, image_credit = $6, city = $7,
    starts_at = $8, ends_at = $9, sales_starts_at = $10, sales_ends_at = $11,
    status = $12, max_tickets_per_user = $13, updated_at = now()
WHERE id = $1;

-- name: UpdateVenueInfo :exec
UPDATE venues SET name = $2, address = $3 WHERE id = $1;

-- name: GetEventOrganizer :one
SELECT organizer_id FROM events WHERE id = $1;

-- name: GetEventZoneForUpdate :one
SELECT * FROM event_zones
WHERE event_id = $1 AND zone_id = $2
FOR UPDATE;

-- name: UpdateEventZonePricing :one
-- Saving the bounds is the organizer's approval of them for automatic pricing.
UPDATE event_zones
SET base_price = $3, floor_price = $4, ceiling_price = $5,
    bounds_approved_at = now(), bounds_approved_by = $6, updated_at = now()
WHERE event_id = $1 AND zone_id = $2
RETURNING *;

-- name: SetEventZoneBasePrice :exec
UPDATE event_zones SET base_price = $3, updated_at = now()
WHERE event_id = $1 AND zone_id = $2;

-- name: RepriceAvailableZoneSeats :execrows
UPDATE event_seats es
SET current_price = $3, version = es.version + 1, updated_at = now()
FROM seats s
WHERE es.seat_id = s.id
  AND es.event_id = $1
  AND s.zone_id = $2
  AND es.status = 'AVAILABLE';


-- name: InsertPriceChange :exec
INSERT INTO price_changes (event_id, zone_id, old_price, new_price, changed_by, reason, details)
VALUES ($1, $2, $3, $4, $5, $6, $7);
