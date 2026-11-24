# KỊCH BẢN THUYẾT TRÌNH ĐỒ ÁN COSH301
## Đề tài: Thiết kế Hệ thống Đặt vé Trực tuyến cho Sự kiện (EventTicketing)

* **Học phần**: Phân tích và Thiết kế Hệ thống (COSH301 / COSH201)
* **Khoa**: Công nghệ và Khoa học dữ liệu — Trường Đại học Ngoại thương
* **Giảng viên hướng dẫn**: TS. Phạm Thị Kim Dung
* **Nhóm sinh viên thực hiện**:
  1. Vũ Đức Huy — MSV: 2412960011 *(Nhóm trưởng, ERD 23 bảng, Sơ đồ lớp BCE, Kế hoạch Sprint)*
  2. Trần Trung Nhân — MSV: 2412960019 *(Kiến trúc hệ thống, Go Backend, React Frontend, OTP & API Spec)*
  3. Đinh Tiến Thành — MSV: 2413960023 *(Bảng FR/NFR, Ma trận truy vết, Kiểm thử thủ công FR-06)*
  4. Lê Đức Anh — MSV: 2411960002 *(Sơ đồ và Đặc tả Use Case, Kế hoạch kiểm thử người dùng)*
  5. Nguyễn Đức Phúc — MSV: 2413960020 *(Sơ đồ luồng dữ liệu DFD, Sequence chống bán trùng)*
  6. Nguyễn Anh Dũng — MSV: 2413960006 *(Sequence giữ ghế 5 phút, Bài toán và thiết kế Định giá động)*
* **Mốc báo cáo**: Báo cáo Giữa kỳ (Sprint 1 và Sprint 2)
* **Thời lượng chuẩn**: 10 – 12 phút thuyết trình + 3 phút Live Demo / Q&A

---

## MỤC LỤC KỊCH BẢN
1. **Phần 1: Mở đầu & Đặt vấn đề** *(Slide 1 – 3 \| Thời lượng: 1.5 phút)*
2. **Phần 2: Mục tiêu, Đặc tả Yêu cầu & Cam kết SLA** *(Slide 4 – 6 \| Thời lượng: 2.5 phút)*
3. **Phần 3: Kiến trúc Hệ thống & Mô hình hóa Phân tầng** *(Slide 7 – 11 \| Thời lượng: 3.0 phút)*
4. **Phần 4: Quy trình Nghiệp vụ Cốt lõi & Điểm nhấn Học thuật** *(Slide 12 – 16 \| Thời lượng: 3.0 phút)*
5. **Phần 5: Nghiệm thu Thực nghiệm, Demo & Kết luận** *(Slide 17 – 20 \| Thời lượng: 2.0 phút)*
6. **Phần 6: Kịch bản phối hợp Live Demo Sản phẩm thực tế** *(Thời lượng: 3.0 phút)*
7. **Phần 7: Bộ câu hỏi phản biện chuyên sâu từ Giảng viên & Đáp án chuẩn**

---

## CHI TIẾT LỜI THOẠI VÀ CHỈ DẪN TRÌNH BÀY

### PHẦN 1: MỞ ĐẦU & ĐẶT VẤN ĐỀ (1.5 phút)

#### `[Slide 1: Trang bìa]`
* **Cử chỉ**: Đứng thẳng, mắt nhìn bao quát cả lớp và hướng về Giảng viên, nở nụ cười tự tin.
* **Lời thoại**:
  > *"Kính thưa cô Phạm Thị Kim Dung cùng toàn thể các bạn sinh viên,*
  > 
  > *Em xin đại diện cho nhóm nghiên cứu trình bày báo cáo tiểu luận và tiến độ giữa kỳ môn Phân tích và Thiết kế Hệ thống với đề tài: **'Thiết kế hệ thống đặt vé trực tuyến cho sự kiện — EventTicketing'**.*
  > 
  > *Dự án được nhóm em tiếp cận không chỉ dừng lại ở phạm vi một bài tập môn học, mà là một bài toán kỹ nghệ phần mềm hoàn chỉnh nhằm giải quyết triệt để những lỗ hổng nhức nhối nhất của các nền tảng bán vé hiện nay."*

