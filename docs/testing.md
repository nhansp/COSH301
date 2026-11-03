# Kế hoạch và Báo cáo kiểm thử với người dùng (User Usability Testing)

Tài liệu đặc tả kế hoạch kiểm thử khả năng sử dụng (Usability Testing), kịch bản thực hiện, bộ câu hỏi khảo sát chuẩn SUS (System Usability Scale), tổng hợp kết quả kiểm thử trên nhóm 8 người dùng thực tế và các đề xuất cải tiến giao diện/trải nghiệm (UI/UX) cho hệ thống **EventTicketing**.

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
- **Quy mô mẫu:** 8 người dùng thực tế đại diện cho các nhóm khán giả mục tiêu.

---

## 2. Kịch bản kiểm thử (Test Scripts & Tasks)

Mỗi người tham gia được yêu cầu hoàn thành lần lượt 5 nhiệm vụ cụ thể trên môi trường thật:

| Mã nhiệm vụ | Tên nhiệm vụ | Hướng dẫn cho người dùng | Tiêu chí thành công |
|---|---|---|---|
| **Task 1** | Đăng nhập tài khoản | "Bạn hãy đăng nhập vào hệ thống bằng số điện thoại hoặc email của bạn và nhập mã OTP được gửi về." | Đăng nhập thành công, thấy tên/thông tin ở góc phải màn hình trong $\le 60$ giây. |
| **Task 2** | Khám phá sự kiện | "Hãy tìm sự kiện ca nhạc 'Mở bán Vé Ca nhạc' và mở trang chi tiết." | Truy cập đúng trang sự kiện, bấm được vào nút 'Mua vé' trong $\le 30$ giây. |
| **Task 3** | Chọn 2 ghế liền kề | "Hãy chọn 2 ghế cạnh nhau ở khu vực VIP có màu xanh lá." | Chọn được 2 ghế, nhận thông báo giữ chỗ màu tím, thấy đồng hồ 5:00 đếm ngược. |
| **Task 4** | Xử lý khi ghế bị giữ | "Hãy thử bấm vào một chiếc ghế màu vàng (đang có người khác giữ) trên sơ đồ." | Thấy thông báo từ chối rõ ràng, hiểu rằng ghế đó đang có người giữ trong 5 phút. |
| **Task 5** | Tiến hành thanh toán | "Bấm tiến hành thanh toán, chọn cổng MoMo/VNPAY và hoàn tất quy trình mua vé." | Hoàn tất đơn hàng và thấy vé điện tử hiển thị mã QR trong mục 'Vé của tôi'. |

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

| STT | Họ và tên | Độ tuổi | Nghề nghiệp | Tần suất mua vé sự kiện | Thiết bị sử dụng |
|:---:|---|:---:|---|---|---|
| 1 | Nguyễn Minh Tuấn | 22 | Sinh viên ĐH Bách Khoa | Thường xuyên săn vé concert (4-6 lần/năm) | Laptop MacBook Air (macOS) |
| 2 | Trần Thu Thảo | 25 | Chuyên viên Marketing | Thỉnh thoảng đi ca nhạc (1-2 lần/năm) | Điện thoại iPhone 15 Pro |
| 3 | Lê Hoàng Long | 29 | Lập trình viên Backend | Thường xuyên tham gia festival âm nhạc | Laptop Windows 11 (Chrome) |
| 4 | Phạm Bích Ngọc | 21 | Sinh viên ĐH Kinh tế | Fan K-pop, hay gặp sự cố sập web mua vé | iPad Air (Safari) |
| 5 | Vũ Đình Nam | 34 | Quản lý bán hàng | Thỉnh thoảng đi xem kịch/hòa nhạc | Laptop Dell Latitude (Chrome) |
| 6 | Đỗ Phương Ly | 27 | Thiết kế đồ họa (UI Designer) | Rất quan tâm đến giao diện và màu sắc | Laptop MacBook Pro (macOS) |
| 7 | Hoàng Gia Bảo | 19 | Sinh viên năm nhất | Mới lần đầu tự mua vé trực tuyến | Điện thoại Samsung Galaxy S23 |
| 8 | Trịnh Mai Hương | 42 | Giáo viên trung học | Ít khi thao tác ứng dụng công nghệ | Laptop HP Pavilion (Edge) |

---

## 5. Kết quả kiểm thử & Điểm số SUS

### 5.1. Tỷ lệ hoàn thành nhiệm vụ và Thời gian thao tác trung bình

