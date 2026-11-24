=== id=usecases layout=default cols="0.62fr 1.38fr" speaker=ducanh time=45 kicker="Mô hình hóa" figh=760
## Biểu đồ use case
|||
![Hình 2. Sơ đồ use case tổng thể](img/report/h2-use-case.jpg)
|||
### Khán giả
`UC-01` Đăng nhập OTP · `UC-02` Xem sự kiện · `UC-03` Phòng chờ · `UC-04` Giữ ghế 5 phút · `UC-05` Thanh toán · `UC-06` Xem vé, mã QR
### Ban Tổ chức và CEO
`UC-07` Quản lý sự kiện, khu vực · `UC-08` Duyệt giá đề xuất · `UC-09` Bảng doanh thu · `UC-10` Xuất báo cáo
### Nhân viên cổng, quản trị viên
`UC-11` Soát vé QR · `UC-12` Soát vé ngoại tuyến · `UC-13` Giám sát, kiểm toán

Hệ thống ngoài: VNPay, Cloudflare, dịch vụ gửi mã OTP.
NOTES:
Hình 2 và bảng 8 của báo cáo. Đã chạy: UC-01, UC-02, UC-04, UC-05 (môi trường thử), UC-07 và UC-08. Các use case còn lại đang ở mức thiết kế.

=== id=dfd-context layout=default speaker=phuc time=30 kicker="Mô hình hóa" figh=560
## Biểu đồ luồng dữ liệu mức ngữ cảnh
![Hình 3. DFD mức ngữ cảnh](img/report/h3-dfd-ngu-canh.jpg)
<p class="figcap">Cả hệ thống là một tiến trình 0.0; năm tác nhân ngoài trao đổi dữ liệu với hệ thống.</p>
NOTES:
Hình 3 trong báo cáo. Tác nhân: khán giả, Ban Tổ chức, nhân viên cổng, cổng thanh toán, dịch vụ SMS hoặc email.

=== id=dfd layout=default cols="0.55fr 1.45fr" speaker=phuc time=35 kicker="Mô hình hóa" figh=760
## Biểu đồ luồng dữ liệu mức 0
|||
![Hình 4. DFD mức 0](img/report/h4-dfd-muc-0.jpg)
|||
- **Tiến trình đã có mã chạy:** xác thực OTP; sự kiện và giá khu; sơ đồ ghế và giữ chỗ; đơn hàng và thanh toán; định giá động.
- **Đang ở mức thiết kế:** phòng chờ ảo, soát vé tại cổng, báo cáo doanh thu.
- **Kho dữ liệu:** người dùng và phiên, sự kiện và ghế, đơn hàng và vé, nhật ký giá.
- Mức 1 được vẽ cho ba tiến trình chính: xác thực OTP, giữ chỗ, thanh toán.
NOTES:
Hình 4 trong báo cáo vẽ 7 tiến trình và 4 kho dữ liệu; tài liệu docs/dfd.md tách thành 9 tiến trình (thêm phân quyền, nhật ký giá). Phúc thống nhất lại trước buổi báo cáo.

=== id=erd layout=default speaker=huy time=30 kicker="Mô hình hóa" figh=600
## Mô hình dữ liệu
![Hình 6. Sơ đồ thực thể liên kết](img/report/h6-erd.jpg)
<p class="figcap">Thiết kế ở Sprint 1 có 26 bảng; sau khi chuẩn hóa, cơ sở dữ liệu đang chạy có 24 bảng.</p>
NOTES:
Hình 6 trong báo cáo. Nhóm bảng: định danh và bảo mật; địa điểm và ghế; hàng chờ và giữ chỗ; đơn hàng và thanh toán; vé và soát vé; giá và khuyến mãi. Bảng otp_app_deliveries được thêm cho ứng dụng OTP. Khóa chính dùng UUID, số tiền lưu kiểu NUMERIC(14,0). Thực thể trong ERD tương ứng với các lớp Entity trong biểu đồ lớp.

=== id=hold layout=default speaker=huy time=35 kicker="Nghiệp vụ cốt lõi" figh=500
## Giữ ghế và cập nhật thời gian thực
![Hình 7. Sơ đồ tuần tự giữ ghế 5 phút và đồng bộ SSE](img/report/h7-giu-ghe.jpg)
<div class="states">
<div class="st av">Còn trống</div><div class="ar">khách chọn ghế</div>
<div class="st he">Đang giữ 5 phút</div><div class="ar">thanh toán</div>
<div class="st so">Đã bán</div>
</div>
NOTES:
Thông báo chỉ được gửi sau khi giao dịch hoàn tất, nên trình duyệt không bao giờ thấy trạng thái chưa được ghi. Nhóm dùng SSE vì chỉ cần luồng một chiều từ máy chủ về trình duyệt, nhẹ hơn WebSocket.

=== id=race layout=default speaker=huy time=35 kicker="Nghiệp vụ cốt lõi" figh=560
## Chống bán trùng ghế
![Hình 8. Sơ đồ tuần tự khóa dòng chống bán trùng](img/report/h8-chong-ban-trung.jpg)
<p class="figcap"><b>Lớp 1:</b> chỉ ghế đang trống mới chuyển sang trạng thái giữ · <b>Lớp 2:</b> chỉ mục duy nhất, mỗi ghế chỉ có một lượt giữ còn hiệu lực</p>
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
