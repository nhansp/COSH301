# Sơ đồ lớp theo BCE (Boundary — Control — Entity)

Sơ đồ lớp của backend, chia theo BCE như bài B05.
Mục 2 và 3 vẽ đúng code đang có trong `backend/internal/`.
Mục 5 liệt kê các lớp dự kiến chưa có trong code.

## 1. Phân lớp

- **Boundary** — `internal/httpapi`.
  Handler nhận request HTTP và SSE, đọc JSON, lấy phiên đăng nhập và trả JSON.
  Handler không gọi `store` trực tiếp, mọi truy cập dữ liệu đều qua service.
- **Control** — `internal/service`.
  Service giữ quy tắc nghiệp vụ và mở giao dịch với PostgreSQL.
  Khi ghế đổi trạng thái, service gửi `pg_notify` trong cùng giao dịch.
  `RealtimeHub` và `HoldReaper` chạy nền từ lúc api khởi động.
- **Entity** — `internal/store`.
  `sqlc` sinh struct từ schema trong `migrations/` và sinh hàm truy vấn từ `queries/`.
  Mỗi struct ứng với một bảng trong [ERD](erd.md).

Middleware trong `httpapi` không vẽ thành lớp, vì chúng là hàm bọc handler:
- `RequireFeature` trả `404 feature_disabled` khi cờ tắt;
- `RequireRole` chặn người dùng không đúng vai trò;
- `RateLimiter` giới hạn số lần gọi API OTP theo IP;
- `LoggingMiddleware`, `CORSMiddleware`.

Quy ước ghi trong sơ đồ:
- Kiểu trả về bỏ `error` và bỏ dấu con trỏ.
  Ví dụ `HoldSeat` trả `(*store.SeatHold, error)`, sơ đồ ghi `SeatHold`.
- `List~T~` là slice `[]T` của Go.
- Kiểu cột bỏ tiền tố `pgtype.`.
  `Text` là chuỗi cho phép `NULL`.
  `Numeric` là kiểu `numeric` của PostgreSQL, dùng cho tiền và tọa độ ghế.

## 2. Sơ đồ BCE của code hiện tại

