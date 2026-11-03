# Sơ đồ luồng dữ liệu (Data Flow Diagram - DFD)

Tài liệu đặc tả Sơ đồ luồng dữ liệu (DFD) cho hệ thống **EventTicketing**, bao gồm:
1. **DFD Mức ngữ cảnh (Context Diagram / Level 0)**
2. **DFD Mức 0 (Diagram 0)**
3. **DFD Mức 1 (Diagram 1)** cho hai phân hệ cốt lõi: Quản lý Giữ chỗ / Chống bán trùng và Quản lý Thanh toán / Phát hành vé.
4. **Bảng ánh xạ kho dữ liệu (Data Stores)** khớp 100% với các bảng cơ sở dữ liệu PostgreSQL đã chuẩn hóa trong ERD ([`docs/erd.md`](erd.md)).

---

## 1. DFD Mức ngữ cảnh (Context Diagram)

Sơ đồ thể hiện ranh giới hệ thống **EventTicketing**, tương tác luồng dữ liệu hai chiều với 5 tác nhân người dùng nội bộ và 3 hệ sinh thái bên ngoài (theo Mục 2 của [`docs/design/README.md`](design/README.md)).

```mermaid
flowchart TD
    subgraph ExternalEntities["Tác nhân ngoài (External Entities)"]
        Customer["Khán giả (CUSTOMER)"]
        Organizer["Ban Tổ chức (ORGANIZER)"]
        CEO["Giám đốc điều hành (CEO)"]
        GateStaff["Nhân viên cổng (GATE_STAFF)"]
        Admin["Quản trị viên (ADMIN)"]
        PaymentGateway["Cổng thanh toán (MoMo / VNPAY)"]
        OTPService["Dịch vụ gửi OTP (SMTP / SMS Gateway)"]
        Turnstile["Cloudflare Turnstile (Chống Bot)"]
    end

    System(("0.0<br/>Hệ thống Quản lý Bán vé Sự kiện<br/>(EventTicketing)"))

    %% Customer flows
    Customer -->|"Yêu cầu OTP, token Captcha, thông tin tài khoản"| System
    Customer -->|"Lệnh xếp hàng, yêu cầu giữ ghế, yêu cầu tạo đơn"| System
    Customer -->|"Yêu cầu xem vé, mã QR động"| System
    System -->|"Mã OTP xác thực, vị trí hàng chờ, sơ đồ ghế realtime"| System
    System -->|"Xác nhận giữ chỗ (5 phút), link thanh toán, vé điện tử"| Customer

    %% Organizer flows
    Organizer -->|"Thông tin địa điểm, khu vực, cấu hình giá sàn/trần"| System
    Organizer -->|"Quyết định duyệt / từ chối đề xuất giá động"| System
    System -->|"Báo cáo tình trạng bán, đề xuất giá động từ thuật toán"| Organizer

    %% CEO flows
    CEO -->|"Yêu cầu xem dashboard doanh thu, bộ lọc báo cáo"| System
    System -->|"Chỉ số doanh thu realtime, tỷ lệ lấp đầy, file báo cáo (CSV/XLSX)"| CEO

    %% GateStaff flows
    GateStaff -->|"Mã QR quét tại cổng, dữ liệu check-in offline đồng bộ"| System
    System -->|"Kết quả xác thực vé (Hợp lệ, Đã dùng, Không hợp lệ)"| GateStaff

    %% Admin flows
    Admin -->|"Phân quyền tài khoản, cấu hình hệ thống"| System
    System -->|"Nhật ký kiểm toán (Audit logs)"| Admin

    %% External Systems
    System -->|"Yêu cầu gửi OTP (SĐT / Email)"| OTPService
    OTPService -->|"Trạng thái gửi tin (Thành công / Lỗi)"| System

    System -->|"Token Turnstile cần xác thực"| Turnstile
    Turnstile -->|"Kết quả đánh giá Bot (Pass / Fail)"| System

    System -->|"Yêu cầu khởi tạo giao dịch thanh toán"| PaymentGateway
    PaymentGateway -->|"Thông báo kết quả giao dịch (Webhook / IPN)"| System
```

