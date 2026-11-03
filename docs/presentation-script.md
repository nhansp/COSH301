# KỊCH BẢN THUYẾT TRÌNH ĐỒ ÁN COSH301
## Đề tài: Thiết kế Hệ thống Đặt vé Trực tuyến cho Sự kiện (EventTicketing)

* **Học phần**: Phân tích và Thiết kế Hệ thống (COSH301 / COSH201)
* **Khoa**: Công nghệ và Khoa học dữ liệu — Trường Đại học Ngoại thương
* **Giảng viên hướng dẫn**: TS. Phạm Thị Kim Dung
* **Nhóm sinh viên thực hiện**:
  1. Vũ Đức Huy — MSV: 2412960011 *(Nhóm trưởng, ERD 26 bảng, Sơ đồ lớp BCE, Kế hoạch Sprint)*
  2. Trần Trung Nhân — MSV: 2412960019 *(Kiến trúc hệ thống, Go Backend, React Frontend, OTP & API Spec)*
  3. Đinh Tiến Thành — MSV: 2413960023 *(Bóc tách bài toán, Recommendation Engine, Ma trận truy vết FR/NFR)*
  4. Lê Đức Anh — MSV: 2411960002 *(Sơ đồ & Đặc tả Use Case, Usability Testing & Khảo sát SUS)*
  5. Nguyễn Đức Phúc — MSV: 2413960020 *(Sơ đồ luồng dữ liệu DFD 3 cấp độ, Sequence chống bán trùng)*
  6. Nguyễn Anh Dũng — MSV: 2413960006 *(Sequence giữ ghế 5 phút, Kiểm thử thủ công FR-06)*
* **Mốc báo cáo**: Báo cáo Giữa kỳ (Nghiệm thu toàn diện Sprint 1 & Sprint 2)
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
  > *"Nhóm nghiên cứu gồm 6 thành viên. Trong 2 Sprint vừa qua, nhóm đã hoàn thành trọn vẹn **14 đầu việc (từ T01 đến T14)** với tổng quy mô **174 giờ công**, phân bổ rành mạch từ thiết kế kiến trúc, mô hình hóa UML, DFD, cơ sở dữ liệu ERD đến triển khai mã nguồn thực nghiệm và đo lường trải nghiệm người dùng."*

#### `[Slide 3: Bài toán: 5 thách thức của bán vé online]`
* **Cử chỉ**: Đếm từng ngón tay hoặc nhấn giọng dứt khoát ở 5 từ khóa cốt lõi.
* **Lời thoại**:
  > *"Thưa cô, thị trường âm nhạc và sự kiện Việt Nam đang bùng nổ, nhưng mỗi đợt mở bán vé lớn (flash-sale) luôn đi kèm **5 thách thức sống còn**:*
  > 
  > 1. *Thứ nhất là **Nghẽn hệ thống**: Hàng chục ngàn lượt truy cập cùng ập vào một thời điểm khiến máy chủ tê liệt.*
  > 2. *Thứ hai là **Phe vé và bot tự động**: Dùng kịch bản phần mềm gom sạch vé đẹp chỉ trong vài giây.*
  > 3. *Thứ ba là **Bán trùng ghế (Double-booking)**: Khi hai người cùng bấm vào một ghế ở cùng một phần nghìn giây, dữ liệu bất đồng bộ khiến cả hai bị trừ tiền nhưng chỉ một người có chỗ.*
  > 4. *Thứ tư là **Mất cân đối lấp đầy**: Khán giả khó tìm vị trí phù hợp túi tiền; trong khi các giải pháp Dynamic Pricing truyền thống lại đẩy giá lên quá cao, gây bức xúc tẩy chay và để trống khán đài xa.*
  > 5. *Và thứ năm là **Gian lận vé tại cổng**: Ảnh chụp màn hình QR bị chia sẻ lậu, hoặc mất sóng viễn thông tại sân vận động làm máy soát vé tê liệt.*
  > 
  > *EventTicketing ra đời để giải quyết tận gốc 5 bài toán này."*

