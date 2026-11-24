=== id=pov layout=default speaker=thanh time=40 kicker="Các góc nhìn"
## Mỗi người dùng thấy gì
| Góc nhìn | Thấy và làm gì | Trong demo |
|---|---|---|
| Khán giả | Sơ đồ ghế cập nhật tức thì, giữ ghế 5 phút, thanh toán, xem vé | Khách A, khách B |
| Điện thoại khán giả | Ứng dụng COSH301 OTP nhận mã đăng nhập thành thông báo | Màn hình Pixel 8 Pro |
| Cổng thanh toán | Trang VNPay (môi trường thử), báo kết quả về máy chủ | Khách B thanh toán |
| Ban Tổ chức | Đặt giá theo khu, xem và duyệt giá đề xuất | Cửa sổ Ban Tổ chức |
| Trợ lý ảo | Trả lời câu hỏi bằng số liệu thật | Khách B hỏi trợ lý |
| Máy chủ | Tải k6, CPU từng container, nhật ký giá không xóa được | Cửa sổ "Máy chủ" |
| CEO, nhân viên cổng | Bảng doanh thu, soát vé QR | [[todo:Sprint 5]] |
NOTES:
Mỗi bước demo có nhãn góc nhìn ở bên phải video. CEO và nhân viên cổng thuộc Sprint 5, đang ở mức thiết kế.

=== id=pov-khan-gia layout=default speaker=ducanh time=35 kicker="Các góc nhìn" figh=640
## Hai khán giả cùng chọn một ghế
|||
![Khách A giữ ghế A1](img/pov/khach-a.jpg)
<p class="figcap">Khách A bấm ghế A1: ghế được giữ 5 phút</p>
|||
![Khách B thấy ghế A1 đổi màu](img/pov/khach-b.jpg)
<p class="figcap">Màn hình khách B đổi màu ghế A1 ngay, không cần tải lại</p>
NOTES:
Hai trình duyệt riêng, hai tài khoản khác nhau, cùng mở khu SVIP của concert Anh Trai "Say Hi" Hà Nội. Ảnh chụp từ bản chạy thật.

=== id=pov-dien-thoai layout=default cols="0.42fr 1.58fr" speaker=nhan time=35 kicker="Các góc nhìn" figh=640
## Điện thoại và cổng thanh toán
|||
![Thông báo mã OTP trên điện thoại](img/pov/phone-code.jpg)
<p class="figcap">Mã OTP trên điện thoại</p>
|||
![Trang thanh toán VNPay](img/pov/vnpay.jpg)
<p class="figcap">Khách chuyển sang trang VNPay (môi trường thử) để thanh toán</p>
NOTES:
Điện thoại là Pixel 8 Pro của nhóm, cài ứng dụng COSH301 OTP. Trang VNPay là môi trường thử nghiệm (sandbox), dùng thẻ thử, không có tiền thật. Kết quả thanh toán do VNPay gọi về máy chủ (IPN), không dựa vào trang trả về.
