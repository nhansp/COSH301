# Sơ đồ tuần tự: Thanh toán VNPay và phát vé (FR-13)

Luồng từ lúc khán giả bấm "Thanh toán" đến lúc vé được phát hành.
Quy tắc ký, mã phản hồi IPN, cấu hình và cách thử nằm ở [`../payments.md`](../payments.md).

Cờ tính năng: `payments`. Cờ tắt thì mọi endpoint bên dưới trả `404 feature_disabled`.
Profile `sprint2` tắt cờ này, nên bản chạy phải đặt `FEATURE_PAYMENTS=on`.

## 1. Quy tắc

- Server tự tính tiền từ `event_seats.current_price`. Client chỉ gửi `eventId`.
- Phí dịch vụ là 3% tạm tính, làm tròn lên theo VND.
- Đơn hết hạn cùng lúc với lượt giữ ghế sớm nhất. Khán giả cần ít nhất 60 giây giữ ghế còn lại mới tạo được thanh toán.
- IPN là nguồn sự thật duy nhất. Trang return chỉ đọc và hiển thị.
- Một giao dịch VNPay chỉ được xử lý một lần, dù IPN đến nhiều lần hay đồng thời.
- Tiền đã vào nhưng ghế không còn của khách thì không phát vé. Giao dịch được đánh dấu `refund_required`.

## 2. Đối tượng

| Đối tượng | Lớp BCE | Vị trí |
|---|---|---|
| `PaymentHandler` | Boundary | `internal/httpapi/payments.go` |
| `PaymentService` | Control | `internal/service/payment_service.go` |
| `VNPayClient` (`vnpay.Client`) | Hỗ trợ | `internal/vnpay`, ký và kiểm tra chữ ký |
| `HoldReaper` | Control | `internal/service/hold_reaper.go` |
| `Queries` | Entity | `internal/store`, bảng `orders`, `order_items`, `payments`, `seat_holds`, `event_seats`, `tickets` |

`RealtimeHub` nhận `NOTIFY` từ giao dịch IPN, giống luồng giữ ghế (xem [`hold.md`](hold.md)).

## 3. Tạo thanh toán

```mermaid
sequenceDiagram
    autonumber
    actor KG as Khán giả (trình duyệt)
    participant H as PaymentHandler
    participant S as PaymentService
    participant V as VNPayClient
    participant Q as Queries (PostgreSQL)
    participant VN as VNPay

    KG->>H: POST /api/payments/vnpay/create {eventId}
    activate H
    H->>H: Kiểm tra cờ payments, RequireRole (phiên đăng nhập)
    H->>S: CreateVNPayCheckout(ctx, userID, eventID, ip)
    activate S
    S->>Q: BEGIN, LockUserEventAdvisory(user, event)
    S->>Q: GetEventSaleState(eventID)
    alt Sự kiện không tồn tại
        S-->>H: ErrEventNotFound
        H-->>KG: 404 {error: "event_not_found"}
    else Sự kiện không ON_SALE
        S-->>H: ErrEventNotOnSale
        H-->>KG: 409 {error: "event_not_on_sale"}
    end

    S->>Q: LockBuyableHolds(event, user)
    Note right of Q: Lượt giữ ACTIVE còn hạn, ghế HELD, khóa dòng
    alt Không có lượt giữ nào
        S-->>H: ErrNoActiveHolds
        H-->>KG: 409 {error: "no_active_holds"}
    end
    S->>S: Cộng current_price, lấy hạn sớm nhất của các lượt giữ
    alt Còn dưới 60 giây
        S-->>H: ErrHoldsExpiring
        H-->>KG: 409 {error: "holds_expiring"}
    end

    S->>S: orderForHolds(...)
    S->>Q: LockPendingOrdersForUser, ListOrderHoldIDs
    alt Có đơn PENDING còn hạn, đúng bộ lượt giữ hiện tại
        Note over S: Dùng lại đơn đó
    else Còn lại
        S->>Q: CancelOrder (các đơn PENDING khác của khán giả)
        S->>Q: CreateOrder (service_fee = 3%), CreateOrderItem (hold_id)
    end
    S->>Q: CreatePayment (INITIATED, payment_code)
    S->>Q: COMMIT
    S->>V: PaymentURL(PayRequest)
    V-->>S: URL có vnp_SecureHash (HMAC-SHA512)
    S-->>H: Checkout{orderCode, subtotal, serviceFee, total, expiresAt, paymentUrl}
    deactivate S
    H-->>KG: 201 Created {..., paymentUrl}
    deactivate H

    KG->>VN: Trình duyệt chuyển sang paymentUrl
    KG->>VN: Nhập thẻ, xác thực OTP của ngân hàng
```

## 4. IPN, phát vé và trang return

