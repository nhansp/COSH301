# Sơ đồ thực thể liên kết (ERD) — Cơ sở dữ liệu PostgreSQL

Tài liệu này đặc tả cấu trúc cơ sở dữ liệu PostgreSQL của hệ thống EventTicketing, phục vụ toàn bộ các yêu cầu từ Sprint 2 đến Sprint 5.

## 1. Sơ đồ ERD tổng thể

```mermaid
erDiagram
    users ||--o{ sessions : "duy tri"
    users ||--o{ events : "to chuc"
    users ||--o{ seat_holds : "giu"
    users ||--o{ orders : "dat"
    users ||--o{ tickets : "so huu"
    users ||--o{ queue_entries : "xep hang"
    users ||--o{ price_changes : "thuc hien"
    users ||--o{ price_suggestions : "duyet"
    users ||--o{ promotions : "phe duyet"
    users ||--o{ promotion_usages : "su dung"
    users ||--o{ audit_logs : "tac dong"

    venues ||--o{ venue_zones : "chia khu"
    venues ||--o{ events : "dia diem to chuc"
    venues ||--o{ gate_devices : "lap dat"

    venue_zones ||--o{ seats : "chua"
    venue_zones ||--o{ event_zones : "ap gia"
    venue_zones ||--o{ price_changes : "ghi nhan gia"
    venue_zones ||--o{ price_suggestions : "de xuat gia"

    events ||--o{ event_seats : "phat hanh ghe"
    events ||--o{ event_zones : "cau hinh vung"
    events ||--o{ queue_entries : "hang cho"
    events ||--o{ seat_holds : "khoa ghe"
    events ||--o{ orders : "tao don"
    events ||--o{ tickets : "ve ban"
    events ||--o{ checkins : "soat ve"
    events ||--o{ price_changes : "doi gia"
    events ||--o{ price_suggestions : "de xuat"
    events ||--o{ promotions : "khuyen mai"
    events ||--o{ sales_snapshots : "thong ke"
    events ||--o{ audit_logs : "nhat ky"

    seats ||--o{ event_seats : "tham gia su kien"
    seats ||--o{ seat_holds : "khoa tam"
    seats ||--o{ order_items : "dong don hang"
    seats ||--o{ tickets : "phat hanh"

    orders ||--o{ order_items : "gom co"
    orders ||--o{ payments : "thanh toan"
    orders ||--o{ tickets : "sinh ra"
    orders ||--o{ promotion_usages : "ap dung ma"

    tickets ||--o{ checkins : "kiem tra"
    gate_devices ||--o{ checkins : "thuc hien quet"

    users {
        uuid id PK
        varchar phone UK
        varchar email UK
        varchar full_name
        enum role
        enum status
        timestamptz phone_verified_at
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    otp_verifications {
        uuid id PK
        varchar destination
        varchar channel
        varchar purpose
        varchar code_hash
        timestamptz expires_at
        timestamptz verified_at
        int attempt_count
        timestamptz created_at
    }

    sessions {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        varchar ip_address
        text user_agent
        timestamptz expires_at
        timestamptz created_at
    }

    venues {
        uuid id PK
        varchar name
        text address
        varchar timezone
        timestamptz created_at
    }

    venue_zones {
        uuid id PK
        uuid venue_id FK
        varchar code
        varchar name
        varchar floor
        int capacity
        timestamptz created_at
    }

    seats {
        uuid id PK
        uuid zone_id FK
        varchar row_label
        varchar seat_number
        varchar seat_label
        numeric x_position
        numeric y_position
        boolean is_active
        timestamptz created_at
    }

    events {
        uuid id PK
        uuid organizer_id FK
        uuid venue_id FK
        varchar name
        varchar slug UK
        text description
        varchar genre
        text image_url
        varchar city
        timestamptz starts_at
        timestamptz ends_at
        timestamptz sales_starts_at
        timestamptz sales_ends_at
        enum status
        int max_tickets_per_user
        boolean waiting_room_enabled
        int waiting_room_capacity
        timestamptz created_at
        timestamptz updated_at
    }

    event_seats {
        uuid id PK
        uuid event_id FK
        uuid seat_id FK
        enum status
        numeric current_price
        bigint version
        timestamptz updated_at
    }

    event_zones {
        uuid id PK
        uuid event_id FK
        uuid zone_id FK
        numeric base_price
        numeric floor_price
        numeric ceiling_price
        boolean is_dynamic_pricing_enabled
        timestamptz created_at
        timestamptz updated_at
    }

    queue_entries {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        int position
        varchar status
        timestamptz admitted_at
        timestamptz expires_at
        timestamptz created_at
    }

    seat_holds {
        uuid id PK
        uuid event_id FK
        uuid seat_id FK
        uuid user_id FK
        varchar hold_token
        enum status
        timestamptz created_at
        timestamptz expires_at
    }

    orders {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        varchar order_code UK
        enum status
        numeric total_amount
        numeric discount_amount
        numeric final_amount
        varchar currency
        varchar payment_method
        timestamptz expires_at
        timestamptz paid_at
        timestamptz cancelled_at
        timestamptz created_at
        timestamptz updated_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid seat_id FK
        numeric price
        timestamptz created_at
    }

    payments {
        uuid id PK
        uuid order_id FK
        varchar payment_code UK
        varchar provider
        varchar provider_txn_id
        numeric amount
        enum status
        jsonb raw_response
        timestamptz created_at
        timestamptz updated_at
    }

    tickets {
        uuid id PK
        uuid order_id FK
        uuid event_id FK
        uuid seat_id FK
        uuid user_id FK
        varchar ticket_code UK
        varchar qr_secret
        enum status
        timestamptz issued_at
        timestamptz updated_at
    }

    gate_devices {
        uuid id PK
        uuid venue_id FK
        varchar gate_name
        varchar device_code UK
        boolean is_active
        timestamptz last_synced_at
        timestamptz created_at
    }

    checkins {
        uuid id PK
        uuid ticket_id FK
        uuid event_id FK
        uuid gate_device_id FK
        timestamptz scanned_at
        enum result
        boolean is_offline
        varchar client_event_id UK
        timestamptz synced_at
    }

    price_changes {
        bigserial id PK
        uuid event_id FK
        uuid zone_id FK
        numeric old_price
        numeric new_price
        uuid changed_by FK
        text reason
        timestamptz created_at
    }

    price_suggestions {
        uuid id PK
        uuid event_id FK
        uuid zone_id FK
        numeric current_price
        numeric suggested_price
        text reason
        jsonb metrics
        varchar status
        uuid reviewed_by FK
        timestamptz reviewed_at
        timestamptz created_at
    }

    promotions {
        uuid id PK
        uuid event_id FK
        varchar code
        varchar name
        varchar discount_type
        numeric discount_value
        timestamptz starts_at
        timestamptz ends_at
        int usage_limit
        int used_count
        uuid approved_by FK
        timestamptz approved_at
        boolean is_active
    }

    promotion_usages {
        uuid id PK
        uuid promotion_id FK
        uuid order_id FK
        uuid user_id FK
        numeric discount_amount
        timestamptz used_at
    }

    audit_logs {
        bigserial id PK
        uuid actor_user_id FK
        uuid event_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb old_data
        jsonb new_data
        text reason
        varchar request_id
        timestamptz created_at
    }

    sales_snapshots {
        bigserial id PK
        uuid event_id FK
        timestamptz captured_at
        int tickets_sold
        int tickets_available
        int tickets_held
        numeric gross_revenue
        numeric net_revenue
        int payment_success_count
    }
```

