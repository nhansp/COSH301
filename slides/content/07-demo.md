=== id=otp-app layout=default cols="1.5fr 0.8fr" speaker=nhan time=35 kicker="OTP qua ứng dụng"
## Mã OTP về điện thoại
|||
- Đăng nhập bằng số điện thoại: mã không hiện trên web.
- api giữ mã tạm cho ứng dụng Android `COSH301 OTP`.
- Ứng dụng nhận tín hiệu `pending` qua SSE, không có mã trong luồng.
- Ứng dụng lấy mã một lần, hiện thông báo "Mã đăng nhập COSH301".
- [[wip:Giới hạn]] Số điện thoại do ứng dụng gửi chưa chứng minh quyền sở hữu.
|||
@mirror label="COSH301 OTP, trực tiếp"
NOTES:
Chi tiết ở docs/otp-app.md: ứng dụng Kotlin và Compose, khoảng 1,9 MB, claim qua POST /api/otp-app/claim. Kênh email giữ nguyên: mã hiện trên màn hình ở chế độ demo, mã của nhân sự ghi trong log server. Số điện thoại chuẩn hóa về dạng +84. Cần SMS thật hoặc ghép cặp thiết bị cho bản chính thức.
Nếu chưa có tín hiệu màn hình điện thoại, khung chỉ hiện trạng thái chờ và deck chạy bình thường.

=== id=demo-steps layout=demo-steps

=== id=demo-all layout=demo-all speaker=nhan title="Toàn bộ demo" caption="Chạy liền một mạch, từ trang chủ đến nhật ký giá."
NOTES:
Phát toàn bộ video. Bấm R để phát lại, P để tạm dừng.