---

## 2. DFD Mức 0 (Diagram 0)

Phân rã hệ thống thành 6 tiến trình nghiệp vụ chính và ánh xạ các luồng dữ liệu vào 14 kho dữ liệu (Data Stores) tương ứng các bảng PostgreSQL.

```mermaid
flowchart TD
    %% Entities
    C["Khán giả"]
    O["Ban Tổ chức"]
    G["Nhân viên cổng"]
    E_Pay["Cổng thanh toán"]
    E_OTP["Dịch vụ OTP"]

    %% Data Stores
    D1[("D1: users")]
    D2[("D2: sessions")]
    D3[("D3: otp_verifications")]
    D4[("D4: events & venues & zones")]
    D5[("D5: event_seats")]
    D6[("D6: seat_holds")]
    D7[("D7: queue_entries")]
    D8[("D8: orders & order_items")]
    D9[("D9: payments")]
    D10[("D10: tickets")]
    D11[("D11: checkin_logs")]
    D12[("D12: price_suggestions & price_changes")]

    %% Processes
    P1(("1.0<br/>Định danh &<br/>Xác thực OTP"))
    P2(("2.0<br/>Quản trị Sự kiện &<br/>Định giá Khu vực"))
    P3(("3.0<br/>Điều phối Hàng chờ<br/>(Virtual Queue)"))
    P4(("4.0<br/>Quản lý Sơ đồ ghế &<br/>Giữ chỗ 5 phút"))
    P5(("5.0<br/>Xử lý Đơn hàng &<br/>Thanh toán"))
    P6(("6.0<br/>Soát vé tại Cổng &<br/>Đồng bộ Offline"))
    P7(("7.0<br/>Thuật toán Định giá &<br/>Báo cáo Doanh thu"))

    %% Flows P1
    C -->|"SĐT / Email, OTP"| P1
    P1 -->|"Lệnh gửi mã"| E_OTP
    P1 <-->|"Lưu / Xác thực mã"| D3
    P1 <-->|"Kiểm tra / Tạo tài khoản"| D1
    P1 -->|"Tạo token phiên"| D2
    P1 -->|"Session Token"| C

    %% Flows P2
    O -->|"Thông tin sự kiện, giá sàn/trần"| P2
    P2 -->|"Lưu sự kiện & khu vực"| D4
    P2 -->|"Sinh danh sách ghế"| D5

    %% Flows P3
    C -->|"Vào hàng chờ"| P3
    P3 <-->|"Ghi nhận lượt xếp hàng"| D7
    P3 -->|"Cấp quyền vào chọn ghế"| C

    %% Flows P4
    C -->|"Chọn ghế trống"| P4
    P4 <-->|"Khóa dòng ghế, cập nhật HELD"| D5
    P4 <-->|"Ghi nhận giữ chỗ 5 phút"| D6
    P4 -->|"Sơ đồ ghế realtime (SSE)"| C

    %% Flows P5
    C -->|"Tạo đơn & Thanh toán"| P5
    P5 <-->|"Tạo đơn hàng từ hold"| D8
    P5 -->|"Tạo giao dịch cổng"| E_Pay
    E_Pay -->|"IPN / Webhook"| P5
    P5 <-->|"Ghi nhận thanh toán"| D9
    P5 -->|"Cập nhật ghế SOLD"| D5
    P5 -->|"Chuyển hold CONVERTED"| D6
    P5 -->|"Phát hành vé"| D10

    %% Flows P6
    G -->|"Quét mã QR vé"| P6
    P6 <-->|"Xác thực vé & Khóa vé USED"| D10
    P6 -->|"Ghi nhật ký quét vé"| D11
    P6 -->|"Kết quả soát vé"| G

    %% Flows P7
    D5 -.->|"Thống kê lấp đầy"| P7
    D7 -.->|"Độ dài hàng chờ"| P7
    D8 -.->|"Tốc độ bán vé"| P7
    P7 -->|"Đề xuất giá mới"| D12
    D12 -->|"Hiển thị đề xuất"| O
    O -->|"Duyệt đổi giá"| P7
    P7 -->|"Cập nhật giá ghế chưa bán"| D5
```

