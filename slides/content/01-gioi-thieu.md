<!--
Slide source. One "===" line starts a slide, see js/deck.js for the attributes.
Speakers and slide order follow "PHÂN CÔNG TRÌNH BÀY" in docs/presentation-script.md.
-->

=== id=title layout=title speaker=huy time=10 title="EventTicketing"
<div class="eyebrow">COSH301 · Phân tích và Thiết kế Hệ thống</div>
# EventTicketing
Hệ thống đặt vé trực tuyến cho sự kiện
<div class="meta">
<div><b>Giảng viên</b>TS. Phạm Thị Kim Dung</div>
<div><b>Trường</b>Đại học Ngoại thương<br>Khoa Công nghệ và Khoa học dữ liệu</div>
<div><b>Nhóm</b>Vũ Đức Huy · Trần Trung Nhân · Đinh Tiến Thành<br>Lê Đức Anh · Nguyễn Đức Phúc · Nguyễn Anh Dũng</div>
</div>
NOTES:
Script slide 1. Chào cô và các bạn. Nhóm trình bày EventTicketing: hệ thống đặt vé concert, backend Go, frontend React, PostgreSQL 18.
Bản chạy thật ở cosh301.nhansp.id.vn. Cuối bài là demo trực tiếp.

=== id=team layout=default speaker=ducanh time=15 kicker="Nhóm thực hiện"
## Sáu người, năm sprint
| Thành viên | Phần phụ trách |
|---|---|
| Vũ Đức Huy | Nhóm trưởng, ERD, sơ đồ lớp BCE, kế hoạch Sprint |
| Trần Trung Nhân | Kiến trúc, backend Go, frontend React, OTP, đặc tả API |
| Đinh Tiến Thành | Bảng FR/NFR, ma trận truy vết, kiểm thử thủ công FR-06 |
| Lê Đức Anh | Sơ đồ và đặc tả use case, kế hoạch kiểm thử người dùng |
| Nguyễn Đức Phúc | Sơ đồ luồng dữ liệu, sequence chống bán trùng |
| Nguyễn Anh Dũng | Sequence giữ ghế 5 phút, định giá động |
NOTES:
Script slide 2. Sprint 2 có 14 đầu việc (T01 đến T14), ước lượng 206 giờ. Cả dự án 5 sprint, 458 giờ.

=== id=problem layout=default speaker=ducanh time=45 kicker="Bối cảnh"
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
### Bản trực tuyến
Chống bán trùng, giữ ghế realtime, thanh toán sandbox. Phần còn lại ở mức thiết kế.
:::
:::
NOTES:
Script slide 3. Năm thách thức: nghẽn, bot, bán trùng, giá cố định, gian lận tại cổng.
