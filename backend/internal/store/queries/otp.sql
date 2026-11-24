-- name: CreateOTP :one
INSERT INTO otp_verifications (
    destination, channel, purpose, code_hash, expires_at
) VALUES (
    $1, $2, $3, $4, now() + make_interval(secs => sqlc.arg(ttl_seconds)::int)
) RETURNING *;

-- name: CountRecentOTPs :one
SELECT
    COUNT(*) FILTER (WHERE created_at > now() - make_interval(secs => sqlc.arg(cooldown_seconds)::int))::int AS in_cooldown,
    COUNT(*)::int AS in_window
FROM otp_verifications
WHERE destination = $1 AND purpose = $2
  AND created_at > now() - make_interval(secs => sqlc.arg(window_seconds)::int);

-- ConsumeOTPAttempt counts one verification attempt against the newest usable code
-- and returns it, so concurrent guesses cannot exceed the attempt limit.
-- name: ConsumeOTPAttempt :one
UPDATE otp_verifications
SET attempt_count = attempt_count + 1
WHERE id = (
    SELECT o.id FROM otp_verifications o
    WHERE o.destination = $1 AND o.purpose = $2
      AND o.verified_at IS NULL
      AND o.expires_at > now()
      AND o.attempt_count < sqlc.arg(max_attempts)::int
    ORDER BY o.created_at DESC
    LIMIT 1
    FOR UPDATE
)
RETURNING *;

-- name: MarkOTPVerified :execrows
UPDATE otp_verifications
SET verified_at = now()
WHERE id = $1 AND verified_at IS NULL;

-- name: CreateOTPAppDelivery :exec
INSERT INTO otp_app_deliveries (otp_id, destination, code, expires_at)
VALUES ($1, $2, $3, $4);

-- DeleteOTPAppDeliveries drops codes the app has not picked up that are expired
-- or were replaced by a newer request for the same destination.
-- name: DeleteOTPAppDeliveries :exec
DELETE FROM otp_app_deliveries
WHERE expires_at <= now() OR destination = $1;

-- name: DeleteExpiredOTPAppDeliveries :execrows
DELETE FROM otp_app_deliveries WHERE expires_at <= now();

-- ClaimOTPAppDelivery hands the newest unexpired code for a destination to the
-- app and deletes it, so each code is delivered at most once.
-- name: ClaimOTPAppDelivery :one
DELETE FROM otp_app_deliveries
WHERE otp_id = (
    SELECT d.otp_id FROM otp_app_deliveries d
    JOIN otp_verifications o ON o.id = d.otp_id
    WHERE d.destination = $1
      AND d.expires_at > now()
      AND o.verified_at IS NULL
    ORDER BY o.created_at DESC
    LIMIT 1
    FOR UPDATE OF d SKIP LOCKED
)
RETURNING code;
