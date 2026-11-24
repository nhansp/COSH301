=== id=usecases layout=default speaker=ducanh time=40 kicker="Use case"
## 13 use case, 3 vai trò
::: grid g3
::: card tight
### Khán giả
`UC-01` đăng nhập OTP
`UC-02` danh sách sự kiện
`UC-03` phòng chờ
`UC-04` sơ đồ ghế
`UC-05` giữ ghế
`UC-06` thanh toán, nhận vé
`UC-07` vé và QR
:::
::: card tight
### Ban Tổ chức
`UC-08` địa điểm, sự kiện
`UC-09` đặt giá khu
`UC-10` duyệt đề xuất giá
`UC-11` nhật ký giá
`UC-12` gợi ý khuyến mãi
:::
::: card tight
### CEO
`UC-13` dashboard doanh thu
:::
:::
Hệ thống ngoài: cổng thanh toán VNPay, SMTP, SMS Gateway, Cloudflare Turnstile.
NOTES:
Script slide 9. Mọi vai trò đăng nhập bằng OTP (UC-01). Tài khoản mới luôn là CUSTOMER. Danh sách UC-01 đến UC-13 lấy theo docs/use-cases.md, đối chiếu lại với báo cáo.

=== id=dfd layout=default speaker=phuc time=25 kicker="Luồng dữ liệu"
## DFD mức 0: chín tiến trình
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
::: card tight
<span class="no">7.0</span>
### Định giá động, khuyến mãi
:::
::: card tight
<span class="no">8.0</span>
### Dashboard, báo cáo, nhật ký giá
:::
::: card tight lift
<span class="no">9.0</span>
### Phân quyền
:::
:::
Tô tím: đã có code. Có 17 kho dữ liệu, mỗi kho là một hoặc vài bảng PostgreSQL.
NOTES:
Script slide 10. DFD có ba mức: ngữ cảnh, mức 0 (9 tiến trình, 17 kho) và mức 1 của tiến trình 1.0, 4.0, 5.0.
Realtime dùng LISTEN/NOTIFY của PostgreSQL, không có kho riêng. Nguồn: docs/dfd.md.

=== id=erd layout=default speaker=huy time=30 kicker="Cơ sở dữ liệu"
## 24 bảng, 6 nhóm
<div class="erd">
<div class="grp"><h3>Định danh và bảo mật · 5</h3><code>users</code><code>sessions</code><code>otp_verifications</code><code>otp_app_deliveries</code><code>audit_logs</code></div>
<div class="grp"><h3>Địa điểm và ghế · 6</h3><code>venues</code><code>venue_zones</code><code>seats</code><code>events</code><code>event_zones</code><code>event_seats</code></div>
<div class="grp hot"><h3>Hàng chờ và giữ chỗ · 2</h3><code>queue_entries</code><code>seat_holds</code></div>
<div class="grp"><h3>Đơn hàng và thanh toán · 3</h3><code>orders</code><code>order_items</code><code>payments</code></div>
<div class="grp"><h3>Vé và soát vé · 3</h3><code>tickets</code><code>gate_devices</code><code>checkins</code></div>
<div class="grp"><h3>Giá, khuyến mãi, thống kê · 5</h3><code>price_changes</code><code>price_suggestions</code><code>promotions</code><code>promotion_usages</code><code>sales_snapshots</code></div>
</div>

Thanh toán sandbox ghi `orders`, `payments`, `tickets`. Soát vé đã có schema, chưa có code ghi.
NOTES:
Script slide 11. Thiết kế gồm 23 bảng; otp_app_deliveries (migration 00005) thêm cho ứng dụng OTP nên production có 24 bảng. Migration 00006 của VNPay chỉ thêm cột. ERD Sprint 1 trên MySQL có 26 bảng.
Khóa chính là UUID, tiền là NUMERIC(14,0).

=== id=hold layout=default speaker=huy time=30 kicker="Giữ ghế 5 phút"
## Giữ ghế, rồi mọi trình duyệt thấy ngay
<div class="states">
<div class="st av">AVAILABLE</div><div class="ar">bấm ghế</div>
<div class="st he">HELD</div><div class="ar">thanh toán<br>VNPay sandbox</div>
<div class="st so">SOLD</div>
</div>
<div class="flow">
<div class="node"><b>Khán giả A</b><code>POST /api/holds</code></div><div class="arrow">→</div>
<div class="node"><b>Một giao dịch</b>giữ ghế, <code>pg_notify</code>, COMMIT</div><div class="arrow">→</div>
<div class="node"><b>RealtimeHub</b>nhận NOTIFY sau COMMIT</div><div class="arrow">→</div>
<div class="node hot"><b>Khán giả B</b>ghế đổi màu qua SSE</div>
</div>

