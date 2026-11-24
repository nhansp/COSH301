<!--
Slide source. One "===" line starts a slide, see js/deck.js for the attributes.
Speakers and slide order follow "PHÂN CÔNG TRÌNH BÀY" in docs/presentation-script.md.
-->

=== id=title layout=title speaker=huy time=15 title="EventTicketing"
<div class="eyebrow"><span class="mark"></span>Nhóm 1 · Phân tích và thiết kế hệ thống</div>
# EventTicketing
Hệ thống đặt vé trực tuyến cho sự kiện
<div class="meta">
<div><b>Giảng viên hướng dẫn</b>TS. Phạm Thị Kim Dung</div>
<div><b>Thành viên</b>Vũ Đức Huy · Trần Trung Nhân · Đinh Tiến Thành<br>Lê Đức Anh · Nguyễn Đức Phúc · Nguyễn Anh Dũng</div>
</div>
NOTES:
Em chào cô và các bạn. Nhóm 1 xin trình bày đề tài thiết kế hệ thống đặt vé trực tuyến cho sự kiện, gọi tắt là EventTicketing.
Hệ thống đang chạy thật tại cosh301.nhansp.id.vn. Cuối buổi nhóm sẽ demo.

=== id=team layout=default speaker=ducanh time=20 kicker="Giới thiệu"
## Thành viên nhóm và phân công
| Thành viên | Phụ trách chính |
|---|---|
| Vũ Đức Huy | Nhóm trưởng, mô hình dữ liệu, giữ ghế, trợ lý ảo |
| Trần Trung Nhân | Kiến trúc, backend và frontend, đăng nhập OTP, ứng dụng Android, triển khai |
| Đinh Tiến Thành | Đặc tả yêu cầu, ma trận truy vết, kiểm thử người dùng |
| Lê Đức Anh | Biểu đồ use case và đặc tả, khảo sát người dùng |
| Nguyễn Đức Phúc | Biểu đồ luồng dữ liệu, sơ đồ tuần tự chống bán trùng |
| Nguyễn Anh Dũng | Sơ đồ tuần tự giữ ghế, định giá động, kiểm thử tải |
NOTES:
Nhóm làm theo Scrum, chia 5 sprint. Bảng phân công chi tiết theo từng đầu việc có trong báo cáo, phần 6.

=== id=problem layout=default speaker=ducanh time=45 kicker="Giới thiệu"
## Bối cảnh và vấn đề
::: grid g3
::: card
<span class="no">01</span>
### Quá tải khi mở bán
Lượng truy cập tăng đột biến đúng thời điểm mở bán, hệ thống dễ sập.
:::
::: card
<span class="no">02</span>
### Phe vé dùng bot
Công cụ tự động gom hết vé đẹp chỉ trong vài giây.
:::
::: card
<span class="no">03</span>
### Bán trùng ghế
Hai người cùng chọn một ghế và cùng bị trừ tiền.
:::
::: card
<span class="no">04</span>
### Giá vé cố định
Khu gần sân khấu hết vé sớm, khu xa còn trống nhiều.
:::
::: card
<span class="no">05</span>
### Gian lận tại cổng
Ảnh chụp mã QR bị chia sẻ; sân vận động mất sóng thì máy quét không dùng được.
:::
::: card lift
<span class="no">Hướng giải quyết</span>
### EventTicketing
Giữ ghế có thời hạn, chống bán trùng ở tầng cơ sở dữ liệu, giá theo cung cầu có người duyệt.
:::
:::
NOTES:
Năm vấn đề này lấy từ khảo sát khán giả và Ban Tổ chức ở Sprint 1. Các phần sau lần lượt trình bày cách nhóm xử lý từng vấn đề.
