-- +goose Up
-- Ensure a single stable demo customer account exists and consolidate any
-- tickets, orders, and holds created under earlier ephemeral demo-*@demo.invalid users.

-- +goose StatementBegin
DO $$
DECLARE
    demo_id UUID;
BEGIN
    SELECT id INTO demo_id FROM users WHERE email = 'khangia.demo@sortmyscene.live' LIMIT 1;

    IF demo_id IS NULL THEN
        INSERT INTO users (role, status, email, full_name, email_verified_at)
        VALUES ('CUSTOMER', 'ACTIVE', 'khangia.demo@sortmyscene.live', 'Khán giả Demo', now())
        RETURNING id INTO demo_id;
    END IF;

    UPDATE orders
    SET user_id = demo_id, updated_at = now()
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo-%@demo.invalid' AND id <> demo_id);

    UPDATE tickets
    SET user_id = demo_id, updated_at = now()
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo-%@demo.invalid' AND id <> demo_id);

    UPDATE seat_holds
    SET user_id = demo_id
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo-%@demo.invalid' AND id <> demo_id);

    UPDATE promotion_usages
    SET user_id = demo_id
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo-%@demo.invalid' AND id <> demo_id);
END $$;
-- +goose StatementEnd

-- +goose Down
-- Data consolidation is non-destructive and intentionally a no-op on rollback.
SELECT 1;
