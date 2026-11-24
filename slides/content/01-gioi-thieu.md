<!--
Slide source. One "===" line starts a slide, see js/deck.js for the attributes.
Speakers are provisional: thanh, phuc, ducanh (sections 1, 2, 6), huy (4), dung (realtime, pricing), nhan (architecture, OTP app, demo).
-->

=== id=title layout=title speaker=thanh time=20 title="EventTicketing"
<div class="eyebrow">COSH301 · Phân tích và Thiết kế Hệ thống</div>
# EventTicketing
Hệ thống đặt vé trực tuyến cho sự kiện
<div class="meta">
<div><b>Giảng viên</b>TS. Phạm Thị Kim Dung</div>
<div><b>Trường</b>Đại học Ngoại thương<br>Khoa Công nghệ và Khoa học dữ liệu</div>
<div><b>Nhóm</b>Vũ Đức Huy · Trần Trung Nhân · Đinh Tiến Thành<br>Lê Đức Anh · Nguyễn Đức Phúc · Nguyễn Anh Dũng</div>
</div>
NOTES:
Chào cô và các bạn. Nhóm trình bày EventTicketing: hệ thống đặt vé concert, backend Go, frontend React, cơ sở dữ liệu PostgreSQL 18.
Bản chạy thật nằm ở cosh301.nhansp.id.vn. Cuối bài nhóm có demo trực tiếp.

=== id=sec-1 layout=section no=1 speaker=thanh time=5 kicker="Phần 1"
## Giới thiệu và bối cảnh
Bài toán bán vé khi mở bán đông người, và phần nhóm đã làm.

=== id=team layout=default speaker=thanh time=30 kicker="Nhóm thực hiện"
## Sáu người, năm sprint
| Thành viên | Phần phụ trách |
|---|---|
| Vũ Đức Huy | Nhóm trưởng, ERD 23 bảng, sơ đồ lớp BCE, kế hoạch Sprint |
| Trần Trung Nhân | Kiến trúc, backend Go, frontend React, OTP, đặc tả API |
| Đinh Tiến Thành | Bảng FR/NFR, ma trận truy vết, kiểm thử thủ công FR-06 |
| Lê Đức Anh | Sơ đồ và đặc tả use case, kế hoạch kiểm thử người dùng |
| Nguyễn Đức Phúc | Sơ đồ luồng dữ liệu, sequence chống bán trùng |
| Nguyễn Anh Dũng | Sequence giữ ghế 5 phút, bài toán và thiết kế định giá động |

Sprint 2 có 14 đầu việc (T01 đến T14), ước lượng 206 giờ.
NOTES:
Sprint 2 là mốc giữa kỳ: 14 đầu việc, 206 giờ công. Cả dự án 5 sprint, ước lượng 458 giờ.

=== id=problem layout=default speaker=phuc time=50 kicker="Bối cảnh"
## Năm thách thức khi mở bán vé
::: grid g3
::: card
<span class="no">01</span>
### Nghẽn hệ thống
Lượng truy cập tăng vọt đúng lúc mở bán.
:::
::: card
<span class="no">02</span>
### Phe vé và bot
Kịch bản tự động gom vé đẹp trong vài giây.
:::
::: card
<span class="no">03</span>
### Bán trùng ghế
Hai người bấm cùng một ghế, cả hai đều bị trừ tiền.
:::
::: card
<span class="no">04</span>
### Giá cố định
Khu VIP cháy vé sớm, khu xa sân khấu còn trống.
:::
::: card
<span class="no">05</span>
### Gian lận tại cổng
QR chụp màn hình bị chia sẻ. Sân vận động mất sóng thì máy quét tê liệt.
:::
::: card lift
<span class="no">Đã chạy</span>
### Sprint 2
Chống bán trùng và giữ ghế realtime. Phần còn lại ở mức thiết kế.
:::
:::
NOTES:
Năm thách thức: nghẽn, bot, bán trùng, giá cố định, gian lận tại cổng.
Ở Sprint 2 nhóm giải quyết trọn vẹn bán trùng ghế. Các phần khác có thiết kế, chưa có code.

=== id=scope layout=default speaker=ducanh time=45 kicker="Mục tiêu và phạm vi"
## Làm gì, không làm gì
|||
### Mục tiêu
- Chuẩn hóa 23 FR và 13 NFR.
- Mô hình hóa theo BCE.
- PostgreSQL 18, không bán trùng ghế.
- Sơ đồ ghế realtime bằng SSE.
- Định giá động do Ban Tổ chức duyệt (<span class="nb">FR-22</span>).
|||
### Chạy được ở profile `sprint2`
- [[ok:Xong]] Danh sách sự kiện, sơ đồ ghế realtime
- [[ok:Xong]] Giữ ghế 5 phút, chống bán trùng
- [[wip:Đang làm]] Đăng nhập OTP, giá sàn và giá trần theo khu
- [[todo:Chưa làm]] Thanh toán, phát vé, soát vé
NOTES:
Won't-Have quan trọng nhất là W-01: hệ thống không bao giờ tự đổi giá. Định giá động chỉ sinh đề xuất, Ban Tổ chức duyệt.

=== id=status layout=default speaker=ducanh time=30 kicker="Trạng thái hiện tại"
## Những con số kiểm được trong code
::: grid g4
::: stat
<b>23</b>
<span>bảng trong migration</span>
:::
::: stat
<b>19</b>
<span>cờ tính năng, profile <code>sprint2</code> bật 5</span>
:::
::: stat
<b>6</b>
<span>FR đã xong (FR-02 đến FR-07)</span>
:::
::: stat
<b>1</b>
<span>binary Go, một database</span>
:::
:::
Còn 4 FR đang làm (FR-01, FR-08, FR-11, FR-20) và 13 FR chưa làm.
Cờ tắt thì giao diện ẩn tính năng và api trả `404 feature_disabled`.
NOTES:
Nguồn: docs/spec.md. Bản trực tuyến chạy profile sprint2, APP_ENV=production.
