# Sơ đồ tuần tự: Chống bán trùng ghế (FR-07)

Tài liệu đặc tả sơ đồ tuần tự (Sequence Diagram) xử lý kịch bản hai hoặc nhiều khán giả cùng tranh chấp một ghế tại cùng một mili-giây, bảo đảm loại trừ bán trùng ghế tuyệt đối theo yêu cầu `FR-07` và tiêu chuẩn kiến trúc mục 6 của [`docs/design/README.md`](../design/README.md).

---

## 1. Cơ chế phòng thủ hai tầng

Hệ thống loại bỏ hoàn toàn khả năng bán trùng (double-booking) tại tầng cơ sở dữ liệu PostgreSQL 18 mà không cần phụ thuộc vào bộ nhớ đệm ngoài:

1. **Tầng 1 — Cập nhật có điều kiện nguyên tử (Atomic Conditional Update):**
   ```sql
   UPDATE event_seats 
   SET status = 'HELD', updated_at = now()
   WHERE id = $1 AND event_id = $2 AND status = 'AVAILABLE'
   RETURNING id, status, updated_at;
   ```
   PostgreSQL tự động áp dụng khóa mức hàng (Row-level Lock) trên bản ghi ghế. Khi hai giao dịch đồng thời yêu cầu cập nhật cùng một hàng, một giao dịch sẽ tranh được khóa trước và đổi trạng thái thành `HELD`. Giao dịch đến sau bị chặn lại; khi giao dịch trước commit, câu truy vấn của giao dịch sau thực thi trên trạng thái mới của dòng (`status = 'HELD'`) nên điều kiện `status = 'AVAILABLE'` không còn thỏa mãn, trả về `rows_affected = 0`.

2. **Tầng 2 — Chỉ mục duy nhất có điều kiện (Partial Unique Index):**
   ```sql
   CREATE UNIQUE INDEX idx_seat_holds_active_seat 
   ON seat_holds (event_id, seat_id) 
   WHERE status = 'ACTIVE';
   ```
   Bảo đảm tại một thời điểm, chỉ duy nhất một bản ghi giữ chỗ ở trạng thái `ACTIVE` được phép tồn tại cho mỗi ghế trong một sự kiện. Mọi xung đột phát sinh ngoài ý muốn sẽ lập tức bị chặn bởi vi phạm ràng buộc toàn vẹn duy nhất của PostgreSQL.

---

## 2. Sơ đồ tuần tự tương tác (Sequence Diagram)

Tên các đối tượng tuân thủ chặt chẽ mô hình BCE đã chuẩn hóa tại [`docs/class-diagram.md`](../class-diagram.md):
- **Boundary:** `SeatHandler` (`internal/httpapi`)
- **Control:** `SeatService`, `RealtimeHub` (`internal/service`)
- **Entity / Store:** `DB (PostgreSQL 18)` (`internal/store`)