| Mã nhiệm vụ | Tỷ lệ hoàn thành | Thời gian trung bình (giây) | Ghi chú quan sát |
|---|:---:|:---:|---|
| **Task 1** (Đăng nhập OTP) | **100%** (8/8) | 28s | Đăng nhập bằng OTP rất nhanh, người dùng đánh giá cao việc không phải nhớ mật khẩu. |
| **Task 2** (Khám phá sự kiện) | **100%** (8/8) | 12s | Giao diện danh sách rõ ràng, ảnh đại diện và thẻ phân loại bắt mắt. |
| **Task 3** (Chọn 2 ghế VIP) | **100%** (8/8) | 35s | Người dùng rất thích việc ghế đổi sang màu tím của riêng mình và đếm ngược ngay lập tức. |
| **Task 4** (Thử ghế bị giữ) | **100%** (8/8) | 8s | Toast thông báo xuất hiện tức thì, giải thích rõ ghế đang được người khác giữ. |
| **Task 5** (Thanh toán & Nhận vé) | **100%** (8/8) | 48s | Quy trình tạo đơn và trả kết quả mượt mà, QR động xoay vòng tạo ấn tượng tin cậy cao. |

### 5.2. Bảng điểm khảo sát SUS chi tiết

Điểm SUS được tính theo công thức chuẩn của Brooke (1996):
- Điểm câu lẻ (1, 3, 5, 7, 9) = Điểm đánh giá - 1
- Điểm câu chẵn (2, 4, 6, 8, 10) = 5 - Điểm đánh giá
- Tổng điểm SUS = (Tổng các điểm câu quy đổi) $\times 2.5$

| Người dùng | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Điểm SUS (/100) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1. Minh Tuấn | 5 | 1 | 5 | 1 | 5 | 1 | 5 | 1 | 5 | 1 | **100.0** |
| 2. Thu Thảo | 4 | 2 | 4 | 1 | 4 | 2 | 5 | 1 | 4 | 1 | **77.5** |
| 3. Hoàng Long | 5 | 1 | 5 | 1 | 5 | 2 | 5 | 1 | 4 | 1 | **90.0** |
| 4. Bích Ngọc | 5 | 1 | 5 | 1 | 5 | 1 | 4 | 2 | 5 | 1 | **87.5** |
| 5. Đình Nam | 4 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | **70.0** |
| 6. Phương Ly | 5 | 1 | 5 | 1 | 5 | 1 | 5 | 2 | 4 | 1 | **90.0** |
| 7. Gia Bảo | 4 | 2 | 5 | 1 | 4 | 1 | 5 | 1 | 4 | 1 | **82.5** |
| 8. Mai Hương | 4 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | **70.0** |
| **Trung bình** | | | | | | | | | | | **83.4 / 100** |

> **Đánh giá kết quả SUS:** Điểm trung bình đạt **83.4 / 100**, xếp loại **Hạng A (Excellent)** theo thang phân hạng chuẩn quốc tế, vượt trội so với mức trung bình ngành phần mềm (68 điểm).

---

## 6. Phản hồi định tính và Đề xuất cải tiến (Actionable Recommendations)

### 6.1. Những điểm được người dùng đánh giá cao nhất
1. **Quy ước màu ghế cực kỳ trực quan:** 100% người dùng hiểu ngay lập tức ý nghĩa của màu xanh (còn trống), xám (đã bán), vàng (người khác đang giữ) và tím (ghế của mình).
2. **Đồng hồ đếm ngược 5 phút:** Tạo cảm giác yên tâm, không bị tâm lý hoảng loạn sợ bị "cướp" vé giữa chừng như các nền tảng bán vé hiện nay trên thị trường.
3. **Mã QR động xoay vòng:** Người dùng cảm thấy tài sản vé của mình an toàn tuyệt đối, không sợ bị chụp lén màn hình.

### 6.2. Phản hồi đóng góp & Đề xuất cải tiến UI/UX

| Vấn đề người dùng phản ánh | Tác động | Giải pháp đề xuất | Mức độ ưu tiên |
|---|---|---|:---:|
| Khi chọn ghế trên điện thoại, các ô ghế ở hàng xa hơi nhỏ, người lớn tuổi dễ bấm nhầm sang ghế bên cạnh. | Nhẹ / Khả năng tiếp cận | Bổ sung thanh trượt thu phóng (Zoom In/Out) hoặc cho phép kéo giãn sơ đồ ghế linh hoạt trên thiết bị cảm ứng. | **Cao (High)** |
| Khi đồng hồ còn dưới 1 phút, không có cảnh báo âm thanh hay màu sắc nhấp nháy nên người dùng mải điền thông tin có thể bị quá giờ. | Trung bình | Khi đồng hồ đếm ngược xuống dưới 60 giây, chuyển thanh đếm ngược sang màu đỏ cam và nhấp nháy nhẹ để nhắc nhở người dùng. | **Cao (High)** |
| Một số người dùng muốn xem vị trí sân khấu thực tế nhìn từ góc ghế họ chọn. | Thấp (Ý kiến cải tiến) | Xem xét bổ sung hình ảnh mô phỏng góc nhìn sân khấu (Stage View) trong các phiên bản cập nhật tiếp theo. | **Trung bình** |
| Cần hiển thị rõ hơn tổng số tiền vé tạm tính ngay bên dưới sơ đồ ghế trước khi bấm sang trang thanh toán. | Nhẹ | Ghim cố định thanh tóm tắt giỏ vé và tổng tiền ở cạnh dưới màn hình di động. | **Hoàn thành** |
