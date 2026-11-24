# Kịch bản thuyết trình – Nhóm 1

**Đề tài:** Thiết kế hệ thống đặt vé trực tuyến cho sự kiện (EventTicketing)
**Học phần:** Phân tích và thiết kế hệ thống · Giảng viên hướng dẫn: TS. Phạm Thị Kim Dung
**Thời lượng:** khoảng 17 phút trình bày và 5 phút demo, sau đó là phần hỏi đáp.

Kịch bản đi theo đúng thứ tự 27 slide trong thư mục `slides/`.
Mỗi slide ghi người trình bày, thời lượng và lời nói gợi ý.
Không cần đọc thuộc lòng, chỉ cần nói đủ ý.

---

## Phân công trình bày

| Người trình bày | Slide | Demo | Câu hỏi phụ trách |
|---|---|---|---|
| Vũ Đức Huy | 1, 13 – 16, 20, 27 | Trợ lý ảo, nhật ký giá | Câu 1, 2, 7 |
| Lê Đức Anh | 2, 3, 11, 21 | — | — |
| Đinh Tiến Thành | 4, 5, 6, 24 | Khảo sát người dùng | — |
| Trần Trung Nhân | 7 – 10 | Khách hàng, ứng dụng OTP, thanh toán | Câu 4, 5, 6, 8 |
| Nguyễn Đức Phúc | 12, 19, 22, 25, 26 | — | — |
| Nguyễn Anh Dũng | 17, 18, 23 | Ban Tổ chức, kiểm thử tải, định giá động | Câu 3 |

## Điều khiển slide

- Chạy `python3 slides/serve.py` trên laptop, mở `http://127.0.0.1:8765` lên màn hình chiếu.
- Người trình bày mở `/presenter` để xem ghi chú, slide kế tiếp và đồng hồ.
- Có thể chuyển slide bằng điện thoại ở `/ctl` (chạy server với `--host 0.0.0.0`).
- Phím `→` `←` chuyển slide, `F` toàn màn hình. Ở slide demo, `R` phát lại đoạn video, `P` tạm dừng.

---

## Lời nói theo từng slide

### Phần 1. Giới thiệu

**Slide 1 – EventTicketing** · Vũ Đức Huy · 15 giây
> Em chào cô và các bạn. Nhóm 1 xin trình bày đề tài thiết kế hệ thống đặt vé trực tuyến cho sự kiện, gọi tắt là EventTicketing. Hệ thống đang chạy thật tại địa chỉ cosh301.nhansp.id.vn, cuối buổi nhóm sẽ demo.

**Slide 2 – Thành viên nhóm và phân công** · Lê Đức Anh · 20 giây
> Nhóm có sáu thành viên, làm theo Scrum và chia thành năm sprint. Mỗi bạn phụ trách một mảng như trên bảng. Phân công chi tiết theo từng đầu việc có trong phần 6 của báo cáo.

**Slide 3 – Bối cảnh và vấn đề** · Lê Đức Anh · 45 giây
> Khi mở bán vé các concert lớn, hệ thống thường gặp năm vấn đề: quá tải lúc mở bán, phe vé dùng bot gom vé, bán trùng ghế, giá vé cố định khiến khu gần sân khấu hết sớm còn khu xa thì ế, và gian lận vé tại cổng. Hướng giải quyết của nhóm là giữ ghế có thời hạn, chống bán trùng ngay ở tầng cơ sở dữ liệu, và điều chỉnh giá theo cung cầu nhưng luôn có người duyệt.

### Phần 2. Yêu cầu

**Slide 4 – Mục tiêu và phạm vi** · Đinh Tiến Thành · 45 giây
> Mục tiêu của nhóm gồm đặc tả yêu cầu đầy đủ, mô hình hóa theo BCE, không để xảy ra bán trùng ghế, sơ đồ ghế cập nhật theo thời gian thực và giá vé điều chỉnh theo cung cầu. Bên phải là hiện trạng trên bản chạy thật: mua vé, giữ ghế, đăng nhập, giá và thanh toán thử đã chạy; soát vé và bảng doanh thu chưa làm. Điểm quan trọng nhất trong phần ngoài phạm vi là W-01: hệ thống không tự đổi giá khi chưa có người duyệt.

**Slide 5 – Yêu cầu chức năng và mức ưu tiên** · Đinh Tiến Thành · 55 giây
> Nhóm có 24 yêu cầu chức năng, 13 yêu cầu phi chức năng, 7 user story và 13 use case. Các yêu cầu được xếp theo MoSCoW. Nhóm Must là những phần bắt buộc để bán được vé. Nhóm Should và Could là phần nâng cao như mã QR xoay vòng, định giá động và trợ lý ảo. User story viết theo mẫu Given – When – Then, chi tiết ở bảng 2 và bảng 13 của báo cáo.

