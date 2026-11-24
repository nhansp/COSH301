=== id=usecases layout=default speaker=ducanh time=40 kicker="Mô hình hóa"
## Biểu đồ use case
::: grid g3
::: card tight
### Khán giả
`UC-01` Đăng nhập bằng OTP (mọi tác nhân)
`UC-02` Xem danh sách sự kiện
`UC-03` Xếp hàng phòng chờ
`UC-04` Chọn và giữ ghế 5 phút
`UC-05` Thanh toán, nhận vé
`UC-06` Xem vé, mã QR
:::
::: card tight
### Ban Tổ chức và CEO
`UC-07` Quản lý sự kiện và khu vực
`UC-08` Duyệt giá đề xuất
`UC-09` Xem bảng doanh thu
`UC-10` Xuất báo cáo bán vé
:::
::: card tight
### Nhân viên cổng và quản trị viên
`UC-11` Soát vé bằng mã QR
`UC-12` Đồng bộ soát vé ngoại tuyến
`UC-13` Giám sát và kiểm toán
:::
:::
Hệ thống ngoài: cổng thanh toán VNPay, Cloudflare, dịch vụ gửi mã OTP.
NOTES:
Danh sách theo bảng 8 của báo cáo. Đã chạy: UC-01, UC-02, UC-04, UC-05 (môi trường thử), UC-07 và UC-08. Các use case còn lại đang ở mức thiết kế.

=== id=dfd layout=default speaker=phuc time=30 kicker="Mô hình hóa"
## Biểu đồ luồng dữ liệu mức 0
::: grid g3
::: card tight lift
<span class="no">1.0</span>
### Xác thực OTP và phiên
:::
::: card tight lift
<span class="no">2.0</span>
### Sự kiện, địa điểm, giá khu
:::
::: card tight
<span class="no">3.0</span>
### Phòng chờ ảo
:::
::: card tight lift
<span class="no">4.0</span>
### Sơ đồ ghế và giữ chỗ
:::
::: card tight lift
<span class="no">5.0</span>
### Đơn hàng, thanh toán, vé
:::
::: card tight
<span class="no">6.0</span>
### Soát vé tại cổng
:::
::: card tight lift
<span class="no">7.0</span>
### Định giá động, khuyến mãi
:::
::: card tight
<span class="no">8.0</span>
### Báo cáo và nhật ký giá
:::
::: card tight
<span class="no">9.0</span>
### Phân quyền
:::
:::
Các tiến trình tô đậm đã có mã chạy.
NOTES:
DFD gồm mức ngữ cảnh, mức 0 và mức 1 cho các tiến trình 1.0, 4.0 và 5.0. Lưu ý: hình 4 trong báo cáo vẽ 7 tiến trình, tài liệu docs/dfd.md có 9 tiến trình; Phúc thống nhất lại trước buổi báo cáo.

=== id=erd layout=default speaker=huy time=30 kicker="Mô hình hóa"
## Mô hình dữ liệu
<div class="erd">
<div class="grp"><h3>Định danh và bảo mật</h3><code>users</code><code>sessions</code><code>otp_verifications</code><code>otp_app_deliveries</code><code>audit_logs</code></div>
<div class="grp"><h3>Địa điểm và ghế</h3><code>venues</code><code>venue_zones</code><code>seats</code><code>events</code><code>event_zones</code><code>event_seats</code></div>
<div class="grp hot"><h3>Hàng chờ và giữ chỗ</h3><code>queue_entries</code><code>seat_holds</code></div>
<div class="grp"><h3>Đơn hàng và thanh toán</h3><code>orders</code><code>order_items</code><code>payments</code></div>
<div class="grp"><h3>Vé và soát vé</h3><code>tickets</code><code>gate_devices</code><code>checkins</code></div>
<div class="grp"><h3>Giá và khuyến mãi</h3><code>price_changes</code><code>price_suggestions</code><code>promotions</code><code>promotion_usages</code><code>sales_snapshots</code></div>
</div>