#### `[Slide 2: Nhóm thực hiện & Phân công tiến độ]`
* **Cử chỉ**: Chỉ tay nhẹ về phía slide, giới thiệu ngắn gọn tinh thần phối hợp của nhóm.
* **Lời thoại**:
  > *"Nhóm nghiên cứu gồm 6 thành viên. Sprint 2 gồm **14 đầu việc (T01 đến T14)**, ước lượng **206 giờ công**, từ thiết kế kiến trúc, mô hình hóa UML, DFD, ERD đến mã nguồn backend và frontend. Riêng kiểm thử với người dùng mới có kế hoạch, chưa thực hiện."*

#### `[Slide 3: Bài toán: 5 thách thức của bán vé online]`
* **Cử chỉ**: Đếm từng ngón tay hoặc nhấn giọng dứt khoát ở 5 từ khóa cốt lõi.
* **Lời thoại**:
  > *"Thưa cô, thị trường âm nhạc và sự kiện Việt Nam đang bùng nổ, nhưng mỗi đợt mở bán vé lớn (flash-sale) luôn đi kèm **5 thách thức sống còn**:*
  > 
  > 1. *Thứ nhất là **Nghẽn hệ thống**: Hàng chục ngàn lượt truy cập cùng ập vào một thời điểm khiến máy chủ tê liệt.*
  > 2. *Thứ hai là **Phe vé và bot tự động**: Dùng kịch bản phần mềm gom sạch vé đẹp chỉ trong vài giây.*
  > 3. *Thứ ba là **Bán trùng ghế (Double-booking)**: Khi hai người cùng bấm vào một ghế ở cùng một phần nghìn giây, dữ liệu bất đồng bộ khiến cả hai bị trừ tiền nhưng chỉ một người có chỗ.*
  > 4. *Thứ tư là **Mất cân đối lấp đầy**: Giá cố định khiến khu VIP cháy vé sớm, trong khi khu xa sân khấu còn trống. Giá tăng tự động lại gây tranh cãi, nên nhóm thiết kế Định giá động theo hướng chỉ đề xuất, Ban Tổ chức duyệt.*
  > 5. *Và thứ năm là **Gian lận vé tại cổng**: Ảnh chụp màn hình QR bị chia sẻ lậu, hoặc mất sóng viễn thông tại sân vận động làm máy soát vé tê liệt.*
  > 
  > *EventTicketing ra đời để giải quyết tận gốc 5 bài toán này."*

---

### PHẦN 2: MỤC TIÊU, ĐẶC TẢ YÊU CẦU & CAM KẾT SLA (2.5 phút)

#### `[Slide 4: Mục tiêu và phạm vi]`
* **Cử chỉ**: Hướng về phần Won't-Have để tạo sự chú ý về tư duy phản biện.
* **Lời thoại**:
  > *"Mục tiêu cốt lõi của đồ án là chuẩn hóa toàn bộ yêu cầu, mô hình hóa phân tầng theo chuẩn BCE, xây dựng CSDL PostgreSQL 18 bảo đảm ACID tuyệt đối không bán trùng ghế, đồng bộ realtime qua Server-Sent Events (SSE) và thiết kế Định giá động có người duyệt (FR-22).*
  > 
  > *Về phạm vi, bản chạy ở Sprint 2 gồm: đăng nhập OTP không mật khẩu, sơ đồ ghế realtime, khóa giữ ghế độc quyền 5 phút và cấu hình giá sàn/trần. Thanh toán, phát vé và soát vé là các Sprint sau.*
  > 
  > *Ở nhóm **Won't-Have**, yêu cầu **W-01** quy định hệ thống không bao giờ tự đổi giá. Định giá động (FR-22) chỉ sinh đề xuất, và giá chỉ đổi khi Ban Tổ chức duyệt, để bảo vệ người mua và uy tín của Ban Tổ chức."*