---

## 2. Điểm khác biệt so với ERD Sprint 1

Hệ thống chuyển từ thiết kế MySQL ban đầu sang PostgreSQL 18 nhằm tận dụng cơ chế khóa mức dòng, giao dịch ACID và phát thông báo thời gian thực.

| Bảng | Thay đổi so với Sprint 1 | Lý do nghiệp vụ & kỹ thuật |
|---|---|---|
| Toàn bộ bảng | Khóa chính chuyển từ `char(36)` sang `uuid` mặc định `gen_random_uuid()` | Tối ưu dung lượng lưu trữ index và hiệu năng join trong PostgreSQL |
| Tiền tệ | Chuyển từ `decimal(14,2)` sang `numeric(14,0)` | Tiền đồng Việt Nam (VND) không sử dụng phần thập phân |
| Thời gian | Chuyển từ `datetime` sang `timestamptz` | Chuẩn hóa múi giờ quốc tế và tránh lệch giờ khi đối soát |
| Trạng thái | Chuyển thành kiểu `enum` riêng của PostgreSQL | Đảm bảo tính toàn vẹn dữ liệu từ tầng lưu trữ |
| `users` | Cho phép cột `phone` nhận giá trị rỗng (`NULL`) | Hỗ trợ đăng nhập khán giả qua email mà không bắt buộc số điện thoại |
| `users` | Bổ sung ràng buộc `CHECK (phone IS NOT NULL OR email IS NOT NULL)` | Đảm bảo luôn có ít nhất một kênh định danh để liên hệ và gửi vé |
| `users` | Bổ sung cột `email_verified_at` | Lưu mốc thời gian người dùng xác thực địa chỉ email |
| `otp_verifications` | Loại bỏ `user_id`, thêm `destination` và `channel` | Cho phép gửi mã OTP trước khi người dùng có bản ghi trong bảng `users` |
| `sessions` | Bổ sung bảng mới | Quản trị phiên đăng nhập trên máy chủ, lưu hash token và kiểm soát đăng xuất |
| `seat_holds` | Bỏ ràng buộc `UNIQUE(event_id, seat_id)` trên toàn bảng | Cho phép lưu lịch sử các lượt giữ ghế trước đó của từng ghế |
| `seat_holds` | Bổ sung Partial Unique Index `WHERE status = 'ACTIVE'` | Ngăn chặn triệt để tình trạng hai người cùng giữ một ghế tại một thời điểm |
| `tickets` | Bổ sung Partial Unique Index `WHERE status <> 'VOID'` | Đảm bảo một ghế thực tế chỉ thuộc về một vé hợp lệ duy nhất |
| `tickets` | Bổ sung cột `qr_secret` | Lưu khóa bí mật riêng từng vé phục vụ thuật toán sinh mã QR động đổi theo chu kỳ 30 giây (FR-12) |
| `events` | Bổ sung các cột `genre`, `image_url`, `city` | Cung cấp đầy đủ thông tin cho giao diện trang chủ và bộ lọc sự kiện |
| `events` | Bổ sung `waiting_room_enabled` và `waiting_room_capacity` | Cấu hình bật/tắt và giới hạn sức chứa của phòng chờ ảo khi mở bán (FR-09) |
| `payments` | Bổ sung Partial Unique Index trên `(provider, provider_txn_id)` | Đảm bảo tính lũy kế (idempotency) khi cổng thanh toán gửi lại webhook IPN nhiều lần |
| `price_suggestions` | Bổ sung bảng mới | Lưu trữ đề xuất định giá động do thuật toán AI sinh ra để Ban Tổ chức xem xét phê duyệt (W-01, FR-22) |
| `price_changes`, `audit_logs` | Bổ sung trigger chặn `UPDATE` và `DELETE` | Đảm bảo tính bất biến tuyệt đối của nhật ký thay đổi giá và nhật ký kiểm toán hệ thống (NFR-12) |

---

## 3. Các chỉ mục (Index) then chốt bảo vệ toàn vẹn dữ liệu

1. **Chống bán trùng ghế (FR-07, NFR-03):**
   ```sql
   CREATE UNIQUE INDEX uq_seat_holds_active 
   ON seat_holds (event_id, seat_id) 
   WHERE status = 'ACTIVE';
   ```
2. **Chống phát hành vé trùng ghế (FR-12):**
   ```sql
   CREATE UNIQUE INDEX uq_tickets_active_seat 
   ON tickets (event_id, seat_id) 
   WHERE status <> 'VOID';
   ```
3. **Chống xử lý trùng giao dịch cổng thanh toán (FR-13, NFR-04):**
   ```sql
   CREATE UNIQUE INDEX uq_payment_provider_txn 
   ON payments (provider, provider_txn_id) 
   WHERE provider_txn_id IS NOT NULL;
   ```
4. **Kiểm tra giới hạn vé mỗi tài khoản (FR-11):**
   ```sql
   CREATE INDEX idx_seat_holds_user_event 
   ON seat_holds (user_id, event_id, status);

   CREATE INDEX idx_tickets_user_event 
   ON tickets (user_id, event_id, status);
   ```
