-- +goose Up
-- Phone login codes are shown by the COSH301 OTP app instead of an SMS. The
-- app picks the code up once, so the plaintext lives here only until it is
-- claimed or expires; otp_verifications keeps just the hash.
CREATE TABLE otp_app_deliveries (
    otp_id      UUID PRIMARY KEY REFERENCES otp_verifications(id) ON DELETE CASCADE,
    destination VARCHAR(320) NOT NULL,
    code        CHAR(6) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_otp_app_deliveries_destination ON otp_app_deliveries(destination);
CREATE INDEX idx_otp_app_deliveries_expires_at ON otp_app_deliveries(expires_at);

-- Phone numbers are now stored as +84..., so move national-format numbers to it.
UPDATE users u
SET phone = '+84' || substr(u.phone, 2)
WHERE u.phone ~ '^0[0-9]{8,10}$'
  AND NOT EXISTS (SELECT 1 FROM users o WHERE o.phone = '+84' || substr(u.phone, 2));

-- +goose Down
DROP TABLE IF EXISTS otp_app_deliveries;