```mermaid
classDiagram
    direction LR

    class SystemHandler {
        <<boundary>>
        -FeatureManager features
        -bool demoLogin
        +HandleHealth(w, r)
        +HandleFeatures(w, r)
    }

    class AuthHandler {
        <<boundary>>
        -AuthService authService
        -bool cookieSecure
        +HandleRequestOTP(w, r)
        +HandleVerifyOTP(w, r)
        +HandleDemoLogin(w, r)
        +HandleMe(w, r)
        +HandleLogout(w, r)
        -session(w, r) GetSessionByTokenHashRow, bool
    }

    class EventHandler {
        <<boundary>>
        -EventService eventService
        +HandleEvents(w, r)
        -handleEventDetail(w, r, identifier)
    }

    class SeatHandler {
        <<boundary>>
        -SeatService seatService
        -AuthService authService
        -EventService eventService
        +HandleEventSeats(w, r)
        +HandleHolds(w, r)
        +HandleMyHolds(w, r, sess)
    }

    class StreamHandler {
        <<boundary>>
        -RealtimeHub hub
        -EventService eventService
        +HandleEventStream(w, r)
    }

    class OrganizerHandler {
        <<boundary>>
        -OrganizerService organizer
        -EventService events
        +HandleListEvents(w, r, sess)
        +HandleSalesOverview(w, r, sess)
        +HandleEventSalesSummary(w, r, sess)
        +HandleUpdateZonePricing(w, r, sess)
        -writeErr(w, r, err)
    }

    class PaymentHandler {
        <<boundary>>
        -PaymentService payments
        -EventService events
        +HandleCreateOrder(w, r, sess)
        +HandleListOrders(w, r, sess)
        +HandleGetOrder(w, r, sess)
        +HandleInitiatePayment(w, r, sess)
        +HandlePaymentIPN(w, r)
        +HandlePaymentReturn(w, r)
    }

    class TicketHandler {
        <<boundary>>
        -TicketService tickets
        -EventService events
        +HandleListMyTickets(w, r, sess)
        +HandleGetTicketQR(w, r, sess)
        +HandleVerifyTicketQR(w, r, sess)
        +HandleCancelTicket(w, r, sess)
        +HandleListUserCancelledTickets(w, r, sess)
        +HandleListAuditLogs(w, r, sess)
        +HandleResetDemoTickets(w, r, sess)
    }

    class AssistantHandler {
        <<boundary>>
        -AssistantService assistant
        -AuthService auth
        +HandleChat(w, r)
    }

    class AuthService {
        <<control>>
        -Queries queries
        -Config cfg
        +RequestOTP(ctx, destination) OTPIssue
        +VerifyOTP(ctx, destination, code, ipAddress, userAgent) string, User
        +DemoLogin(ctx, role, ipAddress, userAgent) string, User
        +GetUserByToken(ctx, rawToken) GetSessionByTokenHashRow
        +Logout(ctx, rawToken)
    }

    class EventService {
        <<control>>
        -Queries queries
        +ListEvents(ctx) List~ListPublishedEventsRow~
        +GetEventDetail(ctx, identifier) EventDetailDTO
        +GetEventDetailBySlug(ctx, slug) EventDetailDTO
        +ResolveEventID(ctx, identifier) UUID
        +GetEventByID(ctx, id) GetEventByIDRow
    }

    class SeatService {
        <<control>>
        -Pool dbPool
        -Queries queries
        -bool limitTickets
        +GetSeatMap(ctx, eventID, currentUserID) List~SeatMapItem~
        +HoldSeat(ctx, eventID, seatID, userID) SeatHold
        +ReleaseSeat(ctx, eventID, seatID, userID)
        +ExpireStaleHolds(ctx) List~ExpireStaleSeatHoldsRow~
        +ListMyHolds(ctx, userID) List~MyHold~
    }

    class OrganizerService {
        <<control>>
        -Pool dbPool
        -Queries queries
        +ListEvents(ctx, userID, isAdmin) List~OrganizerEventDTO~
        +AuthorizeEvent(ctx, eventID, userID, isAdmin)
        +UpdateZonePricing(ctx, eventID, zoneID, userID, p) ZonePricing
        +GetEventSalesSummary(ctx, eventID) EventSalesSummaryDTO
        +GetSalesOverview(ctx, userID, isAdmin) OrganizerSalesOverviewDTO
    }

    class PaymentService {
        <<control>>
        -Pool dbPool
        -Queries queries
        -string webhookSecret
        -bool demoMode
        +CreateOrder(ctx, userID, eventID, seatIDs, method) OrderDTO
        +GetOrder(ctx, userID, orderID, isAdmin) OrderDTO
        +ListOrders(ctx, userID) List~OrderDTO~
        +InitiatePayment(ctx, userID, orderID, provider) PaymentSessionDTO
        +ProcessIPN(ctx, provider, req) IPNResult
        +SignIPN(provider, paymentCode, txnID, amount, result) string
        +VerifyIPNSignature(provider, paymentCode, txnID, amount, result, sig) bool
    }

    class TicketService {
        <<control>>
        -Pool dbPool
        -Queries queries
        +ListMyTickets(ctx, userID) List~UserTicketDTO~
        +GetFixedQR(ctx, ticketID, callerID, isStaff) TicketQRDTO
        +VerifyTicketQR(ctx, payload) QRVerifyResult
        +Cancel(ctx, userID, userEmail, eventID, req) CancelResult
        +ListCancelled(ctx, userID) List~CancelledTicketItem~
        +ListAuditLogs(ctx, userID, isAdmin) List~AuditItem~
        +ResetDemo(ctx, userID)
    }

    class AssistantService {
        <<control>>
        -Config cfg
        -EventService events
        -OrganizerService organizer
        -HttpClient client
        +Chat(ctx, caller, req) AssistantChatResponse
        -buildGroundedContext(ctx, caller, req) string
        -callOllama(ctx, systemPrompt, userMsg) string
        -callGemini(ctx, systemPrompt, userMsg) string
    }

    class RealtimeHub {
        <<control>>
        -Pool dbPool
        -RWMutex subMu
        -map eventSubs
        +Subscribe(eventID) ClientChannel
        +Unsubscribe(eventID, ch)
        +Broadcast(eventID, payload)
        +StartListener(ctx)
        -listen(ctx)
    }

    class HoldReaper {
        <<control>>
        -SeatService seatService
        -Duration interval
        +Start(ctx)
    }

    class User {
        <<entity>>
    }
    class OtpVerification {
        <<entity>>
    }
    class Session {
        <<entity>>
    }
    class Venue {
        <<entity>>
    }
    class VenueZone {
        <<entity>>
    }
    class Seat {
        <<entity>>
    }
    class Event {
        <<entity>>
    }
    class EventZone {
        <<entity>>
    }
    class EventSeat {
        <<entity>>
    }
    class SeatHold {
        <<entity>>
    }
    class Order {
        <<entity>>
    }
    class OrderItem {
        <<entity>>
    }
    class Payment {
        <<entity>>
    }
    class Ticket {
        <<entity>>
    }
    class PriceChange {
        <<entity>>
    }
    class AuditLog {
        <<entity>>
    }

    AuthHandler --> AuthService
    EventHandler --> EventService
    SeatHandler --> SeatService
    SeatHandler --> AuthService
    SeatHandler --> EventService
    StreamHandler --> RealtimeHub
    StreamHandler --> EventService
    OrganizerHandler --> OrganizerService
    OrganizerHandler --> EventService
    PaymentHandler --> PaymentService
    PaymentHandler --> EventService
    TicketHandler --> TicketService
    TicketHandler --> EventService
    AssistantHandler --> AssistantService
    AssistantHandler --> AuthService
    HoldReaper --> SeatService : gọi định kỳ
    AssistantService --> EventService : đọc sự kiện
    AssistantService --> OrganizerService : tóm tắt doanh số

    AuthService ..> User : đọc, tạo, cập nhật
    AuthService ..> OtpVerification : tạo, xác minh
    AuthService ..> Session : tạo, đọc, xóa

    EventService ..> Event : đọc
    EventService ..> Venue : đọc
    EventService ..> EventZone : đọc giá
    EventService ..> VenueZone : đọc

    SeatService ..> Event : kiểm tra đang bán
    SeatService ..> EventSeat : đổi trạng thái
    SeatService ..> SeatHold : tạo, nhả, hết hạn
    SeatService ..> Seat : đọc
    SeatService ..> VenueZone : đọc
    SeatService ..> Ticket : đếm vé đã mua

    OrganizerService ..> Event : đọc, kiểm tra BTC
    OrganizerService ..> Venue : đọc
    OrganizerService ..> EventZone : cập nhật giá
    OrganizerService ..> EventSeat : đổi giá ghế trống
    OrganizerService ..> PriceChange : ghi nhật ký giá

    PaymentService ..> Order : tạo, thanh toán, hoàn tiền
    PaymentService ..> OrderItem : tạo, đọc
    PaymentService ..> Payment : khởi tạo, xử lý IPN
    PaymentService ..> SeatHold : chuyển sang đã bán
    PaymentService ..> EventSeat : chuyển sang SOLD
    PaymentService ..> Ticket : phát hành vé
    PaymentService ..> AuditLog : ghi nhật ký

    TicketService ..> Ticket : xem, tạo QR, hủy vé
    TicketService ..> EventSeat : nhả ghế khi hủy
    TicketService ..> SeatHold : giải phóng lượt giữ
    TicketService ..> Event : kiểm tra sự kiện
    TicketService ..> AuditLog : ghi và đọc nhật ký
```