---

## 3. DFD Mức 1: Phân hệ Quản lý Sơ đồ ghế & Giữ chỗ 5 phút (Process 4.0)

Phân hệ xử lý giữ chỗ có điều kiện nguyên tử, quản lý thời gian đếm ngược và chống bán trùng ghế (`FR-06`, `FR-07`, `FR-11`).

```mermaid
flowchart TD
    Customer["Khán giả (CUSTOMER)"]
    ReaperWorker["HoldReaper (Background Job)"]

    subgraph DataStores["Kho dữ liệu PostgreSQL"]
        D1[("D1: users")]
        D5[("D5: event_seats")]
        D6[("D6: seat_holds")]
        D10[("D10: tickets")]
    end

    P41(("4.1<br/>Lấy trạng thái<br/>Sơ đồ ghế"))
    P42(("4.2<br/>Kiểm tra Hạn mức<br/>(Ticket Limit)"))
    P43(("4.3<br/>Khóa ghế Nguyên tử<br/>& Tạo Hold"))
    P44(("4.4<br/>Phát tín hiệu Realtime<br/>(SSE Broadcast)"))
    P45(("4.5<br/>Thu hồi Lượt giữ<br/>Hết hạn (HoldReaper)"))

    %% Query seat map
    Customer -->|"Truy cập sơ đồ ghế"| P41
    D5 -->|"Đọc trạng thái ghế (AVAILABLE/HELD/SOLD)"| P41
    P41 -->|"Dữ liệu ma trận ghế"| Customer

    %% Hold request
    Customer -->|"Bấm chọn ghế trống (POST /api/holds)"| P42
    P42 <-->|"Đếm active holds & tickets (tối đa 4)"| D6
    P42 <-->|"Kiểm tra vé đã mua"| D10
    P42 -->|"Hợp lệ (< 4 vé)"| P43
    P42 -.->|"Vượt quá giới hạn"| Customer

    %% Atomic lock & hold
    P43 <-->|"UPDATE status='HELD' WHERE status='AVAILABLE'"| D5
    P43 -->|"INSERT seat_holds (status='ACTIVE', expires_at=now()+5m)"| D6
    P43 -->|"Xác nhận giữ chỗ (201 Created)"| Customer
    P43 -->|"Kích hoạt sự kiện"| P44
    P44 -->|"SSE event 'seat_updated'"| Customer

    %% Auto release
    ReaperWorker -->|"Định kỳ kiểm tra expires_at <= now()"| P45
    P45 <-->|"Cập nhật status='EXPIRED'"| D6
    P45 <-->|"Hoàn trả status='AVAILABLE'"| D5
    P45 -->|"Báo nhả ghế"| P44
```

---

## 4. DFD Mức 1: Phân hệ Xử lý Đơn hàng & Thanh toán (Process 5.0)

Phân hệ xử lý tạo đơn hàng, đối soát IPN đa kênh và phát hành vé an toàn (`FR-13`, `FR-14`, `FR-15`).