**Slide 6 – Yêu cầu phi chức năng** · Đinh Tiến Thành · 45 giây
> Mỗi yêu cầu phi chức năng đều có một chỉ tiêu đo được. Không bán trùng ghế, ghế cập nhật trong 3 giây và nhật ký giá không sửa được đều đã đạt. Về tải, nhóm mới đo được 300 người dùng đồng thời trên máy chủ thật, thời gian phản hồi 342 mili giây, chưa đạt mức 50.000 người trong thiết kế.

### Phần 3. Kiến trúc

**Slide 7 – Kiến trúc triển khai** · Trần Trung Nhân · 40 giây
> Người dùng truy cập qua trình duyệt hoặc ứng dụng OTP trên điện thoại. Mọi yêu cầu đi qua Cloudflare, đến nginx phục vụ giao diện React, rồi tới máy chủ API viết bằng Go và cơ sở dữ liệu PostgreSQL 18. Toàn bộ chạy bằng Docker Compose trên một máy ảo, máy ảo không mở cổng web ra ngoài. Hệ thống dùng hai dịch vụ ngoài: cổng VNPay ở môi trường thử và máy chủ mô hình ngôn ngữ cho trợ lý ảo.

**Slide 8 – Kiến trúc phân lớp BCE** · Trần Trung Nhân · 35 giây
> Mã nguồn backend chia đúng ba lớp BCE. Boundary nhận yêu cầu, kiểm tra đăng nhập, vai trò và cờ tính năng. Control chứa nghiệp vụ. Entity là lớp truy cập dữ liệu, sinh tự động từ câu lệnh SQL. Boundary không gọi thẳng cơ sở dữ liệu. Biểu đồ lớp trong báo cáo dựng theo đúng ba lớp này.

**Slide 9 – Hệ thống cờ tính năng** · Trần Trung Nhân · 40 giây
> Mỗi chức năng lớn gắn với một cờ. Biến FEATURE_PROFILE chọn bộ cờ theo sprint, và có thể bật, tắt riêng từng cờ mà không sửa mã. Cờ đang tắt thì API trả lỗi 404 và giao diện ẩn chức năng đó. Nhờ vậy nhóm nghiệm thu từng sprint trên cùng một bản mã; phần chưa xong chỉ cần tắt cờ.

**Slide 10 – Ứng dụng nhận mã OTP** · Trần Trung Nhân · 40 giây
> Nhóm chưa có nhà cung cấp SMS, nên viết một ứng dụng Android nhỏ để nhận mã đăng nhập. Khi khách nhập số điện thoại trên web, máy chủ tạo mã và chỉ báo cho ứng dụng là có mã mới; ứng dụng tự lấy mã một lần và hiện thông báo. Đăng nhập bằng email thì mã hiện trên màn hình ở chế độ demo. Hạn chế là số điện thoại do ứng dụng gửi lên chưa chứng minh được người dùng là chủ số.

### Phần 4. Mô hình hóa và nghiệp vụ

**Slide 11 – Biểu đồ use case** · Lê Đức Anh · 40 giây
> Hệ thống có 13 use case cho năm tác nhân: khán giả, Ban Tổ chức, CEO, nhân viên cổng và quản trị viên. Đã chạy được đăng nhập, xem sự kiện, giữ ghế, thanh toán thử, quản lý giá khu và duyệt giá đề xuất. Các use case còn lại đang ở mức thiết kế.

**Slide 12 – Biểu đồ luồng dữ liệu mức 0** · Nguyễn Đức Phúc · 30 giây
> Biểu đồ luồng dữ liệu có ba mức. Ở mức 0 có các tiến trình từ xác thực, quản lý sự kiện, giữ chỗ, thanh toán đến định giá động. Các ô tô đậm là phần đã có mã chạy.

**Slide 13 – Mô hình dữ liệu** · Vũ Đức Huy · 30 giây
> Cơ sở dữ liệu có 24 bảng, chia sáu nhóm. Thiết kế ở Sprint 1 có 26 bảng; sau khi chuẩn hóa còn 23 bảng lõi, cộng thêm một bảng cho ứng dụng OTP. Mỗi thực thể trong ERD tương ứng với một lớp Entity trong biểu đồ lớp.

