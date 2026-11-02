-- name: CreateUser :one
INSERT INTO users (
    phone, email, full_name, role, status, phone_verified_at, email_verified_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1 LIMIT 1;

-- name: GetUserByPhone :one
SELECT * FROM users WHERE phone = $1 LIMIT 1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1 LIMIT 1;

-- name: UpdateUserLastLogin :exec
UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1;

-- name: SetPhoneVerified :exec
UPDATE users SET phone_verified_at = now(), status = 'ACTIVE', updated_at = now() WHERE id = $1;

-- name: SetEmailVerified :exec
UPDATE users SET email_verified_at = now(), status = 'ACTIVE', updated_at = now() WHERE id = $1;