```mermaid
sequenceDiagram
    autonumber
    actor KhánGiả1 as Khán giả 1 (User A)
    actor KhánGiả2 as Khán giả 2 (User B)
    participant Boundary as SeatHandler (Boundary)
    participant Control as SeatService (Control)
    participant DB as PostgreSQL 18 (Entity / Lock)
    participant Hub as RealtimeHub (Control / SSE)

    Note over KhánGiả1,KhánGiả2: Cả hai khán giả cùng bấm chọn ghế S1 tại cùng 1 mili-giây

    par Yêu cầu của Khán giả 1
        KhánGiả1->>Boundary: POST /api/holds {event_id, seat_id: S1}
        Boundary->>Control: HoldSeat(ctx, User_A, Event_E, Seat_S1)
    and Yêu cầu của Khán giả 2
        KhánGiả2->>Boundary: POST /api/holds {event_id, seat_id: S1}
        Boundary->>Control: HoldSeat(ctx, User_B, Event_E, Seat_S1)
    end

    Note over Control,DB: Mở hai Transaction đồng thời (Tx1 cho User A, Tx2 cho User B)

    activate Control
    Control->>DB: Tx1: BEGIN & pg_advisory_xact_lock(hash(User_A, Event_E))
    Control->>DB: Tx2: BEGIN & pg_advisory_xact_lock(hash(User_B, Event_E))

    Control->>DB: Tx1: Kiểm tra quota User A (active holds + tickets < 4)
    DB-->>Control: Quota hợp lệ (0/4)
    Control->>DB: Tx2: Kiểm tra quota User B (active holds + tickets < 4)
    DB-->>Control: Quota hợp lệ (0/4)

    Note over DB: Tranh chấp Row Lock trên dòng ghế S1 (status = 'AVAILABLE')
    Control->>DB: Tx1: UPDATE event_seats SET status='HELD' WHERE id=S1 AND status='AVAILABLE'
    activate DB
    Note over DB: Tx1 giành được Row Lock trước
    Control->>DB: Tx2: UPDATE event_seats SET status='HELD' WHERE id=S1 AND status='AVAILABLE'
    Note over DB: Tx2 bị block chờ Tx1 giải phóng khóa

    DB-->>Control: Tx1: Cập nhật thành công (1 row affected)
    Control->>DB: Tx1: INSERT INTO seat_holds (User_A, S1, 'ACTIVE', now() + 5m)
    DB-->>Control: Tx1: Insert thành công (Thỏa mãn Partial Unique Index)
    Control->>DB: Tx1: SELECT pg_notify('events_stream', '{"type":"seat_updated","seat_id":"S1","status":"HELD"}')
    Control->>DB: Tx1: COMMIT Transaction
    deactivate DB

    Note over DB: Tx1 COMMIT giải phóng Row Lock cho Tx2
    activate DB
    Note over DB: Tx2 đọc hàng S1: status hiện tại là 'HELD' (không còn 'AVAILABLE')
    DB-->>Control: Tx2: Cập nhật thất bại (0 rows affected)
    deactivate DB

    Note over Control,DB: Tx2 kiểm tra hold hiện tại trên ghế S1
    Control->>DB: Tx2: SELECT * FROM seat_holds WHERE seat_id=S1 AND status='ACTIVE'
    DB-->>Control: Trả về lượt giữ còn hiệu lực của User_A (expires_at > now())
    Control->>DB: Tx2: ROLLBACK Transaction

    par Phản hồi cho Khán giả 1 (Thành công)
        Control-->>Boundary: Trả về SeatHold (expires_at: now() + 300s)
        Boundary-->>KhánGiả1: 201 Created {hold_id, expires_at, status: "ACTIVE"}
        Note over KhánGiả1: Màn hình đổi ghế S1 sang màu tím (đang giữ), đếm ngược 5:00
    and Phản hồi cho Khán giả 2 (Xung đột)
        Control-->>Boundary: Trả về ErrSeatNotAvailable
        Boundary-->>KhánGiả2: 409 Conflict {"error":"seat_not_available","message":"Ghế đã có người giữ"}
        Note over KhánGiả2: Màn hình thông báo ghế đã bị giữ, không thêm vào giỏ
    end

    Note over DB,Hub: Tín hiệu pg_notify từ Tx1 kích hoạt broadcast qua SSE
    DB-->>Hub: NOTIFY events_stream payload
    Hub-->>KhánGiả2: SSE event "seat_updated": {seat_id: "S1", status: "HELD"}
    Note over KhánGiả2: Ghế S1 tự động chuyển sang màu vàng (người khác đang giữ)
    deactivate Control
```

---

## 3. Các kịch bản ngoại lệ và giải quyết

| Tình huống | Cơ chế xử lý | Kết quả |
|---|---|---|
| Cả hai cùng gửi lệnh `INSERT` vào `seat_holds` | Partial Unique Index `idx_seat_holds_active_seat` chặn lại tại engine cơ sở dữ liệu. | Một bên thành công, bên còn lại gặp lỗi `23505 (unique_violation)`. Transaction rollback an toàn. |
| Ghế đang có một lượt giữ cũ đã quá 5 phút | Lệnh `HoldSeat` kiểm tra `expires_at <= now()`. Nếu lượt giữ cũ đã hết hạn, hệ thống thực hiện giải phóng hoặc ghi đè lượt giữ mới (stale hold stealing). | Khán giả mới giữ thành công; khán giả cũ quá hạn bị từ chối thanh toán. |
| Một người dùng gửi đồng thời 10 request giữ ghế | Hàm `pg_advisory_xact_lock(hash(user_id, event_id))` tuần tự hóa các yêu cầu của cùng một người dùng. Kiểm tra `COUNT(seat_holds) + COUNT(tickets)` tại bước 2. | Tối đa 4 yêu cầu thành công, các yêu cầu thứ 5 trở đi bị từ chối với mã `400 Bad Request (ticket_limit_exceeded)`. |
