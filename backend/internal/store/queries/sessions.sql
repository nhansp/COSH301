-- name: CreateSession :one
INSERT INTO sessions (
    user_id, token_hash, ip_address, user_agent, expires_at
) VALUES (
    $1, $2, $3, $4, now() + make_interval(hours => sqlc.arg(ttl_hours)::int)
) RETURNING *;

-- name: GetSessionByTokenHash :one
SELECT s.*, u.phone, u.email, u.full_name, u.role, u.status AS user_status
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'ACTIVE'
LIMIT 1;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token_hash = $1;

-- name: DeleteUserSessions :exec
DELETE FROM sessions WHERE user_id = $1;
