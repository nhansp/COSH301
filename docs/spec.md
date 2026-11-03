# Đặc tả yêu cầu và truy vết

Danh sách FR, NFR và W theo mã trong [`design/README.md`](design/README.md).
Mỗi yêu cầu ghi cờ tính năng, Sprint và trạng thái.

Trạng thái:
- **Xong**: có code, chạy được trong profile của Sprint đó, đã kiểm tra.
- **Đang làm**: đã có một phần code, còn thiếu phần ghi ở cột Ghi chú.
- **Chưa làm**: chưa có code.

Cờ của từng profile lấy từ `backend/internal/config/features.go`.
Profile `sprint2` bật: `otp_login`, `seat_map_realtime`, `seat_hold`, `zone_pricing`, `organizer_console`.

## 1. Yêu cầu chức năng

| Mã | Yêu cầu | Cờ | Sprint | Trạng thái | Ghi chú |
|---|---|---|:---:|:---:|---|
| FR-01 | Đăng nhập bằng OTP qua SMS hoặc email | `otp_login` | 2 | Đang làm | Tạo, kiểm tra mã và tạo tài khoản đã xong. Chưa gửi mã qua SMTP hoặc SMS Gateway: mã hiện trên màn hình (`OTP_DEMO`) hoặc ghi vào log |
| FR-02 | Danh sách sự kiện, lọc theo thể loại, thành phố, ngày | Luôn bật | 2 | Xong | `GET /api/events`, trang chủ |
| FR-03 | Sơ đồ ghế 4 màu | `seat_map_realtime` | 2 | Xong | Xanh: trống. Xám: đã bán. Vàng: người khác giữ. Tím: mình giữ |
| FR-04 | Phiên đăng nhập trên server, đăng xuất | `otp_login` | 2 | Xong | Bảng `sessions`, cookie `session_token`, `GET /api/auth/me` |
| FR-05 | Sơ đồ ghế cập nhật trực tiếp | `seat_map_realtime` | 2 | Xong | SSE `GET /api/events/{id}/stream`, PostgreSQL `LISTEN/NOTIFY` |
| FR-06 | Giữ ghế 5 phút | `seat_hold` | 2 | Xong | `POST /api/holds`. `HoldReaper` nhả ghế hết hạn, quét 5 giây một lần |
| FR-07 | Chống bán trùng ghế | `seat_hold` | 2 | Xong | `UPDATE` có điều kiện và unique index trên `seat_holds`. Test 50 người cùng giữ 1 ghế: đúng 1 người thành công |
| FR-08 | BTC quản lý sự kiện, đặt giá sàn, giá trần theo khu vực | `zone_pricing`, `organizer_console` | 2 | Đang làm | Đã có: xem sự kiện của mình, đặt giá khu vực, ghi `price_changes`. Chưa có: tạo địa điểm, khu vực, sinh ghế, tạo sự kiện, mở/tạm dừng bán |
| FR-09 | Phòng chờ ảo | `waiting_room` | 3 | Chưa làm | Đã có bảng `queue_entries` |
| FR-10 | Chặn bot bằng Cloudflare Turnstile | `bot_check` | 3 | Chưa làm | |
| FR-11 | Giới hạn vé mỗi tài khoản | `ticket_limit` | 3 | Đang làm | api đã khóa theo (người dùng, sự kiện) và đếm ghế giữ cộng vé đã mua. Chưa kiểm thử tải theo mục 8 của thiết kế |
| FR-12 | QR đổi mỗi 30 giây | `rotating_qr` | 3 | Chưa làm | Đã có cột `tickets.qr_secret` |
| FR-13 | Thanh toán MoMo, VNPAY | `payments` | 4 | Chưa làm | |
| FR-14 | Gửi vé qua email | `ticket_email` | 4 | Chưa làm | |
| FR-15 | Đối soát, hoàn tiền | `reconciliation` | 4 | Chưa làm | |
| FR-16 | Quét vé tại cổng | `gate_checkin` | 5 | Chưa làm | |
| FR-17 | Chống dùng vé hai lần | `gate_checkin` | 5 | Chưa làm | |
| FR-18 | Quét vé khi mất mạng | `offline_checkin` | 5 | Chưa làm | |
| FR-19 | Dashboard doanh thu cho CEO | `ceo_dashboard` | 5 | Chưa làm | |
| FR-20 | Nhật ký giá | `price_log` | 5 | Đang làm | Mỗi lần BTC đổi giá cơ bản đều ghi `price_changes`. Trigger chặn sửa và xóa. Chưa có trang xem |
| FR-21 | Xuất báo cáo CSV/XLSX | `reports_export` | 5 | Chưa làm | |
| FR-22 | Đề xuất giá, BTC duyệt | `dynamic_pricing` | 5 | Chưa làm | Thiết kế ở [`dynamic-pricing.md`](dynamic-pricing.md) |
| FR-23 | Gợi ý khuyến mãi | `promo_suggestions` | 5 | Chưa làm | |

