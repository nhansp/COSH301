-- name: GetOwnedTicketSecret :one
SELECT id, qr_secret, status
FROM tickets
WHERE id = $1 AND user_id = $2;

-- LockTicketForCheckin serializes scans of one ticket: a second gate scanning the
-- same code waits here and then sees the ticket as used.
-- name: LockTicketForCheckin :one
SELECT t.id, t.qr_secret, t.status, t.event_id, t.ticket_code,
       e.name AS event_name, s.seat_label, vz.name AS zone_name,
       COALESCE(u.full_name, u.phone, u.email, '')::text AS holder
FROM tickets t
JOIN events e ON e.id = t.event_id
JOIN seats s ON s.id = t.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
JOIN users u ON u.id = t.user_id
WHERE t.id = $1
FOR UPDATE OF t;

-- name: MarkTicketUsed :exec
UPDATE tickets SET status = 'USED', updated_at = now() WHERE id = $1;

-- name: InsertCheckin :one
INSERT INTO checkins (ticket_id, event_id, result)
VALUES ($1, $2, $3)
RETURNING scanned_at;

-- name: FirstValidCheckin :one
SELECT scanned_at FROM checkins
WHERE ticket_id = $1 AND result = 'VALID'
ORDER BY scanned_at
LIMIT 1;

-- name: CountEventCheckins :one
SELECT COUNT(*)::int AS checked_in
FROM checkins
WHERE event_id = $1 AND result = 'VALID';
