-- name: ListPublishedEvents :many
SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.timezone AS venue_timezone
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.status IN ('ON_SALE', 'SOLD_OUT', 'PAUSED')
ORDER BY e.starts_at ASC;

-- name: GetEventBySlug :one
SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.timezone AS venue_timezone
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.slug = $1
LIMIT 1;

-- name: GetEventByID :one
SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.timezone AS venue_timezone
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.id = $1
LIMIT 1;

-- name: ListEventZonesWithPrices :many
SELECT ez.*, vz.code, vz.name AS zone_name, vz.floor, vz.capacity
FROM event_zones ez
JOIN venue_zones vz ON ez.zone_id = vz.id
WHERE ez.event_id = $1
ORDER BY ez.base_price ASC;
