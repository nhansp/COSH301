# Bảng đặc tả yêu cầu và ma trận truy vết (Requirements Specification & Traceability Matrix)

Tài liệu chuẩn hóa toàn bộ các Yêu cầu Chức năng (**FR-01 … FR-23**), Yêu cầu Phi chức năng (**NFR-01 … NFR-13**) và các hạng mục hoãn lại (**W-01 … W-05**) của hệ thống **EventTicketing**, theo đúng mã định danh đã thống nhất trong tài liệu phân tích hệ thống (SA) và thiết kế hệ thống ([`docs/design/README.md`](design/README.md)).

---

## 1. Yêu cầu Chức năng (Functional Requirements - FR)

Mỗi yêu cầu chức năng được liên kết trực tiếp với cờ tính năng (`feature_flag`), profile Sprint và trạng thái triển khai:
- **Xong:** Đã hoàn thiện kiến trúc cơ sở dữ liệu, API backend Go, giao diện frontend và kiểm thử.
- **Đang làm:** Đã hoàn thiện schema và dịch vụ lõi, đang hoàn thiện tích hợp mở rộng.
- **Chưa làm:** Nằm trong backlog của các sprint tiếp theo.

| Mã | Tên yêu cầu | Mô tả chi tiết | Cờ tính năng (`flag`) | Sprint | Trạng thái |
|---|---|---|---|:---:|:---:|
| **FR-01** | Đăng nhập tài khoản bằng OTP | Xác thực người dùng bằng mã OTP 6 số gửi qua Email hoặc SMS, tự động tạo tài khoản nếu chưa tồn tại. | `otp_login` | 2 | **Xong** |
| **FR-02** | Khám phá & danh sách sự kiện | Hiển thị danh sách sự kiện đang mở bán, lọc theo thể loại, thành phố, ngày diễn ra và khoảng giá. | *(Luôn bật)* | 1 | **Xong** |
| **FR-03** | Sơ đồ ghế trực quan tương tác | Hiển thị ma trận ghế theo khu vực với 4 màu chuẩn: Xanh (Trống), Tím (Mình đang giữ), Vàng (Người khác giữ), Xám (Đã bán). | `seat_map_realtime` | 2 | **Xong** |
| **FR-04** | Đăng nhập an toàn không mật khẩu | Quản lý phiên bằng `sessions` trên máy chủ, hỗ trợ đăng xuất và lấy thông tin tài khoản hiện tại qua `/api/auth/me`. | `otp_login` | 2 | **Xong** |
| **FR-05** | Đồng bộ sơ đồ ghế thời gian thực | Cập nhật trạng thái ghế đến tất cả trình duyệt trong $\le 3$ giây thông qua Server-Sent Events (SSE) và `pg_notify`. | `seat_map_realtime` | 2 | **Xong** |
| **FR-06** | Giữ ghế độc quyền 5 phút | Khóa ghế nguyên tử trong 300 giây, hiển thị đồng hồ đếm ngược; tự động giải phóng ghế nếu quá giờ chưa thanh toán. | `seat_hold` | 2 | **Xong** |
| **FR-07** | Chống bán trùng ghế tuyệt đối | Sử dụng khóa hàng có điều kiện nguyên tử và chỉ mục một phần `seat_holds (status = 'ACTIVE')` đảm bảo zero double-booking. | `seat_hold` | 2 | **Xong** |
| **FR-08** | Cấu hình khu vực & giá sàn/trần | Ban Tổ chức thiết lập thông tin địa điểm, khu vực khán đài, giá vé cơ bản, giá sàn và giá trần ($P_{\text{floor}} \le P_{\text{base}} \le P_{\text{ceiling}}$). | `zone_pricing`, `organizer_console` | 2 | **Xong** |
| **FR-09** | Phòng chờ ảo (Virtual Waiting Room) | Tự động đưa người dùng vào hàng chờ khi lưu lượng vượt `waiting_room_capacity`, hiển thị số thứ tự và thời gian chờ ước tính. | `waiting_room` | 3 | **Đang làm** |
| **FR-10** | Chặn bot tự động | Tích hợp Cloudflare Turnstile để xác thực tương tác người thật trước khi gửi OTP hoặc giữ ghế. | `bot_check` | 3 | **Đang làm** |
| **FR-11** | Giới hạn số vé mỗi tài khoản | Kiểm tra tổng số ghế đang giữ và số vé đã mua của tài khoản, giới hạn tối đa 4 vé/sự kiện nhằm ngăn chặn đầu cơ. | `ticket_limit` | 3 | **Xong** |
| **FR-12** | Mã QR động xoay vòng | Mã QR vé số hóa tự động đổi mỗi 30 giây bằng thuật toán HMAC (`qr_secret`, `step`), vô hiệu hóa hoàn toàn ảnh chụp màn hình. | `rotating_qr` | 3 | **Đang làm** |
| **FR-13** | Thanh toán trực tuyến đa kênh | Tích hợp cổng thanh toán MoMo và VNPAY, xử lý xác nhận giao dịch qua Webhook/IPN có kiểm tra chữ ký số an toàn. | `payments` | 4 | **Đang làm** |
| **FR-14** | Phát hành vé điện tử tức thì | Tự động tạo vé trong cơ sở dữ liệu và gửi thông tin vé qua Email ngay khi giao dịch thanh toán thành công. | `ticket_email` | 4 | **Đang làm** |
| **FR-15** | Tự động đối soát & hoàn tiền | Tự động phát hiện giao dịch thanh toán chậm khi ghế đã hết hạn giữ chỗ: cấp vé nếu ghế còn trống hoặc hoàn tiền tự động. | `reconciliation` | 4 | **Chưa làm** |
| **FR-16** | Ứng dụng soát vé tại cổng | Cung cấp giao diện di động cho nhân viên soát vé quét mã QR qua camera, phản hồi tức thì kết quả. | `gate_checkin` | 5 | **Chưa làm** |
| **FR-17** | Chống sử dụng vé hai lần | Kiểm tra trạng thái vé nguyên tử trong cơ sở dữ liệu (`status = 'ISSUED' \rightarrow 'USED'`), cảnh báo vé đã sử dụng kèm thời gian và cổng quét. | `gate_checkin` | 5 | **Chưa làm** |
| **FR-18** | Soát vé ngoại tuyến (Offline Check-in) | Cho phép thiết bị quét vé tải danh sách vé cục bộ để xác thực chữ ký khi mất mạng; đồng bộ dữ liệu quét khi có kết nối lại. | `offline_checkin` | 5 | **Chưa làm** |
| **FR-19** | Dashboard doanh thu thời gian thực | Màn hình dành cho CEO hiển thị doanh thu, số vé đã bán và tỷ lệ lấp đầy theo thời gian thực (phút/giờ). | `ceo_dashboard` | 5 | **Chưa làm** |
| **FR-20** | Nhật ký thay đổi giá bất biến | Lưu vết toàn bộ các lần thay đổi giá trong bảng `price_changes`, kích hoạt trigger cấm sửa và cấm xóa dữ liệu lịch sử. | `price_log` | 5 | **Xong** |
| **FR-21** | Xuất báo cáo tài chính tổng hợp | Hỗ trợ xuất dữ liệu bán vé, doanh thu chi tiết theo sự kiện và khu vực ra file định dạng CSV và Excel (XLSX). | `reports_export` | 5 | **Chưa làm** |
| **FR-22** | Thuật toán định giá động | Định kỳ 5 phút tính toán cung - cầu, đề xuất giá vé mới cho BTC phê duyệt; làm tròn 10.000 VNĐ và nằm trong [giá sàn, giá trần]. | `dynamic_pricing` | 5 | **Đang làm** |
| **FR-23** | Gợi ý chương trình khuyến mãi | Hệ thống phân tích tỷ lệ lấp đầy và đề xuất các mã giảm giá cho các khu vực bán chậm. | `promo_suggestions` | 5 | **Chưa làm** |

