-- name: RecordEventView :exec
-- One view per user and event per 30 minutes, so reloads do not inflate interest.
INSERT INTO event_views (event_id, user_id)
SELECT sqlc.arg(event_id)::uuid, sqlc.arg(user_id)::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM event_views v
    WHERE v.event_id = sqlc.arg(event_id) AND v.user_id = sqlc.arg(user_id)
      AND v.viewed_at > now() - interval '30 minutes'
);

-- name: ListUserTaste :many
-- A user's interactions over 180 days, weighted view 1, hold 2, ticket 3,
-- and decayed with a 30-day half-life (43.28 = 30 / ln 2).
WITH ix AS (
    SELECT v.event_id, 1.0 AS w, v.viewed_at AS at FROM event_views v
    WHERE v.user_id = $1 AND v.viewed_at > now() - interval '180 days'
    UNION ALL
    SELECT sh.event_id, 2.0, sh.created_at FROM seat_holds sh
    WHERE sh.user_id = $1 AND sh.created_at > now() - interval '180 days'
    UNION ALL
    SELECT t.event_id, 3.0, t.issued_at FROM tickets t
    WHERE t.user_id = $1 AND t.status <> 'VOID' AND t.issued_at > now() - interval '180 days'
)
SELECT COALESCE(e.genre, '')::text AS genre,
       COALESCE(e.city, '')::text AS city,
       sum(ix.w * exp(-extract(epoch FROM now() - ix.at) / 86400.0 / 43.28))::float8 AS weight,
       count(*)::bigint AS interactions
FROM ix
JOIN events e ON e.id = ix.event_id
GROUP BY 1, 2;

-- name: GetUserTypicalPrice :one
-- Median price of the seats a user has held or bought.
SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY es.current_price), 0)::float8 AS typical_price,
       count(*)::bigint AS samples
FROM (
    SELECT sh.event_id, sh.seat_id FROM seat_holds sh
    WHERE sh.user_id = $1 AND sh.created_at > now() - interval '180 days'
    UNION ALL
    SELECT t.event_id, t.seat_id FROM tickets t WHERE t.user_id = $1 AND t.status <> 'VOID'
) x
JOIN event_seats es ON es.event_id = x.event_id AND es.seat_id = x.seat_id;

-- name: ListRecommendationCandidates :many
-- Events on sale with their interest over the last 7 days.
SELECT e.id, e.slug, e.name, COALESCE(e.genre, '')::text AS genre, COALESCE(e.city, '')::text AS city,
       COALESCE(e.image_url, '')::text AS image_url, e.starts_at, v.name AS venue_name,
       (SELECT count(*) FROM event_views ev WHERE ev.event_id = e.id AND ev.viewed_at > now() - interval '7 days')::bigint AS views_7d,
       (SELECT count(*) FROM seat_holds sh WHERE sh.event_id = e.id AND sh.created_at > now() - interval '7 days')::bigint AS holds_7d,
       (SELECT count(*) FROM tickets t WHERE t.event_id = e.id AND t.status <> 'VOID' AND t.issued_at > now() - interval '7 days')::bigint AS sales_7d
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE e.status = 'ON_SALE';

-- name: ListCandidateZones :many
SELECT ez.event_id, ez.zone_id, vz.code AS zone_code, vz.name AS zone_name, ez.base_price,
       count(es.id)::bigint AS capacity,
       (count(es.id) FILTER (WHERE es.status = 'AVAILABLE'))::bigint AS available
FROM event_zones ez
JOIN events e ON e.id = ez.event_id
JOIN venue_zones vz ON vz.id = ez.zone_id
JOIN seats s ON s.zone_id = ez.zone_id
JOIN event_seats es ON es.event_id = ez.event_id AND es.seat_id = s.id
WHERE e.status = 'ON_SALE'
GROUP BY ez.event_id, ez.zone_id, vz.code, vz.name, ez.base_price;

-- name: ListUserPurchasedEvents :many
SELECT DISTINCT event_id FROM tickets WHERE user_id = $1 AND status <> 'VOID';

-- name: GetEventInterest :one
-- Interest the recommendation data shows for one event, and the platform-wide
-- view-to-hold rate the pricing engine compares it with.
SELECT
    (SELECT count(*) FROM event_views v WHERE v.event_id = $1 AND v.viewed_at > now() - interval '24 hours')::bigint AS views_24h,
    (SELECT count(DISTINCT v.user_id) FROM event_views v WHERE v.event_id = $1 AND v.viewed_at > now() - interval '24 hours')::bigint AS viewers_24h,
    (SELECT count(*) FROM seat_holds sh WHERE sh.event_id = $1 AND sh.created_at > now() - interval '24 hours')::bigint AS holds_24h,
    (SELECT count(*) FROM event_views v WHERE v.viewed_at > now() - interval '30 days')::bigint AS platform_views_30d,
    (SELECT count(*) FROM seat_holds sh WHERE sh.created_at > now() - interval '30 days')::bigint AS platform_holds_30d;
