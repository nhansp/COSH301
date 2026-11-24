=== id=k6 layout=default speaker=dung time=60 kicker="Kiểm thử"
## k6 trên bản trực tuyến
| Kịch bản 3 phút 30 giây | Kết quả |
|---|---|
| 200 người duyệt, 100 người giữ và trả ghế cùng lúc | 28.576 request, khoảng 132 request mỗi giây |
| Duyệt trang, p95 | 342 ms, 0% lỗi, 15.490 check đều đạt |
| Giữ ghế, p95 | 296 ms, 6.294 lượt giữ, 389 lượt `409` đúng kỳ vọng |
| CPU đỉnh của container | api khoảng 13%, db khoảng 10% |

::: callout
**Tranh ghế:** 100 tài khoản cùng giữ một ghế, đúng 1 thắng, 99 bị từ chối (`409`).
Test tầng service: 50 goroutine, một ghế.
:::
Đo qua Cloudflare, máy ảo 2 vCPU và 4 GB. Mới 300 người dùng đồng thời, chưa tới 50.000 của NFR-01.
NOTES:
Script slide 17. Số đo lấy từ bản trực tuyến, lấy mẫu CPU mỗi 4 giây. Lần thử đầu của tranh ghế ra 3 người thắng tuần tự vì mỗi người thắng trả ghế sau 3 giây trong khi các request đến muộn qua Cloudflare, không chồng lấn; chạy lại với thời gian giữ 15 giây cho kết quả 1 thắng, 99 thua. Chỉ nêu khi được hỏi. Test tầng service: 50 goroutine cùng giữ một ghế, đúng 1 lượt thành công.
Chưa kiểm thử với người dùng thật, không có điểm SUS. Kế hoạch ở docs/testing.md.

=== id=limits layout=default speaker=phuc time=45 kicker="Hạn chế và bài học"
## Còn thiếu gì
|||
### Hạn chế
- OTP qua ứng dụng Android, mức demo: số điện thoại chưa phải bằng chứng sở hữu.
- Chưa có SMS thật, chưa có Turnstile. Đã giới hạn OTP theo IP và theo số.
- Thanh toán đang tích hợp sandbox. Vé, soát vé, dashboard chưa làm.
- Một máy ảo, chưa kiểm thử với người dùng.
|||
### Bài học
- **Đơn giản có chủ đích:** khóa nguyên tử và `LISTEN/NOTIFY` của PostgreSQL đủ cho giữ ghế.
- **BCE:** ba lớp tách rõ, kiểm thử riêng được.
- **Cờ tính năng:** nghiệm thu từng sprint, không giấu code dở.
NOTES:
Script slide 18 và 19. Hướng phát triển: hoàn thành Sprint 3 đến 5 theo bảng cờ.

=== id=thanks layout=title speaker=huy time=5 title="Cảm ơn và demo"
<div class="eyebrow">Demo trực tiếp</div>
# Cảm ơn cô và các bạn
Bản chạy thật: **cosh301.nhansp.id.vn**
<div class="meta">
<div><b>Mã nguồn</b>nhánh <code>rewrite</code></div>
<div><b>Tài liệu</b>thư mục <code>docs/</code></div>
</div>
NOTES:
Script slide 20. Mời cô xem demo trực tiếp ngay sau đây.
