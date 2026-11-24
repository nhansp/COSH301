-- name: ListActiveHoldsForOrder :many
SELECT
    sh.id AS hold_id,
    sh.event_id,
    sh.seat_id,
    sh.expires_at,
    s.seat_label,
    vz.id AS zone_id,
    vz.code AS zone_code,
    vz.name AS zone_name,
    es.current_price
FROM seat_holds sh
JOIN seats s ON s.id = sh.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
JOIN event_seats es ON es.event_id = sh.event_id AND es.seat_id = sh.seat_id
WHERE sh.event_id = $1
  AND sh.user_id = $2
  AND sh.status = 'ACTIVE'
  AND sh.expires_at > now()
ORDER BY s.seat_label ASC;

-- name: CreateOrder :one
INSERT INTO orders (
    event_id,
    user_id,
    order_code,
    status,
    total_amount,
    discount_amount,
    final_amount,
    currency,
    payment_method,
    expires_at
) VALUES (
    $1, $2, $3, 'PENDING', $4, $5, $6, 'VND', $7, $8
) RETURNING *;

-- name: CreateOrderItem :one
INSERT INTO order_items (
    order_id,
    seat_id,
    price
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: GetOrderByIDForUpdate :one
SELECT * FROM orders
WHERE id = $1
FOR UPDATE;

-- name: GetOrderWithEvent :one
SELECT
    o.id,
    o.event_id,
    o.user_id,
    o.order_code,
    o.status,
    o.total_amount,
    o.discount_amount,
    o.final_amount,
    o.currency,
    o.payment_method,
    o.expires_at,
    o.paid_at,
    o.cancelled_at,
    o.created_at,
    o.updated_at,
    e.name AS event_name,
    e.slug AS event_slug,
    e.starts_at AS event_starts_at,
    v.name AS venue_name
FROM orders o
JOIN events e ON e.id = o.event_id
JOIN venues v ON v.id = e.venue_id
WHERE o.id = $1;

-- name: ListUserOrders :many
SELECT
    o.id,
    o.event_id,
    o.user_id,
    o.order_code,
    o.status,
    o.total_amount,
    o.discount_amount,
    o.final_amount,
    o.currency,
    o.payment_method,
    o.expires_at,
    o.paid_at,
    o.cancelled_at,
    o.created_at,
    o.updated_at,
    e.name AS event_name,
    e.slug AS event_slug,
    e.starts_at AS event_starts_at,
    v.name AS venue_name
FROM orders o
JOIN events e ON e.id = o.event_id
JOIN venues v ON v.id = e.venue_id
WHERE o.user_id = $1
ORDER BY o.created_at DESC
LIMIT 50;

-- name: ListOrderItemsWithSeats :many
SELECT
    oi.id,
    oi.order_id,
    oi.seat_id,
    oi.price,
    s.seat_label,
    vz.id AS zone_id,
    vz.code AS zone_code,
    vz.name AS zone_name
FROM order_items oi
JOIN seats s ON s.id = oi.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
WHERE oi.order_id = $1
ORDER BY s.seat_label ASC;

-- name: CreatePayment :one
INSERT INTO payments (
    order_id,
    payment_code,
    provider,
    amount,
    status,
    raw_response
) VALUES (
    $1, $2, $3, $4, 'INITIATED', $5
) RETURNING *;

-- name: GetPaymentByCodeForUpdate :one
SELECT * FROM payments
WHERE payment_code = $1
FOR UPDATE;

-- name: GetPaymentByProviderTxn :one
SELECT * FROM payments
WHERE provider = $1 AND provider_txn_id = $2;

-- name: ListOrderPayments :many
SELECT * FROM payments
WHERE order_id = $1
ORDER BY created_at DESC;

-- name: UpdatePaymentResult :one
UPDATE payments
SET status = $2,
    provider_txn_id = $3,
    raw_response = $4,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: MarkOrderPaid :one
UPDATE orders
SET status = 'PAID',
    payment_method = $2,
    paid_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: MarkOrderRefunded :one
UPDATE orders
SET status = 'REFUNDED',
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ConvertSeatHold :execrows
UPDATE seat_holds
SET status = 'CONVERTED'
WHERE event_id = $1
  AND seat_id = $2
  AND user_id = $3
  AND status = 'ACTIVE';

-- name: MarkHeldSeatSold :execrows
UPDATE event_seats
SET status = 'SOLD',
    version = version + 1,
    updated_at = now()
WHERE event_id = $1
  AND seat_id = $2
  AND status = 'HELD';

-- name: MarkAvailableSeatSold :execrows
UPDATE event_seats
SET status = 'SOLD',
    version = version + 1,
    updated_at = now()
WHERE event_id = $1
  AND seat_id = $2
  AND status = 'AVAILABLE';

-- name: CreateTicket :one
INSERT INTO tickets (
    order_id,
    event_id,
    seat_id,
    user_id,
    ticket_code,
    qr_secret,
    status
) VALUES (
    $1, $2, $3, $4, $5, $6, 'ACTIVE'
) RETURNING *;

-- name: ListUserTickets :many
SELECT
    t.id,
    t.order_id,
    t.event_id,
    t.seat_id,
    t.user_id,
    t.ticket_code,
    t.status,
    t.issued_at,
    o.order_code,
    o.payment_method,
    o.paid_at,
    oi.price AS seat_price,
    e.name AS event_name,
    e.slug AS event_slug,
    e.starts_at AS event_starts_at,
    e.city AS event_city,
    e.image_url AS event_image_url,
    v.name AS venue_name,
    v.address AS venue_address,
    s.seat_label,
    s.row_label,
    s.seat_number,
    vz.id AS zone_id,
    vz.code AS zone_code,
    vz.name AS zone_name
FROM tickets t
JOIN orders o ON o.id = t.order_id
LEFT JOIN order_items oi ON oi.order_id = t.order_id AND oi.seat_id = t.seat_id
JOIN events e ON e.id = t.event_id
JOIN venues v ON v.id = e.venue_id
JOIN seats s ON s.id = t.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
WHERE t.user_id = $1
  AND t.status <> 'VOID'
ORDER BY t.issued_at DESC, s.seat_label ASC;

-- name: ListOrderTickets :many
SELECT
    t.id,
    t.order_id,
    t.event_id,
    t.seat_id,
    t.user_id,
    t.ticket_code,
    t.status,
    t.issued_at,
    o.order_code,
    o.payment_method,
    o.paid_at,
    oi.price AS seat_price,
    e.name AS event_name,
    e.slug AS event_slug,
    e.starts_at AS event_starts_at,
    e.city AS event_city,
    e.image_url AS event_image_url,
    v.name AS venue_name,
    v.address AS venue_address,
    s.seat_label,
    s.row_label,
    s.seat_number,
    vz.id AS zone_id,
    vz.code AS zone_code,
    vz.name AS zone_name
FROM tickets t
JOIN orders o ON o.id = t.order_id
LEFT JOIN order_items oi ON oi.order_id = t.order_id AND oi.seat_id = t.seat_id
JOIN events e ON e.id = t.event_id
JOIN venues v ON v.id = e.venue_id
JOIN seats s ON s.id = t.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
WHERE t.order_id = $1
ORDER BY s.seat_label ASC;

-- name: GetTicketDetailByID :one
SELECT
    t.id,
    t.order_id,
    t.event_id,
    t.seat_id,
    t.user_id,
    t.ticket_code,
    t.qr_secret,
    t.status,
    t.issued_at,
    e.name AS event_name,
    e.starts_at AS event_starts_at,
    v.name AS venue_name,
    s.seat_label,
    vz.name AS zone_name
FROM tickets t
JOIN events e ON e.id = t.event_id
JOIN venues v ON v.id = e.venue_id
JOIN seats s ON s.id = t.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
WHERE t.id = $1;

-- name: GetTicketByCode :one
SELECT
    t.id,
    t.order_id,
    t.event_id,
    t.seat_id,
    t.user_id,
    t.ticket_code,
    t.qr_secret,
    t.status,
    t.issued_at,
    e.name AS event_name,
    e.starts_at AS event_starts_at,
    v.name AS venue_name,
    s.seat_label,
    vz.name AS zone_name
FROM tickets t
JOIN events e ON e.id = t.event_id
JOIN venues v ON v.id = e.venue_id
JOIN seats s ON s.id = t.seat_id
JOIN venue_zones vz ON vz.id = s.zone_id
WHERE t.ticket_code = $1;
