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
