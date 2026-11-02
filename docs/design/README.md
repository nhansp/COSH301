# EventTicketing — Thiết kế hệ thống

Tài liệu gốc cho code ở `backend/` và `frontend/`.
Mọi sơ đồ (Use Case, DFD, ERD, Class, Sequence, Kiến trúc) đều lấy từ tài liệu này hoặc sinh từ code.
Vì vậy các sơ đồ luôn khớp nhau.

Mã yêu cầu giữ nguyên theo tài liệu SA (System design): FR-01 … FR-23, NFR-01 … NFR-13, W-01 … W-05.

## 1. Phạm vi và cờ tính năng

Nhóm xây toàn bộ tính năng trong một lần.
Mỗi tính năng có một cờ (feature flag).
Mỗi Sprint là một *profile*, chỉ bật các cờ thuộc Sprint đó.

Khi cờ tắt:
- giao diện ẩn tính năng;
- API trả `404 feature_disabled`.

| Cờ | Yêu cầu | Sprint | Nội dung |
|---|---|---|---|
| `otp_login` | FR-01, FR-04 | 2 | Đăng nhập bằng OTP qua SMS hoặc email |
| `seat_map_realtime` | FR-03, FR-05, NFR-10 | 2 | Sơ đồ ghế cập nhật trực tiếp |
| `seat_hold` | FR-06, FR-07, NFR-03 | 2 | Giữ ghế 5 phút, chống bán trùng |
| `zone_pricing` | FR-08 | 2 | Giá sàn, giá trần theo khu vực |
| `organizer_console` | FR-08 | 2 | BTC quản lý sự kiện, địa điểm, khu vực |
| `waiting_room` | FR-09, NFR-09 | 3 | Phòng chờ ảo |
| `bot_check` | FR-10, NFR-07 | 3 | Chặn bot bằng Cloudflare Turnstile |
| `ticket_limit` | FR-11 | 3 | Giới hạn vé mỗi tài khoản |
| `rotating_qr` | FR-12, NFR-08 | 3 | QR đổi mỗi 30 giây |
| `payments` | FR-13 | 4 | Thanh toán MoMo, VNPAY |
| `ticket_email` | FR-14 | 4 | Gửi vé qua email |
| `reconciliation` | FR-15, NFR-04 | 4 | Đối soát, hoàn tiền |
| `gate_checkin` | FR-16, FR-17, NFR-05 | 5 | Quét vé tại cổng |
| `offline_checkin` | FR-18, NFR-06 | 5 | Quét vé khi mất mạng |
| `ceo_dashboard` | FR-19 | 5 | Dashboard doanh thu |
| `price_log` | FR-20, NFR-12 | 5 | Trang xem nhật ký giá |
| `reports_export` | FR-21 | 5 | Xuất báo cáo CSV/XLSX |
| `dynamic_pricing` | FR-22, W-01 | 5 | Đề xuất giá, BTC duyệt |
| `promo_suggestions` | FR-23 | 5 | Gợi ý khuyến mãi |

FR-02 (danh sách sự kiện) luôn bật.
Nhật ký giá luôn ghi, cờ `price_log` chỉ ẩn/hiện trang xem.

Không làm:
- Apple/Google Wallet: cần tài khoản nhà phát triển trả phí.
- W-01 … W-05: đã loại trong tài liệu SA.

Profile: `sprint2` (giữa kỳ), `sprint3`, `sprint4`, `final` (bật hết).

Cách chọn:
- `FEATURE_PROFILE=sprint2` chọn profile;
- `FEATURE_<TÊN>=on|off` bật/tắt riêng từng cờ.

## 2. Tác nhân

| Tác nhân | `users.role` | Nhiệm vụ |
|---|---|---|
| Khán giả (SH-03) | `CUSTOMER` | Mua vé, xem vé |
| Ban Tổ chức (SH-01) | `ORGANIZER` | Tạo sự kiện, đặt giá, duyệt đề xuất giá |
| CEO (SH-02) | `CEO` | Xem doanh thu, xuất báo cáo |
| Nhân viên cổng (SH-04) | `GATE_STAFF` | Soát vé |
| Quản trị | `ADMIN` | Phân quyền |