**Slide 14 – Giữ ghế và cập nhật thời gian thực** · Vũ Đức Huy · 35 giây
> Ghế có ba trạng thái: còn trống, đang giữ và đã bán. Khi khách chọn ghế, máy chủ giữ ghế và gửi thông báo trong cùng một giao dịch. Thông báo chỉ đi ra sau khi giao dịch hoàn tất, nên mọi trình duyệt đang mở thấy ghế đổi màu ngay. Lượt giữ có hạn 5 phút, hết hạn thì ghế tự trả lại.

**Slide 15 – Chống bán trùng ghế** · Vũ Đức Huy · 35 giây
> Khi hai người cùng bấm một ghế, câu lệnh cập nhật chỉ thành công nếu ghế còn trống. Khóa dòng khiến người đến sau phải chờ, rồi nhận lỗi ghế đã bị giữ. Lớp bảo vệ thứ hai là chỉ mục duy nhất: mỗi ghế của một sự kiện chỉ có một lượt giữ còn hiệu lực.

**Slide 16 – Nhật ký thay đổi giá** · Vũ Đức Huy · 25 giây
> Mọi lần đổi giá đều được ghi lại: ai đổi, lúc nào, từ giá nào sang giá nào. Trigger trong PostgreSQL chặn mọi lệnh sửa và xóa trên bảng này, kể cả với quản trị viên. Phần demo sẽ cho thấy lệnh xóa bị từ chối.

### Phần 5. Định giá, thanh toán, trợ lý ảo

**Slide 17 – Định giá động: dữ liệu đầu vào và công thức** · Nguyễn Anh Dũng · 55 giây
> Định giá động dựa trên ba dữ liệu của từng khu: tốc độ bán trong 15 phút gần nhất so với tốc độ mục tiêu, số người trong phòng chờ, và tỉ lệ ghế đang được giữ. Từ đó tính chỉ số áp lực cầu α. Nếu α lớn hơn 1, tức là bán nhanh hơn kế hoạch, giá đề xuất tăng; nhỏ hơn 1 thì giảm. Mỗi lần điều chỉnh tối đa 20%, làm tròn đến 10.000 đồng và luôn nằm trong khoảng sàn – trần; lệch dưới 5% thì bỏ qua. Đây chỉ là đề xuất, Ban Tổ chức duyệt thì giá mới áp dụng.

**Slide 18 – Định giá động trên giao diện** · Nguyễn Anh Dũng · 45 giây
> Ban Tổ chức thấy dữ liệu đầu vào của từng khu, giá hiện tại so với giá đề xuất và lịch sử giá, rồi bấm duyệt hoặc từ chối. Sau khi duyệt, giá trên sơ đồ ghế của khán giả đổi ngay và khu đó có nhãn báo tăng hoặc giảm. Phần demo sẽ cho thấy toàn bộ chuỗi này với dữ liệu thật.

**Slide 19 – Thanh toán qua VNPay** · Nguyễn Đức Phúc · 40 giây
> Sau khi giữ ghế, khách tạo đơn; giá được tính lại ở máy chủ, cộng phí dịch vụ 3%. Khách được chuyển sang trang VNPay. Chỉ khi VNPay báo kết quả về máy chủ và chữ ký hợp lệ thì ghế mới chuyển sang đã bán và vé được phát. Nhóm đang dùng môi trường thử của VNPay, không có tiền thật.

**Slide 20 – Trợ lý ảo hỗ trợ đặt vé** · Vũ Đức Huy · 40 giây
> Trợ lý ảo trả lời khán giả về lịch diễn, giá, khu còn chỗ và cách đặt vé. Ban Tổ chức có thể hỏi nhanh doanh số các sự kiện của mình. Mô hình ngôn ngữ chạy trên máy của nhóm. Vì mô hình nhỏ dễ trả lời sai, nhóm chỉ để mô hình xác định loại câu hỏi; mọi con số đều lấy từ cơ sở dữ liệu.

**Slide 21 – Vé QR xoay vòng và soát vé ngoại tuyến** · Lê Đức Anh · 40 giây
> Đây là hướng phát triển ở Sprint 5. Mã QR trên vé đổi sau mỗi 30 giây, nên ảnh chụp màn hình cũ không dùng được. Nhân viên quét vé bằng camera điện thoại; khi mất mạng, máy quét vẫn tự kiểm tra và đồng bộ lại khi có mạng.

**Slide 22 – Bảng doanh thu cho Ban lãnh đạo** · Nguyễn Đức Phúc · 25 giây
> Cũng ở Sprint 5, Ban lãnh đạo sẽ theo dõi doanh thu và tỉ lệ lấp đầy trên điện thoại. Số liệu cập nhật chậm nhất 60 giây và xuất được báo cáo ra Excel.

### Phần 6. Kiểm thử và kết luận