---

## 2. Yêu cầu Phi chức năng (Non-Functional Requirements - NFR)

| Mã | Phân nhóm tiêu chuẩn | Định nghĩa yêu cầu | Chỉ số đo lường định lượng (SLA / Metric) | Giải pháp kỹ thuật áp dụng | Trạng thái |
|---|---|---|---|---|:---:|
| **NFR-01** | Hiệu năng & Khả năng chịu tải | Chịu tải cao tại thời điểm mở bán sự kiện lớn | Chịu $\ge 50.000$ kết nối đồng thời; thời gian phản hồi (Latency) p95 $\le 2$ giây | Go HTTP engine hiệu năng cao, Connection Pooling với `pgx/v5`, Nginx reverse proxy | **Đạt** |
| **NFR-02** | Độ sẵn sàng (Availability) | Hệ thống duy trì hoạt động liên tục trong giờ cao điểm | Uptime $\ge 99.9\%$ trong khung giờ mở bán; thời gian phục hồi (RTO) $\le 5$ phút | Docker Compose containerization, health-checks định kỳ tại `/api/health` | **Đạt** |
| **NFR-03** | Tính toàn vẹn dữ liệu | Không bao giờ xảy ra tình trạng bán trùng ghế | $0$ (zero) trường hợp double-booking; giao dịch đạt chuẩn ACID | Khóa có điều kiện nguyên tử, PostgreSQL partial unique index `seat_holds` | **Đạt** |
| **NFR-04** | Nhất quán thanh toán | Bảo vệ giao dịch, chống trừ tiền mà không cấp vé | 100% giao dịch lỗi được đối soát xử lý trong $\le 15$ phút; tỷ lệ khiếu nại $< 0.1\%$ | Idempotency key trên `provider_txn_id`, đối soát bất đồng bộ tự động | **Đang làm** |
| **NFR-05** | Tốc độ quét vé | Soát vé nhanh chóng tại cổng ra vào | Thời gian xác thực 1 mã vé $\le 1$ giây (cả online và offline) | Xác thực HMAC SHA-256 đối xứng cực nhanh, truy vấn chỉ mục `tickets(code)` | **Chưa làm** |
| **NFR-06** | Khả năng phục hồi ngoại tuyến | Hoạt động soát vé độc lập khi mất kết nối Internet | Thiết bị quét hoạt động offline liên tục $\ge 4$ giờ; đồng bộ lại $\le 2$ phút khi có mạng | Cache danh sách vé cục bộ trên PWA / IndexedDB, lưu log quét offline | **Chưa làm** |
| **NFR-07** | An toàn & Chống Bot | Ngăn chặn các công cụ mua vé tự động (bot scalpers) | Tỷ lệ giao dịch bot lọt qua $< 1\%$; chặn $\ge 99\%$ request bất thường | Cloudflare Turnstile CAPTCHA vô hình, rate-limiting IP/tài khoản | **Đang làm** |
| **NFR-08** | Bảo mật vé điện tử | Ngăn ngừa việc chia sẻ vé lậu hoặc chụp màn hình | Mã QR đổi mới chu kỳ $\le 30$ giây; vé chụp màn hình quá hạn bị từ chối 100% | TOTP / HMAC sinh mã động phụ thuộc thời gian và `qr_secret` | **Đang làm** |
| **NFR-09** | Trải nghiệm Hàng chờ | Hàng chờ ảo minh bạch thông tin | Cập nhật số thứ tự xếp hàng và thời gian chờ ước tính định kỳ $\le 10$ giây/lần | SSE stream sự kiện vị trí hàng chờ từ bảng `queue_entries` | **Đang làm** |
| **NFR-10** | Trực quan hóa Sơ đồ ghế | Đồng bộ trạng thái ghế tức thì giữa các người dùng | Trạng thái ghế phản ánh đến trình duyệt trong $\le 3$ giây; quy ước 4 màu đồng nhất | PostgreSQL `LISTEN/NOTIFY` đẩy qua Go SSE hub trực tiếp tới client | **Đạt** |
| **NFR-11** | Giám sát Realtime CEO | Độ trễ hiển thị số liệu doanh thu trên Dashboard | Độ trễ cập nhật chỉ số bán vé lên dashboard di động $\le 60$ giây | Truy vấn tối ưu trên bảng `orders` và bảng `payments`, cache thống kê | **Chưa làm** |
| **NFR-12** | Tính bất biến & Kiểm toán | Lịch sử thay đổi giá và giao dịch minh bạch | 100% thay đổi giá vé được lưu trữ bất biến (immutable), cấm sửa/xóa, lưu $\ge 2$ năm | PostgreSQL Trigger chặn `UPDATE` và `DELETE` trên bảng `price_changes` | **Đạt** |
| **NFR-13** | Tuân thủ bảo mật dữ liệu | Bảo vệ dữ liệu người dùng và thông tin thẻ tín dụng | Tuân thủ Nghị định 13/2023/NĐ-CP và tiêu chuẩn PCI-DSS không lưu thẻ | Không lưu thông tin thẻ trên máy chủ (chuyển giao hoàn toàn cho MoMo/VNPAY) | **Đạt** |

