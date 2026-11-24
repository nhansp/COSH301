=== id=pricing-model layout=default speaker=dung time=55 kicker="Định giá động"
## Định giá động: dữ liệu đầu vào và công thức
|||
### Dữ liệu đầu vào (mỗi khu)
- Tốc độ bán v: số ghế được giữ hoặc bán trong 15 phút gần nhất, so với tốc độ mục tiêu v*.
- Số người trong phòng chờ Q.
- Tỉ lệ ghế đang được giữ r.
|||
### Cách tính (5 phút một lần)
<div class="callout"><code>α = 0,5·v/v* + 0,3·(1 + Q/500) + 0,2·(1 + r)</code><br><code>δ = 0,25·(α − 1)</code>, giới hạn ±20%</div>

- Giá đề xuất bằng giá hiện tại nhân (1 + δ), làm tròn đến 10.000 đồng, nằm trong khoảng giá sàn – giá trần.
- Lệch dưới 5% thì bỏ qua.
- **Chỉ là đề xuất, Ban Tổ chức duyệt mới áp dụng (W-01).**
NOTES:
α là chỉ số áp lực cầu. α lớn hơn 1 nghĩa là bán nhanh hơn kế hoạch, giá đề xuất tăng; nhỏ hơn 1 thì giảm. Ví dụ trong tài liệu: Fanzone giá 1.200.000 đồng, α = 1,73, δ = +18,25%, đề xuất 1.420.000 đồng.
Ghế đang được giữ không đổi giá cho đến khi được trả lại. Tỉ lệ lấp đầy hiển thị cho Ban Tổ chức tham khảo, không đưa vào công thức.

=== id=pricing-ui layout=default speaker=dung time=45 kicker="Định giá động"
## Định giá động trên giao diện
|||
### Phía Ban Tổ chức
- Xem dữ liệu đầu vào của từng khu: tốc độ bán, tỉ lệ lấp đầy, hệ số áp lực.
- So sánh giá hiện tại và giá đề xuất, kèm mức tăng giảm.
- Xem lịch sử giá, bấm duyệt hoặc từ chối.
|||
### Phía khán giả
- Giá trên sơ đồ ghế cập nhật ngay sau khi Ban Tổ chức duyệt.
- Khu vừa đổi giá có nhãn báo tăng hoặc giảm.
- Mỗi lần đổi giá được ghi vào nhật ký giá.
NOTES:
Phần demo cho thấy: nhiều khách giữ ghế cùng lúc làm tốc độ bán tăng, chạy lại phân tích thì giá đề xuất tăng, Ban Tổ chức duyệt và giá trên sơ đồ ghế thay đổi.

=== id=payment layout=default speaker=phuc time=40 kicker="Thanh toán"
## Thanh toán qua VNPay
<div class="flow">
<div class="node"><b>Giữ ghế</b>5 phút</div><div class="arrow">→</div>
<div class="node"><b>Tạo đơn</b>giá tính ở máy chủ<small>cộng phí 3%</small></div><div class="arrow">→</div>
<div class="node"><b>Trang VNPay</b>có chữ ký số</div><div class="arrow">→</div>
<div class="node hot"><b>VNPay báo về</b>kiểm tra chữ ký<small>xử lý đúng một lần</small></div><div class="arrow">→</div>
<div class="node"><b>Phát vé</b>ghế chuyển sang đã bán</div>
</div>

- Chỉ thông báo từ VNPay mới xác nhận thanh toán, trang trả về chỉ hiển thị kết quả.
- Thanh toán đến sau khi hết hạn giữ ghế thì đơn được đánh dấu cần hoàn tiền, không phát vé.
- Chạy ở môi trường thử của VNPay, dùng thẻ thử, không có tiền thật.
NOTES:
Chữ ký dùng HMAC-SHA512 theo chuẩn VNPay 2.1.0. Nếu VNPay gửi lại cùng một thông báo, máy chủ trả mã "đã xác nhận" và không xử lý lần hai. Chưa có hoàn tiền tự động và chưa gửi vé qua email.

=== id=assistant layout=default speaker=huy time=40 kicker="Trợ lý ảo"
## Trợ lý ảo hỗ trợ đặt vé
|||
- Khán giả hỏi lịch diễn, giá vé, khu còn chỗ, cách đặt vé.
- Ban Tổ chức hỏi nhanh doanh số các sự kiện của mình.
- Mô hình ngôn ngữ chạy trên máy của nhóm, kết nối qua Cloudflare.
|||
### Cách tránh trả lời sai
- Mô hình chỉ xác định câu hỏi thuộc loại nào.
- Số liệu (ngày, giá, số ghế) lấy từ cơ sở dữ liệu.
- Mô hình lỗi hoặc chậm thì chuyển sang bộ nhận diện từ khóa.
NOTES:
Đây là phần cộng điểm về công nghệ thông minh (FR-24). Mô hình nhỏ (Qwen3.5, 0,8 tỉ tham số) nên nhóm không để mô hình tự viết số liệu. Câu trả lời luôn theo quyền của người hỏi: khán giả không xem được doanh số.

=== id=gate layout=default speaker=ducanh time=40 kicker="Hướng phát triển" badge="road:Sprint 5"
## Vé QR xoay vòng và soát vé ngoại tuyến
|||
### Mã QR đổi sau mỗi 30 giây
- Mã sinh từ khóa bí mật của vé và thời điểm hiện tại, theo ý tưởng TOTP.
- Ảnh chụp màn hình cũ bị từ chối.
|||
### Soát vé tại cổng
- Quét bằng camera điện thoại, xác thực dưới 1 giây.
- Mất mạng thì máy quét tự kiểm tra và đồng bộ khi có mạng lại.
NOTES:
FR-12, FR-16, FR-17, FR-18 thuộc Sprint 5, hiện ở mức thiết kế. Cơ sở dữ liệu đã có cột khóa bí mật của vé và bảng checkins.

=== id=ceo layout=default speaker=phuc time=25 kicker="Hướng phát triển" badge="road:Sprint 5"
## Bảng doanh thu cho Ban lãnh đạo
- Theo dõi doanh thu và tỉ lệ lấp đầy theo thời gian thực trên điện thoại (FR-19).
- Số liệu cập nhật chậm nhất 60 giây (NFR-11).
- Xuất báo cáo bán vé ra CSV hoặc Excel (FR-21).
NOTES:
Thuộc Sprint 5, hiện ở mức thiết kế. Cơ sở dữ liệu đã có bảng sales_snapshots.
