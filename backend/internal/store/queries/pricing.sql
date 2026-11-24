-- name: ListDynamicPricingEvents :many
-- Events the pricing job analyzes: dynamic pricing on, on sale, sales still open.
SELECT e.id FROM events e
JOIN event_pricing_settings ps ON ps.event_id = e.id
WHERE ps.enabled AND e.status = 'ON_SALE' AND COALESCE(e.sales_ends_at, e.starts_at) > now();

-- name: GetEventPricingContext :one
-- Sales open at sales_starts_at (or when the event was created) and close at
-- sales_ends_at (or when the show starts).
SELECT e.id, e.name, e.status,
       COALESCE(e.sales_starts_at, e.created_at)::timestamptz AS sales_open_at,
       COALESCE(e.sales_ends_at, e.starts_at)::timestamptz AS sales_close_at,
       e.waiting_room_capacity,
       (SELECT count(*) FROM queue_entries q WHERE q.event_id = e.id AND q.status = 'WAITING')::bigint AS queue_waiting,
       COALESCE(ps.enabled, FALSE)::bool AS enabled,
       COALESCE(ps.auto_adjust, FALSE)::bool AS auto_adjust,
       COALESCE(ps.max_step_pct, 10)::int AS max_step_pct,
       COALESCE(ps.cooldown_minutes, 60)::int AS cooldown_minutes,
       ps.updated_at AS settings_updated_at
FROM events e
LEFT JOIN event_pricing_settings ps ON ps.event_id = e.id
WHERE e.id = $1;

-- name: ListZoneDemand :many
-- Inventory, demand counts and the last price move of every zone of an event.
-- list_price is the zone's price before its first logged change.
SELECT ez.zone_id, vz.code AS zone_code, vz.name AS zone_name,
       ez.base_price, ez.floor_price, ez.ceiling_price,
       ez.is_dynamic_pricing_enabled, ez.bounds_approved_at,
       COALESCE((SELECT pc.old_price FROM price_changes pc
                 WHERE pc.event_id = ez.event_id AND pc.zone_id = ez.zone_id
                 ORDER BY pc.id ASC LIMIT 1), ez.base_price)::bigint AS list_price,
       inv.capacity::bigint AS capacity,
       inv.available::bigint AS available,
       inv.held::bigint AS held,
       inv.sold::bigint AS sold,
       dem.holds_1h::bigint AS holds_1h,
       dem.holds_24h::bigint AS holds_24h,
       dem.holds_total::bigint AS holds_total,
       sal.sales_1h::bigint AS sales_1h,
       sal.sales_24h::bigint AS sales_24h,
       sal.sales_total::bigint AS sales_total,
       COALESCE(ds.demand_index, 0)::float8 AS previous_demand,
       lc.created_at AS last_change_at,
       COALESCE(lc.direction, 0)::int AS last_change_direction
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
CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE sh.created_at > now() - interval '1 hour') AS holds_1h,
           count(*) FILTER (WHERE sh.created_at > now() - interval '24 hours') AS holds_24h,
           count(*) AS holds_total
    FROM seat_holds sh JOIN seats s ON s.id = sh.seat_id
    WHERE sh.event_id = ez.event_id AND s.zone_id = ez.zone_id
) dem
CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE t.issued_at > now() - interval '1 hour') AS sales_1h,
           count(*) FILTER (WHERE t.issued_at > now() - interval '24 hours') AS sales_24h,
           count(*) AS sales_total
    FROM tickets t JOIN seats s ON s.id = t.seat_id
    WHERE t.event_id = ez.event_id AND s.zone_id = ez.zone_id AND t.status <> 'VOID'
) sal
LEFT JOIN zone_demand_state ds ON ds.event_id = ez.event_id AND ds.zone_id = ez.zone_id
LEFT JOIN LATERAL (
    SELECT pc.created_at, sign(pc.new_price - pc.old_price)::int AS direction
    FROM price_changes pc
    WHERE pc.event_id = ez.event_id AND pc.zone_id = ez.zone_id
    ORDER BY pc.id DESC LIMIT 1
) lc ON TRUE
WHERE ez.event_id = $1
ORDER BY ez.base_price DESC;

-- name: UpsertZoneDemandState :exec
INSERT INTO zone_demand_state (event_id, zone_id, demand_index)
VALUES ($1, $2, $3)
ON CONFLICT (event_id, zone_id) DO UPDATE SET demand_index = EXCLUDED.demand_index, updated_at = now();

-- name: UpsertPricingSettings :one
INSERT INTO event_pricing_settings (event_id, enabled, auto_adjust, max_step_pct, cooldown_minutes, updated_by)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (event_id) DO UPDATE SET enabled          = EXCLUDED.enabled,
                                     auto_adjust      = EXCLUDED.auto_adjust,
                                     max_step_pct     = EXCLUDED.max_step_pct,
                                     cooldown_minutes = EXCLUDED.cooldown_minutes,
                                     updated_by       = EXCLUDED.updated_by,
                                     updated_at       = now()
RETURNING *;

-- name: LockEventZones :many
SELECT zone_id, is_dynamic_pricing_enabled, bounds_approved_at
FROM event_zones WHERE event_id = $1
FOR UPDATE;

-- name: IncludeAllZones :exec
UPDATE event_zones SET is_dynamic_pricing_enabled = TRUE, updated_at = now() WHERE event_id = $1;

