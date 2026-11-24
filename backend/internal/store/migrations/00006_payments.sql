-- +goose Up

-- orders.final_amount = total_amount - discount_amount + service_fee.
ALTER TABLE orders
    ADD COLUMN service_fee NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
    ADD CONSTRAINT chk_orders_final_amount CHECK (final_amount = total_amount - discount_amount + service_fee);

CREATE INDEX idx_orders_pending_expiry ON orders(expires_at) WHERE status = 'PENDING';

-- The hold that reserved the seat when the order was created. The payment
-- confirmation converts exactly these holds.
ALTER TABLE order_items ADD COLUMN hold_id UUID REFERENCES seat_holds(id);

-- A payment can succeed at the provider after the order can no longer be
-- fulfilled (holds expired, order cancelled). Those need a manual refund.
ALTER TABLE payments
    ADD COLUMN refund_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN refund_reason   TEXT;

CREATE INDEX idx_payments_refund_required ON payments(created_at) WHERE refund_required;

-- +goose Down
DROP INDEX IF EXISTS idx_payments_refund_required;
ALTER TABLE payments DROP COLUMN IF EXISTS refund_reason, DROP COLUMN IF EXISTS refund_required;
ALTER TABLE order_items DROP COLUMN IF EXISTS hold_id;
DROP INDEX IF EXISTS idx_orders_pending_expiry;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_final_amount, DROP COLUMN IF EXISTS service_fee;
