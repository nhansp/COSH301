=== id=sec-3 layout=section no=3 speaker=nhan time=5 kicker="Phần 3"
## Kiến trúc
Triển khai, phân lớp BCE, cờ tính năng và luồng realtime.

=== id=deploy layout=default speaker=nhan time=50 kicker="Triển khai"
## Bốn dịch vụ trên một máy ảo
<div class="flow">
<div class="node"><b>Trình duyệt</b>HTTPS</div><div class="arrow">→</div>
<div class="node"><b>Cloudflare</b><small>cosh301.nhansp.id.vn</small></div><div class="arrow">→</div>
<div class="node"><b>tunnel</b>cloudflared<small>kết nối đi ra, không mở cổng</small></div><div class="arrow">→</div>
<div class="node"><b>frontend</b>nginx<small>SPA và proxy <code>/api</code></small></div><div class="arrow">→</div>
<div class="node hot"><b>api</b>Go, cổng 8080<small>một binary</small></div><div class="arrow">→</div>
<div class="node"><b>db</b>PostgreSQL 18<small>volume <code>pgdata</code></small></div>
</div>
|||
- Docker Compose trên một máy ảo GCP.
- Máy ảo không mở cổng web ra Internet.
- nginx tắt `proxy_buffering` và giữ kết nối SSE tới 24 giờ.
|||
- Thứ tự khởi động: `db`, `api`, `frontend`, `tunnel`.
- api chạy bằng user không phải root, có healthcheck.
- Bản trực tuyến: `APP_ENV=production`, profile `sprint2`.
NOTES:
Cập nhật bằng cách lấy mã mới từ nhánh rewrite rồi chạy lại docker compose up -d --build.
Production tắt demo-login và reset-demo. Chưa có dự phòng: một máy ảo duy nhất, đây là hạn chế đã nêu.

=== id=bce layout=default speaker=nhan time=50 kicker="Kiến trúc backend"
## Một database, ba lớp BCE
<div class="layer"><b>Boundary</b><div><code>internal/httpapi</code></div><div>Định tuyến, đọc JSON, tra phiên, kiểm tra cờ và vai trò</div></div>
<div class="layer"><b>Control</b><div><code>internal/service</code></div><div>OTP, giữ ghế, giá khu, realtime, <code>HoldReaper</code></div></div>
<div class="layer"><b>Entity</b><div><code>internal/store</code></div><div>Truy vấn sinh bằng <code>sqlc</code>, chạy trên <code>pgx/v5</code></div></div>
::: callout
**Không dùng Redis.** PostgreSQL lo khóa ghế, hàng chờ và `LISTEN/NOTIFY`.
Một nguồn sự thật, không có cache lệch dữ liệu.
:::
NOTES:
Handler không gọi store trực tiếp, mọi truy cập dữ liệu đi qua service.
Nhóm chưa đo hiệu năng ở mức chục nghìn người dùng. Lý do bỏ Redis là nhất quán và đơn giản, không phải tốc độ.

=== id=flags layout=default speaker=nhan time=40 kicker="Cờ tính năng"
## 19 cờ, bốn profile
|||
| Profile | Cờ bật |
|---|---|
| `sprint2` | 5 |
| `sprint3` | 9 |
| `sprint4` | 12 |
| `final` | 19 |
|||
- `FEATURE_PROFILE` chọn profile.
- `FEATURE_<TÊN>=on|off` bật tắt riêng từng cờ.
- Cờ tắt: giao diện ẩn tính năng.
- api trả `404 feature_disabled`.
- `GET /api/features` cho frontend biết nên hiện gì.
NOTES:
Nhờ cờ, nhóm nghiệm thu từng sprint mà không phải xóa code của sprint sau.

=== id=realtime layout=default speaker=dung time=55 kicker="Realtime"
## Ghế đổi màu trong vài giây, không cần F5
<div class="flow">
<div class="node"><b>Khán giả A</b><code>POST /api/holds</code></div><div class="arrow">→</div>
<div class="node"><b>SeatService</b>BEGIN, giữ ghế, <code>pg_notify</code>, COMMIT</div><div class="arrow">→</div>
<div class="node"><b>PostgreSQL</b>NOTIFY chỉ gửi sau COMMIT</div><div class="arrow">→</div>
<div class="node"><b>RealtimeHub</b>LISTEN, chia theo <code>eventId</code></div><div class="arrow">→</div>
<div class="node hot"><b>Khán giả B</b><code>event: update</code> qua SSE</div>
</div>
|||
- Trình duyệt mở `EventSource` một lần, không hỏi lại liên tục.
- Giao dịch bị hủy thì không có thông báo.
- Ba loại thông báo: `seat_held`, `seat_released`, `seat_expired`.
|||
- Mất kết nối `LISTEN` thì hub nối lại sau 3 giây.
- Hàng đợi của một trình duyệt đầy thì bỏ thông báo, không chặn các trình duyệt khác.
- SSE chỉ cần luồng một chiều server tới trình duyệt, nên nhẹ hơn WebSocket.
NOTES:
Ghế hết hạn có thể trễ tối đa 5 giây vì HoldReaper quét 5 giây một lần. Trong lúc đó ghế vẫn giữ được nhờ cơ chế chiếm lượt giữ quá hạn.
