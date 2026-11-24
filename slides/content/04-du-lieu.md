=== id=sec-4 layout=section no=4 speaker=huy time=5 kicker="Phần 4"
## Dữ liệu và giữ ghế
Lược đồ 23 bảng, vòng đời lượt giữ, chống bán trùng và giá theo khu.

=== id=erd layout=default speaker=huy time=60 kicker="Cơ sở dữ liệu"
## 23 bảng, 6 nhóm
<div class="erd">
<div class="grp"><h3>Định danh và bảo mật · 4</h3><code>users</code><code>sessions</code><code>otp_verifications</code><code>audit_logs</code></div>
<div class="grp"><h3>Địa điểm và ghế · 6</h3><code>venues</code><code>venue_zones</code><code>seats</code><code>events</code><code>event_zones</code><code>event_seats</code></div>
<div class="grp hot"><h3>Hàng chờ và giữ chỗ · 2</h3><code>queue_entries</code><code>seat_holds</code></div>
<div class="grp"><h3>Đơn hàng và thanh toán · 3</h3><code>orders</code><code>order_items</code><code>payments</code></div>
<div class="grp"><h3>Vé và soát vé · 3</h3><code>tickets</code><code>gate_devices</code><code>checkins</code></div>
<div class="grp"><h3>Giá, khuyến mãi, thống kê · 5</h3><code>price_changes</code><code>price_suggestions</code><code>promotions</code><code>promotion_usages</code><code>sales_snapshots</code></div>
</div>

Sprint 2 ghi vào các bảng định danh, địa điểm và ghế, `seat_holds`, `price_changes` và `audit_logs`.
Các bảng đơn hàng, vé và soát vé đã có schema, chưa có code ghi.
NOTES:
ERD Sprint 1 trên MySQL có 26 bảng. Bản PostgreSQL có 23 bảng, khác biệt liệt kê trong docs/erd.md mục 2.
Khóa chính là UUID, tiền là NUMERIC(14,0).

=== id=hold-lifecycle layout=default speaker=huy time=60 kicker="Giữ ghế"
## Vòng đời một lượt giữ ghế
<div class="states">
<div class="st av">AVAILABLE</div><div class="ar">bấm ghế</div>
<div class="st he">HELD</div><div class="ar">thanh toán<br>Sprint 4</div>
<div class="st so">SOLD</div>
</div>
|||
### `event_seats.status`
- `AVAILABLE` sang `HELD` bằng một câu `UPDATE` có điều kiện.
- `HELD` về `AVAILABLE` khi khách trả ghế hoặc hết 5 phút.
- `SOLD` chưa có code ghi, vì thanh toán còn tắt.
|||
### `seat_holds.status`
- `ACTIVE`: `expires_at` bằng lúc giữ cộng 300 giây.
- `RELEASED`: khách bấm trả ghế.
- `EXPIRED`: `HoldReaper` quét 5 giây một lần.
- `CONVERTED`: dành cho thanh toán, Sprint 4.
NOTES:
Ghế hết hạn mà HoldReaper chưa quét tới vẫn giữ được: TryStealExpiredSeatHold hủy lượt cũ và cấp lượt mới trong cùng giao dịch.
Giá của ghế đang HELD giữ nguyên đến khi được trả, dù Ban Tổ chức đổi giá khu.

=== id=race layout=default speaker=dung time=35 kicker="Chống bán trùng"
## Hai người cùng bấm một ghế
<div class="lanes">
<div class="h">Bước</div><div class="h">Khán giả A</div><div class="h">Khán giả B</div>
<div class="t">1</div><div>Cả hai gửi <code>POST /api/holds</code> cho ghế S1</div><div>Cùng một mili giây</div>
<div class="t">2</div><div>UPDATE <code>WHERE status = 'AVAILABLE'</code> giành khóa hàng</div><div>UPDATE cùng ghế, chờ khóa</div>
<div class="t">3</div><div>Ghi <code>seat_holds</code> <code>ACTIVE</code>, <code>NOTIFY</code>, COMMIT</div><div>Đang chờ</div>
<div class="t">4</div><div class="win">201, ghế chuyển tím</div><div class="lose">UPDATE đọc lại, ghế đã <code>HELD</code>: 0 dòng, <code>409 seat_not_available</code></div>
</div>
NOTES:
Câu UPDATE giữ khóa mức hàng. Giao dịch đến sau đọc lại hàng sau khi giao dịch trước commit, điều kiện AVAILABLE không còn đúng.