## 2. Yêu cầu phi chức năng

| Mã | Loại | Chỉ số | Cờ | Trạng thái | Ghi chú |
|---|---|---|---|:---:|---|
| NFR-01 | Hiệu năng | ≥ 50.000 người dùng đồng thời lúc mở bán, p95 trang chờ và chọn ghế ≤ 2 giây | — | Chưa làm | Chưa chạy k6 |
| NFR-02 | Sẵn sàng | Uptime ≥ 99,9% trong giờ mở bán, RTO ≤ 5 phút | — | Đang làm | Có healthcheck và tự khởi động lại container. Chưa đo |
| NFR-03 | Toàn vẹn dữ liệu | 0 trường hợp bán trùng, giao dịch ghế đạt ACID | `seat_hold` | Xong | Test `TestHoldSeat_ConcurrentHoldersGetOneSeat` |
| NFR-04 | Nhất quán thanh toán | 100% giao dịch lỗi được xử lý trong ≤ 15 phút | `reconciliation` | Chưa làm | |
| NFR-05 | Tốc độ soát vé | Xác thực 1 vé ≤ 1 giây, cả online và offline | `gate_checkin` | Chưa làm | |
| NFR-06 | Soát vé khi mất mạng | Chạy offline ≥ 4 giờ, đồng bộ ≤ 2 phút khi có mạng | `offline_checkin` | Chưa làm | |
| NFR-07 | Chống bot | Bot lọt qua < 1% | `bot_check` | Đang làm | Đã giới hạn OTP theo IP và theo SĐT/email. Chưa có Turnstile |
| NFR-08 | Bảo mật vé | QR tự làm mới, ảnh chụp màn hình bị từ chối | `rotating_qr` | Chưa làm | |
| NFR-09 | Hàng chờ minh bạch | Thấy vị trí và thời gian chờ, cập nhật ≤ 10 giây | `waiting_room` | Chưa làm | |
| NFR-10 | Sơ đồ ghế trực quan | Trạng thái ghế tới trình duyệt ≤ 3 giây, màu thống nhất | `seat_map_realtime` | Xong | Đẩy qua SSE ngay sau `COMMIT`. Ghế hết hạn trễ tối đa 5 giây do `HoldReaper` |
| NFR-11 | Dashboard | Số liệu lên dashboard của CEO ≤ 60 giây | `ceo_dashboard` | Chưa làm | |
| NFR-12 | Kiểm toán | 100% thay đổi giá và giao dịch ghi log không sửa được | `price_log` | Đang làm | Trigger chặn sửa và xóa trên `price_changes`, `audit_logs`. Chưa ghi log giao dịch |
| NFR-13 | Tuân thủ | PCI-DSS cho thanh toán, Nghị định 13/2023/NĐ-CP | — | Đang làm | OTP và token phiên chỉ lưu SHA-256. Chưa có thanh toán |

## 3. Không làm

| Mã | Nội dung | Lý do |
|---|---|---|
| W-01 | AI tự đổi giá không cần BTC duyệt | Rủi ro pháp lý và dư luận. FR-22 chỉ đề xuất, BTC duyệt |
| W-02 | Sàn bán lại vé chính thức | Ngoài phạm vi MVP |
| W-03 | eKYC đầy đủ bằng khuôn mặt, CCCD | Tăng ma sát khi mua. OTP là đủ |
| W-04 | Sơ đồ sân khấu 3D | Không thiết yếu |
| W-05 | Đa ngôn ngữ, đa tiền tệ, bán vé quốc tế | Thị trường hiện tại là trong nước |

## 4. Truy vết Sprint 2

| Yêu cầu | Code | Tài liệu |
|---|---|---|
| FR-01, FR-04 | `service/auth_service.go`, `httpapi/auth.go` | [`sequences/otp-login.md`](sequences/otp-login.md) |
| FR-03, FR-05, NFR-10 | `service/realtime_hub.go`, `httpapi/stream.go`, `frontend/src/components/SeatMap.tsx` | [`architecture.md`](architecture.md) |
| FR-06 | `service/seat_service.go`, `service/hold_reaper.go` | [`sequences/hold.md`](sequences/hold.md), [`checks/fr-06.md`](checks/fr-06.md) |
| FR-07, NFR-03 | `service/seat_service.go`, `store/queries/seats.sql` | [`sequences/double-booking.md`](sequences/double-booking.md) |
| FR-08 | `service/organizer_service.go`, `httpapi/organizer.go` | [`api/openapi.yaml`](api/openapi.yaml) |
| FR-22 | — | [`dynamic-pricing.md`](dynamic-pricing.md) |

Đường dẫn code tính từ `backend/internal/`, trừ dòng có `frontend/`.
