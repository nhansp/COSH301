-- name: ListPublishedEvents :many
SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.timezone AS venue_timezone, v.layout_config AS venue_layout_config,
       (SELECT MIN(ez.base_price) FROM event_zones ez WHERE ez.event_id = e.id)::bigint AS price_from
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.status IN ('ON_SALE', 'SOLD_OUT', 'PAUSED')
ORDER BY e.starts_at ASC;

-- name: GetEventBySlug :one
SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.timezone AS venue_timezone, v.layout_config AS venue_layout_config
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.slug = $1
LIMIT 1;

-- name: GetEventByID :one
SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.timezone AS venue_timezone, v.layout_config AS venue_layout_config
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.id = $1
LIMIT 1;

-- name: EventExists :one
SELECT EXISTS (SELECT 1 FROM events WHERE id = $1);

-- name: ListEventZonesWithPrices :many
SELECT ez.*, vz.code, vz.name AS zone_name, vz.floor, vz.capacity, vz.zone_kind
FROM event_zones ez
JOIN venue_zones vz ON ez.zone_id = vz.id
WHERE ez.event_id = $1
ORDER BY ez.base_price ASC;