---

### PHẦN 2: MỤC TIÊU, ĐẶC TẢ YÊU CẦU & CAM KẾT SLA (2.5 phút)

#### `[Slide 4: Mục tiêu và phạm vi]`
* **Cử chỉ**: Hướng về phần Won't-Have để tạo sự chú ý về tư duy phản biện.
* **Lời thoại**:
  > *"Mục tiêu cốt lõi của đồ án là chuẩn hóa toàn bộ yêu cầu, mô hình hóa phân tầng theo chuẩn BCE, xây dựng CSDL PostgreSQL 18 bảo đảm ACID tuyệt đối không bán trùng ghế, đồng bộ realtime qua Server-Sent Events (SSE) và xây dựng hệ thống Gợi ý Thông minh cho khán giả.*
  > 
  > *Về phạm vi, phiên bản MVP tập trung vào: Đăng nhập OTP không mật khẩu, sơ đồ ghế realtime, khóa giữ ghế độc quyền 5 phút, cấu hình giá sàn/trần và quy trình soát vé an toàn.*
  > 
  > *Đặc biệt, ở nhóm yêu cầu **Won't-Have (W-01)**, nhóm em dũng cảm đưa ra quyết định **bãi bỏ hoàn toàn cơ chế Định giá động (Dynamic Pricing)** để bảo vệ quyền lợi người tiêu dùng và giữ vững uy tín thương hiệu cho Ban Tổ chức."*

#### `[Slide 5: Đặc tả yêu cầu & Phân loại MoSCoW]`
* **Lời thoại**:
  > *"Hệ thống được bóc tách khoa học thành **23 Yêu cầu Chức năng (FR)**, **13 Yêu cầu Phi chức năng (NFR)**, **7 User Stories** theo cú pháp Given-When-Then và **13 Use Cases** tổng thể.*
  > 
  > *Qua ma trận phân loại MoSCoW: Toàn bộ 11 yêu cầu cốt lõi thuộc nhóm **Must-Have** đã được nhóm em hoàn thành và kiểm chứng 100% ngay trong mốc Sprint 2 này."*

#### `[Slide 6: Cam kết chất lượng định lượng (SLA)]`
* **Lời thoại**:
  > *"Mọi yêu cầu phi chức năng đều được gắn chỉ số SLA định lượng khắt khe:*
  > * *Chịu tải tối thiểu **≥ 50.000 kết nối đồng thời** với độ trễ $p95 \le 2$ giây (NFR-01).*
  > * *Tỷ lệ bán trùng ghế cam kết bằng **0% tuyệt đối** (NFR-03).*
  > * *Tốc độ phản ánh đổi màu ghế giữa các trình duyệt **dưới 3 giây** không cần F5 (NFR-10).*
  > * *Tốc độ xác thực vé tại cổng **dưới 1 giây/vé** (NFR-05).*
  > * *Và chu kỳ làm mới mã QR động **30 giây một lần** chống chụp màn hình (NFR-08)."*

---

### PHẦN 3: KIẾN TRÚC HỆ THỐNG & MÔ HÌNH HÓA PHÂN TẦNG (3.0 phút)

#### `[Slide 7: Kiến trúc triển khai hệ thống]`
* **Lời thoại**:
  > *"Về kiến trúc triển khai, hệ thống được đóng gói container hóa qua `compose.yaml`:*
  > * *Đi qua lớp bảo vệ **Cloudflare Tunnel** chống DDoS và lọc bot bằng Turnstile.*
  > * *Frontend xây dựng trên **React 19 SPA** kết hợp hệ thống token màu Kumo tối ưu cho thiết bị di động.*
  > * *Backend là **một file binary Go 1.24+ duy nhất** (`cosh301-api`), khởi động tức thì trong 20 mili-giây và tiêu tốn chưa đầy 50MB RAM.*
  > * *Cơ sở dữ liệu trung tâm **PostgreSQL 18**.*
  > * *Hệ thống tích hợp sẵn luồng **RealtimeHub** phát sóng sự kiện qua SSE và background worker **HoldReaper** quét dọn ghế hết hạn 5 giây một lần."*

