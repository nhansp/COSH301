-- +goose Up
-- Row triggers do not fire on TRUNCATE, so the append-only logs need statement triggers too (NFR-12).
CREATE TRIGGER trg_no_truncate_audit_logs
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_no_truncate_price_changes
BEFORE TRUNCATE ON price_changes
FOR EACH STATEMENT EXECUTE FUNCTION prevent_modification();

-- +goose Down
DROP TRIGGER IF EXISTS trg_no_truncate_price_changes ON price_changes;
DROP TRIGGER IF EXISTS trg_no_truncate_audit_logs ON audit_logs;