```mermaid
sequenceDiagram
    autonumber
    actor KG as Khán giả (trình duyệt)
    participant VN as VNPay
    participant H as PaymentHandler
    participant S as PaymentService
    participant V as VNPayClient
    participant Q as Queries (PostgreSQL)
    participant Hub as RealtimeHub

    VN->>H: GET /api/payments/vnpay/ipn?vnp_...
    H->>S: HandleVNPayIPN(ctx, query)
    activate S
    S->>V: Verify(query)
    alt Sai chữ ký
        S-->>H: IPNResult{97, Invalid signature}
    end
    S->>S: Kiểm tra vnp_TmnCode, vnp_TxnRef, vnp_Amount
    S->>Q: GetPaymentByCode(vnp_TxnRef)
    alt Không có giao dịch
        S-->>H: IPNResult{01, Order not found}
    end

    S->>Q: BEGIN, LockOrderForUpdate, LockPaymentForUpdate
    alt Số tiền khác payments.amount nhân 100
        S-->>H: IPNResult{04, Invalid amount}
    else payments không còn INITIATED hoặc PROCESSING
        S-->>H: IPNResult{02, Order already confirmed}
    else vnp_ResponseCode hoặc vnp_TransactionStatus khác 00
        S->>Q: MarkPaymentFailed
        S-->>H: IPNResult{00, Confirm Success}
        Note over S,Q: Đơn vẫn PENDING, khán giả thử lại bằng lần thanh toán mới
    else Thanh toán thành công
        S->>S: fulfil(ctx, qtx, order)
        alt Đơn PENDING và mọi lượt giữ còn ACTIVE, ghế còn HELD của khách
            S->>Q: ConvertOrderHolds (CONVERTED), MarkOrderSeatsSold (SOLD)
            S->>Q: IssueOrderTickets (ticket_code), MarkOrderPaid
            S->>Q: pg_notify(event_seats_channel, seat_sold) cho từng ghế
        else Lượt giữ đã mất, đơn đã hủy hoặc đã trả tiền
            S->>Q: MarkOrderExpired (nếu đơn PENDING)
            Note over S,Q: Không bán ghế, không phát vé. refund_reason là<br/>holds_no_longer_valid, order_not_pending hoặc order_already_paid
        end
        S->>Q: MarkPaymentSuccess (provider_txn_id, raw_response, refund_required)
        Note right of Q: uq_payment_provider_txn chặn trùng vnp_TransactionNo
        S->>Q: COMMIT
        S-->>H: IPNResult{00, Confirm Success}
    end
    deactivate S
    H-->>VN: 200 {"RspCode": "...", "Message": "..."}
    Q--)Hub: NOTIFY event_seats_channel (sau COMMIT)
    Hub--)KG: SSE event "update" {type: seat_sold, status: SOLD}

    VN-->>KG: Chuyển trình duyệt về /payment/vnpay/return?vnp_...
    KG->>H: GET /api/payments/vnpay/return?vnp_...
    H->>S: VerifyVNPayReturn(ctx, query)
    S->>V: Verify(query)
    alt Sai chữ ký
        H-->>KG: 400 {error: "invalid_signature"}
    end
    S->>Q: GetPaymentReturnState(vnp_TxnRef)
    alt Không thấy giao dịch
        H-->>KG: 404 {error: "payment_not_found"}
    end
    S-->>H: PaymentOutcome{status, orderCode, ticketCount, ...}
    H-->>KG: 200 {status: paid, processing, failed hoặc refund_pending}
    Note over KG: processing thì trang hỏi lại mỗi 2 giây, tối đa 8 lần
```

IPN và trang return đi song song, không có thứ tự cố định.
Vì vậy trang return có thể đến trước khi IPN ghi xong, và trạng thái `processing` cho biết điều đó.

## 5. Đơn quá hạn và xem vé

`HoldReaper` mỗi 5 giây gọi `PaymentService.ExpireStaleOrders`, chuyển đơn `PENDING` có `expires_at` đã qua sang `EXPIRED`.
Các `payments` của đơn đó giữ nguyên trạng thái, để IPN thành công đến muộn vẫn được ghi và đánh dấu cần hoàn tiền.

```mermaid
sequenceDiagram
    autonumber
    actor KG as Khán giả (trình duyệt)
    participant H as PaymentHandler
    participant S as PaymentService
    participant Q as Queries (PostgreSQL)

    KG->>H: GET /api/tickets
    H->>H: Kiểm tra cờ payments, RequireRole
    H->>S: ListMyTickets(ctx, userID)
    S->>Q: ListUserTickets(userID)
    Q-->>S: Vé kèm sự kiện, ghế, khu vực, giá
    S-->>H: List~MyTicket~
    H-->>KG: 200 [{ticketCode, eventName, seatLabel, ...}]
```

## 6. Mã phản hồi của `create` và `return`

| Endpoint | Tình huống | HTTP | `error` |
|---|---|:---:|---|
| `create` | Cờ `payments` tắt | 404 | `feature_disabled` |
| `create` | Chưa đăng nhập | 401 | `unauthorized` |
| `create` | Body không có `eventId` | 400 | `invalid_payload` |
| `create` | Không có sự kiện | 404 | `event_not_found` |
| `create` | Không có lượt giữ còn hạn | 409 | `no_active_holds` |
| `create` | Lượt giữ còn dưới 60 giây | 409 | `holds_expiring` |
| `create` | Sự kiện không ON_SALE | 409 | `event_not_on_sale` |
| `create` | Thành công | 201 | — |
| `return` | Sai chữ ký | 400 | `invalid_signature` |
| `return` | Không thấy giao dịch | 404 | `payment_not_found` |
| `return` | Thành công | 200 | — |

IPN luôn trả HTTP 200, mã kết quả nằm trong `RspCode` (xem [`../payments.md`](../payments.md) mục 3.2).
