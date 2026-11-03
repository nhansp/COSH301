-- name: GetEventSeatMap :many
SELECT 
    es.id AS event_seat_id,
    es.event_id,
    es.seat_id,
    es.status,
    es.current_price,
    s.row_label,
    s.seat_number,
    s.seat_label,
    s.x_position,
    s.y_position,
    vz.id AS zone_id,
    vz.code AS zone_code,
    vz.name AS zone_name
FROM event_seats es
JOIN seats s ON es.seat_id = s.id
JOIN venue_zones vz ON s.zone_id = vz.id
WHERE es.event_id = $1 AND s.is_active = TRUE
ORDER BY vz.code, s.row_label, s.seat_number;

-- name: LockUserEventAdvisory :exec
SELECT pg_advisory_xact_lock(hashtext($1::text || ':' || $2::text));

-- name: CountUserHeldAndBoughtTickets :one
SELECT 
    (
        SELECT COUNT(*) 
        FROM seat_holds sh 
        WHERE sh.event_id = $1 AND sh.user_id = $2 AND sh.status = 'ACTIVE' AND sh.expires_at > now()
    ) + (
        SELECT COUNT(*) 
        FROM tickets t 
        WHERE t.event_id = $1 AND t.user_id = $2 AND t.status <> 'VOID'
    ) AS total_count;

-- name: TryLockSeat :one
UPDATE event_seats
SET status = 'HELD', version = version + 1, updated_at = now()
WHERE event_id = $1 AND seat_id = $2 AND status = 'AVAILABLE'
RETURNING id, event_id, seat_id, status, current_price, version, updated_at;

-- name: TryStealExpiredSeatHold :one
WITH expired_hold AS (
    UPDATE seat_holds
    SET status = 'EXPIRED'
    WHERE event_id = $1 AND seat_id = $2 AND status = 'ACTIVE' AND expires_at <= now()
    RETURNING id
)
UPDATE event_seats
SET status = 'HELD', version = event_seats.version + 1, updated_at = now()
WHERE event_seats.event_id = $1 AND event_seats.seat_id = $2 AND event_seats.status = 'HELD' AND EXISTS (SELECT 1 FROM expired_hold)
RETURNING id, event_id, seat_id, status, current_price, version, updated_at;

-- name: CreateSeatHold :one
INSERT INTO seat_holds (
    event_id, seat_id, user_id, hold_token, status, expires_at
) VALUES (
    $1, $2, $3, $4, 'ACTIVE', $5
) RETURNING *;

-- name: ReleaseSeatHold :one
UPDATE seat_holds
SET status = 'RELEASED'
WHERE event_id = $1 AND seat_id = $2 AND user_id = $3 AND status = 'ACTIVE'
RETURNING *;

-- name: ResetSeatToAvailable :exec
UPDATE event_seats
SET status = 'AVAILABLE', version = version + 1, updated_at = now()
WHERE event_id = $1 AND seat_id = $2 AND status = 'HELD';

-- name: ExpireStaleSeatHolds :many
WITH expired AS (
    UPDATE seat_holds
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND expires_at <= now()
    RETURNING event_id AS exp_event_id, seat_id AS exp_seat_id
)
UPDATE event_seats
SET status = 'AVAILABLE', version = version + 1, updated_at = now()
FROM expired
WHERE event_seats.event_id = expired.exp_event_id 
  AND event_seats.seat_id = expired.exp_seat_id 
  AND event_seats.status = 'HELD'
RETURNING expired.exp_event_id, expired.exp_seat_id;

-- name: ListActiveHoldsForUser :many
SELECT sh.*, s.seat_label, vz.name as zone_name
FROM seat_holds sh
JOIN seats s ON sh.seat_id = s.id
JOIN venue_zones vz ON s.zone_id = vz.id
WHERE sh.event_id = $1 AND sh.user_id = $2 AND sh.status = 'ACTIVE' AND sh.expires_at > now();

-- name: NotifyChannel :exec
SELECT pg_notify($1, $2);