=== id=layers layout=default speaker=dung time=30 kicker="Chống bán trùng"
## Các lớp chặn và bài test
::: grid g2
::: card
<span class="no">Lớp 1</span>
### UPDATE có điều kiện
Chỉ ghế `AVAILABLE` mới chuyển sang `HELD`.
:::
::: card
<span class="no">Lớp 2</span>
### Unique index một phần
`uq_seat_holds_active` trên `(event_id, seat_id)`, chỉ với `status = 'ACTIVE'`.
:::
::: card tight
<span class="no">Lớp 3 · cờ tắt ở sprint2</span>
### Khóa cố vấn
`pg_advisory_xact_lock` theo `(user_id, event_id)` khi bật `ticket_limit`.
:::
::: card lift
<span class="no">Kiểm thử</span>
### 50 goroutine, một ghế
`TestHoldSeat_ConcurrentHoldersGetOneSeat`: đúng 1 lượt thành công, `seat_holds` có một dòng `ACTIVE`.
:::
:::
NOTES:
Test chạy ở tầng service trên PostgreSQL thật, cần biến TEST_DATABASE_URL.
Lớp 3 chỉ phục vụ giới hạn vé mỗi người (FR-11), không phải chống bán trùng ghế.

=== id=audit layout=default speaker=huy time=45 kicker="Nhật ký"
## Nhật ký chỉ thêm, không sửa được
|||
- `price_changes` ghi mỗi lần Ban Tổ chức đổi giá cơ bản.
- `audit_logs` ghi người làm, đối tượng, dữ liệu trước và sau.
- Trigger chặn `UPDATE` và `DELETE`.
- Trigger riêng chặn `TRUNCATE`.
|||
::: callout
Ứng dụng chỉ thêm dòng mới.
Muốn sửa nhật ký phải gỡ trigger, và việc đó nằm ngoài quyền của api.
:::
::: callout warn
Chưa có trang xem nhật ký giá (FR-20). Hiện đọc qua `GET /api/tickets/audit-logs`.
:::
NOTES:
NFR-12 yêu cầu 100% thay đổi giá và giao dịch ghi log không sửa được. Mới xong phần giá, chưa ghi log giao dịch.

=== id=zone-pricing layout=default speaker=dung time=45 kicker="Giá theo khu"
## Giá sàn, giá cơ bản, giá trần
|||
- Ban Tổ chức đặt ba mức giá cho từng khu (FR-08).
- Ràng buộc: `giá sàn ≤ giá cơ bản ≤ giá trần`.
- Mỗi lần đổi giá cơ bản ghi một dòng `price_changes`, lý do `MANUAL`.
- Ghế đang được giữ giữ nguyên giá cũ.
|||
::: callout
`PUT /api/organizer/events/{id}/zones/{zoneId}/pricing`
Cờ `organizer_console` và `zone_pricing`.
:::
[[ok:Đã chạy]] đặt giá thủ công · [[wip:Đang làm]] tạo địa điểm, khu, sự kiện
NOTES:
Demo có hai bước về giá: nhập giá cơ bản lớn hơn giá trần để thấy lỗi, rồi nhập giá hợp lệ.

=== id=dynamic-pricing layout=default speaker=dung time=55 kicker="Định giá động" badge="road:Thiết kế"
## Hệ thống đề xuất, Ban Tổ chức duyệt
|||
- Mỗi 5 phút tính chỉ số áp lực từ tốc độ bán, hàng chờ và tỷ lệ ghế đang giữ.
- Mỗi chu kỳ đổi tối đa 20%.
- Giá luôn nằm trong khoảng giá sàn và giá trần.
- Chênh dưới 5% thì bỏ qua.
- **Hệ thống không bao giờ tự đổi giá (<span class="nb">W-01</span>).**
|||
### Ví dụ tính tay: khu Fanzone
- Giá hiện tại 1.200.000 đồng.
- Tốc độ bán gấp 2 lần mục tiêu, 250 người chờ, 40% ghế đang giữ.
- Chỉ số áp lực 1,73.
- Đề xuất tăng 18,3%, lên **1.420.000 đồng**.
NOTES:
Cờ dynamic_pricing đang tắt, FR-22 chưa làm. Đã có bảng price_suggestions và giá sàn, giá trần theo khu. Chưa có job tính và endpoint duyệt.
Phản biện của nhóm: người mua không biết trước giá có thể tăng. Có tiền lệ cuộc điều tra của CMA ở Anh về cách bán vé Oasis. Vì vậy thiết kế dùng người duyệt, biên độ và nhật ký giá. Nhóm chưa có thực nghiệm về hành vi người mua.
