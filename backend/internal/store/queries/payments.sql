-- Checkout: the caller's holds that can still be bought, locked together with
-- their seats so nobody else can release or take them while the order is built.
-- name: LockBuyableHolds :many
SELECT sh.id AS hold_id, sh.seat_id, sh.expires_at, es.current_price
FROM seat_holds sh
JOIN event_seats es ON es.event_id = sh.event_id AND es.seat_id = sh.seat_id
WHERE sh.event_id = $1 AND sh.user_id = $2
  AND sh.status = 'ACTIVE' AND sh.expires_at > now()
  AND es.status = 'HELD'
ORDER BY sh.seat_id
FOR UPDATE OF sh, es;

-- name: LockPendingOrdersForUser :many
SELECT * FROM orders
WHERE user_id = $1 AND event_id = $2 AND status = 'PENDING'
ORDER BY created_at
FOR UPDATE;

-- name: ListOrderHoldIDs :many
SELECT hold_id FROM order_items WHERE order_id = $1 AND hold_id IS NOT NULL ORDER BY hold_id;

-- name: CancelOrder :exec
UPDATE orders SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
WHERE id = $1 AND status = 'PENDING';

-- name: CreateOrder :one
INSERT INTO orders (event_id, user_id, order_code, total_amount, service_fee, final_amount, payment_method, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, 'VNPAY', $7)
RETURNING *;

-- name: CreateOrderItem :exec
INSERT INTO order_items (order_id, seat_id, price, hold_id) VALUES ($1, $2, $3, $4);

-- name: CreatePayment :one
INSERT INTO payments (order_id, payment_code, provider, amount)
VALUES ($1, $2, 'VNPAY', $3)
RETURNING *;

-- IPN: resolve the payment without locking, then lock order and payment in a fixed order.
-- name: GetPaymentByCode :one
SELECT * FROM payments WHERE payment_code = $1;

-- name: LockOrderForUpdate :one
SELECT * FROM orders WHERE id = $1 FOR UPDATE;

-- name: LockPaymentForUpdate :one
SELECT * FROM payments WHERE id = $1 FOR UPDATE;

-- name: MarkPaymentFailed :exec
UPDATE payments
SET status = 'FAILED', raw_response = $2, updated_at = now()
WHERE id = $1;

-- name: MarkPaymentSuccess :exec
UPDATE payments
SET status = 'SUCCESS', provider_txn_id = $2, raw_response = $3,
    refund_required = $4, refund_reason = $5, updated_at = now()
WHERE id = $1;

-- Rows are locked in the same seat order as LockBuyableHolds.
-- name: LockOrderHolds :many
SELECT oi.seat_id, sh.status AS hold_status, sh.user_id AS hold_user_id, es.status AS seat_status
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN seat_holds sh ON sh.id = oi.hold_id
JOIN event_seats es ON es.event_id = o.event_id AND es.seat_id = oi.seat_id
WHERE oi.order_id = $1
ORDER BY oi.seat_id
FOR UPDATE OF sh, es;

-- name: CountOrderItems :one
SELECT COUNT(*)::int FROM order_items WHERE order_id = $1;

-- name: ConvertOrderHolds :exec
UPDATE seat_holds SET status = 'CONVERTED'
WHERE id IN (SELECT hold_id FROM order_items WHERE order_id = $1);

-- name: MarkOrderSeatsSold :exec
UPDATE event_seats es
SET status = 'SOLD', version = es.version + 1, updated_at = now()
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.order_id = $1 AND es.event_id = o.event_id AND es.seat_id = oi.seat_id;

-- name: IssueOrderTickets :many
INSERT INTO tickets (order_id, event_id, seat_id, user_id, ticket_code)
SELECT o.id, o.event_id, oi.seat_id, o.user_id,
       'TK' || upper(encode(gen_random_bytes(8), 'hex'))
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = $1
RETURNING seat_id;

-- name: MarkOrderPaid :exec
UPDATE orders SET status = 'PAID', paid_at = now(), updated_at = now() WHERE id = $1;

-- name: MarkOrderExpired :exec
UPDATE orders SET status = 'EXPIRED', updated_at = now() WHERE id = $1 AND status = 'PENDING';

-- name: ExpireStalePendingOrders :execrows
UPDATE orders SET status = 'EXPIRED', updated_at = now()
WHERE status = 'PENDING' AND expires_at <= now();

-- Return page: payment and order state keyed by the transaction reference.
-- name: GetPaymentReturnState :one
SELECT p.status AS payment_status, p.amount, p.refund_required,
       o.order_code, o.status AS order_status, o.event_id,
       (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id AND t.status <> 'VOID')::int AS ticket_count
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE p.payment_code = $1;

-- name: ListUserTickets :many
SELECT t.id, t.ticket_code, t.status, t.issued_at,
       e.id AS event_id, e.slug AS event_slug, e.name AS event_name, e.starts_at, v.name AS venue_name,
       e.image_url, e.image_credit,
       s.seat_label, vz.name AS zone_name, oi.price, o.order_code
FROM tickets t
JOIN orders o ON o.id = t.order_id
JOIN order_items oi ON oi.order_id = t.order_id AND oi.seat_id = t.seat_id
JOIN events e ON e.id = t.event_id
JOIN venues v ON v.id = e.venue_id
JOIN seats s ON s.id = t.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
WHERE t.user_id = $1 AND t.status <> 'VOID'
ORDER BY e.starts_at, t.issued_at, s.seat_label;
