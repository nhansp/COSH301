=== id=deploy layout=default speaker=nhan time=35 kicker="Triển khai"
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
- Docker Compose trên một máy ảo GCP, 2 vCPU, 4 GB.
- Máy ảo không mở cổng web ra Internet.
- nginx giữ kết nối SSE tới 24 giờ.
|||
- Thứ tự khởi động: `db`, `api`, `frontend`, `tunnel`.
- api chạy bằng user không phải root, có healthcheck.
- Bản trực tuyến: `APP_ENV=production`, thanh toán ở sandbox.
NOTES:
Script slide 7. Cập nhật bằng cách lấy mã mới từ nhánh rewrite rồi chạy lại docker compose up -d --build.
Production tắt demo-login và reset-demo. Một máy ảo duy nhất, không dự phòng: đây là hạn chế đã nêu.

=== id=bce layout=default speaker=nhan time=35 kicker="Kiến trúc backend"
## Ba lớp BCE, 19 cờ tính năng
<div class="layer"><b>Boundary</b><div><code>internal/httpapi</code></div><div>Định tuyến, đọc JSON, tra phiên, kiểm tra cờ và vai trò</div></div>
<div class="layer"><b>Control</b><div><code>internal/service</code></div><div>OTP, giữ ghế, giá khu, realtime, <code>HoldReaper</code></div></div>
<div class="layer"><b>Entity</b><div><code>internal/store</code></div><div>Truy vấn sinh bằng <code>sqlc</code>, chạy trên <code>pgx/v5</code></div></div>
::: callout
**Cờ tính năng:** `FEATURE_PROFILE` chọn `sprint2` (5 cờ) đến `final` (19 cờ).
Cờ tắt thì api trả `404 feature_disabled`.
:::
NOTES:
Script slide 8. Handler không gọi store trực tiếp, mọi truy cập dữ liệu đi qua service.
Không dùng Redis: PostgreSQL lo khóa ghế, hàng chờ và LISTEN/NOTIFY. Nhóm chưa đo so sánh với Redis; lý do là nhất quán và đơn giản.