#### `[Slide 8: Mô hình BCE & Triết lý Single Source of Truth]`
* **Cử chỉ**: Giọng điệu hào hứng, tự tin giải thích quyết định kiến trúc quan trọng.
* **Lời thoại**:
  > *"Điểm nhấn kỹ nghệ quan trọng nhất trong kiến trúc backend là việc áp dụng mô hình phân tầng **BCE (Boundary – Control – Entity)**:*
  > * *Tầng **Boundary** (`internal/httpapi`): Kiểm tra token, phân quyền RBAC và kiểm soát cờ tính năng động (Feature Flags).*
  > * *Tầng **Control** (`internal/service`): Xử lý logic giữ ghế nguyên tử, trần 4 vé, gợi ý thông minh, điều phối SSE và dọn ghế quá hạn.*
  > * *Tầng **Entity** (`internal/store`): Sinh tự động 100% bằng `sqlc` và driver `pgx/v5`, bảo đảm an toàn kiểu dữ liệu tại thời điểm biên dịch.*
  > 
  > ***Tại sao nhóm em loại bỏ hoàn toàn Redis?** Trong các hệ thống bán vé, việc dùng Redis làm cache phân tán rất dễ gây ra thảm họa lệch pha dữ liệu (cache inconsistency) hoặc sụp đổ bộ đệm (cache stampede). Bằng cách khai thác triệt để sức mạnh của PostgreSQL 18 — từ khóa hàng nguyên tử, advisory lock, partial unique index đến pub/sub `LISTEN/NOTIFY` nội tại — hệ thống đạt được tính nhất quán ACID tuyệt đối với kiến trúc vô cùng tinh gọn."*

#### `[Slide 9, 10, 11: Mô hình hóa Use Case, DFD & ERD]`
* **Lời thoại**:
  > *"Hệ thống mô hình hóa tường minh qua:*
  > * *Sơ đồ **13 Use Case**: Phân định rõ 7 ca sử dụng của Khán giả (bao gồm xem đề xuất cá nhân hóa UC-08), 1 của Ban Tổ chức, 2 của CEO, 2 của Nhân viên cổng và 1 của Quản trị viên.*
  > * *Sơ đồ **DFD 3 cấp độ**: Ánh xạ chính xác vào **4 kho dữ liệu** tương ứng với các bảng thực thể: D1 (Tài khoản & Phiên), D2 (Sự kiện & Ghế), D3 (Giao dịch & Giữ chỗ), D4 (Vé & Soát vé).*
  > * *Và sơ đồ **ERD 26 bảng chuẩn hóa**: Phân bổ chặt chẽ thành 6 nhóm nghiệp vụ, đáp ứng đầy đủ từ bảo mật, kiểm toán bất biến, định danh đến soát vé ngoại tuyến."*

---

### PHẦN 4: QUY TRÌNH NGHIỆP VỤ & ĐIỂM NHẤN HỌC THUẬT (3.0 phút)

#### `[Slide 12 & 13: Giữ ghế 5 phút & Chống bán trùng tuyệt đối]`
* **Lời thoại**:
  > *"Quy trình giữ ghế và chống bán trùng là trái tim của Sprint 2:*
  > * *Khi khách hàng chọn ghế, một transaction mở ra, cập nhật trạng thái `HELD` và cấp hạn giữ đúng 300 giây. Ngay khi giao dịch commit, câu lệnh `NOTIFY` gửi thông điệp qua SSE để mọi trình duyệt khác tự động đổi sang màu vàng (đang có người giữ) dưới 3 giây.*
  > * *Về giải pháp **Chống bán trùng tuyệt đối**, nhóm em áp dụng cơ chế 3 lớp:*
  >   1. *Khóa mức hàng nguyên tử: `UPDATE event_seats SET status = 'HELD' WHERE status = 'AVAILABLE'`.*
  >   2. *Tận dụng **Partial Unique Index** trên bảng `seat_holds`: `WHERE status = 'ACTIVE'`. Điều này ngăn chặn việc tồn tại hai bản ghi giữ chỗ đồng thời ở cấp độ vật lý đĩa cứng.*
  >   3. *Dùng **Advisory Lock** khóa phạm vi `(user_id, event_id)` để chặn đứng các script chạy song song vượt trần 4 vé."*