#### `[Slide 5: Đặc tả yêu cầu & Phân loại MoSCoW]`
* **Lời thoại**:
  > *"Hệ thống được bóc tách khoa học thành **23 Yêu cầu Chức năng (FR)**, **13 Yêu cầu Phi chức năng (NFR)**, **7 User Stories** theo cú pháp Given-When-Then và **17 Use Cases** tổng thể.*
  > 
  > *Theo `docs/spec.md`, ở mốc Sprint 2 có **6 yêu cầu đã xong** (FR-02 đến FR-07), **4 yêu cầu đang làm** (FR-01, FR-08, FR-11, FR-20) và **13 yêu cầu chưa làm**. Hệ thống có 19 cờ tính năng, profile `sprint2` bật 5 cờ."*

#### `[Slide 6: Cam kết chất lượng định lượng (SLA)]`
* **Lời thoại**:
  > *"Mọi yêu cầu phi chức năng đều có chỉ số mục tiêu định lượng. Đây là mục tiêu thiết kế, hiện mới NFR-03 và NFR-10 đã xong:*
  > * *Mục tiêu chịu tải **≥ 50.000 người dùng đồng thời** với $p95 \le 2$ giây (NFR-01). Nhóm chưa chạy kiểm thử tải k6.*
  > * *Không bán trùng ghế (NFR-03).*
  > * *Tốc độ phản ánh đổi màu ghế giữa các trình duyệt **dưới 3 giây** không cần F5 (NFR-10).*
  > * *Tốc độ xác thực vé tại cổng **dưới 1 giây/vé** (NFR-05).*
  > * *Và chu kỳ làm mới mã QR động **30 giây một lần** chống chụp màn hình (NFR-08)."*

---

### PHẦN 3: KIẾN TRÚC HỆ THỐNG & MÔ HÌNH HÓA PHÂN TẦNG (3.0 phút)

#### `[Slide 7: Kiến trúc triển khai hệ thống]`
* **Lời thoại**:
  > *"Về kiến trúc triển khai, hệ thống đóng gói bằng Docker Compose (`compose.yaml`) gồm 4 dịch vụ và chạy trên một máy ảo GCP:*
  > * *`tunnel` (cloudflared): công bố hệ thống ra Internet qua **Cloudflare Tunnel** tại `cosh301.nhansp.id.vn`.*
  > * *`frontend`: **React 19 SPA** phục vụ bởi nginx, đồng thời chuyển `/api` sang backend.*
  > * *`api`: **một file chạy Go duy nhất**.*
  > * *`db`: **PostgreSQL 18**.*
  > * *Trong api có **RealtimeHub** phát sự kiện qua SSE và worker **HoldReaper** nhả ghế hết hạn, quét 5 giây một lần."*

#### `[Slide 8: Mô hình BCE & Triết lý Single Source of Truth]`
* **Cử chỉ**: Giọng điệu hào hứng, tự tin giải thích quyết định kiến trúc quan trọng.
* **Lời thoại**:
  > *"Điểm nhấn kỹ nghệ quan trọng nhất trong kiến trúc backend là việc áp dụng mô hình phân tầng **BCE (Boundary – Control – Entity)**:*
  > * *Tầng **Boundary** (`internal/httpapi`): Kiểm tra token, phân quyền RBAC và kiểm soát cờ tính năng động (Feature Flags).*
  > * *Tầng **Control** (`internal/service`): Xử lý logic giữ ghế nguyên tử, giới hạn vé mỗi người (cờ `ticket_limit`), giá khu vực, điều phối SSE và dọn ghế quá hạn.*
  > * *Tầng **Entity** (`internal/store`): Sinh tự động 100% bằng `sqlc` và driver `pgx/v5`, bảo đảm an toàn kiểu dữ liệu tại thời điểm biên dịch.*
  > 
  > ***Tại sao nhóm em loại bỏ hoàn toàn Redis?** Trong các hệ thống bán vé, việc dùng Redis làm cache phân tán rất dễ gây ra thảm họa lệch pha dữ liệu (cache inconsistency) hoặc sụp đổ bộ đệm (cache stampede). Bằng cách khai thác triệt để sức mạnh của PostgreSQL 18 — từ khóa hàng nguyên tử, advisory lock, partial unique index đến pub/sub `LISTEN/NOTIFY` nội tại — hệ thống đạt được tính nhất quán ACID tuyệt đối với kiến trúc vô cùng tinh gọn."*

