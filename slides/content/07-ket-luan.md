=== id=k6 layout=default cols="1.1fr 0.9fr" speaker=dung time=60 kicker="Kiểm thử" figh=680
## Kiểm thử tải trên bản chạy thật
|||
- **3 phút 30 giây**, 200 người xem và 100 người giữ, trả ghế: 28.576 yêu cầu, khoảng 132 yêu cầu mỗi giây, không lỗi. Thời gian phản hồi p95: xem 342 ms, giữ ghế 296 ms.
- **45 giây**, 260 người dùng ảo dồn vào một khu: 12.084 yêu cầu, khoảng 249 yêu cầu mỗi giây, p95 183 ms, 100% kiểm tra đạt.
- **CPU cao nhất:** api khoảng 25%, cơ sở dữ liệu khoảng 20%.
- **Tranh một ghế:** 100 tài khoản cùng giữ một ghế, đúng 1 thành công.
|||
![k6 và CPU từng container trên máy chủ thật](img/pov/k6.jpg)
<p class="figcap">Kết quả k6 và CPU từng container, theo thời gian thực</p>
NOTES:
Đo bằng k6 qua Cloudflare, máy ảo 2 vCPU, 4 GB. Biểu đồ dưới ảnh lấy từ docker stats trên máy ảo, cập nhật mỗi giây; phần cao là lúc chạy tải, phần thấp là sau khi tải dừng.
Kịch bản dồn vào một khu cố ý tạo tranh chấp: 60 người cùng giữ ghế trong 24 ghế, nên phần lớn lượt giữ bị từ chối đúng quy tắc (ghế đã có người giữ): 336 lượt thành công, 4.499 lượt bị từ chối. Ảnh chụp từ video demo.
Ngoài ra có kiểm thử tự động: 50 luồng cùng giữ một ghế ở tầng nghiệp vụ, đúng 1 luồng thành công.

=== id=usertest layout=default speaker=thanh time=40 kicker="Kiểm thử"
## Kiểm thử người dùng
|||
### Quy trình
- Người tham gia: 5 – 8 bạn trong lớp, vai trò khán giả và Ban Tổ chức.
- Nhiệm vụ: đăng nhập OTP, giữ ghế, thanh toán thử, xem vé.
- Ghi nhận: hoàn thành hay không, thời gian, lỗi gặp phải.
|||
### Đo lường
- Phiếu SUS 10 câu ngay trong ứng dụng, tại trang `/khao-sat`.
- Ban Tổ chức xem kết quả tổng hợp: điểm SUS, tỉ lệ hoàn thành, góp ý.
- Kết quả được cập nhật vào báo cáo sau buổi kiểm thử.
NOTES:
Nhóm không đưa số liệu khi chưa có người dùng thật tham gia. Kế hoạch chi tiết ở docs/testing.md.

=== id=sprints layout=default speaker=phuc time=40 kicker="Kết luận"
## Kế hoạch và tiến độ theo sprint
| Sprint | Nội dung chính | Hiện trạng |
|---|---|---|
| 1 (2 tuần) | Khảo sát, đặc tả yêu cầu, DFD, ERD, giao diện mẫu | [[ok:Xong]] |
| 2 (3 tuần) | Giữ ghế, chống bán trùng, sơ đồ ghế thời gian thực, OTP, giá khu, định giá động | [[ok:Xong]] |
| 3 (2 tuần) | Phòng chờ ảo, chặn bot, giới hạn vé, trợ lý ảo | [[wip:Một phần]] trợ lý ảo đã chạy |
| 4 (2 tuần) | Thanh toán, vé điện tử, đối soát hoàn tiền | [[wip:Một phần]] VNPay môi trường thử |
| 5 (3 tuần) | Soát vé, bảng doanh thu, báo cáo | [[todo:Chưa làm]] |

Tổng cộng 12 tuần, ước lượng 472 giờ công cho 6 thành viên.
NOTES:
Bảng phân rã công việc Sprint 2 (T01 đến T14) và phân bổ giờ công từng người nằm ở bảng 14 và bảng 15 của báo cáo. Phần làm sớm hơn kế hoạch: định giá động, trợ lý ảo và thanh toán VNPay.

=== id=limits layout=default speaker=phuc time=45 kicker="Kết luận"
## Hạn chế và bài học
|||
### Hạn chế
- Chưa có SMS thật; ứng dụng OTP chưa xác minh chủ số điện thoại.
- Thanh toán ở môi trường thử, chưa hoàn tiền tự động.
- Chưa có soát vé và bảng doanh thu.
- Hệ thống chạy trên một máy ảo, chưa có dự phòng.
|||
### Bài học
- Tận dụng PostgreSQL (khóa dòng, LISTEN/NOTIFY) giúp hệ thống đơn giản mà vẫn an toàn.
- Phân lớp BCE giúp tách nghiệp vụ và kiểm thử dễ hơn.
- Cờ tính năng giúp nghiệm thu từng sprint trên cùng một bản mã.
NOTES:
Hướng phát triển: hoàn thành Sprint 3 đến Sprint 5 theo bảng cờ tính năng. Sau slide này chuyển sang phần demo.