```mermaid
flowchart TD
    Customer["Khán giả"]
    PaymentProvider["Cổng thanh toán (MoMo / VNPAY)"]

    subgraph DataStores["Kho dữ liệu"]
        D5[("D5: event_seats")]
        D6[("D6: seat_holds")]
        D8[("D8: orders & order_items")]
        D9[("D9: payments")]
        D10[("D10: tickets")]
    end

    P51(("5.1<br/>Khởi tạo Đơn hàng<br/>từ Ghế đang giữ"))
    P52(("5.2<br/>Tạo giao dịch<br/>Cổng thanh toán"))
    P53(("5.3<br/>Xử lý Webhook / IPN<br/>Đối soát Chữ ký"))
    P54(("5.4<br/>Phát hành Vé &<br/>Cập nhật Ghế SOLD"))

    Customer -->|"Xác nhận giỏ hàng"| P51
    P51 <-->|"Kiểm tra hold ACTIVE và còn hạn"| D6
    P51 -->|"Tạo bản ghi order (status='PENDING')"| D8
    P51 -->|"Mã đơn hàng"| P52

    P52 -->|"Gọi API tạo link thanh toán"| PaymentProvider
    PaymentProvider -->|"URL Cổng thanh toán"| Customer

    PaymentProvider -->|"IPN / Webhook báo kết quả giao dịch"| P53
    P53 <-->|"Kiểm tra idempotent (provider_txn_id)"| D9
    P53 -->|"Ghi nhận thanh toán (status='SUCCESS')"| D9
    P53 -->|"Cập nhật đơn (status='PAID')"| D8
    P53 -->|"Kích hoạt cấp vé"| P54

    P54 -->|"Tạo vé điện tử (qr_secret, mã vé)"| D10
    P54 -->|"Cập nhật trạng thái ghế sang 'SOLD'"| D5
    P54 -->|"Chuyển trạng thái hold sang 'CONVERTED'"| D6
    P54 -->|"Gửi vé qua email & mục Vé của tôi"| Customer
```

---

## 5. Bảng danh mục Kho dữ liệu (Data Stores Mapping)

Tất cả các kho dữ liệu trên sơ đồ DFD đều khớp chính xác với các bảng trong cơ sở dữ liệu PostgreSQL của hệ thống:

| Ký hiệu kho | Tên kho dữ liệu | Bảng PostgreSQL tương ứng | Mục đích lưu trữ chính |
|---|---|---|---|
| **D1** | Tài khoản & Khách hàng | `users` | Hồ sơ người dùng, số điện thoại, email, vai trò (`role`) |
| **D2** | Phiên đăng nhập | `sessions` | Quản lý token xác thực máy chủ, thời hạn phiên |
| **D3** | Xác thực OTP | `otp_verifications` | Mã băm OTP, đích đến (SĐT/Email), số lần thử |
| **D4** | Sự kiện & Khu vực | `events`, `venues`, `zones` | Thông tin sự kiện, địa điểm biểu diễn, cấu hình giá sàn/trần |
| **D5** | Trạng thái Ghế | `event_seats` | Tình trạng ghế (`AVAILABLE`, `HELD`, `SOLD`) trong từng sự kiện |
| **D6** | Nhật ký Giữ chỗ | `seat_holds` | Lịch sử giữ ghế 5 phút, trạng thái `ACTIVE`, `EXPIRED`, `CONVERTED` |
| **D7** | Hàng chờ ảo | `queue_entries` | Vị trí xếp hàng, trạng thái chờ, thời hạn vào mua |
| **D8** | Đơn hàng & Chi tiết | `orders`, `order_items` | Thông tin đơn hàng, tổng tiền thanh toán, danh sách vé |
| **D9** | Giao dịch Thanh toán | `payments` | Mã giao dịch cổng thanh toán (`provider_txn_id`), trạng thái đối soát |
| **D10** | Vé điện tử | `tickets` | Mã vé, `qr_secret`, trạng thái vé (`ISSUED`, `ACTIVE`, `USED`, `VOID`) |
| **D11** | Nhật ký Soát vé | `checkin_logs` | Lịch sử quét mã QR tại cổng, ghi nhận xung đột offline |
| **D12** | Đề xuất & Thay đổi giá | `price_suggestions`, `price_changes` | Đề xuất giá động thuật toán tính toán và lịch sử giá bất biến |
