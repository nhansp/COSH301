-- FindOwnedEventSeats resolves a seat reference (UUID or label) among the seats
-- of an event that the user currently holds or has a ticket for.
-- name: FindOwnedEventSeats :many
SELECT s.id AS seat_id, s.seat_label
FROM seats s
JOIN event_seats es ON es.seat_id = s.id AND es.event_id = sqlc.arg(event_id)
WHERE (s.id::text = sqlc.arg(seat_ref)::text OR s.seat_label = sqlc.arg(seat_ref)::text)
  AND (
      EXISTS (
          SELECT 1 FROM seat_holds sh
          WHERE sh.event_id = sqlc.arg(event_id) AND sh.seat_id = s.id
            AND sh.user_id = sqlc.arg(user_id) AND sh.status = 'ACTIVE'
      )
      OR EXISTS (
          SELECT 1 FROM tickets t
          WHERE t.event_id = sqlc.arg(event_id) AND t.seat_id = s.id
            AND t.user_id = sqlc.arg(user_id) AND t.status IN ('ISSUED', 'ACTIVE')
      )
  );

-- name: VoidUserSeatTicket :execrows
UPDATE tickets
SET status = 'VOID', updated_at = now()
WHERE event_id = $1 AND seat_id = $2 AND user_id = $3 AND status IN ('ISSUED', 'ACTIVE');

-- name: ResetCancelledSeat :exec
UPDATE event_seats
SET status = 'AVAILABLE', current_price = (
        SELECT ez.base_price FROM event_zones ez JOIN seats z ON z.zone_id = ez.zone_id
        WHERE ez.event_id = event_seats.event_id AND z.id = event_seats.seat_id
    ),
    version = version + 1, updated_at = now()
WHERE event_seats.event_id = $1 AND event_seats.seat_id = $2 AND event_seats.status IN ('HELD', 'SOLD');

-- name: ReleaseUserActiveHolds :many
WITH released AS (
    UPDATE seat_holds
    SET status = 'RELEASED'
    WHERE user_id = $1 AND status = 'ACTIVE'
    RETURNING event_id AS rel_event_id, seat_id AS rel_seat_id
)
UPDATE event_seats
SET status = 'AVAILABLE', current_price = (
        SELECT ez.base_price FROM event_zones ez JOIN seats z ON z.zone_id = ez.zone_id
        WHERE ez.event_id = event_seats.event_id AND z.id = event_seats.seat_id
    ),
    version = event_seats.version + 1, updated_at = now()
FROM released
WHERE event_seats.event_id = released.rel_event_id
  AND event_seats.seat_id = released.rel_seat_id
  AND event_seats.status = 'HELD'
RETURNING released.rel_event_id, released.rel_seat_id;

-- Cancellations recorded before the user's latest demo reset are hidden.
-- name: ListUserCancelledTickets :many
SELECT a.id, a.created_at, COALESCE(a.reason, '')::text AS reason, a.old_data
FROM audit_logs a
WHERE a.action = 'TICKET_CANCELLED'
  AND a.actor_user_id = $1
  AND a.id > COALESCE((
      SELECT MAX(r.id) FROM audit_logs r
      WHERE r.action = 'DEMO_RESET' AND r.actor_user_id = $1
  ), 0)
ORDER BY a.created_at DESC
LIMIT 50;

-- name: ListStaffAuditLogs :many
SELECT
    a.id,
    a.action,
    a.entity_type,
    COALESCE(a.reason, '')::text AS reason,
    a.created_at,
    COALESCE(u.email, 'guest')::text AS actor_email,
    COALESCE(e.name, a.old_data->'concert'->>'name', 'N/A')::text AS event_name,
    a.old_data,
    a.new_data
FROM audit_logs a
LEFT JOIN users u ON a.actor_user_id = u.id
LEFT JOIN events e ON a.event_id = e.id
WHERE sqlc.arg(is_admin)::bool OR e.organizer_id = sqlc.arg(organizer_id)
ORDER BY a.created_at DESC
LIMIT 50;