**Slide 23 – Kiểm thử tải trên bản chạy thật** · Nguyễn Anh Dũng · 55 giây
> Nhóm dùng k6 chạy trên bản thật trong ba phút rưỡi: 200 người xem và 100 người giữ, trả ghế cùng lúc. Hệ thống xử lý hơn 28 nghìn yêu cầu; thời gian phản hồi p95 là 342 mili giây khi xem và 296 mili giây khi giữ ghế, không có lỗi. Khi cho 100 tài khoản cùng giữ một ghế, đúng một tài khoản thành công.

**Slide 24 – Kiểm thử người dùng** · Đinh Tiến Thành · 40 giây
> Với kiểm thử người dùng, nhóm mời 5 đến 8 bạn trong lớp làm bốn nhiệm vụ: đăng nhập, giữ ghế, thanh toán thử và xem vé. Sau đó các bạn điền phiếu SUS ngay trong ứng dụng; Ban Tổ chức xem được điểm SUS, tỉ lệ hoàn thành và góp ý. Kết quả sẽ được cập nhật vào báo cáo sau buổi kiểm thử.

**Slide 25 – Kế hoạch và tiến độ theo sprint** · Nguyễn Đức Phúc · 40 giây
> Dự án chia năm sprint trong 12 tuần, ước lượng 472 giờ công. Sprint 1 và Sprint 2 đã xong. Nhóm làm sớm một số phần của các sprint sau: trợ lý ảo của Sprint 3 và thanh toán VNPay ở môi trường thử của Sprint 4. Sprint 5 gồm soát vé, bảng doanh thu và báo cáo, hiện chưa làm. Bảng phân rã công việc và giờ công từng người có trong bảng 14 và bảng 15 của báo cáo.

**Slide 26 – Hạn chế và bài học** · Nguyễn Đức Phúc · 45 giây
> Hệ thống còn một số hạn chế: chưa có SMS thật, thanh toán ở môi trường thử và chưa hoàn tiền tự động, chưa có soát vé và bảng doanh thu, và chỉ chạy trên một máy ảo. Bài học lớn nhất của nhóm là tận dụng tốt PostgreSQL giúp hệ thống vừa đơn giản vừa an toàn, phân lớp BCE giúp dễ kiểm thử, và cờ tính năng giúp nghiệm thu từng sprint.

**Slide 27 – Cảm ơn** · Vũ Đức Huy · 10 giây
> Phần trình bày của nhóm đến đây là hết. Em cảm ơn cô và các bạn đã lắng nghe, mời cô xem phần demo.

---

## Demo

Video demo quay trên bản chạy thật, chia thành từng bước.
Mỗi slide demo phát đúng đoạn của bước đó.
Nếu mạng ổn định, có thể demo trực tiếp thay cho video.

| Bước | Nội dung | Người thuyết minh |
|---|---|---|
| Khách hàng | Hai khách đăng nhập và cùng mở khu SVIP. Khách A giữ ghế, màn hình khách B đổi màu ngay. B bấm cùng ghế thì bị từ chối. A trả ghế, B thấy ghế trống lại. | Trần Trung Nhân |
| Trợ lý ảo | Khách B hỏi khu nào của concert Mỹ Tâm còn vé và cách đặt vé. Số liệu lấy từ cơ sở dữ liệu. | Vũ Đức Huy |
| Ứng dụng OTP | Mở ứng dụng COSH301 OTP từ màn hình chính, đăng nhập web bằng số điện thoại, mã hiện trong thông báo. | Trần Trung Nhân |
| Thanh toán | Khách C xem vé đã mua qua VNPay. Khách B giữ ghế và chuyển sang trang VNPay (môi trường thử). | Trần Trung Nhân |
| Ban Tổ chức | Đặt giá sai bị chặn, đặt giá đúng thì lưu; khách B thấy giá mới ngay. | Nguyễn Anh Dũng |
| Kiểm thử tải | k6 tạo tải thật lên khu VieVIP trong 45 giây; dữ liệu đầu vào của khu thay đổi theo. | Nguyễn Anh Dũng |
| Định giá động | Ban Tổ chức chạy lại phân tích, giá đề xuất tăng 20%, duyệt; khách B nhận thông báo và nhãn "Giá vừa tăng". | Nguyễn Anh Dũng |
| Tranh một ghế | 100 tài khoản cùng giữ một ghế, đúng 1 tài khoản thành công. | Nguyễn Anh Dũng |
| Nhật ký giá | Xem nhật ký giá, lệnh xóa bị từ chối. | Vũ Đức Huy |
| Khảo sát | Phiếu khảo sát SUS ngay trong ứng dụng. | Đinh Tiến Thành |

