=== id=sec-6 layout=section no=6 speaker=thanh time=5 kicker="Phần 6"
## Lộ trình
Các phân hệ ở Sprint 3 đến 5. Mới có thiết kế, chưa có code.

=== id=roadmap layout=default speaker=thanh time=40 kicker="Lộ trình" badge="road:Thiết kế"
## Từ giữ ghế đến soát vé
<div class="timeline">
<div class="col-s"><h3>Sprint 3</h3><span class="flag">waiting_room</span><span class="flag">bot_check</span><span class="flag">ticket_limit</span><span class="flag">rotating_qr</span><p>Phòng chờ ảo, Turnstile, giới hạn vé, QR đổi mỗi 30 giây.</p></div>
<div class="col-s"><h3>Sprint 4</h3><span class="flag">payments</span><span class="flag">ticket_email</span><span class="flag">reconciliation</span><p>Thanh toán, vé qua email, đối soát và hoàn tiền.</p></div>
<div class="col-s"><h3>Sprint 5</h3><span class="flag">gate_checkin</span><span class="flag">offline_checkin</span><span class="flag">ceo_dashboard</span><span class="flag">dynamic_pricing</span><p>Soát vé, dashboard CEO, nhật ký giá, định giá động.</p></div>
</div>

Mỗi sprint ứng với một profile cờ: `sprint3`, `sprint4`, `final`.
NOTES:
Sprint 3 và 4 mỗi sprint 2 tuần ước lượng; tổng dự án 458 giờ công. Mọi phần trong lộ trình đều ở cờ tắt, api trả 404 feature_disabled.

=== id=payment layout=default speaker=phuc time=50 kicker="Sprint 4" badge="road:Sprint 4"
## Thanh toán: cổng sandbox và IPN
<div class="flow">
<div class="node"><b>Giữ ghế</b>5 phút<small>đã chạy</small></div><div class="arrow">→</div>
<div class="node"><b>Tạo đơn</b><code>orders</code><small>PENDING</small></div><div class="arrow">→</div>
<div class="node"><b>Cổng thanh toán</b>VNPay sandbox<small>chuyển hướng</small></div><div class="arrow">→</div>
<div class="node hot"><b>IPN về api</b>kiểm tra chữ ký<small>mỗi giao dịch xử lý một lần</small></div><div class="arrow">→</div>
<div class="node"><b>Phát vé</b><code>tickets</code></div>
</div>
|||
- Mọi IPN được kiểm tra chữ ký.
- Unique index `uq_payment_provider_txn` trên `(provider, provider_txn_id)`: IPN gửi lại thì bỏ qua.
|||
- Tiền về sau khi lượt giữ hết hạn: đơn chuyển sang đối soát.
- Ghế còn trống thì phát vé. Ghế đã bán cho người khác thì hoàn tiền.
NOTES:
Thiết kế cho FR-13, FR-15 (cờ payments, reconciliation), chưa có code. Mục tiêu NFR-04: giao dịch lỗi được xử lý trong 15 phút.
Báo cáo ghi hai cổng MoMo và VNPAY. Nhóm dự kiến thử với sandbox của VNPay trước.

=== id=gate layout=default speaker=ducanh time=55 kicker="Sprint 5" badge="road:Sprint 4 và 5"
## Vé QR xoay vòng và soát vé tại cổng
|||
### QR đổi mỗi 30 giây
<div class="callout"><code>ticket_code.step.HMAC(qr_secret, step)</code></div>
- `step` tăng 1 sau mỗi 30 giây, theo ý tưởng TOTP.
- Cổng nhận `step` hiện tại, liền trước và liền sau.
- Ảnh chụp màn hình cũ hơn 60 giây bị từ chối.
|||
### Soát vé và offline
- Quét bằng camera, xác thực ≤ 1 giây.
- Vé chỉ sang `USED` khi đang `ISSUED` hoặc `ACTIVE`.
- Trước giờ mở cổng, máy tải sẵn danh sách vé.
- Mất mạng thì tự kiểm tra chữ ký và lưu lượt quét.
- Hai cổng quét cùng một vé khi offline: ghi `OFFLINE_CONFLICT`.
NOTES:
FR-12, FR-16, FR-17, FR-18. Hiện mới có cột tickets.qr_secret và enum checkin_result.

=== id=ceo layout=default speaker=thanh time=35 kicker="Sprint 5" badge="road:Sprint 5"
## Dashboard doanh thu cho CEO
|||
- Doanh thu theo thời gian thực trên điện thoại (FR-19, UC-13).
- Số liệu lên dashboard trong vòng 60 giây (NFR-11).
- Xuất báo cáo CSV hoặc XLSX (FR-21, UC-14).
|||
- Có sẵn bảng `sales_snapshots` cho thống kê.
- Kênh `/api/dashboard/stream` và `/api/reports/…` chưa có code.
- Cờ `ceo_dashboard` và `reports_export` đang tắt.
NOTES:
Chỉ giới thiệu hướng đi. Không có số liệu dashboard thật.
