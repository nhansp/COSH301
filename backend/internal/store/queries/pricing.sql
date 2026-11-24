-- name: ListPricingEventIDs :many
SELECT id FROM events
WHERE status = 'ON_SALE'
  AND (sales_starts_at IS NULL OR sales_starts_at <= now())
  AND COALESCE(sales_ends_at, starts_at) > now()
ORDER BY starts_at;

-- Minutes until sales close. Without a sales end, sales close when the event starts.
-- name: GetEventPricingTiming :one
SELECT status,
       (sales_starts_at IS NULL OR sales_starts_at <= now()) AS sales_started,
       (EXTRACT(EPOCH FROM (COALESCE(sales_ends_at, starts_at) - now())) / 60)::float8 AS minutes_left
FROM events
WHERE id = $1;

-- Seat counts of a zone, and how many distinct seats were held or sold in the last window_minutes.
-- name: GetZoneDemand :one
WITH recent AS (
    SELECT sh.seat_id FROM seat_holds sh
    WHERE sh.event_id = sqlc.arg(event_id)
      AND sh.created_at >= now() - make_interval(mins => sqlc.arg(window_minutes)::int)
    UNION
    SELECT t.seat_id FROM tickets t
    WHERE t.event_id = sqlc.arg(event_id)
      AND t.issued_at >= now() - make_interval(mins => sqlc.arg(window_minutes)::int)
      AND t.status <> 'VOID'
)
SELECT
    (count(*) FILTER (WHERE es.status = 'AVAILABLE'))::int AS available,
    (count(*) FILTER (WHERE es.status = 'HELD'))::int AS held,
    (count(*) FILTER (WHERE es.status = 'SOLD'))::int AS sold,
    (count(*) FILTER (WHERE es.status <> 'BLOCKED'))::int AS total,
    (count(*) FILTER (WHERE es.seat_id IN (SELECT seat_id FROM recent)))::int AS demand_seats
FROM event_seats es
JOIN seats s ON s.id = es.seat_id
WHERE es.event_id = sqlc.arg(event_id) AND s.zone_id = sqlc.arg(zone_id) AND s.is_active = TRUE;

-- name: CountWaitingQueue :one
SELECT count(*)::int FROM queue_entries WHERE event_id = $1 AND status = 'WAITING';

-- name: GetPendingPriceSuggestion :one
SELECT * FROM price_suggestions
WHERE event_id = $1 AND zone_id = $2 AND status = 'PENDING';

-- name: InsertPriceSuggestion :one
INSERT INTO price_suggestions (event_id, zone_id, current_price, suggested_price, reason, metrics)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: RefreshPriceSuggestion :one
UPDATE price_suggestions
SET current_price = $2, suggested_price = $3, reason = $4, metrics = $5, updated_at = now()
WHERE id = $1 AND status = 'PENDING'
RETURNING *;

-- The engine withdraws an open suggestion the data no longer supports.
-- name: ExpirePendingPriceSuggestion :execrows
UPDATE price_suggestions
SET status = 'EXPIRED', updated_at = now()
WHERE event_id = $1 AND zone_id = $2 AND status = 'PENDING';

-- True when the organizer already rejected this exact change recently.
-- name: HasRecentRejection :one
SELECT EXISTS (
    SELECT 1 FROM price_suggestions
    WHERE event_id = sqlc.arg(event_id) AND zone_id = sqlc.arg(zone_id)
      AND status = 'REJECTED'
      AND current_price = sqlc.arg(current_price) AND suggested_price = sqlc.arg(suggested_price)
      AND reviewed_at >= now() - make_interval(mins => sqlc.arg(cooldown_minutes)::int)
);

-- name: GetPriceSuggestion :one
SELECT * FROM price_suggestions WHERE id = $1;

-- name: GetPriceSuggestionForUpdate :one
SELECT * FROM price_suggestions WHERE id = $1 FOR UPDATE;

-- name: MarkPriceSuggestionReviewed :one
UPDATE price_suggestions
SET status = sqlc.arg(status), reviewed_by = sqlc.arg(reviewed_by), reviewed_at = now(), updated_at = now()
WHERE id = sqlc.arg(id) AND status = 'PENDING'
RETURNING *;

-- name: ExpirePriceSuggestion :exec
UPDATE price_suggestions SET status = 'EXPIRED', updated_at = now()
WHERE id = $1 AND status = 'PENDING';

-- name: ListPendingPriceSuggestions :many
SELECT * FROM price_suggestions WHERE event_id = $1 AND status = 'PENDING';

-- The newest changes of every zone of an event, oldest first within a zone.
-- name: ListZonePriceHistory :many
SELECT zone_id, old_price, new_price, reason, created_at
FROM (
    SELECT pc.zone_id, pc.old_price, pc.new_price, pc.reason, pc.created_at, pc.id,
           row_number() OVER (PARTITION BY pc.zone_id ORDER BY pc.created_at DESC, pc.id DESC) AS rn
    FROM price_changes pc
    WHERE pc.event_id = sqlc.arg(event_id)
) ranked
WHERE rn <= sqlc.arg(max_rows)::int
ORDER BY zone_id, created_at, id;

-- The latest change of each zone that happened after since, for the trend badge on the seat map.
-- name: ListRecentZonePriceChanges :many
SELECT DISTINCT ON (zone_id) zone_id, old_price, new_price, created_at
FROM price_changes
WHERE event_id = $1 AND created_at >= $2
ORDER BY zone_id, created_at DESC, id DESC;

-- name: SetZoneDynamicPricing :one
UPDATE event_zones
SET is_dynamic_pricing_enabled = $3, updated_at = now()
WHERE event_id = $1 AND zone_id = $2
RETURNING *;