- Lượt giữ có hạn 300 giây. `HoldReaper` quét 5 giây một lần và nhả ghế hết hạn.
- Ghế quá hạn mà chưa được quét vẫn giữ được: lượt cũ bị hủy, lượt mới được cấp trong cùng giao dịch.
NOTES:
Script slide 12. Ba loại thông báo SSE: seat_held, seat_released, seat_expired. SSE chỉ cần luồng một chiều từ server, nhẹ hơn WebSocket.
Giao dịch bị hủy thì không có thông báo. Giá của ghế đang HELD giữ nguyên đến khi được trả.

=== id=race layout=default speaker=huy time=30 kicker="Chống bán trùng"
## Hai người cùng bấm một ghế
<div class="lanes two">
<div class="h">Khán giả A</div><div class="h">Khán giả B</div>
<div>UPDATE <code>WHERE status = 'AVAILABLE'</code> giành khóa hàng, ghi <code>seat_holds</code>, COMMIT</div><div>UPDATE cùng ghế, chờ khóa</div>
<div class="win">201, ghế chuyển tím</div><div class="lose">Đọc lại: ghế đã <code>HELD</code>, 0 dòng, <code>409 seat_not_available</code></div>
</div>
::: grid g3
::: card tight
<span class="no">Lớp 1</span>
### UPDATE có điều kiện
Chỉ ghế `AVAILABLE` mới sang `HELD`.
:::
::: card tight
<span class="no">Lớp 2</span>
### Unique index một phần
`uq_seat_holds_active` trên `(event_id, seat_id)` khi `ACTIVE`.
:::
::: card tight
<span class="no">Lớp 3 · cờ tắt</span>
### Khóa cố vấn
Theo `(user_id, event_id)`, cho giới hạn vé `ticket_limit`.
:::
:::
NOTES:
Script slide 13. Câu UPDATE giữ khóa mức hàng; giao dịch đến sau đọc lại hàng sau khi giao dịch trước commit. Lớp 3 phục vụ giới hạn vé mỗi người (FR-11), không phải chống bán trùng ghế, và đang tắt ở sprint2.
Kết quả kiểm chứng (test 50 luồng, thử 100 tài khoản) nằm ở slide kiểm thử.

=== id=audit layout=default speaker=huy time=20 kicker="Nhật ký" title="Nhật ký giá bất biến"
## Nhật ký giá không sửa, không xóa được
|||
- `price_changes` ghi mỗi lần Ban Tổ chức đổi giá cơ bản.
- Trigger `BEFORE UPDATE OR DELETE` theo từng dòng chặn sửa và xóa.
- Trigger `BEFORE TRUNCATE` chặn xóa cả bảng.
- `audit_logs` được bảo vệ theo cách tương tự.
|||
```
SELECT old_price, new_price, reason
FROM price_changes
ORDER BY created_at DESC LIMIT 3;

DELETE FROM price_changes;
ERROR: Modification or deletion is
  strictly forbidden on audit log
  table price_changes
```
NOTES:
Demo chapter "Nhật ký giá bất biến": chạy SELECT rồi DELETE bị từ chối. NFR-12: mới xong phần giá, chưa ghi log giao dịch. Chưa có trang xem nhật ký giá (FR-20).

=== id=pricing layout=default speaker=dung time=60 kicker="Giá theo khu và định giá động"
## Giá do người quyết định, máy chỉ đề xuất
|||
### [[ok:Đã chạy]] Giá khu (FR-08)
- Ban Tổ chức đặt giá sàn, giá cơ bản, giá trần.
- Ràng buộc: `sàn ≤ cơ bản ≤ trần`.
- Mỗi lần đổi ghi một dòng `price_changes`.
- Ghế đang giữ giữ nguyên giá cũ.
|||
### [[road:Thiết kế]] Định giá động (FR-22)
- Mỗi 5 phút tính áp lực từ tốc độ bán, hàng chờ, ghế đang giữ.
- Tối đa 20% mỗi chu kỳ, chênh dưới 5% thì bỏ qua.
- **Không bao giờ tự đổi giá (<span class="nb">W-01</span>).**
- Ví dụ Fanzone: 1.200.000 đồng, áp lực 1,73, đề xuất **1.420.000 đồng**.
NOTES:
Script slide 14. Cờ dynamic_pricing đang tắt. Đã có bảng price_suggestions và giá sàn, giá trần theo khu; chưa có job tính và endpoint duyệt.
Phản biện của nhóm: người mua không biết trước giá có thể tăng, có tiền lệ cuộc điều tra của CMA ở Anh về cách bán vé Oasis. Vì vậy thiết kế dùng người duyệt, biên độ và nhật ký giá. Nhóm chưa có thực nghiệm về hành vi người mua.