Thiết kế ở Sprint 1 có 26 bảng; sau khi chuẩn hóa, cơ sở dữ liệu đang chạy có 24 bảng.
NOTES:
Bảng otp_app_deliveries được thêm cho ứng dụng OTP. Khóa chính dùng UUID, số tiền lưu kiểu NUMERIC(14,0). Thực thể trong ERD tương ứng với các lớp Entity trong biểu đồ lớp.

=== id=hold layout=default speaker=huy time=35 kicker="Nghiệp vụ cốt lõi"
## Giữ ghế và cập nhật thời gian thực
<div class="states">
<div class="st av">Còn trống</div><div class="ar">khách chọn ghế</div>
<div class="st he">Đang giữ</div><div class="ar">thanh toán</div>
<div class="st so">Đã bán</div>
</div>
<div class="flow">
<div class="node"><b>Khách A</b>chọn ghế</div><div class="arrow">→</div>
<div class="node"><b>Một giao dịch</b>giữ ghế, gửi thông báo</div><div class="arrow">→</div>
<div class="node"><b>Bộ phát SSE</b>nhận thông báo sau khi giao dịch xong</div><div class="arrow">→</div>
<div class="node hot"><b>Khách B</b>thấy ghế đổi màu</div>
</div>

- Mỗi lượt giữ có hạn 5 phút; hết hạn thì ghế tự trả lại.
- Tiến trình nền kiểm tra 5 giây một lần và báo cho mọi trình duyệt đang mở.
NOTES:
Thông báo chỉ được gửi sau khi giao dịch hoàn tất, nên trình duyệt không bao giờ thấy trạng thái chưa được ghi. Nhóm dùng SSE vì chỉ cần luồng một chiều từ máy chủ về trình duyệt, nhẹ hơn WebSocket.

=== id=race layout=default speaker=huy time=35 kicker="Nghiệp vụ cốt lõi"
## Chống bán trùng ghế
<div class="lanes two">
<div class="h">Khách A</div><div class="h">Khách B</div>
<div>Cập nhật ghế với điều kiện còn trống, giành được khóa dòng</div><div>Cập nhật cùng ghế, phải chờ khóa</div>
<div class="win">Giữ ghế thành công</div><div class="lose">Ghế đã bị giữ, nhận lỗi <code>409</code></div>
</div>
::: grid g2
::: card tight
<span class="no">Lớp 1</span>
### Cập nhật có điều kiện
Chỉ ghế đang trống mới chuyển sang trạng thái giữ.
:::
::: card tight
<span class="no">Lớp 2</span>
### Chỉ mục duy nhất một phần
Mỗi ghế của một sự kiện chỉ có một lượt giữ còn hiệu lực.
:::
:::
NOTES:
Câu lệnh UPDATE khóa dòng; giao dịch đến sau đọc lại dòng sau khi giao dịch trước hoàn tất nên thấy ghế đã bị giữ. Chỉ mục tên là uq_seat_holds_active trên (event_id, seat_id).
Giới hạn số vé mỗi người (FR-11) dùng thêm khóa cố vấn, hiện đang tắt bằng cờ ticket_limit.

=== id=audit layout=default speaker=huy time=25 kicker="Nghiệp vụ cốt lõi" title="Nhật ký thay đổi giá"
## Nhật ký thay đổi giá
|||
- Mỗi lần đổi giá đều ghi vào bảng `price_changes`: ai đổi, lúc nào, giá cũ, giá mới.
- Trigger trong PostgreSQL chặn mọi lệnh sửa và xóa trên bảng này.
- Bảng `audit_logs` được bảo vệ theo cùng cách.
|||
```
DELETE FROM price_changes;
ERROR: Modification or deletion is
  strictly forbidden on audit log
  table price_changes
```
NOTES:
Ngay cả quản trị viên cơ sở dữ liệu cũng không xóa được nhật ký giá. Phần demo có cảnh chạy lệnh DELETE và bị từ chối.
