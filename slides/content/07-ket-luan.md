=== id=sec-7 layout=section no=7 speaker=ducanh time=5 kicker="Phần 7"
## Kết luận
Kết quả, hạn chế và bài học.

=== id=results layout=default speaker=ducanh time=35 kicker="Kết quả"
## Nhóm đã làm được
1. 23 FR, 13 NFR, 7 user story và ma trận truy vết.
2. 17 use case, DFD ba mức, sơ đồ lớp BCE, các sơ đồ tuần tự.
3. Cơ sở dữ liệu 23 bảng trên PostgreSQL 18, có unique index một phần và trigger nhật ký.
4. Sprint 2 chạy trên Go và PostgreSQL: OTP, sơ đồ ghế realtime, giữ ghế 5 phút, giá theo khu.
5. Test tương tranh cho giữ ghế: 50 luồng, một ghế.
NOTES:
Kiểm thử tải và kiểm thử người dùng chưa chạy, nói ở slide sau.

=== id=limits layout=default speaker=thanh time=40 kicker="Hạn chế và bài học"
## Còn thiếu gì
|||
### Hạn chế
- OTP chưa gửi qua SMTP hay SMS.
- Chưa có Turnstile.
- Thanh toán, vé, soát vé, dashboard chưa làm.
- Một máy ảo, không dự phòng.
- Chưa chạy k6, chưa kiểm thử với người dùng.
|||
### Bài học
- **Đơn giản có chủ đích:** khóa nguyên tử và `LISTEN/NOTIFY` của PostgreSQL đủ cho giữ ghế, không cần Redis.
- **BCE:** ba lớp tách rõ, dễ kiểm thử riêng.
- **Cờ tính năng:** nghiệm thu từng sprint mà không giấu code dở.
NOTES:
Kế hoạch kiểm thử người dùng, form SUS 10 câu nằm trong docs/testing.md, các bảng kết quả để trống. Không nêu điểm SUS.

=== id=thanks layout=title speaker=phuc time=15 title="Cảm ơn và hỏi đáp"
<div class="eyebrow">Hỏi đáp</div>
# Cảm ơn cô và các bạn
Bản chạy thật: **cosh301.nhansp.id.vn**
<div class="meta">
<div><b>Mã nguồn</b>nhánh <code>rewrite</code></div>
<div><b>Tài liệu</b>thư mục <code>docs/</code></div>
</div>
NOTES:
Câu hỏi hay gặp: vì sao không dùng Redis, HoldReaper có làm chậm database không, vì sao chọn SSE, định giá động có gây tranh cãi không. Đáp án ở docs/presentation-script.md phần 7.