#### `[Slide 9, 10, 11: Mô hình hóa Use Case, DFD & ERD]`
* **Lời thoại**:
  > *"Hệ thống mô hình hóa tường minh qua:*
  > * *Sơ đồ **17 Use Case**: 7 của Khán giả, 5 của Ban Tổ chức (UC-08 đến UC-12, trong đó UC-10 là duyệt đề xuất giá), 2 của CEO, 2 của Nhân viên cổng và 1 của Quản trị. UC-01 đăng nhập dùng chung.*
  > * *Sơ đồ **DFD** mức ngữ cảnh, mức 0 (9 tiến trình) và mức 1. Mức 0 có **17 kho dữ liệu**, mỗi kho ứng với một hoặc vài bảng thật trong database.*
  > * *Và sơ đồ **ERD 23 bảng**, chia thành 6 nhóm: định danh, địa điểm và ghế, hàng chờ và giữ chỗ, đơn hàng và thanh toán, vé và soát vé, giá và thống kê. ERD Sprint 1 trên MySQL có 26 bảng."*

---

### PHẦN 4: QUY TRÌNH NGHIỆP VỤ & ĐIỂM NHẤN HỌC THUẬT (3.0 phút)

#### `[Slide 12 & 13: Giữ ghế 5 phút & Chống bán trùng tuyệt đối]`
* **Lời thoại**:
  > *"Quy trình giữ ghế và chống bán trùng là trái tim của Sprint 2:*
  > * *Khi khách hàng chọn ghế, một transaction mở ra, cập nhật trạng thái `HELD` và cấp hạn giữ đúng 300 giây. Ngay khi giao dịch commit, câu lệnh `NOTIFY` gửi thông điệp qua SSE để mọi trình duyệt khác tự động đổi sang màu vàng (đang có người giữ) dưới 3 giây.*
  > * *Về giải pháp **Chống bán trùng tuyệt đối**, nhóm em áp dụng cơ chế 3 lớp:*
  >   1. *Khóa mức hàng nguyên tử: `UPDATE event_seats SET status = 'HELD' WHERE status = 'AVAILABLE'`.*
  >   2. *Tận dụng **Partial Unique Index** trên bảng `seat_holds`: `WHERE status = 'ACTIVE'`. Điều này ngăn chặn việc tồn tại hai bản ghi giữ chỗ đồng thời ở cấp độ vật lý đĩa cứng.*
  >   3. *Khi cờ `ticket_limit` bật, dùng **Advisory Lock** khóa phạm vi `(user_id, event_id)` để các yêu cầu song song của một người không vượt giới hạn vé. Cờ này đang tắt ở profile `sprint2`."*

#### `[Slide 14: Định giá động (FR-22) và phản biện]`
* **Cử chỉ**: Giọng nói chững chạc, nêu rõ phần nào là thiết kế, phần nào đã chạy.
* **Lời thoại**:
  > *"Kính thưa cô, ở phân hệ giá, nhóm em phân biệt rõ phần đã chạy và phần mới ở mức thiết kế.*
  >
  > *Đã chạy: Ban Tổ chức đặt **giá sàn, giá cơ bản, giá trần** cho từng khu (FR-08). Mỗi lần đổi giá ghi vào bảng `price_changes`, có trigger chặn sửa và xóa.*
  >
  > *Mới thiết kế: **Định giá động (FR-22)**, cờ `dynamic_pricing` đang tắt. Cứ 5 phút, hệ thống tính chỉ số áp lực từ tốc độ bán, hàng chờ và tỷ lệ ghế đang giữ, rồi đề xuất giá mới cho từng khu. Mỗi chu kỳ đổi tối đa 20%, giá luôn nằm trong khoảng giá sàn và giá trần, chênh dưới 5% thì bỏ qua. **Hệ thống không bao giờ tự đổi giá (W-01)**, Ban Tổ chức duyệt thì giá mới có hiệu lực.*
  >
  > *Nhóm có phản biện về Định giá động: người mua không biết trước giá có thể tăng, và có tiền lệ như cuộc điều tra của CMA ở Anh về cách bán vé Oasis. Vì vậy thiết kế dùng người duyệt, biên độ giá và nhật ký giá để giảm rủi ro. Nhóm chưa chạy thực nghiệm nào về hành vi người mua, nên em không đưa ra số liệu thực nghiệm.*
  >
  > *Ví dụ tính tay trong `docs/dynamic-pricing.md`: khu Fanzone có giá 1.200.000 đồng, tốc độ bán gấp đôi mục tiêu, 250 người chờ và 40% ghế đang giữ. Chỉ số áp lực là 1,73, giá đề xuất tăng 18,3% lên 1.420.000 đồng."*

