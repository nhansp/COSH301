-- +goose Up
-- Organizers and staff may test the buying flow in client-side preview mode only;
-- real seat holds, orders, and tickets are restricted to CUSTOMER accounts.

-- 1. Release any existing seats held or sold by non-CUSTOMER accounts back to AVAILABLE.
UPDATE event_seats es
SET status = 'AVAILABLE',
    current_price = (
        SELECT ez.base_price
        FROM event_zones ez
        JOIN seats s ON s.zone_id = ez.zone_id
        WHERE ez.event_id = es.event_id AND s.id = es.seat_id
    ),
    version = es.version + 1,
    updated_at = now()
WHERE EXISTS (
    SELECT 1
    FROM seat_holds sh
    JOIN users u ON u.id = sh.user_id
    WHERE sh.event_id = es.event_id
      AND sh.seat_id = es.seat_id
      AND sh.status = 'ACTIVE'
      AND u.role <> 'CUSTOMER'
)
OR EXISTS (
    SELECT 1
    FROM tickets t
    JOIN users u ON u.id = t.user_id
    WHERE t.event_id = es.event_id
      AND t.seat_id = es.seat_id
      AND t.status <> 'VOID'
      AND u.role <> 'CUSTOMER'
);

-- 2. Purge any non-CUSTOMER transactional purchase records.
DELETE FROM checkins
WHERE ticket_id IN (
    SELECT t.id FROM tickets t JOIN users u ON u.id = t.user_id WHERE u.role <> 'CUSTOMER'
);

DELETE FROM tickets
WHERE user_id IN (SELECT id FROM users WHERE role <> 'CUSTOMER');

DELETE FROM payments
WHERE order_id IN (
    SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id WHERE u.role <> 'CUSTOMER'
);

DELETE FROM promotion_usages
WHERE user_id IN (SELECT id FROM users WHERE role <> 'CUSTOMER')
   OR order_id IN (
       SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id WHERE u.role <> 'CUSTOMER'
   );

DELETE FROM orders
WHERE user_id IN (SELECT id FROM users WHERE role <> 'CUSTOMER');

DELETE FROM seat_holds
WHERE user_id IN (SELECT id FROM users WHERE role <> 'CUSTOMER');

-- 3. Enforce CUSTOMER-only purchases at the database layer.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION enforce_customer_purchaser()
RETURNS TRIGGER AS $$
DECLARE
    actor_role user_role;
BEGIN
    SELECT role INTO actor_role FROM users WHERE id = NEW.user_id;
    IF actor_role IS DISTINCT FROM 'CUSTOMER' THEN
        RAISE EXCEPTION 'Only CUSTOMER accounts may hold or purchase tickets (table %, role %)', TG_TABLE_NAME, actor_role
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trg_customer_only_seat_holds
BEFORE INSERT OR UPDATE OF user_id ON seat_holds
FOR EACH ROW EXECUTE FUNCTION enforce_customer_purchaser();

CREATE TRIGGER trg_customer_only_orders
BEFORE INSERT OR UPDATE OF user_id ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_customer_purchaser();

CREATE TRIGGER trg_customer_only_tickets
BEFORE INSERT OR UPDATE OF user_id ON tickets
FOR EACH ROW EXECUTE FUNCTION enforce_customer_purchaser();

-- +goose Down
DROP TRIGGER IF EXISTS trg_customer_only_tickets ON tickets;
DROP TRIGGER IF EXISTS trg_customer_only_orders ON orders;
DROP TRIGGER IF EXISTS trg_customer_only_seat_holds ON seat_holds;
DROP FUNCTION IF EXISTS enforce_customer_purchaser();
