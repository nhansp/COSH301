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

-- name: UpdateEventSeatStatus :exec
UPDATE event_seats
SET status = $3, version = version + 1, updated_at = now()
WHERE event_id = $1 AND seat_id = $2;

-- name: CreateSeatHold :one
INSERT INTO seat_holds (
    event_id, seat_id, user_id, hold_token, status, expires_at
) VALUES (
    $1, $2, $3, $4, 'ACTIVE', $5
) RETURNING *;

-- name: ReleaseSeatHold :exec
UPDATE seat_holds
SET status = 'RELEASED'
WHERE event_id = $1 AND seat_id = $2 AND user_id = $3 AND status = 'ACTIVE';

-- name: ExpireSeatHolds :many
UPDATE seat_holds
SET status = 'EXPIRED'
WHERE status = 'ACTIVE' AND expires_at <= now()
RETURNING event_id, seat_id;