Cách các lớp phối hợp:
- `SeatHandler` gọi `AuthService.GetUserByToken` để lấy người dùng, rồi gọi `SeatService`.
- `OrganizerHandler` dùng `RequireRole`, nên chỉ `ORGANIZER` và `ADMIN` vào được.
  Trước khi đổi giá, handler gọi `OrganizerService.AuthorizeEvent` để kiểm tra người gọi là BTC của sự kiện.
- `PaymentHandler` và `PaymentService` xử lý đơn hàng, khởi tạo phiên thanh toán và tiếp nhận IPN ký HMAC lũy quyền theo `(provider, provider_txn_id)`.
  Khi IPN thành công, `PaymentService` chuyển ghế sang `SOLD`, phát hành `Ticket`, ghi `AuditLog` và phát `pg_notify` `seat_sold`.
- `TicketHandler` và `TicketService` phục vụ danh sách vé của khán giả (`/api/me/tickets`), sinh/xác thực mã QR (`/api/tickets/{id}/qr`, `/api/tickets/verify-qr`), hủy vé và tra cứu `audit_logs`.
- `AssistantHandler` lấy vai trò trực tiếp từ cookie phiên server qua `AuthService`, truyền vào `AssistantService` để truy vấn dữ liệu từ `EventService`/`OrganizerService` và tùy chọn diễn giải bằng Ollama/Gemini.
- `SeatService` không gọi `RealtimeHub` trực tiếp.
  Service gửi `pg_notify` lên kênh `event_seats_channel`.
  `RealtimeHub` giữ một kết nối `LISTEN` riêng trên kênh này và chuyển tin tới các `StreamHandler` đang mở.
