# Kiểm thử với người dùng (V2)

Tài liệu này là kế hoạch kiểm thử khả năng sử dụng (usability testing) của EventTicketing V2.
Kế hoạch gồm mục tiêu, người tham gia, nhiệm vụ, chỉ số, quy trình, cách đọc kết quả từ ứng dụng, bảng ghi lỗi và phần so sánh với V1.

**Trạng thái: chưa có kết quả.**
Mọi bảng kết quả ở mục 8 đến mục 11 để trống.
Chỉ điền bằng số liệu từ buổi kiểm thử thật. Không điền số ước lượng hoặc số mẫu.

Công cụ thu thập nằm trong ứng dụng:
- trang khảo sát `/khao-sat` cho người thử;
- phần "Kết quả khảo sát" ở cuối trang `/organizer` cho Ban Tổ chức, có nút xuất CSV.

Hai phần này chạy khi cờ `user_testing` bật. Cờ này bật sẵn từ profile `sprint2`.

---

## 1. Mục tiêu

1. Đo mức độ dễ dùng của luồng mua vé V2 bằng thang SUS (System Usability Scale): đăng nhập OTP, chọn ghế, giữ chỗ 5 phút, thanh toán VNPay sandbox, xem vé.
2. Đo tỷ lệ người thử tự hoàn thành từng bước, và thời gian làm từng bước.
3. Tìm lỗi và chỗ khó hiểu mà người dùng gặp, ghi lại, sửa và kiểm tra lại.
4. So sánh V2 với V1 (giao diện mẫu của Sprint 1) bằng cùng nhiệm vụ và cùng bảng câu hỏi, nếu chạy được V1.

## 2. Người tham gia

- Số người: 5 đến 8 bạn cùng lớp. Mỗi người thử một lần.
- Vai trò thử:
  - ít nhất 4 người thử vai Khán giả;
  - 1 đến 2 người thử vai Ban Tổ chức (nhiệm vụ B1 ở mục 4).
- Tiêu chí chọn:
  - chưa từng tham gia làm hệ thống này;
  - có điện thoại hoặc máy tính để thao tác;
  - đồng ý tham gia sau khi nghe giới thiệu ở mục 6.
- Nên có cả người hay mua vé sự kiện trực tuyến và người ít mua.
- Không ghi họ tên thật nếu người thử không muốn. Trang khảo sát không bắt buộc ghi tên, và không lưu IP hay tài khoản.

Mẫu nhỏ nên kết quả chỉ mang tính mô tả.
Báo cáo ghi số người (ví dụ 5/7), không suy ra cho toàn bộ người dùng.

## 3. Chuẩn bị

Người tổ chức làm trước buổi thử:

1. Chọn bản chạy: `https://cosh301.nhansp.id.vn`, hoặc bản chạy cục bộ nếu mạng yếu.
2. Kiểm tra `GET /api/features` có `"payments": true` và `"user_testing": true`.
3. Chọn một sự kiện còn nhiều ghế trống để mọi người thử trên cùng sự kiện.
4. Chuẩn bị cách nhận mã OTP:
   - đăng nhập bằng email: mã hiện trên màn hình khi `OTP_DEMO=true`;
   - đăng nhập bằng số điện thoại: cài app Android `COSH301 OTP` ([`otp-app.md`](otp-app.md)) trên một điện thoại và để app nhận mã.
5. Chuẩn bị thẻ thử của VNPay sandbox để đọc cho người thử khi họ tới bước thanh toán ([`payments.md`](payments.md) mục 6): thẻ ngân hàng NCB, số thẻ `9704198526191432198`, tên chủ thẻ `NGUYEN VAN A`, ngày phát hành `07/15`, mã OTP `123456`.
6. Với người thử vai Ban Tổ chức: chuẩn bị một tài khoản `ORGANIZER`. Tài khoản này không tạo được bằng OTP, vì tài khoản mới luôn là `CUSTOMER`. Mã OTP của tài khoản nhân sự nằm trong log của `api`, người tổ chức đọc cho người thử.
7. Mở sẵn bảng ghi quan sát (mục 8.1) và bảng nhật ký lỗi (mục 10), mỗi người thử một dòng hoặc một bản.
8. Chuẩn bị đồng hồ bấm giờ.