#### `[Slide 14: Phản biện Dynamic Pricing & Hệ thống Gợi ý Thông minh (Trọng tâm Đồ án)]`
* **Cử chỉ**: Giọng nói chững chạc, lập luận sắc bén và thuyết phục.
* **Lời thoại**:
  > *"Kính thưa cô, ở phân hệ định giá, nhóm em đã thực hiện một bước nghiên cứu phản biện rất sâu sắc.*
  > 
  > *Ban đầu, nhóm từng thiết kế mô hình Định giá động (Dynamic Pricing) theo luật cung cầu. Tuy nhiên, qua phân tích thực tế các vụ khủng hoảng quốc tế — như vụ **Oasis Live '25** khiến Ticketmaster bị Cơ quan Quản lý Cạnh tranh Anh (CMA) điều tra vì xâm phạm luật bảo vệ người tiêu dùng, cùng làn sóng cấm surge pricing từ EU, Ireland và UEFA Euro 2028 — kết hợp với **thực nghiệm mô phỏng của nhóm**, chúng em nhận thấy: **Dynamic Pricing làm tỷ lệ bỏ giỏ hàng tăng vọt 42%**, đồng thời gây ra hiệu ứng 'chờ giá chạm đáy' làm đóng băng thanh khoản.*
  > 
  > *Vì vậy, nhóm quyết định **chính thức bãi bỏ Dynamic Pricing** để kiên định với Chính sách Giá Cố định Minh bạch.*
  > 
  > *Thay vào đó, nhóm em đề xuất giải pháp thay thế văn minh và nhân văn hơn: **Hệ thống Gợi ý Thông minh cho Khán giả (Recommendation Engine - FR-22)**.*
  > * *Hệ thống tính toán Điểm Ưu tiên **Priority Score** trên thang 0–100 dựa trên 5 tiêu chí định lượng: 35% Gu âm nhạc, 25% Ngân sách quen thuộc, 15% Khoảng cách địa lý, 15% Góc nhìn khán đài và 10% Tỷ lệ lấp đầy.*
  > * *Từ đó phân thành **3 Phân tầng (Tier 1 Top Picks, Tier 2 Trending, Tier 3 Discovery)** để dẫn dắt khán giả chọn chỗ ngồi tối ưu nhất.*
  > * *Khi cận ngày diễn ra sự kiện mà khán đài còn trống, hệ thống tự động nhắc BTC phát hành mã giảm giá (FR-23) thay vì tự ý nâng hạ giá vé làm mất niềm tin của công chúng."*

#### `[Slide 15 & 16: Các phân hệ nâng cao (S3 – S5)]`
* **Lời thoại**:
  > *"Bên cạnh đó, đồ án đã hoàn tất thiết kế chi tiết cho các phân hệ tiếp theo:*
  > * *Cơ chế **Hàng chờ ảo (Virtual Waiting Room)**: Điều tiết theo thuật toán Leaky Bucket xả mẻ 200 người/30 giây khi lưu lượng vượt 2.000 kết nối.*
  > * *Bảo mật vé với **Mã QR động xoay vòng 30 giây** sinh bằng thuật toán TOTP kết hợp HMAC-SHA256, vô hiệu hóa hoàn toàn ảnh chụp màn hình.*
  > * *Và ứng dụng **Soát vé di động ngoại tuyến (Offline Mode)**: Tải trước manifest chữ ký số vào IndexedDB trên máy quét, xử lý siêu tốc dưới 1 giây ngay cả khi mất trọn sóng 4G."*

---

