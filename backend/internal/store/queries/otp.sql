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