## 4. Nhiệm vụ và tiêu chí thành công

Người thử làm lần lượt các nhiệm vụ trên máy của họ.
Người điều hành đọc đề, không chỉ cách làm.
Ngưỡng thời gian là mục tiêu đặt trước khi thử, không phải kết quả.

| Mã | Nhiệm vụ | Đề đọc cho người thử | Tiêu chí thành công | Ngưỡng thời gian |
|---|---|---|---|---|
| T1 | Đăng nhập OTP | "Hãy đăng nhập vào hệ thống bằng email hoặc số điện thoại của bạn." | Đăng nhập xong, thấy tài khoản ở góc phải thanh điều hướng | 60 giây |
| T2 | Chọn ghế và giữ chỗ | "Hãy chọn một sự kiện, rồi chọn 2 ghế cạnh nhau còn trống." | 2 ghế chuyển sang màu của mình đang giữ, thấy đồng hồ đếm ngược 5 phút | 90 giây |
| T3 | Thanh toán VNPay sandbox | "Hãy thanh toán các ghế vừa chọn." | Trang kết quả báo thanh toán thành công | 180 giây |
| T4 | Xem vé | "Hãy tìm vé bạn vừa mua." | Mở "Vé của tôi" và thấy đủ vé vừa mua | 30 giây |
| B1 | Đặt giá khu vực (chỉ vai Ban Tổ chức) | "Hãy đổi giá cơ bản của một khu vực lên thêm 100.000 đồng." | Trang báo "Đã lưu giá", giá mới hiện đúng | 120 giây |

Ghi chú:
- T3 cần người thử còn lượt giữ ghế hơn 60 giây. Nếu hết, người thử chọn lại ghế, người điều hành ghi vào bảng lỗi là "hết hạn giữ ghế khi đang thanh toán".
- Một nhiệm vụ chỉ tính là hoàn thành khi người thử tự làm xong, không cần người điều hành chỉ cách.
- Trang khảo sát có ô đánh dấu và ô thời gian cho T1 đến T4. B1 ghi trong bảng quan sát, không có trong khảo sát.

## 5. Chỉ số

| Chỉ số | Cách đo | Nguồn |
|---|---|---|
| Điểm SUS | 10 câu, thang 1 đến 5. Công thức: câu lẻ lấy điểm trừ 1, câu chẵn lấy 5 trừ điểm, cộng 10 giá trị rồi nhân 2,5. Kết quả từ 0 đến 100 | Trang khảo sát, tính tự động |
| Điểm SUS trung bình, trung vị, thấp nhất, cao nhất | Từ điểm SUS của từng người | Phần "Kết quả khảo sát" |
| Điểm trung bình từng câu SUS | Trung bình điểm 1 đến 5 của từng câu | Phần "Kết quả khảo sát" |
| Tỷ lệ hoàn thành từng nhiệm vụ | Số người tự hoàn thành chia số người thử | Phần "Kết quả khảo sát" |
| Thời gian từng nhiệm vụ | Giây do người điều hành bấm giờ. Trung bình tính trên những người có ghi | Trang khảo sát, phần "Kết quả khảo sát" |
| Số lỗi và sự cố | Người điều hành đếm: lỗi hệ thống, người thử thao tác sai, chỗ người thử phải hỏi | Bảng 8.1, bảng 10 |
| Góp ý bằng lời | Ô góp ý và 3 câu hỏi cuối buổi | Phần "Kết quả khảo sát", bảng 9 |

Mốc tham chiếu: điểm SUS trung bình của các nghiên cứu đã công bố khoảng 68.
Con số này chỉ để tham chiếu, ứng dụng hiện nó như một dòng chú thích.

Mười câu SUS trên trang khảo sát dùng cách diễn đạt phổ biến của bản dịch tiếng Việt.
Nhóm chưa kiểm định độ tin cậy của bản dịch trên mẫu của mình.

