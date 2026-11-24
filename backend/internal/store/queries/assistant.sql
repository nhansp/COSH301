-- Read-only queries for the assistant (FR-24). Every number the assistant says comes from here.

-- Events a customer can still buy a ticket for or ask about.
-- name: ListAssistantEvents :many
SELECT e.id, e.name, e.slug, e.genre, e.city, e.status, e.starts_at, e.ends_at,
       e.sales_starts_at, e.sales_ends_at, e.max_tickets_per_user,
       v.name AS venue_name,
       (SELECT MIN(ez.base_price) FROM event_zones ez WHERE ez.event_id = e.id)::bigint AS price_from
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE e.status IN ('ON_SALE', 'SOLD_OUT', 'PAUSED') AND e.ends_at > now()
ORDER BY e.starts_at;

-- Price and seats left per zone of one event.
-- name: ListAssistantEventZones :many
SELECT vz.code AS zone_code, vz.name AS zone_name, ez.base_price,
       COUNT(es.id)::int AS total_seats,
       (COUNT(es.id) FILTER (WHERE es.status = 'AVAILABLE'))::int AS available_seats
FROM event_zones ez
JOIN venue_zones vz ON vz.id = ez.zone_id
LEFT JOIN seats s ON s.zone_id = ez.zone_id AND s.is_active
LEFT JOIN event_seats es ON es.seat_id = s.id AND es.event_id = ez.event_id
WHERE ez.event_id = $1
GROUP BY ez.id, vz.id
ORDER BY ez.base_price DESC, vz.code;

-- Sales of the events an organizer owns, or of every event for an admin.
-- name: ListAssistantEventSales :many
SELECT e.id, e.name, e.slug, e.status, e.starts_at,
       (SELECT COUNT(*) FROM event_seats es WHERE es.event_id = e.id)::int AS total_seats,
       (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status <> 'VOID')::int AS sold_tickets,
       (SELECT COUNT(*) FROM seat_holds sh
         WHERE sh.event_id = e.id AND sh.status = 'ACTIVE' AND sh.expires_at > now())::int AS active_holds,
       (SELECT COALESCE(SUM(oi.price), 0) FROM tickets t
          JOIN order_items oi ON oi.order_id = t.order_id AND oi.seat_id = t.seat_id
         WHERE t.event_id = e.id AND t.status <> 'VOID')::bigint AS revenue
FROM events e
WHERE (sqlc.arg(is_admin)::bool OR e.organizer_id = sqlc.arg(organizer_id))
  AND e.status IN ('ON_SALE', 'SOLD_OUT', 'PAUSED', 'ENDED')
ORDER BY e.starts_at DESC
LIMIT 20;

-- Tickets sold per zone of one event, scoped the same way as ListAssistantEventSales.
-- name: ListAssistantZoneSales :many
SELECT vz.name AS zone_name,
       COUNT(t.id)::int AS sold_tickets,
       COALESCE(SUM(oi.price), 0)::bigint AS revenue
FROM events e
JOIN tickets t ON t.event_id = e.id AND t.status <> 'VOID'
JOIN order_items oi ON oi.order_id = t.order_id AND oi.seat_id = t.seat_id
JOIN seats s ON s.id = t.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
WHERE e.id = sqlc.arg(event_id)
  AND (sqlc.arg(is_admin)::bool OR e.organizer_id = sqlc.arg(organizer_id))
GROUP BY vz.id
ORDER BY COUNT(t.id) DESC, vz.name;
