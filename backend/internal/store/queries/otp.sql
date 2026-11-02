-- name: CreateOTP :one
INSERT INTO otp_verifications (
    destination, channel, purpose, code_hash, expires_at
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetLatestOTP :one
SELECT * FROM otp_verifications
WHERE destination = $1 AND purpose = $2 AND verified_at IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- name: IncrementOTPAttempts :exec
UPDATE otp_verifications
SET attempt_count = attempt_count + 1
WHERE id = $1;

-- name: MarkOTPVerified :exec
UPDATE otp_verifications
SET verified_at = now()
WHERE id = $1;