- `HoldReaper` gọi `SeatService.ExpireStaleHolds` mỗi 5 giây.
- `SeatService` chỉ đếm vé trong bảng `tickets` khi bật cờ `ticket_limit`.
  Khi đó, `HoldSeat` khóa cặp (người dùng, sự kiện) bằng `pg_advisory_xact_lock` trước khi đếm.
- `HoldSeat` không dùng khóa advisory để chống bán trùng.
  Ghế chỉ chuyển sang `HELD` khi đang `AVAILABLE`.
  Partial unique index trên `seat_holds` là lớp chặn thứ hai.

## 3. Thuộc tính các Entity đang dùng

Thuộc tính lấy đúng tên trường trong `internal/store/models.go`.

```mermaid
classDiagram
    class User {
        <<entity>>
        +UUID ID
        +Text Phone
        +Text Email
        +Text FullName
        +UserRole Role
        +UserStatus Status
        +Timestamptz PhoneVerifiedAt
        +Timestamptz EmailVerifiedAt
        +Timestamptz LastLoginAt
        +Timestamptz CreatedAt
        +Timestamptz UpdatedAt
    }

    class OtpVerification {
        <<entity>>
        +UUID ID
        +string Destination
        +string Channel
        +string Purpose
        +string CodeHash
        +Timestamptz ExpiresAt
        +Timestamptz VerifiedAt
        +int32 AttemptCount
        +Timestamptz CreatedAt
    }

    class Session {
        <<entity>>
        +UUID ID
        +UUID UserID
        +string TokenHash
        +Text IpAddress
        +Text UserAgent
        +Timestamptz ExpiresAt
        +Timestamptz CreatedAt
    }

    class Venue {
        <<entity>>
        +UUID ID
        +string Name
        +Text Address
        +string Timezone
        +Timestamptz CreatedAt
    }

    class VenueZone {
        <<entity>>
        +UUID ID
        +UUID VenueID
        +string Code
        +string Name
        +Text Floor
        +int32 Capacity
        +Timestamptz CreatedAt
    }

    class Seat {
        <<entity>>
        +UUID ID
        +UUID ZoneID
        +Text RowLabel
        +Text SeatNumber
        +string SeatLabel
        +Numeric XPosition
        +Numeric YPosition
        +bool IsActive
        +Timestamptz CreatedAt
    }

    class Event {
        <<entity>>
        +UUID ID
        +UUID OrganizerID
        +UUID VenueID
        +string Name
        +string Slug
        +Text Description
        +Text Genre
        +Text ImageUrl
        +Text ImageCredit
        +Text City
        +Timestamptz StartsAt
        +Timestamptz EndsAt
        +Timestamptz SalesStartsAt
        +Timestamptz SalesEndsAt
        +EventStatus Status
        +int32 MaxTicketsPerUser
        +bool WaitingRoomEnabled
        +int32 WaitingRoomCapacity
        +Timestamptz CreatedAt
        +Timestamptz UpdatedAt
    }

    class EventZone {
        <<entity>>
        +UUID ID
        +UUID EventID
        +UUID ZoneID
        +Numeric BasePrice
        +Numeric FloorPrice
        +Numeric CeilingPrice
        +bool IsDynamicPricingEnabled
        +Timestamptz CreatedAt
        +Timestamptz UpdatedAt
    }

    class EventSeat {
        <<entity>>
        +UUID ID
        +UUID EventID
        +UUID SeatID
        +SeatStatus Status
        +Numeric CurrentPrice
        +int64 Version
        +Timestamptz UpdatedAt
    }

    class SeatHold {
        <<entity>>
        +UUID ID
        +UUID EventID
        +UUID SeatID
        +UUID UserID
        +string HoldToken
        +HoldStatus Status
        +Timestamptz CreatedAt
        +Timestamptz ExpiresAt
    }

    class Ticket {
        <<entity>>
        +UUID ID
        +UUID OrderID
        +UUID EventID
        +UUID SeatID
        +UUID UserID
        +string TicketCode
        +string QrSecret
        +TicketStatus Status
        +Timestamptz IssuedAt
        +Timestamptz UpdatedAt
    }

    class PriceChange {
        <<entity>>
        +int64 ID
        +UUID EventID
        +UUID ZoneID
        +Numeric OldPrice
        +Numeric NewPrice
        +UUID ChangedBy
        +string Reason
        +Timestamptz CreatedAt
    }

    class Order {
        <<entity>>
        +UUID ID
        +UUID EventID
        +UUID UserID
        +string OrderCode
        +OrderStatus Status
        +Numeric TotalAmount
        +Numeric DiscountAmount
        +Numeric FinalAmount
        +string Currency
        +Text PaymentMethod
        +Timestamptz ExpiresAt
        +Timestamptz PaidAt
        +Timestamptz CancelledAt
        +Timestamptz CreatedAt
        +Timestamptz UpdatedAt
    }

    class OrderItem {
        <<entity>>
        +UUID ID
        +UUID OrderID
        +UUID SeatID
        +Numeric Price
        +Timestamptz CreatedAt
    }

    class Payment {
        <<entity>>
        +UUID ID
        +UUID OrderID
        +string PaymentCode
        +string Provider
        +Text ProviderTxnID
        +Numeric Amount
        +PaymentStatus Status
        +byte[] RawResponse
        +Timestamptz CreatedAt
        +Timestamptz UpdatedAt
    }

    class AuditLog {
        <<entity>>
        +int64 ID
        +UUID ActorUserID
        +UUID EventID
        +string Action
        +string EntityType
        +UUID EntityID
        +byte[] OldData
        +byte[] NewData
        +Text Reason
        +Text RequestID
        +Timestamptz CreatedAt
    }

    User "1" -- "*" Session
    User "1" -- "*" Event : tổ chức
    User "1" -- "*" SeatHold
    User "1" -- "*" Order
    User "1" -- "*" Ticket
    User "1" -- "*" PriceChange : đổi giá
    User "1" -- "*" AuditLog : thực hiện
    Venue "1" -- "*" VenueZone
    Venue "1" -- "*" Event
    VenueZone "1" -- "*" Seat
    VenueZone "1" -- "*" EventZone
    VenueZone "1" -- "*" PriceChange
    Event "1" -- "*" EventZone
    Event "1" -- "*" EventSeat
    Event "1" -- "*" SeatHold
    Event "1" -- "*" Order
    Event "1" -- "*" Ticket
    Event "1" -- "*" PriceChange
    Event "1" -- "*" AuditLog
    Seat "1" -- "*" EventSeat
    Seat "1" -- "*" SeatHold
    Seat "1" -- "*" OrderItem
    Seat "1" -- "*" Ticket
    Order "1" -- "*" OrderItem
    Order "1" -- "*" Payment
    Order "1" -- "*" Ticket
```

