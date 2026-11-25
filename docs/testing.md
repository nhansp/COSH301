# Kế hoạch kiểm thử với người dùng (User Usability Testing)

Tài liệu gồm kế hoạch kiểm thử khả năng sử dụng (Usability Testing), kịch bản, form khảo sát SUS (System Usability Scale) và mẫu bảng ghi kết quả cho hệ thống **EventTicketing**.

**Trạng thái: chưa thực hiện.**
Chưa có buổi kiểm thử nào với người dùng thật.
Các mục 4, 5 và 6 là mẫu trống, chờ điền sau khi kiểm thử.

---

## 1. Mục tiêu và Phương pháp kiểm thử

### 1.1. Mục tiêu
1. Đánh giá tính trực quan, độ trơn tru và dễ hiểu của luồng mua vé: Khám phá sự kiện $\rightarrow$ Đăng nhập OTP $\rightarrow$ Sơ đồ ghế tương tác $\rightarrow$ Khóa giữ chỗ 5 phút $\rightarrow$ Thanh toán.
2. Đo lường mức độ thấu hiểu của người dùng về quy ước 4 màu ghế và tính năng đồng hồ đếm ngược 5:00.
3. Thu thập cảm nhận về tính minh bạch, công bằng và phòng chống bot / phe vé.
4. Đo lường chỉ số độ khả dụng hệ thống theo thang đo tiêu chuẩn **SUS (System Usability Scale)**.

### 1.2. Phương pháp
- **Hình thức:** Kiểm thử trực tiếp 1-1 (Moderated Usability Testing) có giám sát và ghi lại thao tác màn hình.
- **Kỹ thuật:** Think-aloud protocol (người dùng vừa thao tác vừa nói suy nghĩ của mình).
- **Quy mô mẫu dự kiến:** 5–10 người dùng thật, đại diện cho khán giả mục tiêu (theo `docs/TASKS.md`, T11).

---

## 2. Kịch bản kiểm thử (Test Scripts & Tasks)

Mỗi người tham gia hoàn thành lần lượt 5 nhiệm vụ trên bản đang chạy.
Bản triển khai hiện dùng profile `sprint2`: cờ `payments` đang tắt (cờ `rotating_qr` đã thuộc `sprint2` nhưng luồng tạo vé cần `payments`).
Nhiệm vụ 5 chỉ thực hiện được khi cờ `payments` bật, nếu không thì bỏ qua và ghi rõ trong kết quả.

| Mã nhiệm vụ | Tên nhiệm vụ | Hướng dẫn cho người dùng | Tiêu chí thành công |
|---|---|---|---|
| **Task 1** | Đăng nhập tài khoản | "Bạn hãy đăng nhập vào hệ thống bằng số điện thoại hoặc email của bạn và nhập mã OTP được gửi về." | Đăng nhập thành công, thấy tên/thông tin ở góc phải màn hình trong $\le 60$ giây. |
| **Task 2** | Khám phá sự kiện | "Hãy tìm một sự kiện ca nhạc trong danh sách và mở trang chi tiết." | Truy cập đúng trang sự kiện, bấm được vào nút 'Mua vé' trong $\le 30$ giây. |
| **Task 3** | Chọn 2 ghế liền kề | "Hãy chọn 2 ghế cạnh nhau ở một khu vực còn ghế trống." | Chọn được 2 ghế, ghế chuyển sang trạng thái "mình đang giữ", thấy đồng hồ 5:00 đếm ngược. |
| **Task 4** | Xử lý khi ghế bị giữ | "Hãy thử bấm vào một chiếc ghế người khác đang giữ (màu vàng cam, sọc chéo) trên sơ đồ." | Thấy thông báo từ chối rõ ràng, hiểu rằng ghế đó đang có người giữ trong 5 phút. |
| **Task 5** | Tiến hành thanh toán (cần cờ `payments`) | "Bấm tiến hành thanh toán, chọn cổng MoMo/VNPAY và hoàn tất quy trình mua vé." | Hoàn tất đơn hàng và thấy vé điện tử trong mục 'Vé của tôi'. |