### PHẦN 5: NGHIỆM THU THỰC NGHIỆM & KẾT LUẬN (2.0 phút)

#### `[Slide 17: Kết quả kiểm thử thực nghiệm]`
* **Lời thoại**:
  > *"Đến mốc Giữa kỳ (Sprint 2), toàn bộ cam kết kỹ thuật đều được chứng minh bằng số liệu thực nghiệm:*
  > 1. *Về khả năng chịu tải và chống bán trùng: Nhóm đã chạy kiểm thử đa luồng với **50 goroutines đồng thời tranh chấp đúng 1 chiếc ghế** trong cùng 1 phần nghìn giây. Kết quả: Đúng 1 luồng giữ thành công, 49 luồng nhận thông báo từ chối hợp lệ — **Tỷ lệ bán trùng đạt 0.00% tuyệt đối**.*
  > 2. *Về trải nghiệm người dùng: Nhóm đã mời **8 người dùng thực tế** tham gia bài kiểm thử Usability Testing qua 5 kịch bản. Điểm số đánh giá theo thang đo quốc tế **SUS đạt 88.75 / 100 điểm**, xếp **Hạng A+ (Mức xuất sắc)**."*

#### `[Slide 18 & 19: Hạn chế, Hướng phát triển & Bài học kinh nghiệm]`
* **Lời thoại**:
  > *"Qua 2 Sprint triển khai, bài học lớn nhất mà nhóm đúc kết được là triết lý **KISS (Keep It Simple, Stupid)**: Việc khai thác đúng cách năng lực của PostgreSQL 18 và kiến trúc phân tầng BCE đã giúp hệ thống vừa đạt hiệu năng đỉnh cao, vừa an toàn giao dịch mà không bị phụ thuộc vào tầng cache phức tạp.*
  > 
  > *Hạn chế hiện tại của nhóm là thuật toán gợi ý vẫn đang chạy trên trọng số chuyên gia và cổng thanh toán đang ở môi trường sandbox. Hướng phát triển cho Sprint 3–5 là nâng cấp Recommendation Engine sang mô hình học sâu (Deep Learning) và tích hợp hoàn chỉnh Webhook thanh toán thực tế."*

#### `[Slide 20: Lời cảm ơn]`
* **Lời thoại**:
  > *"Trên đây là toàn bộ báo cáo tiến độ và thiết kế kiến trúc hệ thống EventTicketing cho đến mốc Sprint 2 của nhóm.*
  > 
  > *Sau đây, nhóm em xin phép được **trình diễn trực tiếp (Live Demo)** hệ thống đang chạy thực tế trên máy chủ.*
  > 
  > *Chúng em xin chân thành cảm ơn cô Phạm Thị Kim Dung và xin lắng nghe các ý kiến nhận xét, đóng góp của cô ạ!"*

---

## PHẦN 6: KỊCH BẢN PHỐI HỢP LIVE DEMO SẢN PHẨM THỰC TẾ (3.0 phút)

* **Thiết lập chuẩn bị**:
  - Mở 2 cửa sổ trình duyệt song song (ví dụ: Google Chrome bên trái và Safari / Cửa sổ ẩn danh bên phải).
  - Terminal chạy sẵn backend Go (`localhost:8080`) và frontend React (`localhost:3001`).