`OtpVerification` không có khóa ngoại tới `User`, vì mã OTP được gửi trước khi có tài khoản.

Các kiểu enum lấy từ `models.go`:

| Kiểu | Giá trị |
|---|---|
| `UserRole` | `CUSTOMER`, `ORGANIZER`, `CEO`, `GATE_STAFF`, `ADMIN` |
| `UserStatus` | `PENDING`, `ACTIVE`, `LOCKED`, `DISABLED` |
| `EventStatus` | `DRAFT`, `ON_SALE`, `SOLD_OUT`, `PAUSED`, `ENDED`, `CANCELLED` |
| `SeatStatus` | `AVAILABLE`, `HELD`, `SOLD`, `BLOCKED` |
| `HoldStatus` | `ACTIVE`, `EXPIRED`, `RELEASED`, `CONVERTED` |
| `OrderStatus` | `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`, `REFUNDED` |
| `PaymentStatus` | `INITIATED`, `PROCESSING`, `SUCCESS`, `FAILED`, `REFUNDED` |
| `TicketStatus` | `ISSUED`, `ACTIVE`, `USED`, `REVOKED`, `VOID` |

## 4. Ánh xạ Entity với bảng

`models.go` có đủ 23 struct cho 23 bảng của ERD.
Cột "Control dùng" cho biết service nào đang đọc hoặc ghi bảng đó.
Dấu "—" nghĩa là chưa có code dùng, bảng chờ tính năng của cờ tương ứng.