#### `[Slide 15 & 16: Các phân hệ nâng cao (Sprint 3 đến 5, mới ở mức thiết kế)]`
* **Lời thoại**:
  > *"Các phân hệ sau mới có thiết kế, chưa có code, và cờ tương ứng đang tắt:*
  > * *Cơ chế **Hàng chờ ảo (Virtual Waiting Room)**: số người mua cùng lúc tối đa bằng `waiting_room_capacity`, mỗi lượt vào có hạn 10 phút. Hiện mới có bảng `queue_entries`.*
  > * *Bảo mật vé với **Mã QR xoay vòng 30 giây** theo công thức `ticket_code.step.HMAC(qr_secret, step)`. Hiện mới có cột `tickets.qr_secret`.*
  > * *Và **Soát vé ngoại tuyến (Offline Mode)**: máy quét tải trước danh sách vé, mất mạng vẫn kiểm tra được chữ ký QR và đồng bộ lại khi có mạng."*

---

### PHẦN 5: NGHIỆM THU THỰC NGHIỆM & KẾT LUẬN (2.0 phút)

#### `[Slide 17: Kiểm thử đã có và chưa có]`
* **Lời thoại**:
  > *"Về kiểm thử, em xin nói rõ phần đã có và phần chưa có:*
  > 1. *Đã có: test tương tranh `TestHoldSeat_ConcurrentHoldersGetOneSeat`. Test cho **50 goroutines cùng giữ một ghế** trên PostgreSQL thật, mong đợi đúng 1 lượt giữ thành công, các lượt còn lại bị từ chối, và `seat_holds` chỉ có một dòng `ACTIVE`. Test chạy ở tầng service và cần biến `TEST_DATABASE_URL`.*
  > 2. *Đã có: kịch bản kiểm thử thủ công FR-06 theo US-03 trong `docs/checks/fr-06.md`.*
  > 3. *Chưa có: kiểm thử tải k6 cho NFR-01, và kiểm thử với người dùng thật. Kế hoạch, kịch bản và form khảo sát SUS đã viết trong `docs/testing.md`, các bảng kết quả để trống."*

#### `[Slide 18 & 19: Hạn chế, Hướng phát triển & Bài học kinh nghiệm]`
* **Lời thoại**:
  > *"Qua Sprint 2, bài học lớn nhất mà nhóm đúc kết được là triết lý **KISS (Keep It Simple, Stupid)**: Việc khai thác đúng cách năng lực của PostgreSQL 18 và kiến trúc phân tầng BCE giúp giữ ghế an toàn giao dịch mà không cần tầng cache riêng.*
  > 
  > *Hạn chế hiện tại: mã OTP chưa gửi qua SMS hay email, chưa kiểm tra Turnstile, thanh toán và phát vé chưa làm, hệ thống chạy trên một máy ảo. Hướng phát triển là hoàn thành Sprint 3 đến 5 theo bảng cờ tính năng."*

#### `[Slide 20: Lời cảm ơn]`
* **Lời thoại**:
  > *"Trên đây là toàn bộ báo cáo tiến độ và thiết kế kiến trúc hệ thống EventTicketing cho đến mốc Sprint 2 của nhóm.*
  > 
  > *Sau đây, nhóm em xin phép được **trình diễn trực tiếp (Live Demo)** hệ thống đang chạy thực tế tại `cosh301.nhansp.id.vn`.*
  > 
  > *Chúng em xin chân thành cảm ơn cô Phạm Thị Kim Dung và xin lắng nghe các ý kiến nhận xét, đóng góp của cô ạ!"*