---

## 3. Các hạng mục hoãn lại (Won't-Have / Out of Scope)

Theo biên bản thống nhất với các Stakeholders (`SH-01` Ban Tổ chức và `SH-02` CEO), các tính năng sau được ghi nhận nhưng **không triển khai trong phạm vi đồ án hiện tại**:

| Mã | Tên hạng mục | Lý do hoãn lại theo tài liệu SA |
|---|---|---|
| **W-01** | AI tự động áp dụng giá mới không cần người duyệt | Nguy cơ pháp lý và phản ứng tiêu cực của dư luận; mọi thay đổi giá bắt buộc phải có Ban Tổ chức phê duyệt (`FR-22`). |
| **W-02** | Sàn giao dịch bán lại vé chính thức (Resale Marketplace) | Quy trình pháp lý và đối soát chuyển nhượng phức tạp; ưu tiên xử lý phân phối vé gốc ở giai đoạn này. |
| **W-03** | eKYC toàn diện bằng CCCD và sinh trắc học | Gây ma sát lớn cho trải nghiệm mua vé của khán giả; xác thực OTP (`FR-01`) đủ đáp ứng định danh người dùng thật. |
| **W-04** | Sơ đồ khán đài không gian 3D tương tác | Đòi hỏi tài nguyên đồ họa nặng và chi phí triển khai cao; sơ đồ 2D trực quan (`FR-03`) đã đáp ứng trọn vẹn nghiệp vụ chọn ghế. |
| **W-05** | Thanh toán đa tiền tệ & hỗ trợ ngôn ngữ quốc tế | Thị trường mục tiêu trọng tâm là các sự kiện văn hóa, thể thao và giải trí nội địa tại Việt Nam. |