| Entity | Bảng | Control dùng | Cờ |
|---|---|---|---|
| `User` | `users` | `AuthService` | `otp_login` |
| `OtpVerification` | `otp_verifications` | `AuthService` | `otp_login` |
| `Session` | `sessions` | `AuthService` | `otp_login` |
| `Venue` | `venues` | `EventService`, `OrganizerService` | `organizer_console` |
| `VenueZone` | `venue_zones` | `EventService`, `SeatService` | `organizer_console` |
| `Seat` | `seats` | `SeatService`, `PaymentService` | `seat_map_realtime` |
| `Event` | `events` | `EventService`, `SeatService`, `OrganizerService`, `PaymentService`, `TicketService` | FR-02, luôn bật |
| `EventZone` | `event_zones` | `EventService`, `OrganizerService` | `zone_pricing` |
| `EventSeat` | `event_seats` | `SeatService`, `OrganizerService`, `PaymentService`, `TicketService` | `seat_map_realtime`, `seat_hold` |
| `SeatHold` | `seat_holds` | `SeatService`, `PaymentService`, `TicketService` | `seat_hold` |
| `PriceChange` | `price_changes` | `OrganizerService` | `zone_pricing`, `price_log` |
| `Ticket` | `tickets` | `SeatService`, `PaymentService`, `TicketService` | `ticket_limit`, `payments`, `rotating_qr` |
| `Order` | `orders` | `PaymentService` | `payments` |
| `OrderItem` | `order_items` | `PaymentService` | `payments` |
| `Payment` | `payments` | `PaymentService` | `payments`, `reconciliation` |
| `QueueEntry` | `queue_entries` | — | `waiting_room` |
| `GateDevice` | `gate_devices` | — | `gate_checkin` |
| `Checkin` | `checkins` | — | `gate_checkin`, `offline_checkin` |
| `SalesSnapshot` | `sales_snapshots` | — | `ceo_dashboard` |
| `PriceSuggestion` | `price_suggestions` | — | `dynamic_pricing` |
| `Promotion` | `promotions` | — | `promo_suggestions` |
| `PromotionUsage` | `promotion_usages` | — | `promo_suggestions` |
| `AuditLog` | `audit_logs` | `PaymentService`, `TicketService` | `organizer_console`, `payments` |

Bảng `price_changes` luôn được ghi khi giá cơ bản đổi.
Cờ `price_log` chỉ ẩn hoặc hiện trang xem nhật ký.

## 5. Lớp dự kiến (chưa làm)

Các lớp dưới đây chưa có trong code.
Tên lớp là tên dự kiến, có thể đổi khi viết code.
Endpoint lấy từ mục 7 của [thiết kế](design/README.md).

| Lớp dự kiến | Cờ | Endpoint, tác vụ nền | Bảng |
|---|---|---|---|
| Mở rộng `OrganizerHandler`, `OrganizerService` | `organizer_console` | `/api/organizer/venues/…`, `/api/organizer/events/…` | `venues`, `venue_zones`, `seats`, `events`, `event_seats` |
| `QueueHandler`, `QueueService` | `waiting_room` | `POST /api/events/{id}/queue`, `GET /api/events/{id}/queue/me`; tác vụ cho người kế tiếp vào | `queue_entries` |
| Middleware kiểm tra Turnstile | `bot_check` | Bọc `POST /api/auth/otp/request` | — |
| `ReconciliationWorker` | `reconciliation` | Tác vụ nền đối soát định kỳ và hoàn tiền tự động khi thanh toán sau khi hold hết hạn | `payments`, `orders`, `seat_holds` |
| Mở rộng `TicketService` (xoay vòng TOTP 30s) | `rotating_qr` | Nâng cấp `GET /api/tickets/{id}/qr` sang QR xoay vòng 30 giây | `tickets` |
| Lớp gửi OTP và vé qua SMTP, SMS Gateway | `otp_login`, `ticket_email` | Dùng trong `AuthService` và `TicketService` | — |
| `GateHandler`, `GateCheckinService` | `gate_checkin`, `offline_checkin` | `GET /api/gate/events/{id}/manifest`, `POST /api/gate/checkins`, `POST /api/gate/sync` | `tickets`, `checkins`, `gate_devices` |
| `DashboardHandler`, `DashboardService` | `ceo_dashboard`, `reports_export` | `GET /api/dashboard/stream`, `GET /api/reports/sales.csv`, `GET /api/reports/sales.xlsx`; tác vụ chụp số liệu | `sales_snapshots` |
| `DynamicPricingEngine` | `dynamic_pricing` | Tác vụ tính đề xuất 5 phút một lần; `POST /api/organizer/suggestions/{id}/approve`, `…/reject` | `price_suggestions`, `price_changes`, `event_zones`, `event_seats` |
| Chưa thiết kế | `promo_suggestions` | Chưa có endpoint trong thiết kế | `promotions`, `promotion_usages` |
| Chưa thiết kế | `price_log` | Chưa có endpoint trong thiết kế | `price_changes` |