-- name: SetZoneIncluded :exec
UPDATE event_zones SET is_dynamic_pricing_enabled = $3, updated_at = now()
WHERE event_id = $1 AND zone_id = $2;

-- name: GetPendingSuggestion :one
SELECT * FROM price_suggestions
WHERE event_id = $1 AND zone_id = $2 AND status = 'PENDING';

-- name: UpsertPendingPriceSuggestion :one
INSERT INTO price_suggestions (event_id, zone_id, current_price, suggested_price, reason, metrics)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (event_id, zone_id) WHERE status = 'PENDING'
DO UPDATE SET current_price   = EXCLUDED.current_price,
              suggested_price = EXCLUDED.suggested_price,
              reason          = EXCLUDED.reason,
              metrics         = EXCLUDED.metrics,
              created_at      = now()
RETURNING *;

-- name: ExpirePendingSuggestion :exec
UPDATE price_suggestions SET status = 'EXPIRED', reviewed_at = now()
WHERE event_id = $1 AND zone_id = $2 AND status = 'PENDING';

-- name: ListPendingPriceSuggestions :many
SELECT ps.*, vz.code AS zone_code, vz.name AS zone_name
FROM price_suggestions ps
JOIN venue_zones vz ON vz.id = ps.zone_id
WHERE ps.event_id = $1 AND ps.status = 'PENDING'
ORDER BY vz.code;

-- name: GetPriceSuggestion :one
SELECT * FROM price_suggestions WHERE id = $1;

-- name: GetPriceSuggestionForUpdate :one
SELECT * FROM price_suggestions WHERE id = $1 FOR UPDATE;

-- name: ReviewPriceSuggestion :exec
UPDATE price_suggestions
SET status = $2, reviewed_by = $3, reviewed_at = now()
WHERE id = $1 AND status = 'PENDING';

-- name: ListPriceHistory :many
SELECT pc.id, pc.zone_id, vz.code AS zone_code, vz.name AS zone_name,
       pc.old_price, pc.new_price, pc.reason, pc.details, pc.created_at,
       pc.changed_by, u.full_name AS changed_by_name
FROM price_changes pc
JOIN venue_zones vz ON vz.id = pc.zone_id
LEFT JOIN users u ON u.id = pc.changed_by
WHERE pc.event_id = $1
ORDER BY pc.id DESC
LIMIT $2;

-- name: ListHourlyDemand :many
-- Holds, tickets and views of an event per hour over the last 48 hours.
WITH hours AS (
    SELECT generate_series(date_trunc('hour', now()) - interval '47 hours', date_trunc('hour', now()), interval '1 hour') AS bucket
)
SELECT hours.bucket::timestamptz AS bucket,
       (SELECT count(*) FROM seat_holds sh
        WHERE sh.event_id = $1 AND sh.created_at >= hours.bucket AND sh.created_at < hours.bucket + interval '1 hour')::bigint AS holds,
       (SELECT count(*) FROM tickets t
        WHERE t.event_id = $1 AND t.status <> 'VOID' AND t.issued_at >= hours.bucket AND t.issued_at < hours.bucket + interval '1 hour')::bigint AS sales,
       (SELECT count(*) FROM event_views v
        WHERE v.event_id = $1 AND v.viewed_at >= hours.bucket AND v.viewed_at < hours.bucket + interval '1 hour')::bigint AS views
FROM hours
ORDER BY hours.bucket;

-- name: InsertPricingAlert :one
-- Skips the alert when the same kind was raised for the zone within dedupe_minutes.
INSERT INTO pricing_alerts (event_id, zone_id, kind, message, data)
SELECT sqlc.arg(event_id)::uuid, sqlc.narg(zone_id)::uuid, sqlc.arg(kind)::varchar, sqlc.arg(message)::text, sqlc.arg(data)::jsonb
WHERE sqlc.arg(dedupe_minutes)::int = 0 OR NOT EXISTS (
    SELECT 1 FROM pricing_alerts a
    WHERE a.event_id = sqlc.arg(event_id)
      AND a.zone_id IS NOT DISTINCT FROM sqlc.narg(zone_id)
      AND a.kind = sqlc.arg(kind)
      AND a.created_at > now() - make_interval(mins => sqlc.arg(dedupe_minutes)::int)
)
RETURNING *;

-- name: ListPricingAlerts :many
SELECT a.*, vz.code AS zone_code, vz.name AS zone_name
FROM pricing_alerts a
LEFT JOIN venue_zones vz ON vz.id = a.zone_id
WHERE a.event_id = $1
ORDER BY a.created_at DESC
LIMIT $2;

-- name: GetPricingAlertEvent :one
SELECT event_id FROM pricing_alerts WHERE id = $1;

-- name: MarkPricingAlertRead :exec
UPDATE pricing_alerts SET read_at = COALESCE(read_at, now()) WHERE id = $1;

-- name: MarkEventPricingAlertsRead :exec
UPDATE pricing_alerts SET read_at = now() WHERE event_id = $1 AND read_at IS NULL;

-- name: ExpireEventPendingSuggestions :exec
UPDATE price_suggestions SET status = 'EXPIRED', reviewed_at = now()
WHERE event_id = $1 AND status = 'PENDING';

-- name: CountUnreadPricingAlerts :one
SELECT count(*)::bigint FROM pricing_alerts WHERE event_id = $1 AND read_at IS NULL;