---

## Câu hỏi phản biện thường gặp

**Câu 1. Vì sao không dùng Redis để giữ ghế?** – Vũ Đức Huy
> Redis hợp với hệ thống đã phải chạy phân tán. Nếu giữ ghế ở Redis còn dữ liệu bán vé ở PostgreSQL thì hai nơi có thể lệch nhau, ví dụ Redis báo ghế trống nhưng cơ sở dữ liệu đã bán. PostgreSQL có sẵn khóa dòng, chỉ mục duy nhất một phần và kênh thông báo LISTEN/NOTIFY chạy trong cùng giao dịch, nên chỉ có một nguồn dữ liệu. Với quy mô của đồ án, cách này đủ dùng; nhóm chưa đo ở mức hàng chục nghìn người dùng.

**Câu 2. Tiến trình quét lượt giữ hết hạn 5 giây một lần có làm chậm cơ sở dữ liệu không?** – Vũ Đức Huy
> Câu quét chỉ đọc các lượt giữ còn hiệu lực đã quá hạn, và có chỉ mục riêng cho đúng các lượt này nên rất nhẹ. Nếu ghế vừa hết hạn mà chưa được quét, người khác vẫn giữ được ngay: trong cùng một giao dịch, lượt cũ bị hủy và lượt mới được tạo.

**Câu 3. Định giá động dễ gây tranh cãi, vì sao nhóm vẫn làm?** – Nguyễn Anh Dũng
> Nhóm làm định giá động theo hướng chỉ đề xuất. Hệ thống không tự đổi giá; Ban Tổ chức xem dữ liệu đầu vào và giá đề xuất rồi mới duyệt. Giá luôn nằm trong khoảng sàn – trần, mỗi lần thay đổi tối đa 20%, lệch dưới 5% thì bỏ qua, và mọi thay đổi được ghi vào nhật ký không sửa được. Nhóm chưa có thực nghiệm về phản ứng của người mua nên không đưa số liệu về mặt này.

**Câu 4. Sơ đồ ghế dùng SSE hay WebSocket, vì sao?** – Trần Trung Nhân
> Nhóm dùng SSE vì sơ đồ ghế chỉ cần máy chủ gửi thông báo xuống trình duyệt, không cần chiều ngược lại. SSE chạy trên HTTP thông thường, tự kết nối lại khi mất mạng và đi qua nginx, Cloudflare dễ dàng.

**Câu 5. Phần nào đã chạy, phần nào chưa?** – Trần Trung Nhân
> Đã chạy trên bản thật: xem sự kiện, sơ đồ ghế thời gian thực, giữ ghế, chống bán trùng, đăng nhập OTP, giá sàn – giá trần, định giá động có người duyệt, thanh toán VNPay ở môi trường thử, trợ lý ảo và phiếu khảo sát người dùng. Chưa làm: phòng chờ ảo, chặn bot, mã QR xoay vòng, soát vé và bảng doanh thu. Phần chưa làm được tắt bằng cờ tính năng, API trả 404.

**Câu 6. Thanh toán có an toàn không, nếu ai đó giả kết quả thanh toán thì sao?** – Trần Trung Nhân
> Máy chủ chỉ tin thông báo do VNPay gửi về. Máy chủ kiểm tra chữ ký HMAC-SHA512 bằng khóa bí mật chỉ nó biết, đồng thời đối chiếu mã cửa hàng và số tiền. Trang mà trình duyệt quay về sau khi thanh toán chỉ hiển thị kết quả, không thể tự xác nhận đơn. Nếu VNPay gửi lại cùng một thông báo, máy chủ không xử lý lần hai.

**Câu 7. Trợ lý ảo trả lời sai thì sao?** – Vũ Đức Huy
> Mô hình chỉ được dùng để hiểu câu hỏi thuộc loại nào. Tên sự kiện, ngày, giá và số ghế đều do máy chủ lấy từ cơ sở dữ liệu rồi ghép vào câu trả lời. Khi mô hình lỗi hoặc chậm, hệ thống chuyển sang nhận diện bằng từ khóa. Trợ lý cũng chỉ trả lời trong phạm vi quyền của người hỏi.

**Câu 8. Ứng dụng OTP có thay được SMS không?** – Trần Trung Nhân
> Chưa. Ứng dụng giúp demo đúng luồng nhận mã qua thiết bị, nhưng số điện thoại do ứng dụng gửi lên chưa chứng minh được người dùng là chủ số. Bản chính thức cần SMS thật, hoặc một bước ghép cặp thiết bị sau khi đã đăng nhập.
