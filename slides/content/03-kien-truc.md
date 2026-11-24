=== id=deploy layout=default speaker=nhan time=40 kicker="Kiến trúc"
## Kiến trúc triển khai
<div class="flow">
<div class="node"><b>Người dùng</b>trình duyệt<small>ứng dụng OTP</small></div><div class="arrow">→</div>
<div class="node"><b>Cloudflare</b>tunnel<small>không mở cổng máy chủ</small></div><div class="arrow">→</div>
<div class="node"><b>frontend</b>nginx<small>React, chuyển tiếp <code>/api</code></small></div><div class="arrow">→</div>
<div class="node hot"><b>api</b>Go<small>một tệp chạy</small></div><div class="arrow">→</div>
<div class="node"><b>db</b>PostgreSQL 18</div>
</div>
|||
- Chạy bằng Docker Compose trên một máy ảo GCP (2 vCPU, 4 GB).
- Máy chủ không mở cổng web, mọi truy cập đi qua Cloudflare.
|||
- Dịch vụ ngoài: cổng VNPay (môi trường thử) và máy chủ mô hình ngôn ngữ cho trợ lý ảo.
- Địa chỉ: **cosh301.nhansp.id.vn**
NOTES:
Cập nhật bản chạy thật: lấy mã mới nhất của nhánh rewrite rồi chạy docker compose up -d --build. Bản chạy thật tắt tính năng đăng nhập nhanh dành cho môi trường phát triển.
Chỉ có một máy ảo, chưa có dự phòng; nhóm nêu điểm này ở phần hạn chế.

=== id=bce layout=default speaker=nhan time=35 kicker="Kiến trúc"
## Kiến trúc phân lớp BCE
<div class="layer"><b>Boundary</b><div><code>internal/httpapi</code></div><div>Nhận yêu cầu HTTP, kiểm tra phiên đăng nhập, vai trò và cờ tính năng</div></div>
<div class="layer"><b>Control</b><div><code>internal/service</code></div><div>Nghiệp vụ: OTP, giữ ghế, giá, thanh toán, đẩy cập nhật thời gian thực</div></div>
<div class="layer"><b>Entity</b><div><code>internal/store</code></div><div>Truy vấn sinh tự động bằng <code>sqlc</code> trên PostgreSQL</div></div>
NOTES:
Lớp Boundary không gọi thẳng cơ sở dữ liệu, mọi thao tác dữ liệu đi qua lớp Control. Biểu đồ lớp trong báo cáo dựng theo đúng ba lớp này, theo phương pháp bài giảng B05.
Hệ thống không dùng Redis: PostgreSQL đảm nhận khóa ghế và kênh thông báo LISTEN/NOTIFY, nên chỉ có một nguồn dữ liệu.

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

=== id=otp-app layout=default speaker=nhan time=40 kicker="Kiến trúc"
## Ứng dụng nhận mã OTP
<div class="flow">
<div class="node"><b>Trang web</b>nhập số điện thoại</div><div class="arrow">→</div>
<div class="node hot"><b>api</b>tạo mã, lưu tạm<small>chỉ báo "có mã mới"</small></div><div class="arrow">→</div>
<div class="node"><b>COSH301 OTP</b>ứng dụng Android<small>nhận mã một lần</small></div><div class="arrow">→</div>
<div class="node"><b>Thông báo</b>trên điện thoại</div>
</div>
|||
- Dùng thay cho SMS, vì nhóm chưa có nhà cung cấp SMS.
- Ứng dụng giữ kết nối SSE với máy chủ; trong luồng không chứa mã.
- Mỗi mã chỉ được nhận một lần, hết hạn sau 5 phút.
|||
- Đăng nhập bằng email: mã hiện trên màn hình ở chế độ demo.
- [[wip:Giới hạn]] Số điện thoại do ứng dụng gửi lên chưa chứng minh được quyền sở hữu.
NOTES:
Ứng dụng viết bằng Kotlin và Jetpack Compose, dung lượng khoảng 1,9 MB. Khi có nhà cung cấp SMS hoặc bước ghép cặp thiết bị thì thay thế phần này. Chi tiết ở docs/otp-app.md.