| Câu | Nội dung |
|:---:|---|
| 1 | Tôi nghĩ rằng tôi sẽ muốn sử dụng hệ thống này thường xuyên. |
| 2 | Tôi thấy hệ thống này phức tạp một cách không cần thiết. |
| 3 | Tôi thấy hệ thống này dễ sử dụng. |
| 4 | Tôi nghĩ rằng tôi sẽ cần sự hỗ trợ của một người có chuyên môn kỹ thuật để sử dụng hệ thống này. |
| 5 | Tôi thấy các chức năng khác nhau của hệ thống này được tích hợp tốt. |
| 6 | Tôi thấy hệ thống này có quá nhiều điểm không nhất quán. |
| 7 | Tôi nghĩ rằng hầu hết mọi người sẽ học cách sử dụng hệ thống này rất nhanh. |
| 8 | Tôi thấy hệ thống này rất rườm rà, khó dùng. |
| 9 | Tôi cảm thấy rất tự tin khi sử dụng hệ thống này. |
| 10 | Tôi cần học rất nhiều thứ trước khi có thể bắt đầu sử dụng hệ thống này. |

Thang trả lời: 1 là rất không đồng ý, 5 là rất đồng ý.

## 6. Quy trình một buổi thử

Mỗi buổi khoảng 15 đến 20 phút, có một người điều hành và một người ghi chép (có thể là cùng một người nếu thiếu người).

1. **Giới thiệu (2 phút).** Nói rõ: đang thử hệ thống, không phải thử người dùng. Người thử làm sai thì lỗi nằm ở hệ thống. Dữ liệu ẩn danh, không bắt buộc ghi tên. Người thử có thể dừng bất cứ lúc nào. Hỏi đồng ý tham gia.
2. **Câu hỏi nền (1 phút).** Thiết bị đang dùng, tần suất mua vé sự kiện trực tuyến. Ghi vào bảng 8.1.
3. **Làm nhiệm vụ (khoảng 10 phút).** Đọc đề từng nhiệm vụ. Bấm giờ từ lúc đọc xong đề đến lúc người thử tự báo xong hoặc đạt tiêu chí. Người thử vừa làm vừa nói điều đang nghĩ (think-aloud).
   - Không gợi ý, không chỉ chỗ bấm.
   - Người thử hỏi cách làm: ghi lại và chỉ giúp nếu họ bị kẹt quá 2 phút. Nhiệm vụ đó tính là không hoàn thành.
4. **Khảo sát (3 phút).** Người thử mở `/khao-sat` trên máy của họ, chọn vai trò, đánh dấu bước đã làm, điền thời gian (người điều hành đọc số giây đã bấm), trả lời 10 câu SUS và ghi góp ý. Người điều hành không đứng cạnh khi họ trả lời SUS.
5. **Hỏi cuối buổi (2 phút).** Ba câu:
   - Điều gì làm bạn khó chịu nhất?
   - Điều gì làm bạn thấy dễ nhất?
   - Bạn muốn đổi điều gì đầu tiên?
6. **Sau buổi.** Ghi lỗi người thử gặp vào bảng 10. Với lỗi hệ thống, tạo issue trên kho mã và ghi mã issue vào bảng.

Mỗi người chỉ gửi khảo sát một lần.
Gửi nhầm hoặc gửi trùng thì ghi lại trong bảng 8.1 để loại khi phân tích.
Hiện chưa có chức năng xóa phản hồi trong ứng dụng.

## 7. Đọc kết quả từ ứng dụng

1. Đăng nhập bằng tài khoản `ORGANIZER` hoặc `ADMIN`.
2. Mở `/organizer` (mục "Quản lý sự kiện" trên thanh điều hướng).
3. Kéo xuống cuối trang, phần **Kết quả khảo sát**.
4. Bấm **Tải lại** để lấy phản hồi mới nhất.

Phần này gồm:

| Thành phần | Ý nghĩa |
|---|---|
| Số phản hồi | Tổng số lượt gửi, kèm số theo vai trò |
| Điểm SUS trung bình | Trung bình điểm SUS của mọi phản hồi |
| Trung vị | Giá trị giữa. Có số chẵn phản hồi thì lấy trung bình hai giá trị giữa |
| Thấp nhất đến cao nhất | Hai điểm SUS ở hai đầu |
| Điểm trung bình từng câu SUS | Câu lẻ điểm cao là tốt, câu chẵn điểm thấp là tốt |
| Tỷ lệ hoàn thành từng bước | k/n người và phần trăm, kèm thời gian trung bình nếu có người ghi |
| Góp ý gần đây | Tối đa 20 góp ý mới nhất, kèm vai trò, điểm SUS của người đó và thời gian |