---

## PHẦN 6: KỊCH BẢN PHỐI HỢP LIVE DEMO SẢN PHẨM THỰC TẾ (3.0 phút)

### Chuẩn bị trước giờ demo

* Dùng bản trực tuyến `https://cosh301.nhansp.id.vn`.
* Bản này chạy `APP_ENV=production` và profile `sprint2`.
* Không có nút Demo 1-Click. Khán giả đăng nhập bằng email, mã OTP hiện ngay trên màn hình.
* Mã OTP của Ban Tổ chức (`btc@cosh301.nhansp.id.vn`) chỉ ghi vào log của `api`.
* Lấy mã đó trên máy ảo: `docker compose logs api | grep "otp: login code"`.
* Sau mỗi lần gửi mã phải chờ 60 giây mới gửi lại được.
* Đăng nhập sẵn tài khoản Ban Tổ chức trên một trình duyệt từ tối hôm trước. Phiên đăng nhập có hạn 7 ngày.
* Các cờ `payments`, `ticket_limit`, `dynamic_pricing` đang tắt. Demo không có thanh toán và không áp giới hạn vé.

### Bố trí màn hình

| Cửa sổ | Nội dung |
|---|---|
| Trình duyệt A (trái) | Khán giả A, đã đăng nhập |
| Trình duyệt B (phải) | Khán giả B, cửa sổ ẩn danh, đã đăng nhập bằng email khác |
| Terminal (dưới) | Log của `api` trên máy ảo |

Lệnh xem log, bỏ các dòng kiểm tra sức khỏe:

```bash
docker compose logs -f api | grep -v /api/health
```

### Các bước

| Bước | Thao tác | Lời dẫn | Kết quả trên màn hình |
|:---:|---|---|---|
| **1** | Mở trang chủ trên cả hai trình duyệt. | *"Danh sách sự kiện lấy từ API `/api/events`, giá thấp nhất tính từ giá khu trong database."* | 6 đêm diễn sắp tới. Có ô tìm theo nghệ sĩ, thành phố và thời gian. |
| **2** | Trên A, bấm **Đăng nhập**, chọn **Địa chỉ Email**, nhập email, bấm **Gửi mã OTP xác thực**. | *"Chưa có kênh gửi SMS hay email, nên bật `OTP_DEMO` để mã hiện trên màn hình. Mã chỉ dùng được 5 phút, sai 5 lần thì khóa."* | Dòng *"Mã thử nghiệm là …"*. Nhập 6 số, bấm **Xác nhận & Đăng nhập**. Thanh trên có mục **Ghế đang giữ**. |
| **3** | Cả hai trình duyệt mở cùng một concert, bấm **Chọn vé**. | *"Trang chọn vé mở luồng SSE `/api/events/{id}/stream`. Mỗi thay đổi ghế được đẩy xuống mọi trình duyệt đang xem."* | Sơ đồ 2D theo khu. Cột phải liệt kê hạng vé và số chỗ còn, ví dụ *"Còn 24/24"*. |
| **4** | Trên cả hai, chọn khu **SVIP**. | *"Mỗi khu có sơ đồ ghế riêng. Màu xanh là còn trống."* | Lưới ghế hàng A, B. Chú thích bốn trạng thái: còn trống, bạn đang giữ, người khác đang giữ, đã bán. |
| **5** | Trên A, bấm ghế **A1**. | *"Backend khóa ghế trong một transaction, ghi `seat_holds` với hạn 300 giây, rồi `NOTIFY` sau khi commit."* | A: thông báo *"Đã giữ ghế A1"*, đồng hồ **Giữ chỗ còn 05:00**. B: A1 đổi sang màu người khác đang giữ, không cần F5. Terminal: `POST /api/holds`. |
| **6** | Trên B, bấm vào **A1**. | *"Khán giả B không lấy được ghế A đang giữ."* | B: *"Ghế A1 đang có người giữ. Chọn ghế khác."* |
| **7** | Trên A, bấm **Xem ghế đã giữ**. | *"Trang này đọc lại các ghế đang giữ từ server qua `GET /api/holds`, không lưu ở trình duyệt."* | Trang **Ghế đang giữ**: A1, khu SVIP, đồng hồ đếm ngược, giá. Dòng *"Thanh toán sẽ mở ở Sprint 4"*. |
| **8** | Trên A, bấm **Trả ghế**. | *"Trả ghế đưa ghế về `AVAILABLE` với giá khu hiện tại và báo cho mọi trình duyệt."* | A: *"Bạn chưa giữ ghế nào cho sự kiện này"*. B: A1 xanh trở lại. Terminal: `DELETE /api/holds/…`. |
| **9** | Chuyển sang trình duyệt Ban Tổ chức, bấm **Quản lý sự kiện**, chọn concert vừa demo. | *"Ban Tổ chức đặt giá sàn, giá cơ bản, giá trần cho từng khu (FR-08)."* | Mỗi khu có ba ô **Giá sàn**, **Giá cơ bản**, **Giá trần** và nút **Lưu giá**. |
| **10** | Ở khu **CAT 3**, nhập giá cơ bản lớn hơn giá trần, bấm **Lưu giá**. | *"Giá cơ bản phải nằm giữa giá sàn và giá trần."* | Báo lỗi *"Cần thỏa mãn: giá sàn ≤ giá cơ bản ≤ giá trần."* |
| **11** | Nhập giá cơ bản hợp lệ, bấm **Lưu giá**. | *"Đổi giá cơ bản ghi một dòng vào `price_changes`. Ghế đang có người giữ giữ nguyên giá cũ đến khi được trả."* | Báo *"Đã lưu giá"*. |
| **12** *(tùy chọn)* | Ở terminal, mở database và xem nhật ký giá, rồi thử xóa. | *"Bảng `price_changes` có trigger chặn sửa, xóa và `TRUNCATE`."* | Dòng giá vừa đổi, lý do `MANUAL`. Lệnh `DELETE` bị từ chối. |

