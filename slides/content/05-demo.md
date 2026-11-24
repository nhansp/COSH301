=== id=sec-5 layout=section no=5 speaker=nhan time=5 kicker="Phần 5"
## Demo trực tiếp
Bản chạy thật tại cosh301.nhansp.id.vn, quay lại thành một mạch.

=== id=demo-setup layout=default speaker=nhan time=25 kicker="Chuẩn bị demo"
## Ba cửa sổ, một sự kiện
| Cửa sổ | Vai trò |
|---|---|
| Trình duyệt A | Khán giả A, đã đăng nhập |
| Trình duyệt B | Khán giả B, cửa sổ ẩn danh, email khác |
| Trình duyệt Ban Tổ chức | Đặt giá cho từng khu |

- Bản trực tuyến: `https://cosh301.nhansp.id.vn`, profile `sprint2`.
- Mã OTP của khán giả hiện ngay trên màn hình (`OTP_DEMO`).
- Cờ `payments`, `ticket_limit`, `dynamic_pricing` tắt: demo không có thanh toán.
NOTES:
Mã OTP của Ban Tổ chức chỉ ghi vào log của api. Đăng nhập sẵn tài khoản này từ trước giờ demo, phiên có hạn 7 ngày.

=== id=otp-app layout=default speaker=nhan time=40 kicker="OTP qua ứng dụng" badge="wip:Đang làm"
## Mã OTP về điện thoại
|||
- Chưa có SMTP hay SMS Gateway, nên mã chỉ hiện trên màn hình hoặc ghi vào log.
- Ứng dụng Android nhận mã và hiển thị trên điện thoại.
- Mã gồm 6 số, dùng được trong 5 phút.
- Một mã mỗi 60 giây, tối đa 5 mã mỗi giờ.
- Nhập sai 5 lần thì mã bị khóa.
|||
@mirror label="Pixel, trực tiếp"
NOTES:
Slide này dùng màn hình điện thoại thật (mirror.sh + scrcpy). Nếu chưa có tín hiệu, khung điện thoại hiện trạng thái chờ và deck vẫn chạy bình thường.
api chỉ lưu SHA-256 của mã, không lưu mã gốc.
Phần mô tả ứng dụng Android là placeholder, bổ sung khi ứng dụng xong.

=== id=demo-steps layout=demo-steps

=== id=demo-all layout=demo-all speaker=nhan title="Toàn bộ demo" caption="Chạy liền một mạch: từ trang chủ, đăng nhập, giữ ghế realtime đến đổi giá."
NOTES:
Phát toàn bộ video. Bấm R để phát lại, P để tạm dừng.

=== id=bot layout=default speaker=phuc time=30 kicker="Chống bot" badge="wip:Đang làm"
## Cản bot ở cửa đăng nhập
|||
### Đã có
- Giới hạn lượt gọi API OTP theo IP.
- Giới hạn mã theo số điện thoại hoặc email: 1 mã mỗi 60 giây, tối đa 5 mã mỗi giờ.
- Nhập sai mã 5 lần thì mã bị khóa.
|||
### Chưa có
- [[todo:Chưa làm]] Cloudflare Turnstile khi xin mã (FR-10, cờ `bot_check`, Sprint 3).
- [[todo:Chưa làm]] Số liệu bot lọt qua (NFR-07: dưới 1%).
- Kịch bản demo bot: đang chuẩn bị.
NOTES:
Placeholder cho kịch bản demo bot. Chỉ nói những gì đã có trong code: rate limit theo IP và theo đích gửi OTP.

=== id=auditor layout=default speaker=huy time=30 kicker="Kiểm toán" badge="wip:Đang chuẩn bị"
## Xóa nhật ký giá thì bị từ chối
```
SELECT old_price, new_price, reason, created_at
FROM price_changes ORDER BY created_at DESC LIMIT 3;

DELETE FROM price_changes;
ERROR: Modification or deletion is strictly forbidden
       on audit log table price_changes
```
Dòng giá vừa đổi có lý do `MANUAL`. Lệnh `DELETE` bị trigger chặn.
NOTES:
Placeholder cho phần demo vai kiểm toán. Bước 12 của kịch bản demo (tùy chọn): chạy trong container db bằng docker compose exec db psql.

=== id=k6 layout=default speaker=thanh time=30 kicker="Kiểm thử tải" badge="wip:Đang đo"
## Tải mở bán: k6
| Chỉ số | Mục tiêu | Kết quả |
|---|---|---|
| Người dùng đồng thời (NFR-01) | ≥ 50.000 | đang đo |
| p95 trang chờ và chọn ghế | ≤ 2 giây | đang đo |
| Ghế bị bán trùng (NFR-03) | 0 | đang đo |
| Trạng thái ghế tới trình duyệt (NFR-10) | ≤ 3 giây | đang đo |
NOTES:
Chưa có số liệu k6. Điền bảng này sau khi chạy. Không nêu con số nào trước khi có kết quả.