Phần "Kết quả khảo sát" chưa có phản hồi nào thì hiện "Chưa có phản hồi nào".

**Xuất CSV.** Bấm **Xuất CSV** để tải `khao-sat-sus.csv` (UTF-8, mở được bằng Excel).
Mỗi dòng là một phản hồi, gồm: `id`, `created_at`, `tester_role`, `tester_name`, `device`, `sus_q1` đến `sus_q10`, `sus_score`, `task_login`, `task_hold`, `task_pay`, `task_ticket` (1 là hoàn thành), `time_login_sec`, `time_hold_sec`, `time_pay_sec`, `time_ticket_sec`, `comment`.
Dùng file này để vẽ biểu đồ và để đối chiếu với số trên màn hình.
Lưu file CSV vào hồ sơ nộp bài như bằng chứng.

**Đối chiếu bằng SQL.** Người có quyền vào database có thể kiểm tra điểm SUS độc lập với ứng dụng:

```sql
SELECT count(*) AS n,
       round(avg(((sus_q1 - 1) + (5 - sus_q2) + (sus_q3 - 1) + (5 - sus_q4) + (sus_q5 - 1)
                + (5 - sus_q6) + (sus_q7 - 1) + (5 - sus_q8) + (sus_q9 - 1) + (5 - sus_q10)) * 2.5), 1) AS sus_mean
FROM feedback_responses;
```

Bảng `feedback_responses` do migration `00009` tạo, xem [`erd.md`](erd.md) mục 4.

## 8. Kết quả kiểm thử

Chưa thực hiện. Các bảng dưới để trống, điền từ số liệu thật.

### 8.1 Danh sách người thử và quan sát

| STT | Mã người thử | Vai trò | Thiết bị | Tần suất mua vé trực tuyến | T1 (giây, đạt?) | T2 | T3 | T4 | B1 | Cần hỗ trợ ở bước | Ghi chú |
|:---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | | |
| 2 | | | | | | | | | | | |
| 3 | | | | | | | | | | | |
| 4 | | | | | | | | | | | |
| 5 | | | | | | | | | | | |

### 8.2 Tỷ lệ hoàn thành và thời gian

Lấy từ phần "Kết quả khảo sát" của ứng dụng.

| Nhiệm vụ | Số người hoàn thành / số người thử | Thời gian trung bình (giây) | Số người có ghi thời gian | Đạt ngưỡng mục tiêu? |
|---|:---:|:---:|:---:|:---:|
| T1 Đăng nhập OTP | | | | |
| T2 Chọn ghế và giữ chỗ | | | | |
| T3 Thanh toán VNPay sandbox | | | | |
| T4 Xem vé | | | | |

### 8.3 Điểm SUS

| Chỉ số | Giá trị |
|---|:---:|
| Số phản hồi | |
| Điểm SUS trung bình | |
| Trung vị | |
| Thấp nhất | |
| Cao nhất | |

| Câu | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Điểm trung bình | | | | | | | | | | |

## 9. Phản hồi định tính

Chưa thực hiện. Điền từ phần "Góp ý gần đây" và câu hỏi cuối buổi.

### 9.1 Điều người thử đánh giá cao

Chưa có dữ liệu.

### 9.2 Vấn đề người thử gặp và đề xuất sửa

| Vấn đề người thử phản ánh | Số người gặp | Tác động | Giải pháp đề xuất | Ưu tiên |
|---|:---:|---|---|:---:|
| | | | | |

## 10. Nhật ký lỗi

Chưa thực hiện. Mỗi lỗi một dòng.
Mức nghiêm trọng:
- **Cao**: không hoàn thành được nhiệm vụ, hoặc sai tiền, sai ghế;
- **Trung bình**: hoàn thành được nhưng phải đi vòng hoặc mất thời gian;
- **Thấp**: lỗi hiển thị, chữ khó hiểu.