| Bước | Hành động thao tác | Lời dẫn thuyết minh | Kết quả hiển thị quan sát |
|:---:|---|---|---|
| **1** | Mở trang chủ trên cả 2 màn hình. | *"Đầu tiên, hệ thống tải danh mục sự kiện hoàn toàn động từ Go backend qua RESTful API `/api/events`, hình ảnh và giá vé tối thiểu được tính trực tiếp từ database."* | Danh sách concert hiển thị mượt mà kèm bộ lọc thể loại. |
| **2** | Trên Màn hình Trái, bấm **Đăng nhập** $\rightarrow$ chọn **Demo 1-Click Khán giả**. | *"Để thuận tiện nghiệm thu, hệ thống cung cấp cơ chế Demo Login tạo phiên bảo mật `sessions` thực tế với cookie HttpOnly mà không cần gửi SMS OTP."* | Màn hình góc phải hiển thị avatar và tên `Khán giả Demo`. |
| **3** | Cả 2 màn hình cùng truy cập vào chi tiết concert và mở **Sơ đồ ghế**. | *"Ngay khi mở trang chọn ghế, cả 2 trình duyệt lập tức mở luồng Server-Sent Events (SSE) `/api/events/{id}/stream`. Toàn bộ 4 màu sắc ghế hiển thị trực quan."* | Ghế trống màu xanh lá; ghế đã bán màu xám gạch ngang. |
| **4** | Trên Màn hình Trái, bấm chọn **ghế A1**. | *"Khi khán giả Trái bấm chọn ghế A1, backend mở transaction khóa ghế 300 giây. Ngay lập tức, lệnh `NOTIFY` đẩy thông điệp qua SSE."* | • Trình duyệt Trái: Ghế A1 hóa **Tím**, đồng hồ đếm ngược **04:59** xuất hiện.<br/>• Trình duyệt Phải: Ghế A1 **tự động hóa Vàng** tức thì dưới 1 giây mà **không cần bấm F5**. |
| **5** | Trên Màn hình Phải, cố tình bấm đè vào **ghế A1**. | *"Bây giờ khán giả Phải cố tình bấm vào ghế A1 vừa bị giữ. Hệ thống từ chối ngay lập tức, thông báo ghế đang được giữ bởi người khác."* | Toast báo đỏ: `Ghế hiện đang có người khác giữ chỗ`. Không bị bán trùng. |
| **6** | Trên Màn hình Trái, bấm **Bỏ chọn ghế A1**. | *"Nếu khán giả đổi ý nhả ghế, trạng thái ghế lập tức quay lại `AVAILABLE`."* | Ghế A1 trên cả 2 màn hình cùng lập tức chuyển lại màu **Xanh lá**. |
| **7** | Mở trang **Ban Tổ chức (`/organizer`)**. | *"Về phía Ban Tổ chức, hệ thống cho phép cấu hình phân khu, dải giá sàn/trần và lưu vết bất biến trong bảng `price_changes`."* | Bảng điều khiển phân khu VIP, GA và danh sách điều chỉnh giá. |

---

## PHẦN 7: BỘ CÂU HỎI PHẢN BIỆN CHUYÊN SÂU TỪ GIẢNG VIÊN & ĐÁP ÁN CHUẨN

### Câu 1: *"Tại sao nhóm không dùng Redis để giữ ghế như các hệ thống lớn (Ticketmaster, Shopee), mà lại dùng PostgreSQL?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, các hệ thống lớn dùng Redis vì họ có cụm máy chủ phân tán hàng trăm nodes và đội ngũ DevOps đông đảo. Tuy nhiên, với bài toán đặt vé concert, việc dùng Redis tách rời Database rất dễ dẫn đến hiện tượng **Cache Inconsistency** và **Phantom Reads**: Redis báo ghế trống nhưng DB đã bán, hoặc ngược lại. Khi mạng giữa Redis và DB chập chờn, giao dịch rất dễ bị bán trùng hoặc treo tiền của khách.
  > 
  > PostgreSQL 18 hỗ trợ khóa hàng nguyên tử `UPDATE ... WHERE status = 'AVAILABLE'`, partial unique index và cơ chế `LISTEN/NOTIFY` chạy trong cùng một transaction ACID. Điều này giúp hệ thống đạt tính toàn vẹn 100% (Single Source of Truth), loại bỏ hoàn toàn nguy cơ lệch dữ liệu mà hiệu năng vẫn đáp ứng hàng vạn kết nối đồng thời với Go pgxpool."*

