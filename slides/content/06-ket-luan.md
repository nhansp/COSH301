=== id=k6 layout=default speaker=dung time=55 kicker="Kiểm thử"
## Kiểm thử tải trên bản chạy thật
| Kịch bản (3 phút 30 giây) | Kết quả |
|---|---|
| 200 người xem và 100 người giữ, trả ghế cùng lúc | 28.576 yêu cầu, khoảng 132 yêu cầu mỗi giây |
| Thời gian phản hồi khi xem, p95 | 342 ms, không có lỗi |
| Thời gian giữ ghế, p95 | 296 ms, 6.294 lượt giữ thành công |
| Mức dùng CPU cao nhất | api khoảng 13%, cơ sở dữ liệu khoảng 10% |

::: callout
**Tranh một ghế:** 100 tài khoản cùng giữ một ghế, đúng 1 tài khoản thành công, 99 bị từ chối.
:::
NOTES:
Đo bằng k6 qua Cloudflare, máy ảo 2 vCPU, 4 GB. Ngoài ra có kiểm thử tự động: 50 luồng cùng giữ một ghế ở tầng nghiệp vụ, đúng 1 luồng thành công.
Nếu được hỏi về lần đo đầu ra 3 người thắng: ba người đó thắng nối tiếp nhau, mỗi người trả ghế sau 3 giây, không trùng thời điểm; chạy lại với thời gian giữ 15 giây cho kết quả 1 thắng.

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
Hướng phát triển: hoàn thành Sprint 3 đến Sprint 5 theo bảng cờ tính năng.

=== id=thanks layout=title speaker=huy time=10 title="Cảm ơn"
<div class="eyebrow"><span class="mark"></span>Nhóm 1 · COSH301 Concerts</div>
# Cảm ơn cô và các bạn đã lắng nghe
Mời cô và các bạn xem phần demo.
<div class="meta">
<div><b>Bản chạy thật</b>cosh301.nhansp.id.vn</div>
<div><b>Mã nguồn và tài liệu</b>github.com/nhansp/COSH301</div>
</div>
NOTES:
Chuyển sang phần demo.