Hệ thống ngoài:
- Cổng thanh toán (SH-05): MoMo, VNPAY.
- Gửi OTP: máy chủ SMTP (email), app SMS Gateway trên điện thoại Android (SMS).
- Chống bot: Cloudflare Turnstile.

## 3. Kiến trúc

```
Trình duyệt ──HTTPS──► Cloudflare Tunnel ──► frontend (nginx: SPA + proxy /api)
                                                   │
                                                   ▼
                                             api (Go, 1 binary)
                     ┌──────────────┬─────────────┼──────────────┬──────────────┐
                 HTTP handlers   services     background jobs   realtime hub   notifiers
                 (Boundary)      (Control)    (hold expiry,     (SSE ◄── PG    (SMTP, SMS
                                              queue admit,      LISTEN/NOTIFY)  gateway)
                                              reconcile,
                                              pricing, snapshots)
                                                   │
                                                   ▼
                                           PostgreSQL 18
```

**Chỉ một database, không dùng Redis.**
PostgreSQL lo cả ba việc:
- khóa ghế, bằng partial unique index;
- hàng chờ, bằng bảng `queue_entries`;
- phát sự kiện realtime, bằng `LISTEN/NOTIFY`.

Ít thành phần hơn, và mọi thay đổi trạng thái đều nằm trong giao dịch ACID.

**Realtime bằng SSE.**
Mỗi thay đổi ghế, hàng chờ, doanh thu gửi một `NOTIFY` trong cùng giao dịch.
api giữ một kết nối `LISTEN` và chuyển thông báo tới các trình duyệt đang mở `EventSource`.
Trình duyệt không phải hỏi lại liên tục (polling).

**Hết hạn giữ ghế.**
Mọi truy vấn đều kiểm tra `expires_at > now()`, nên ghế hết hạn không bị tính là đang giữ.
Ngoài ra, một bộ hẹn giờ chạy đúng lúc lượt giữ sớm nhất hết hạn để nhả ghế và báo cho trình duyệt.

**Phân lớp theo BCE** (bài B05):
- Boundary: `internal/httpapi`
- Control: `internal/service/*`
- Entity: `internal/store` (model sinh từ SQL)

### Công nghệ

| Phần | Công nghệ |
|---|---|
| Backend | Go, `net/http`, `pgx/v5`, `sqlc`, `goose` |
| Database | PostgreSQL 18 |
| Frontend | React 19, Vite, TypeScript, Tailwind, React Router, TanStack Query |
| Triển khai | Docker Compose: `db`, `api`, `frontend`, `tunnel` |
| Kiểm thử | `go test` trên PostgreSQL thật, `k6`, Playwright |

Mọi image Docker đều ghim phiên bản cụ thể.

## 4. User flow (quy trình sử dụng của người dùng)

### 4.1 Khán giả mua vé

1. Trang chủ: danh sách sự kiện đang bán, lọc theo thể loại, thành phố, ngày, giá.
2. Trang sự kiện: bấm **Mua vé**.
3. Chưa đăng nhập thì chuyển sang trang đăng nhập:
   - nhập SĐT hoặc email;
   - qua bước kiểm tra Turnstile;
   - nhập mã OTP 6 số;
   - quay lại trang đang mua.
4. Sự kiện đang đông thì vào phòng chờ:
   - thấy "Bạn đang ở vị trí N, chờ khoảng X phút";
   - thông tin cập nhật tối đa 10 giây một lần;
   - đến lượt thì tự sang trang chọn ghế, có giới hạn thời gian mua.
5. Sơ đồ ghế dùng 4 màu:
   - xanh: còn trống;
   - xám: đã bán;
   - vàng: người khác đang giữ;
   - tím: mình đang giữ.