Lệnh cho bước 12, chạy trong thư mục dự án trên máy ảo:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

```sql
SELECT old_price, new_price, reason, created_at FROM price_changes ORDER BY created_at DESC LIMIT 3;
DELETE FROM price_changes;
```

### Phần dự phòng

* Mất mạng hoặc máy ảo lỗi: chạy cục bộ bằng `docker compose up -d --build`, mở `http://127.0.0.1:3001`.
* Bản cục bộ (`APP_ENV=development`) có nút Demo 1-Click, mỗi lần bấm tạo một tài khoản khán giả mới.
* Nếu cô hỏi về chống bán trùng, chạy test tương tranh trên bản cục bộ:

```bash
cd backend
TEST_DATABASE_URL=postgres://… go test -v -run TestHoldSeat_ConcurrentHoldersGetOneSeat ./internal/service/
```

* Test cho 50 goroutines cùng giữ một ghế, chỉ đúng một lượt thành công.

---

## PHẦN 7: BỘ CÂU HỎI PHẢN BIỆN CHUYÊN SÂU TỪ GIẢNG VIÊN & ĐÁP ÁN CHUẨN

### Câu 1: *"Tại sao nhóm không dùng Redis để giữ ghế như các hệ thống lớn (Ticketmaster, Shopee), mà lại dùng PostgreSQL?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, Redis phù hợp khi hệ thống đã phải chạy phân tán trên nhiều máy chủ. Tuy nhiên, với bài toán đặt vé concert, việc dùng Redis tách rời Database rất dễ dẫn đến hiện tượng **Cache Inconsistency** và **Phantom Reads**: Redis báo ghế trống nhưng DB đã bán, hoặc ngược lại. Khi mạng giữa Redis và DB chập chờn, giao dịch rất dễ bị bán trùng hoặc treo tiền của khách.
  > 
  > PostgreSQL 18 hỗ trợ khóa hàng nguyên tử `UPDATE ... WHERE status = 'AVAILABLE'`, partial unique index và cơ chế `LISTEN/NOTIFY` chạy trong cùng một transaction ACID. Điều này giúp hệ thống đạt tính toàn vẹn 100% (Single Source of Truth), loại bỏ hoàn toàn nguy cơ lệch dữ liệu và đủ cho phạm vi của đồ án. Nhóm chưa đo hiệu năng ở mức hàng chục nghìn người dùng."*

