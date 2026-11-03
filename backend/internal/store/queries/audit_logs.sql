-- name: CreateAuditLog :one
INSERT INTO audit_logs (
    actor_user_id,
    event_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    request_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING id, actor_user_id, event_id, action, entity_type, entity_id, old_data, new_data, reason, request_id, created_at;

-- name: ListAuditLogsByEvent :many
SELECT * FROM audit_logs
WHERE event_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAuditLogsByUser :many
SELECT * FROM audit_logs
WHERE actor_user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