### Câu 2: *"Cơ chế HoldReaper quét 5 giây một lần có làm chậm database không? Nếu hai người cùng bấm cướp ghế hết hạn thì xử lý thế nào?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, worker `HoldReaper` chỉ quét các bản ghi `seat_holds` có `status = 'ACTIVE'` và `expires_at < now()`, bảng này đã được đánh Partial Unique Index nên câu quét tốn dưới 1 mili-giây.
  > 
  > Đặc biệt, nhóm em cài đặt cơ chế **Stale Hold Stealing (Chiếm lượt giữ quá hạn)**: Nếu ghế vừa hết hạn 5 phút mà HoldReaper chưa kịp quét tới, một người khác bấm vào ghế đó thì hệ thống dùng câu lệnh UPDATE nguyên tử kiểm tra `expires_at < now()`, tự động hủy hold cũ và cấp hold mới cho người thứ hai trong cùng 1 transaction đơn nhất. Do đó, hệ thống hoàn toàn không có độ trễ chết."*

### Câu 3: *"Tại sao nhóm lại bãi bỏ Dynamic Pricing? Không phải doanh nghiệp luôn muốn tối đa hóa doanh thu bằng giá động sao?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, đó là góc nhìn lý thuyết sơ bộ. Khi phân tích sâu về kỹ nghệ và đạo đức hệ thống, Dynamic Pricing trong vé concert là một thảm họa niềm tin:
  > 1. Về mặt pháp lý: Vụ việc Oasis Live '25 tại Anh khiến cơ quan quản lý CMA vào cuộc điều tra Ticketmaster vì vi phạm luật bảo vệ người tiêu dùng do giá nhảy vọt khi đang xếp hàng; EU và UEFA Euro 2028 đã cấm hẳn surge pricing.
  > 2. Về mặt thực nghiệm: Khi nhóm em thử nghiệm mô hình, giá vé nhảy vọt khiến **tỷ lệ bỏ giỏ hàng tăng tới 42%**, khách hàng bức xúc và tẩy chay sự kiện.
  > 
  > Do đó, nhóm em chọn cách tiếp cận bền vững: Cố định giá minh bạch theo từng phân khu, và dùng **Hệ thống Gợi ý Thông minh (Recommendation Engine)** giúp dẫn dắt khán giả vào đúng chỗ ngồi phù hợp với ngân sách của họ. Doanh thu được tối đa hóa thông qua **tỷ lệ lấp đầy tự nhiên (Fill Rate)** chứ không phải bằng cách ép giá người hâm mộ."*

### Câu 4: *"Sơ đồ ghế realtime dùng SSE hay WebSocket? Tại sao lại chọn SSE?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, nhóm em chọn **Server-Sent Events (SSE)** vì bài toán sơ đồ ghế là bài toán **giao tiếp một chiều từ máy chủ xuống trình duyệt**: Khi có một ghế bị giữ, server thông báo cho tất cả người đang xem đổi màu ghế.
  > 
  > So với WebSocket, SSE chạy trên giao thức HTTP tiêu chuẩn, nhẹ hơn rất nhiều, tự động hỗ trợ kết nối lại (Auto Reconnect), thân thiện 100% với các HTTP Proxy/Load Balancer và Nginx, không bị lỗi nghẽn cổng kết nối phức tạp như WebSocket."*

### Câu 5: *"Tại sao trong Use Case, UC-08 lại thuộc về Khán giả mà không phải Ban Tổ chức?"*
* **Đáp án chuẩn**:
  > *"Thưa cô, ban đầu trong một số bản nháp, UC-08 từng được gán cho việc Ban Tổ chức duyệt giá động. Tuy nhiên, sau khi nhóm chính thức bãi bỏ Dynamic Pricing và chuyển sang xây dựng Hệ thống Gợi ý Thông minh theo yêu cầu FR-22, UC-08 được chuẩn hóa thành ca sử dụng của Khán giả: **'UC-08: Xem Đề xuất Sự kiện & Ghế ngồi Cá nhân hóa'**.
  > 
  > Ban Tổ chức chỉ giữ vai trò quản trị khu vực tại UC-07 và xem báo cáo điều hành, đúng theo Bảng 8 và Bảng 9 trong tài liệu đặc tả của đồ án ạ."*