| Mã | Ngày | Người gặp | Nhiệm vụ | Mô tả | Cách tái hiện | Mức nghiêm trọng | Loại (giao diện, API, dữ liệu, khó hiểu) | Trạng thái | Commit hoặc PR sửa | Đã kiểm tra lại |
|---|---|---|---|---|---|:---:|---|---|---|:---:|
| | | | | | | | | | | |

### 10.1 Thống kê lỗi

| Mức nghiêm trọng | Số lỗi tìm thấy | Đã sửa | Chưa sửa | Lý do chưa sửa |
|---|:---:|:---:|:---:|---|
| Cao | | | | |
| Trung bình | | | | |
| Thấp | | | | |
| **Tổng** | | | | |

| Loại lỗi | Số lỗi |
|---|:---:|
| Giao diện | |
| API | |
| Dữ liệu | |
| Khó hiểu (không phải lỗi mã) | |

## 11. So sánh V1 và V2

Chưa thực hiện. Phần này điền sau khi có số liệu của cả hai bản.

V1 là giao diện mẫu dựng ở Sprint 1 (xem [`sprints.md`](sprints.md) mục 2).
Chỉ so sánh định lượng khi cả hai bản đáp ứng ba điều kiện:
- chạy được cùng các nhiệm vụ ở mục 4 (bước nào V1 không có thì ghi "không có" thay vì bỏ trống);
- người thử trả lời cùng 10 câu SUS. V1 không có trang `/khao-sat`, nên dùng phiếu giấy hoặc biểu mẫu riêng rồi nhập vào bảng 11.2;
- số người thử và cách tiến hành càng giống nhau càng tốt.

Nếu không chạy được V1, ghi rõ lý do và chỉ so sánh định tính ở mục 11.3.

Ghi cách chạy V1 (commit hoặc đường dẫn) và ngày thử ở đây: ______

### 11.1 Số liệu định lượng

| Chỉ số | V1 | V2 | Chênh lệch | Ghi chú |
|---|:---:|:---:|:---:|---|
| Số người thử | | | | |
| Điểm SUS trung bình | | | | |
| Điểm SUS trung vị | | | | |
| Tỷ lệ hoàn thành T1 | | | | |
| Tỷ lệ hoàn thành T2 | | | | |
| Tỷ lệ hoàn thành T3 | | | | |
| Tỷ lệ hoàn thành T4 | | | | |
| Thời gian trung bình T1 (giây) | | | | |
| Thời gian trung bình T2 (giây) | | | | |
| Thời gian trung bình T3 (giây) | | | | |
| Thời gian trung bình T4 (giây) | | | | |
| Số lỗi tìm thấy | | | | |

### 11.2 Điểm SUS từng người

| Người thử | V1 | V2 |
|---|:---:|:---:|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |

### 11.3 So sánh định tính

| Khía cạnh | V1 | V2 | Nhận xét từ người thử |
|---|---|---|---|
| Đăng nhập | | | |
| Xem sơ đồ ghế và giữ ghế | | | |
| Thanh toán | | | |
| Xem vé | | | |
| Lỗi gặp phải | | | |

### 11.4 Kết luận

Chưa có.
Viết sau khi điền xong các bảng trên: chỉ số nào tốt hơn, chỉ số nào kém hơn, lý do, và việc sẽ sửa tiếp.

## 12. Hạn chế

- Mẫu nhỏ (5 đến 8 người), toàn bạn cùng lớp, nên không đại diện cho mọi khán giả.
- Người thử chạy trên cổng thanh toán sandbox, không có tiền thật.
- Thời gian do người điều hành bấm tay, có sai số vài giây.
- Mỗi IP chỉ gửi được 20 phản hồi mỗi giờ. Người cùng mạng (ví dụ cùng Wi-Fi của lớp) dùng chung IP, nên dùng chung giới hạn này. Lớp 8 người vẫn đủ, nhưng gửi lại nhiều lần có thể chạm giới hạn và nhận thông báo "gửi quá nhiều phản hồi".
- Khảo sát ẩn danh, không có cách xác minh một người gửi nhiều lần. Người điều hành theo dõi bằng bảng 8.1.