6. Bấm ghế trống thì ghế được giữ 5 phút.
   Đồng hồ đếm ngược theo giờ hết hạn của server.
7. Bấm ghế không chọn được thì hiện thông báo, ghế không vào giỏ.
8. Mua quá giới hạn thì hiện "Đã đạt giới hạn số vé cho sự kiện này".
9. Thanh toán:
   - hệ thống tạo đơn từ các ghế đang giữ;
   - khán giả chọn MoMo hoặc VNPAY và chuyển sang cổng thanh toán;
   - cổng báo kết quả về api (IPN).
10. Thanh toán thành công:
    - đơn chuyển sang `PAID`, ghế chuyển sang `SOLD`;
    - vé được phát hành và gửi qua email.
11. Trang "Vé của tôi" hiện QR đổi mỗi 30 giây, kèm cảnh báo không dùng ảnh chụp màn hình.
12. Quá 5 phút chưa thanh toán thì ghế trở về trống, khán giả nhận thông báo hết hạn.

### 4.2 Ban Tổ chức

1. Tạo địa điểm.
2. Thêm khu vực: mã, tên, màu.
3. Sinh ghế theo số hàng và số ghế mỗi hàng.
4. Tạo sự kiện: tên, mô tả, ảnh, thể loại, thời gian diễn ra, thời gian mở bán.
5. Đặt giới hạn vé mỗi tài khoản và bật/tắt phòng chờ.
6. Đặt giá từng khu vực: giá cơ bản, giá sàn, giá trần.
   Điều kiện: sàn ≤ cơ bản ≤ trần.
7. Mở bán, tạm dừng, kết thúc bán.
8. Xem đề xuất giá: giá mới, lý do, số liệu dẫn tới đề xuất.
9. Duyệt hoặc từ chối đề xuất.
   Chỉ khi duyệt, giá các ghế chưa bán trong khu vực mới thay đổi.
   Mọi lần đổi giá đều ghi vào `price_changes`.

### 4.3 CEO

Dashboard hiển thị:
- doanh thu;
- số vé đã bán;
- tỷ lệ lấp đầy.

Số liệu chia theo phút, theo sự kiện, theo khu vực, và cập nhật trực tiếp.
CEO xuất được báo cáo ra file CSV/XLSX.

### 4.4 Nhân viên cổng

1. Mở trang soát vé trên điện thoại.
2. Chọn sự kiện và cổng.
3. Quét QR bằng camera.
4. Xem kết quả:
   - **Hợp lệ** (xanh);
   - **Đã sử dụng** (đỏ), kèm giờ và cổng đã quét trước đó;
   - **Không hợp lệ**.

Khi mất mạng:
- máy đã tải sẵn danh sách vé, nên vẫn tự kiểm tra được chữ ký QR;
- các lượt quét lưu lại trên máy, có mạng thì đồng bộ lên server;
- hai cổng cùng quét một vé khi offline thì ghi nhận `OFFLINE_CONFLICT`.

## 5. Dữ liệu

Giữ 26 bảng của ERD Sprint 1, chuyển từ MySQL sang PostgreSQL.

Kiểu dữ liệu:
- khóa chính dùng `uuid`, sinh bằng `gen_random_uuid()`;
- tiền dùng `numeric(14,0)`, vì VND không có phần lẻ;
- thời gian dùng `timestamptz`;
- trạng thái dùng kiểu `enum` của PostgreSQL.

Thay đổi so với ERD Sprint 1:

