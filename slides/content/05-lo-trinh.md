=== id=payment layout=default speaker=phuc time=40 kicker="Thanh toán · Sprint 4" badge="ok:Đã chạy sandbox"
## Thanh toán: VNPay sandbox
<div class="flow">
<div class="node"><b>Giữ ghế</b>5 phút<small>đã chạy</small></div><div class="arrow">→</div>
<div class="node"><b>Checkout</b>giá tính ở server<small>cộng phí 3%</small></div><div class="arrow">→</div>
<div class="node"><b>URL VNPay</b>ký HMAC-SHA512<small>phiên bản 2.1.0</small></div><div class="arrow">→</div>
<div class="node hot"><b>IPN về api</b>kiểm tra chữ ký<small>xử lý đúng một lần</small></div><div class="arrow">→</div>
<div class="node"><b>Ghế SOLD</b>phát vé<small>một giao dịch</small></div>
</div>

- Thanh toán muộn, khi lượt giữ đã hết hạn: đánh dấu `refund_required`. Chưa hoàn tiền tự động.
- "Vé của tôi" liệt kê vé đã phát. Không có tiền thật, dùng thẻ test của sandbox.
- Sprint 3 còn lại: phòng chờ ảo, Turnstile, giới hạn vé, QR 30 giây, trợ lý chatbot AI (FR-24, đang hoàn thiện).
NOTES:
Script slide 15. Thanh toán đã chạy trên bản trực tuyến ở chế độ sandbox (Sprint 4 làm sớm). Chữ ký HMAC-SHA512 theo VNPay 2.1.0. IPN GET /api/payments/vnpay/ipn được xác thực và idempotent; ghế chuyển SOLD và vé được phát trong cùng một giao dịch.
Chưa có vé qua email, chưa có QR xoay vòng, chưa hoàn tiền tự động.
Sprint 3 có phòng chờ ảo: số người mua cùng lúc tối đa bằng waiting_room_capacity, mỗi lượt vào có hạn 10 phút; hiện mới có bảng queue_entries.

=== id=gate layout=default speaker=ducanh time=50 kicker="Lộ trình · Sprint 5" badge="road:Sprint 3 đến 5"
## Vé QR xoay vòng và soát vé offline
|||
### QR đổi mỗi 30 giây
<div class="callout"><code>ticket_code.step.HMAC(qr_secret, step)</code></div>

- `step` tăng 1 sau mỗi 30 giây, theo ý tưởng TOTP.
- Ảnh chụp màn hình cũ hơn 60 giây bị từ chối.
|||
### Soát vé
- Quét bằng camera, xác thực ≤ 1 giây.
- Mất mạng thì máy tự kiểm tra chữ ký và lưu lượt quét.
- Hai cổng quét cùng một vé: ghi `OFFLINE_CONFLICT`.
NOTES:
Script slide 16. FR-12, FR-16, FR-17, FR-18. Cổng nhận step hiện tại, liền trước và liền sau. Trước giờ mở cổng máy tải sẵn danh sách vé. Hiện mới có cột tickets.qr_secret và enum checkin_result.

=== id=ceo layout=default speaker=phuc time=20 kicker="Lộ trình · Sprint 5" badge="road:Sprint 5"
## Dashboard doanh thu cho CEO
- Doanh thu theo thời gian thực trên điện thoại (FR-19).
- Số liệu lên dashboard trong vòng 60 giây (NFR-11).
- Xuất báo cáo CSV hoặc XLSX (FR-21).
NOTES:
Chỉ giới thiệu hướng đi. Có sẵn bảng sales_snapshots; kênh /api/dashboard/stream và /api/reports chưa có code, cờ ceo_dashboard và reports_export đang tắt. Không có số liệu dashboard thật.