### Câu 2: *"Cơ chế HoldReaper quét 5 giây một lần có làm chậm database không? Nếu hai người cùng bấm cướp ghế hết hạn thì xử lý thế nào?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, worker `HoldReaper` chỉ quét các bản ghi `seat_holds` có `status = 'ACTIVE'` và `expires_at < now()`, bảng này có index một phần `idx_seat_holds_expiry` cho đúng các lượt `ACTIVE`, nên câu quét chỉ đọc các lượt đang hiệu lực.
  > 
  > Đặc biệt, nhóm em cài đặt cơ chế **Stale Hold Stealing (Chiếm lượt giữ quá hạn)**: Nếu ghế vừa hết hạn 5 phút mà HoldReaper chưa kịp quét tới, một người khác bấm vào ghế đó thì hệ thống dùng câu lệnh UPDATE nguyên tử kiểm tra `expires_at < now()`, tự động hủy hold cũ và cấp hold mới cho người thứ hai trong cùng 1 transaction đơn nhất. Nhờ đó ghế hết hạn không bị khóa chờ `HoldReaper`, tối đa trễ 5 giây là ghế trống lại trên giao diện."*

### Câu 3: *"Định giá động gây tranh cãi, tại sao nhóm vẫn thiết kế FR-22?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, nhóm em thiết kế Định giá động theo hướng **chỉ đề xuất**. Hệ thống không bao giờ tự đổi giá (W-01): mỗi 5 phút nó sinh đề xuất vào `price_suggestions`, Ban Tổ chức duyệt thì giá mới đổi.
  >
  > Các rủi ro đã được nêu: người mua không biết trước giá có thể tăng, và có tiền lệ như cuộc điều tra của CMA ở Anh về cách bán vé Oasis. Thiết kế giảm rủi ro bằng giá sàn và giá trần do Ban Tổ chức đặt, biên độ tối đa 20% mỗi chu kỳ, ngưỡng bỏ qua 5% và nhật ký giá `price_changes` không sửa được.
  >
  > FR-22 hiện chưa làm, cờ `dynamic_pricing` đang tắt. Nhóm chưa chạy thực nghiệm nào về hành vi người mua nên em không nêu số liệu thực nghiệm."*

### Câu 4: *"Sơ đồ ghế realtime dùng SSE hay WebSocket? Tại sao lại chọn SSE?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, nhóm em chọn **Server-Sent Events (SSE)** vì bài toán sơ đồ ghế là bài toán **giao tiếp một chiều từ máy chủ xuống trình duyệt**: Khi có một ghế bị giữ, server thông báo cho tất cả người đang xem đổi màu ghế.
  > 
  > So với WebSocket, SSE chạy trên giao thức HTTP tiêu chuẩn, nhẹ hơn rất nhiều, tự động hỗ trợ kết nối lại (Auto Reconnect), thân thiện 100% với các HTTP Proxy/Load Balancer và Nginx, không bị lỗi nghẽn cổng kết nối phức tạp như WebSocket."*

### Câu 5: *"Phần nào của hệ thống đã chạy và phần nào chưa?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, theo `docs/spec.md`, ở Sprint 2 đã xong 6 yêu cầu: danh sách sự kiện, sơ đồ ghế, phiên đăng nhập, ghế realtime, giữ ghế 5 phút và chống bán trùng. Đang làm 4 yêu cầu: đăng nhập OTP (chưa gửi SMS hay email), cấu hình giá (chưa tạo sự kiện), giới hạn vé (cờ tắt) và nhật ký giá (chưa có trang xem). 13 yêu cầu còn lại, gồm thanh toán, phát vé, QR, soát vé và dashboard, chưa làm. Cờ tính năng giúp ẩn các phần chưa làm, API trả `404 feature_disabled`."*