| Bảng | Thay đổi | Lý do |
|---|---|---|
| `users` | `phone` cho phép rỗng | Đăng nhập bằng email không cần SĐT |
| `users` | Bắt buộc có SĐT hoặc email | Tài khoản luôn liên lạc được |
| `users` | Thêm `email_verified_at` | Ghi nhận email đã xác thực |
| `otp_verifications` | Bỏ `user_id`, thêm `destination`, `channel` | OTP gửi đi trước khi có tài khoản |
| `sessions` | Bảng mới | Lưu phiên đăng nhập trên server |
| `seat_holds` | Bỏ `UNIQUE(event_id, seat_id)` | Giữ lại lịch sử các lượt giữ |
| `seat_holds` | Unique trên ghế khi `status = 'ACTIVE'` | Mỗi ghế chỉ có một lượt giữ hiệu lực |
| `tickets` | Unique trên ghế khi `status <> 'VOID'` | Mỗi ghế chỉ có một vé hợp lệ |
| `tickets` | Thêm `qr_secret` | Khóa sinh QR xoay vòng |
| `events` | Thêm `genre`, `image_url`, `city` | Dữ liệu cho trang chủ |
| `events` | Thêm `waiting_room_enabled`, `waiting_room_capacity` | Cấu hình phòng chờ |
| `price_suggestions` | Bảng mới | Đề xuất giá chờ BTC duyệt (W-01) |
| `price_changes`, `audit_logs` | Trigger chặn sửa và xóa | Nhật ký không thể sửa (NFR-12) |

Sơ đồ ERD sinh trực tiếp từ database đang chạy.

## 6. Quy tắc nghiệp vụ

### Giữ ghế (FR-06, FR-07, FR-11)

Mọi bước nằm trong một giao dịch:
1. Khóa theo cặp (người dùng, sự kiện) bằng `pg_advisory_xact_lock`.
2. Đếm số ghế đang giữ cộng số vé đã mua. Vượt giới hạn thì từ chối.
3. Chuyển ghế sang `HELD`, chỉ khi ghế đang `AVAILABLE`.
4. Ghi một dòng vào `seat_holds`.
5. Gửi `NOTIFY` để các trình duyệt cập nhật.

Bước 3 không đổi được dòng nào nghĩa là có người giữ trước: trả `409`.
Unique index trên `seat_holds` là lớp chặn thứ hai.

### Thanh toán (FR-13, FR-15)

- api kiểm tra chữ ký của mọi IPN.
- Một giao dịch của cổng (`provider_txn_id`) chỉ được xử lý một lần, dù IPN gửi lại nhiều lần.
- Tiền về sau khi lượt giữ đã hết hạn thì đơn chuyển sang đối soát:
  - ghế còn trống: phát vé;
  - ghế đã bán cho người khác: hoàn tiền.

### QR xoay vòng (FR-12)

- Nội dung QR: `ticket_code.step.HMAC(qr_secret, step)`.
- `step` tăng 1 sau mỗi 30 giây.
- Cổng chấp nhận `step` hiện tại, liền trước và liền sau.
- Ảnh chụp màn hình cũ hơn 60 giây sẽ bị từ chối.

### Soát vé (FR-17)

Vé chỉ chuyển sang `USED` nếu đang ở `ISSUED` hoặc `ACTIVE`.
Không chuyển được nghĩa là vé đã dùng.

### Định giá động (FR-22)

Cứ 5 phút, hệ thống tính lại cho từng khu vực.

Dữ liệu đầu vào:
- tốc độ bán thực tế;
- tốc độ cần đạt để bán hết trước giờ đóng bán;
- số người đang chờ trong hàng chờ;
- tỷ lệ ghế đang bị giữ.

Kết quả:
- giá đề xuất làm tròn tới 10.000đ;
- luôn nằm trong khoảng [giá sàn, giá trần];
- lệch dưới 5% so với giá hiện tại thì bỏ qua.

Hệ thống không bao giờ tự đổi giá. BTC phải duyệt.

### Phòng chờ (FR-09)

- Số người được mua cùng lúc tối đa bằng `waiting_room_capacity`.
- Có chỗ trống thì người kế tiếp trong hàng được vào.
- Mỗi lượt vào có hạn 10 phút.
- Thời gian chờ ước tính = vị trí ÷ tốc độ cho vào gần đây.

