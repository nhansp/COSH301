=== id=sec-2 layout=section no=2 speaker=thanh time=5 kicker="Phần 2"
## Yêu cầu
FR, NFR, user story, MoSCoW và use case.

=== id=fr-nfr layout=default cols="1fr 1.5fr" speaker=thanh time=45 kicker="Đặc tả yêu cầu"
## 23 FR chia theo bốn sprint
|||
::: grid g2
::: stat sm
<b>23</b>
<span>yêu cầu chức năng</span>
:::
::: stat sm
<b>13</b>
<span>yêu cầu phi chức năng</span>
:::
::: stat sm
<b>7</b>
<span>user story</span>
:::
::: stat sm
<b>17</b>
<span>use case</span>
:::
:::
|||
| Sprint | FR | Nội dung |
|---|---|---|
| 2 | FR-01 đến 08 | OTP, sơ đồ ghế, giữ ghế, giá khu |
| 3 | FR-09 đến 12 | Phòng chờ, chống bot, giới hạn vé, QR 30 giây |
| 4 | FR-13 đến 15 | Thanh toán, vé qua email, đối soát |
| 5 | FR-16 đến 23 | Soát vé, dashboard, nhật ký giá, định giá động |
NOTES:
Mã FR, NFR, US, W cố định, không đánh số lại. Cột trạng thái từng yêu cầu nằm trong docs/spec.md.

=== id=nfr layout=default speaker=thanh time=35 kicker="Yêu cầu phi chức năng"
## Mỗi NFR có một chỉ số đo được
| Mã | Chỉ số | Trạng thái |
|---|---|---|
| NFR-01 | ≥ 50.000 người dùng đồng thời, p95 ≤ 2 giây | [[todo:Chưa làm]] k6 đang đo |
| NFR-03 | 0 trường hợp bán trùng ghế | [[ok:Xong]] test 50 luồng |
| NFR-10 | Trạng thái ghế tới trình duyệt ≤ 3 giây | [[ok:Xong]] SSE sau `COMMIT` |
| NFR-07 | Bot lọt qua < 1% | [[wip:Đang làm]] chưa có Turnstile |
| NFR-05 | Soát một vé ≤ 1 giây | [[todo:Chưa làm]] |
| NFR-08 | QR tự làm mới, ảnh chụp bị từ chối | [[todo:Chưa làm]] |
NOTES:
Đây là mục tiêu thiết kế. Hiện mới NFR-03 và NFR-10 xong. Nhóm chưa chạy k6 nên không nêu số đo tải.

=== id=stories layout=default cols="1.5fr 1fr" speaker=phuc time=40 kicker="User story"
## Bảy user story, hai đã chạy
|||
- [[road:Sprint 3]] **US-01** Xếp hàng trong phòng chờ ảo
- [[ok:Xong]] **US-02** Sơ đồ ghế đổi màu, không cần F5
- [[ok:Xong]] **US-03** Giữ ghế độc quyền 5 phút
- [[road:Sprint 4]] **US-04** Thanh toán qua cổng trực tuyến
- [[road:Sprint 4]] **US-05** Nhận vé và QR đổi mỗi 30 giây
- [[road:Sprint 4]] **US-06** Tự hoàn tiền khi lỗi thanh toán
- [[road:Sprint 5]] **US-07** Soát vé khi mất mạng
|||
::: callout
**US-03** · Giữ ghế độc quyền 5 phút
**Given** đã đăng nhập và chọn một ghế trống.
**When** bấm xác nhận chọn ghế.
**Then** ghế đổi sang tím, đồng hồ đếm ngược 05:00, không ai chọn đè được. Hết giờ thì ghế tự nhả.
:::
NOTES:
Tiêu chí chấp nhận viết theo Given-When-Then. US-02 và US-03 là hai story đã có code và chạy trong demo.

=== id=moscow layout=default speaker=phuc time=35 kicker="Ưu tiên"
## MoSCoW cho bản MVP
::: grid g4
::: card tight
### Must
FR-01 đến 11
FR-13 đến 17
OTP, sơ đồ ghế, giữ ghế, giá khu, phòng chờ, chống bot, thanh toán, soát vé.
:::
::: card tight
### Should
FR-12, 18, 19, 20
QR 30 giây, soát vé offline, dashboard CEO, nhật ký giá.
:::
::: card tight
### Could
FR-21, 22, 23
Xuất báo cáo, định giá động, gợi ý khuyến mãi.
:::
::: card tight
### Won't
W-01 đến W-05
AI tự đổi giá, sàn bán lại vé, eKYC, sơ đồ 3D, đa ngôn ngữ.
:::
:::
NOTES:
W-01 là ranh giới đạo đức của dự án: giá chỉ đổi khi Ban Tổ chức duyệt.

=== id=usecases layout=default speaker=ducanh time=40 kicker="Use case"
## 17 use case, 5 vai trò
::: grid g5
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
`UC-14` xuất báo cáo
:::
::: card tight
### Nhân viên cổng
`UC-15` soát vé
`UC-16` soát vé offline
:::
::: card tight
### Quản trị
`UC-17` phân quyền
:::
:::
Hệ thống ngoài: cổng thanh toán, SMTP, SMS Gateway, Cloudflare Turnstile.
NOTES:
Mọi vai trò đăng nhập bằng OTP (UC-01). Tài khoản mới luôn là CUSTOMER.

=== id=uc05 layout=default speaker=ducanh time=40 kicker="Đặc tả use case"
## UC-05: giữ ghế
<div class="flow">
<div class="node"><b>Bấm ghế xanh</b>Khán giả mở sơ đồ ghế<small>UC-04</small></div><div class="arrow">→</div>
<div class="node"><b>POST /api/holds</b>eventId, seatId<small>cần đăng nhập</small></div><div class="arrow">→</div>
<div class="node"><b>Một giao dịch</b>kiểm tra ON_SALE, UPDATE có điều kiện, ghi seat_holds</div><div class="arrow">→</div>
<div class="node hot"><b>201</b>holdId, expiresAt<small>NOTIFY, rồi COMMIT</small></div>
</div>

| Luồng phụ | Kết quả |
|---|---|
| Chưa đăng nhập | `401 unauthorized` |
| Sự kiện chưa mở bán hoặc đã dừng | `409 event_not_on_sale` |
| Ghế đã có người giữ hoặc đã bán | `409 seat_not_available` |
| Quá 5 phút chưa thanh toán | `HoldReaper` nhả ghế, ghế về `AVAILABLE` |
NOTES:
Giới hạn vé mỗi người (cờ ticket_limit) có trong đặc tả nhưng đang tắt ở profile sprint2.
