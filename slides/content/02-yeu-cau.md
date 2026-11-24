=== id=scope layout=default speaker=thanh time=45 kicker="Mục tiêu và phạm vi"
## Làm gì, không làm gì
|||
### Mục tiêu
- Chuẩn hóa yêu cầu, mô hình hóa theo BCE.
- PostgreSQL 18, không bán trùng ghế.
- Sơ đồ ghế realtime bằng SSE.
- Định giá động do Ban Tổ chức duyệt (<span class="nb">FR-22</span>).
|||
### Đã chạy trên bản trực tuyến
- [[ok:Xong]] Danh sách sự kiện, sơ đồ ghế realtime
- [[ok:Xong]] Giữ ghế 5 phút, chống bán trùng
- [[wip:Đang làm]] Đăng nhập OTP, giá sàn và giá trần
- [[ok:Xong]] Thanh toán (VNPay sandbox)
- [[wip:Một phần]] Phát vé: có "Vé của tôi", chưa email và QR
- [[todo:Chưa làm]] Soát vé
NOTES:
Script slide 4. Won't-Have quan trọng nhất là W-01: hệ thống không bao giờ tự đổi giá. Định giá động chỉ sinh đề xuất, Ban Tổ chức duyệt.
Hệ thống có 19 cờ tính năng. Cờ tắt thì api trả 404 feature_disabled. Thanh toán chạy ở sandbox, không có tiền thật.

=== id=spec layout=default cols="1fr 1.6fr" speaker=thanh time=55 kicker="Đặc tả yêu cầu"
## 24 FR, 13 NFR, ưu tiên MoSCoW
|||
::: grid g2
::: stat sm
<b>24</b>
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
<b>13</b>
<span>use case</span>
:::
:::
|||
| Nhóm | Yêu cầu |
|---|---|
| Must | FR-01 đến 11, FR-13 đến 17: OTP, ghế, giá khu, phòng chờ, thanh toán, soát vé |
| Should | FR-12, 18, 19, 20: QR 30 giây, soát offline, dashboard, nhật ký giá |
| Could | FR-21, 22, 23, 24: báo cáo, định giá động, khuyến mãi, trợ lý chatbot AI |
| Won't | W-01 AI tự đổi giá, W-02 sàn bán lại vé, W-04 Apple/Google Wallet |
NOTES:
Script slide 5. Mã FR, NFR, US, W cố định. Trạng thái từng yêu cầu nằm trong báo cáo và docs/spec.md. FR-24 (trợ lý chatbot AI) thuộc Sprint 3, đang hoàn thiện.
User story viết theo Given-When-Then. US-02 (ghế đổi màu không cần F5) và US-03 (giữ ghế 5 phút) đã chạy.

=== id=nfr layout=default speaker=thanh time=45 kicker="Yêu cầu phi chức năng"
## Mỗi NFR có một chỉ số đo được
| Mã | Chỉ số | Trạng thái |
|---|---|---|
| NFR-01 | ≥ 50.000 người dùng đồng thời, p95 ≤ 2 giây | [[wip:Mới đo 300]] xem slide k6 |
| NFR-03 | 0 trường hợp bán trùng ghế | [[ok:Xong]] test 50 luồng |
| NFR-10 | Trạng thái ghế tới trình duyệt ≤ 3 giây | [[ok:Xong]] SSE sau `COMMIT` |
| NFR-07 | Bot lọt qua < 1% | [[wip:Đang làm]] chưa có Turnstile |
| NFR-05 | Soát một vé ≤ 1 giây | [[todo:Chưa làm]] |
| NFR-08 | QR tự làm mới, ảnh chụp bị từ chối | [[todo:Chưa làm]] |
NOTES:
Script slide 6. Mục tiêu thiết kế. Hiện NFR-03 và NFR-10 xong. NFR-01: nhóm mới đo 300 người dùng đồng thời trên máy ảo 2 vCPU, chưa tới 50.000.
