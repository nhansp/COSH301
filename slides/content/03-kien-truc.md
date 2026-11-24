=== id=deploy layout=default cols="0.8fr 1.2fr" speaker=nhan time=40 kicker="Kiến trúc"
## Kiến trúc triển khai
|||
![Hình 1. Sơ đồ kiến trúc triển khai](img/report/h1-trien-khai.jpg)
|||
- Người dùng vào qua Cloudflare; máy chủ không mở cổng web.
- `frontend` (nginx, React) chuyển yêu cầu `/api` sang `api` viết bằng Go.
- `api` dùng PostgreSQL 18 cho dữ liệu, khóa ghế và kênh thông báo LISTEN/NOTIFY.
- Chạy bằng Docker Compose trên một máy ảo GCP (2 vCPU, 4 GB).
- Dịch vụ ngoài: VNPay (môi trường thử), máy chủ mô hình ngôn ngữ cho trợ lý ảo.
- Địa chỉ: **cosh301.nhansp.id.vn**
NOTES:
Hình 1 trong báo cáo. Hình vẽ ở Sprint 1 còn ghi MoMo và cổng SMS; bản chạy hiện tại dùng VNPay và ứng dụng OTP thay cho SMS.
Cập nhật bản chạy thật: lấy mã mới nhất của nhánh rewrite rồi chạy docker compose up -d --build. Chỉ có một máy ảo, chưa có dự phòng; nhóm nêu điểm này ở phần hạn chế.

=== id=bce layout=default speaker=nhan time=35 kicker="Kiến trúc" figh=640
## Kiến trúc phân lớp BCE
![Hình 5. Sơ đồ lớp theo mô hình BCE](img/report/h5-lop-bce.jpg)
<p class="figcap"><b>Boundary</b> <code>internal/httpapi</code> · <b>Control</b> <code>internal/service</code> · <b>Entity</b> <code>internal/store</code> (sinh bằng <code>sqlc</code>)</p>
NOTES:
Hình 5 trong báo cáo. Lớp Boundary nhận yêu cầu HTTP, kiểm tra phiên, vai trò và cờ tính năng; không gọi thẳng cơ sở dữ liệu. Lớp Control chứa nghiệp vụ: OTP, giữ ghế, giá, thanh toán, đẩy cập nhật thời gian thực. Lớp Entity là các truy vấn sinh tự động trên PostgreSQL.
Hệ thống không dùng Redis: PostgreSQL đảm nhận khóa ghế và kênh thông báo, nên chỉ có một nguồn dữ liệu.

=== id=flags layout=default cols="1.2fr 1fr" speaker=nhan time=40 kicker="Kiến trúc"
## Hệ thống cờ tính năng
|||
- Mỗi chức năng lớn gắn với một cờ, ví dụ `seat_hold`, `payments`, `dynamic_pricing`.
- Biến `FEATURE_PROFILE` chọn bộ cờ theo sprint: `sprint2`, `sprint3`, `sprint4`, `final`.
- Có thể bật, tắt riêng từng cờ bằng biến `FEATURE_<TÊN>`, không cần sửa mã.
- Cờ đang tắt thì API trả `404 feature_disabled` và giao diện ẩn chức năng đó.
|||
::: callout
**Lợi ích**
Nghiệm thu từng sprint trên cùng một bản mã.
Phần chưa xong được tắt, không phải xóa khỏi mã nguồn.
:::
NOTES:
Danh sách cờ hiện hành xem tại /api/features trên bản chạy thật. Đây cũng là cách nhóm chuyển từ mốc giữa kỳ sang cuối kỳ mà không phải tách nhánh riêng.

=== id=otp-app layout=default cols="1.5fr 0.5fr" speaker=nhan time=40 kicker="Kiến trúc" figh=720
## Ứng dụng nhận mã OTP
|||
<div class="flow col-compact">
<div class="node"><b>Trang web</b>nhập số điện thoại</div><div class="arrow">→</div>
<div class="node hot"><b>api</b>tạo mã, lưu tạm<small>chỉ báo "có mã mới"</small></div><div class="arrow">→</div>
<div class="node"><b>COSH301 OTP</b>ứng dụng Android</div>
</div>

- Dùng thay cho SMS, vì nhóm chưa có nhà cung cấp SMS.
- Ứng dụng giữ kết nối SSE với máy chủ; trong luồng không chứa mã.
- Mỗi mã chỉ được nhận một lần, hết hạn sau 5 phút, hiện thành thông báo trên điện thoại.
- [[wip:Giới hạn]] Số điện thoại do ứng dụng gửi lên chưa chứng minh được quyền sở hữu.
|||
![Ứng dụng COSH301 OTP trên Pixel 8 Pro](img/pov/phone-app.jpg)
NOTES:
Ứng dụng viết bằng Kotlin và Jetpack Compose, dung lượng khoảng 1,9 MB. Khi có nhà cung cấp SMS hoặc bước ghép cặp thiết bị thì thay thế phần này. Chi tiết ở docs/otp-app.md.