## 7. API

| Nhóm | Endpoint |
|---|---|
| Hệ thống | `GET /api/health` |
| | `GET /api/features` |
| Xác thực | `POST /api/auth/otp/request` |
| | `POST /api/auth/otp/verify` |
| | `GET /api/auth/me` |
| | `POST /api/auth/logout` |
| Sự kiện | `GET /api/events` |
| | `GET /api/events/{slug}` |
| Hàng chờ | `POST /api/events/{id}/queue` |
| | `GET /api/events/{id}/queue/me` |
| Ghế | `GET /api/events/{id}/seats` |
| | `GET /api/events/{id}/stream` (SSE) |
| | `POST /api/holds` |
| | `DELETE /api/holds/{seatId}` |
| Đơn hàng | `POST /api/orders` |
| | `GET /api/orders/{id}` |
| | `POST /api/orders/{id}/payments` |
| Cổng thanh toán | `GET /api/payments/{provider}/return` |
| | `POST /api/payments/{provider}/ipn` |
| Vé | `GET /api/me/tickets` |
| | `GET /api/tickets/{id}/qr` |
| Ban Tổ chức | `/api/organizer/venues/…` |
| | `/api/organizer/events/…` |
| | `/api/organizer/events/{id}/pricing/…` |
| | `POST /api/organizer/suggestions/{id}/approve` |
| | `POST /api/organizer/suggestions/{id}/reject` |
| Soát vé | `GET /api/gate/events/{id}/manifest` |
| | `POST /api/gate/checkins` |
| | `POST /api/gate/sync` |
| CEO | `GET /api/dashboard/stream` |
| | `GET /api/reports/sales.csv` |
| | `GET /api/reports/sales.xlsx` |

Đặc tả đầy đủ nằm ở `docs/api/openapi.yaml`, viết cùng lúc với code.

## 8. Kiểm thử

| Kịch bản | Kết quả mong đợi | Chứng minh |
|---|---|---|
| 200 yêu cầu cùng giữ 1 ghế | Đúng 1 thành công | FR-07, NFR-03 |
| 1 người gửi cùng lúc 10 yêu cầu giữ ghế | Tối đa 4 thành công | FR-11 |
| Lượt giữ quá 5 phút | Ghế trống lại, trình duyệt nhận thông báo | FR-06 |
| Cổng gửi IPN 2 lần | 1 đơn, 1 bộ vé | NFR-04 |
| 2 cổng cùng quét 1 vé | 1 hợp lệ, 1 đã dùng | FR-17 |
| k6: N người ảo xếp hàng và giữ ghế | Ghi lại p95 đo được | NFR-01 |
| Playwright: mua vé trên 2 trình duyệt | Trình duyệt kia thấy ghế đổi màu | US-02, US-03 |

## 9. Tài liệu đi kèm (`docs/`)

| File | Nội dung |
|---|---|
| `spec.md` | FR, NFR và trạng thái từng yêu cầu |
| `dynamic-pricing.md` | Bài toán và thiết kế Định giá động |
| `use-cases.md` | Sơ đồ và đặc tả Use Case |
| `dfd.md` | DFD mức ngữ cảnh, mức 0, mức 1 |
| `erd.md` | ERD sinh từ database |
| `class-diagram.md` | Sơ đồ lớp theo BCE |
| `sequences/` | Mỗi luồng một file: đăng nhập OTP, giữ ghế, chống bán trùng, thanh toán, hàng chờ, duyệt giá, soát vé |
| `architecture.md` | Sơ đồ kiến trúc |
| `api/openapi.yaml` | Đặc tả API |
| `sprints.md` | Kế hoạch Sprint, WBS, ước lượng, profile |
| `testing.md` | Kế hoạch kiểm thử với người dùng |
| `README.md` (gốc repo) | Cách chạy hệ thống |

Sơ đồ viết bằng Mermaid và xuất PNG để dán vào báo cáo.