---

## 3. Biểu mẫu khảo sát người dùng (SUS Questionnaire)

Sau khi hoàn thành 5 nhiệm vụ, người dùng trả lời bảng khảo sát gồm 10 câu hỏi tiêu chuẩn SUS (thang điểm 1 đến 5: 1 = Rất không đồng ý, 5 = Rất đồng ý):

1. **Q1:** Tôi nghĩ rằng tôi sẽ thích sử dụng hệ thống này thường xuyên khi có nhu cầu mua vé sự kiện.
2. **Q2:** Tôi thấy hệ thống này phức tạp một cách không cần thiết.
3. **Q3:** Tôi thấy hệ thống dễ sử dụng.
4. **Q4:** Tôi nghĩ rằng tôi cần sự hỗ trợ của một chuyên gia kỹ thuật để có thể sử dụng hệ thống này.
5. **Q5:** Tôi thấy các chức năng khác nhau trong hệ thống này được tích hợp rất tốt.
6. **Q6:** Tôi nghĩ rằng có quá nhiều điều không nhất quán trong hệ thống này.
7. **Q7:** Tôi tưởng tượng rằng hầu hết mọi người sẽ học cách sử dụng hệ thống này rất nhanh chóng.
8. **Q8:** Tôi thấy hệ thống rất cồng kềnh hoặc khó chịu khi sử dụng.
9. **Q9:** Tôi cảm thấy rất tự tin khi sử dụng hệ thống.
10. **Q10:** Tôi cần phải học rất nhiều điều trước khi có thể làm quen và sử dụng hệ thống này.

---

## 4. Danh sách người dùng tham gia thử nghiệm

Chưa thực hiện.
Điền sau mỗi buổi kiểm thử. Không ghi thông tin định danh nếu người tham gia không đồng ý.

| STT | Mã người tham gia | Độ tuổi | Nghề nghiệp | Tần suất mua vé sự kiện | Thiết bị sử dụng |
|:---:|---|:---:|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

---

## 5. Kết quả kiểm thử và điểm SUS

Chưa thực hiện. Các bảng dưới đây để trống.

### 5.1. Tỷ lệ hoàn thành nhiệm vụ và thời gian thao tác

| Mã nhiệm vụ | Số người hoàn thành | Thời gian trung bình (giây) | Ghi chú quan sát |
|---|:---:|:---:|---|
| **Task 1** (Đăng nhập OTP) | | | |
| **Task 2** (Khám phá sự kiện) | | | |
| **Task 3** (Chọn 2 ghế liền kề) | | | |
| **Task 4** (Thử ghế bị giữ) | | | |
| **Task 5** (Thanh toán, cần cờ `payments`) | | | |

### 5.2. Bảng điểm khảo sát SUS

Điểm SUS tính theo công thức của Brooke (1996):
- Câu lẻ (1, 3, 5, 7, 9): điểm quy đổi = điểm đánh giá - 1.
- Câu chẵn (2, 4, 6, 8, 10): điểm quy đổi = 5 - điểm đánh giá.
- Điểm SUS = tổng điểm quy đổi × 2.5.

| Người dùng | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Điểm SUS (/100) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | | | | | | | | | | | |
| 2 | | | | | | | | | | | |
| 3 | | | | | | | | | | | |
| 4 | | | | | | | | | | | |
| 5 | | | | | | | | | | | |
| **Trung bình** | | | | | | | | | | | |

---

## 6. Phản hồi định tính và đề xuất cải tiến

Chưa thực hiện.
Điền sau khi có kết quả kiểm thử.

### 6.1. Điểm người dùng đánh giá cao

Chưa có dữ liệu.

### 6.2. Vấn đề người dùng gặp và đề xuất sửa

| Vấn đề người dùng phản ánh | Tác động | Giải pháp đề xuất | Mức độ ưu tiên |
|---|---|---|:---:|
| | | | |
