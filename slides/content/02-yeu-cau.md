=== id=scope layout=default speaker=thanh time=45 kicker="Yêu cầu"
## Mục tiêu và phạm vi
|||
### Mục tiêu
- Đặc tả yêu cầu đầy đủ và mô hình hóa theo BCE.
- Không để xảy ra bán trùng ghế.
- Sơ đồ ghế cập nhật theo thời gian thực.
- Giá vé điều chỉnh theo cung cầu, do Ban Tổ chức duyệt.
|||
### Hiện trạng trên bản chạy thật
- [[ok:Xong]] Xem sự kiện, sơ đồ ghế thời gian thực
- [[ok:Xong]] Giữ ghế 5 phút, chống bán trùng
- [[ok:Xong]] Đăng nhập OTP, giá sàn và giá trần
- [[ok:Xong]] Định giá động có người duyệt
- [[ok:Xong]] Thanh toán VNPay (môi trường thử)
- [[todo:Chưa làm]] Soát vé, bảng doanh thu
NOTES:
Ngoài phạm vi quan trọng nhất là W-01: hệ thống không tự đổi giá khi chưa có người duyệt. Định giá động chỉ đưa ra đề xuất, Ban Tổ chức quyết định.
Thanh toán chạy ở môi trường thử (sandbox) của VNPay, không dùng tiền thật.

=== id=spec layout=default cols="1fr 1.6fr" speaker=thanh time=55 kicker="Yêu cầu"
## Yêu cầu chức năng và mức ưu tiên
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
| Mức | Yêu cầu |
|---|---|
| Must | FR-01 đến FR-11, FR-13 đến FR-17: đăng nhập, sơ đồ ghế, giữ ghế, giá khu, phòng chờ, thanh toán, soát vé |
| Should | FR-12, 18, 19, 20: QR xoay vòng, soát vé ngoại tuyến, bảng doanh thu, nhật ký giá |
| Could | FR-21, 22, 23, 24: báo cáo, định giá động, gợi ý khuyến mãi, trợ lý ảo |
| Won't | W-01 tự đổi giá không qua duyệt, W-02 sàn bán lại vé, W-04 ví Apple/Google |
NOTES:
Nhóm phân loại theo MoSCoW. User story viết theo mẫu Given – When – Then. Chi tiết từng yêu cầu ở bảng 2 và bảng 13 của báo cáo.

=== id=nfr layout=default speaker=thanh time=45 kicker="Yêu cầu"
## Yêu cầu phi chức năng
| Mã | Chỉ tiêu | Hiện trạng |
|---|---|---|
| NFR-01 | 50.000 người dùng đồng thời, p95 ≤ 2 giây | [[wip:Đã đo 300]] p95 342 ms |
| NFR-03 | Không bán trùng ghế | [[ok:Đạt]] kiểm thử 50 và 100 luồng |
| NFR-10 | Trạng thái ghế đến trình duyệt ≤ 3 giây | [[ok:Đạt]] đẩy qua SSE |
| NFR-12 | Lịch sử đổi giá không sửa, không xóa được | [[ok:Đạt]] trigger PostgreSQL |
| NFR-07 | Chặn bot, lọt qua < 1% | [[wip:Một phần]] giới hạn tần suất |
| NFR-05, 08 | Soát vé ≤ 1 giây, QR làm mới | [[todo:Chưa làm]] |
NOTES:
Mỗi yêu cầu phi chức năng có một chỉ tiêu đo được. NFR-01 mới đo được 300 người dùng đồng thời trên máy ảo 2 vCPU, chưa tới mức 50.000 trong thiết kế.
