# Sơ đồ tuần tự: Giữ ghế độc quyền 5 phút (FR-06, US-03)

Tài liệu này đặc tả luồng tương tác giữa các thành phần Boundary, Control và Entity khi khán giả thực hiện thao tác chọn giữ ghế và khi lượt giữ ghế hết hạn tự động.

## 1. Quy tắc nghiệp vụ

- Mọi thao tác giữ ghế được thực hiện trong một giao dịch cơ sở dữ liệu ACID duy nhất.
- Sử dụng `pg_advisory_xact_lock` theo cặp `(user_id, event_id)` để ngăn chặn tình trạng một tài khoản gửi đồng thời nhiều request nhằm vượt quá số lượng vé cho phép (FR-11).
- Ghế chỉ chuyển sang `HELD` khi trạng thái hiện tại là `AVAILABLE` hoặc là ghế đang `HELD` nhưng lượt giữ cũ đã hết hạn (`expires_at <= now()`).
- Sau khi giữ ghế thành công, hệ thống phát thông báo qua kênh `LISTEN/NOTIFY` của PostgreSQL để cập nhật sơ đồ ghế của tất cả khán giả đang mở trang sự kiện qua SSE (NFR-10).
- Bộ hẹn giờ chạy nền `HoldReaper` quét định kỳ và nhả ghế về trạng thái `AVAILABLE` nếu quá 5 phút mà khán giả chưa hoàn tất thanh toán.

---

## 2. Sơ đồ tuần tự: Khán giả chọn giữ ghế thành công

```mermaid
sequenceDiagram
    autonumber
    actor Khán giả as Khán giả (Trình duyệt)
    participant Boundary as SeatHandler (internal/httpapi)
    participant Control as SeatService (internal/service)
    participant DB as PostgreSQL (pgxpool)
    participant Hub as RealtimeHub (internal/service)
    actor Khán giả khác as Trình duyệt khác (SSE)

    Khán giả->>Boundary: POST /api/holds {eventId, seatId} (kèm Session Token)
    activate Boundary

    Boundary->>Boundary: Trích xuất user_id từ Session Token
    Boundary->>Control: HoldSeat(ctx, eventID, seatID, userID)
    activate Control

    Control->>DB: BEGIN Transaction
    activate DB

    Control->>DB: SELECT pg_advisory_xact_lock(hashtext(userID || eventID))
    DB-->>Control: Khóa thành công scope (user, event)

    Control->>DB: CountUserHeldAndBoughtTickets(eventID, userID)
    DB-->>Control: total_count

    alt total_count >= 4 (Vượt trần số vé quy định)
        Control->>DB: ROLLBACK Transaction
        Control-->>Boundary: ErrTicketLimitReached
        Boundary-->>Khán giả: 400 Bad Request {"error": "ticket_limit_reached"}
    else total_count < 4
        Control->>DB: TryLockSeat(eventID, seatID) [UPDATE WHERE status = 'AVAILABLE']
        
        alt Ghế không khả dụng (Đã bán hoặc đang có người giữ)
            Control->>DB: TryStealExpiredSeatHold(eventID, seatID)
            alt Vẫn không chiếm được ghế
                Control->>DB: ROLLBACK Transaction
                Control-->>Boundary: ErrSeatNotAvailable
                Boundary-->>Khán giả: 409 Conflict {"error": "seat_not_available"}
            end
        end

        Control->>DB: CreateSeatHold(eventID, seatID, userID, expires_at = now() + 5m)
        DB-->>Control: seat_holds record (holdToken, expiresAt)

        Control->>DB: SELECT pg_notify('event_seats_channel', payload_json)
        Control->>DB: COMMIT Transaction
        deactivate DB

        Control-->>Boundary: Trả về SeatHold
        deactivate Control

        Boundary-->>Khán giả: 201 Created {holdId, holdToken, seatId, expiresAt}
        deactivate Boundary

        Note over Khán giả: Khán giả thấy ghế chuyển màu Tím (Selected), đồng hồ đếm ngược 5:00 bắt đầu

        DB--)Hub: NOTIFY event_seats_channel {type: "seat_held", seatId, status: "HELD"}
        activate Hub
        Hub--)Khán giả khác: SSE event: update {seatId, status: "held"}
        deactivate Hub

        Note over Khán giả khác: Trình duyệt khác tự đổi màu ghế sang Vàng (Held) trong <= 3 giây
    end
```

---

## 3. Sơ đồ tuần tự: Tự động thu hồi ghế khi hết hạn 5 phút

```mermaid
sequenceDiagram
    autonumber
    participant Reaper as HoldReaper (internal/service)
    participant Control as SeatService (internal/service)
    participant DB as PostgreSQL
    participant Hub as RealtimeHub (internal/service)
    actor Khán giả as Khán giả (Trình duyệt)

    Note over Reaper: Tác vụ nền chạy định kỳ mỗi 5 giây
    Reaper->>Control: ExpireStaleHolds(ctx)
    activate Control

    Control->>DB: ExpireStaleSeatHolds()
    activate DB
    Note over DB: UPDATE seat_holds SET status = 'EXPIRED' WHERE expires_at <= now()<br/>UPDATE event_seats SET status = 'AVAILABLE' WHERE status = 'HELD'
    DB-->>Control: Danh sách [event_id, seat_id] vừa hết hạn
    deactivate DB

    loop Từng ghế được giải phóng
        Control->>DB: SELECT pg_notify('event_seats_channel', {type: "seat_expired", seatId, status: "AVAILABLE"})
    end
    Control-->>Reaper: Hoàn tất quét
    deactivate Control

    DB--)Hub: NOTIFY event_seats_channel
    activate Hub
    Hub--)Khán giả: SSE event: update {seatId, status: "available"}
    deactivate Hub

    Note over Khán giả: Sơ đồ ghế tự động chuyển màu ghế về Xanh (Available) trên màn hình
```
