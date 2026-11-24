=== id=payment layout=default speaker=phuc time=35 kicker="Lộ trình · Sprint 4" badge="road:Sprint 4"
## Thanh toán: VNPay sandbox
<div class="flow">
<div class="node"><b>Giữ ghế</b>5 phút<small>đã chạy</small></div><div class="arrow">→</div>
<div class="node"><b>Tạo đơn</b><code>orders</code></div><div class="arrow">→</div>
<div class="node"><b>VNPay sandbox</b>đang tích hợp<small>thẻ test, không có tiền thật</small></div><div class="arrow">→</div>
<div class="node hot"><b>IPN về api</b>kiểm tra chữ ký<small>mỗi giao dịch xử lý một lần</small></div><div class="arrow">→</div>
<div class="node"><b>Phát vé</b><code>tickets</code></div>
</div>

- Tiền về sau khi lượt giữ hết hạn: ghế còn trống thì phát vé, ghế đã bán thì hoàn tiền.
- Trước đó, Sprint 3: phòng chờ ảo, Turnstile, giới hạn vé, QR đổi mỗi 30 giây.
NOTES:
Script slide 15. Sprint 3 có phòng chờ ảo: số người mua cùng lúc tối đa bằng waiting_room_capacity, mỗi lượt vào có hạn 10 phút; hiện mới có bảng queue_entries.
Thanh toán: nhánh tích hợp VNPay sandbox đang làm, chưa gộp vào rewrite. Mỗi IPN kiểm tra chữ ký; unique index uq_payment_provider_txn bảo đảm một giao dịch chỉ xử lý một lần.

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
