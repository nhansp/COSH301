# Sơ đồ tuần tự: Hỏi trợ lý chatbot (FR-24)

Khán giả hoặc Ban Tổ chức gõ một câu hỏi. Mô hình ngôn ngữ chỉ phân loại câu hỏi, câu trả lời do server dựng từ dữ liệu PostgreSQL.
Thiết kế và các chốt chặn nằm ở [`../assistant.md`](../assistant.md).

Cờ tính năng: `chatbot` (Sprint 2). Cờ tắt thì `POST /api/assistant/chat` trả `404 feature_disabled`.

## 1. Quy tắc

- Vai trò lấy từ phiên trên server. Chưa đăng nhập thì chỉ nhận thông tin công khai.
- Mô hình chỉ trả `intent`, `event`, `zone`. Chữ của mô hình không tới người dùng.
- Mô hình lỗi, quá 8 giây hoặc trả sai định dạng thì dùng bộ từ khóa (`mode = fallback`).
- Truy vấn doanh số lọc theo `events.organizer_id` của người gọi.

## 2. Đối tượng

| Đối tượng | Lớp hoặc nơi | Vai trò |
|---|---|---|
| Người dùng | Trình duyệt | Gõ câu hỏi trong khung "Trợ lý" |
| `AssistantHandler` | `internal/httpapi` | Boundary: giới hạn tốc độ, lấy vai trò từ phiên |
| `AssistantService` | `internal/service` | Control: phân loại, kiểm tra, truy vấn, dựng câu trả lời |
| `LLMClient` | `internal/service` | Gọi máy chủ mô hình, kiểm tra JSON trả về |
| Máy chủ mô hình | llama.cpp, tương thích OpenAI | Chọn một `intent` |
| PostgreSQL | `events`, `event_zones`, `event_seats`, `seat_holds`, `tickets`, `order_items` | Nguồn của mọi số liệu |

## 3. Câu hỏi của khán giả, mô hình trả lời được

```mermaid
sequenceDiagram
    autonumber
    actor User as Khán giả (Trình duyệt)
    participant Boundary as AssistantHandler (internal/httpapi)
    participant Control as AssistantService (internal/service)
    participant LLM as LLMClient (internal/service)
    participant Model as Máy chủ mô hình
    participant DB as PostgreSQL (pgxpool)

    User->>Boundary: POST /api/assistant/chat {message, context?}
    activate Boundary
    Boundary->>Boundary: Kiểm tra giới hạn 20 yêu cầu mỗi phút
    Boundary->>Boundary: Lấy vai trò từ phiên (hoặc ẩn danh)
    Boundary->>Control: Chat(ctx, caller, request)
    activate Control

    Control->>Control: Bỏ dấu, tách từ, chấm điểm từ khóa
    Control->>LLM: Classify(message)
    activate LLM
    LLM->>Model: POST /v1/chat/completions (JSON schema, không suy nghĩ)
    Model-->>LLM: {"intent":"availability","event":"Mỹ Tâm","zone":""}
    LLM->>LLM: Kiểm tra intent thuộc danh sách, làm sạch event và zone
    LLM-->>Control: intent, event, zone
    deactivate LLM

    Control->>Control: Đối chiếu intent với từ khóa, chốt intent
    Control->>DB: ListAssistantEvents()
    DB-->>Control: Sự kiện đang bán, chưa kết thúc
    Control->>Control: Tìm sự kiện theo tên (chỉ nhận event có trong câu hỏi)
    Control->>DB: ListAssistantEventZones(eventID)
    DB-->>Control: Giá và số ghế còn theo khu
    Control->>Control: Dựng câu trả lời từ mẫu, ghi log intent và thời gian

    Control-->>Boundary: reply, intent, mode = llm, links, suggestions
    deactivate Control
    Boundary-->>User: 200 OK
    deactivate Boundary
```

## 4. Mô hình lỗi: chuyển sang từ khóa

```mermaid
sequenceDiagram
    autonumber
    actor User as Khán giả (Trình duyệt)
    participant Boundary as AssistantHandler (internal/httpapi)
    participant Control as AssistantService (internal/service)
    participant LLM as LLMClient (internal/service)
    participant Model as Máy chủ mô hình
    participant DB as PostgreSQL (pgxpool)

    User->>Boundary: POST /api/assistant/chat {message}
    Boundary->>Control: Chat(ctx, caller, request)
    activate Control
    Control->>Control: Chấm điểm từ khóa
    Control->>LLM: Classify(message)
    activate LLM

    alt Đang trong 20 giây nghỉ, hoặc đã có 4 yêu cầu chạy cùng lúc
        LLM-->>Control: errLLMUnavailable (không gọi mô hình)
    else Quá 8 giây, lỗi mạng hoặc mã 5xx
        LLM->>Model: POST /v1/chat/completions
        Model--xLLM: Không trả lời kịp
        LLM->>LLM: Nghỉ 20 giây
        LLM-->>Control: lỗi
    else JSON hỏng, bị cắt hoặc intent ngoài danh sách
        LLM->>Model: POST /v1/chat/completions
        Model-->>LLM: Phản hồi sai định dạng
        LLM-->>Control: lỗi
    end
    deactivate LLM

    Control->>Control: Dùng intent của từ khóa, mode = fallback
    Control->>DB: Truy vấn như luồng thường
    DB-->>Control: Dữ liệu
    Control-->>Boundary: Câu trả lời dựng từ mẫu
    deactivate Control
    Boundary-->>User: 200 OK (mode = fallback)
```

## 5. Ban Tổ chức hỏi doanh số, khách hàng bị từ chối

```mermaid
sequenceDiagram
    autonumber
    actor Org as Ban Tổ chức (Trình duyệt)
    actor Cus as Khách hàng (Trình duyệt)
    participant Boundary as AssistantHandler (internal/httpapi)
    participant Control as AssistantService (internal/service)
    participant DB as PostgreSQL (pgxpool)

    Org->>Boundary: POST /api/assistant/chat "Doanh số sự kiện của tôi"
    Boundary->>Control: Chat(caller = ORGANIZER, userID)
    activate Control
    Control->>Control: intent = organizer_sales, vai trò hợp lệ
    Control->>DB: ListAssistantEventSales(is_admin = false, organizer_id)
    Note right of DB: WHERE events.organizer_id = người gọi
    DB-->>Control: Vé đã bán, doanh thu, ghế đang giữ
    Control-->>Boundary: Tóm tắt doanh số
    deactivate Control
    Boundary-->>Org: 200 OK

    Cus->>Boundary: POST /api/assistant/chat "Doanh số sự kiện của tôi"
    Boundary->>Control: Chat(caller = CUSTOMER)
    activate Control
    Control->>Control: intent = organizer_sales, vai trò không hợp lệ
    Note right of Control: Không truy vấn doanh số
    Control-->>Boundary: "Thống kê doanh số chỉ dành cho Ban Tổ chức"
    deactivate Control
    Boundary-->>Cus: 200 OK
```

## 6. Mã phản hồi

| Mã | `error` | Khi nào |
|---|---|---|
| 200 | | Có câu trả lời, kể cả khi mô hình lỗi |
| 400 | `invalid_payload` | JSON sai hoặc body quá 4 KB |
| 400 | `empty_message` | Câu hỏi rỗng |
| 404 | `feature_disabled` | Cờ `chatbot` tắt |
| 429 | `rate_limited` | Quá 20 yêu cầu mỗi phút cho một tài khoản (hoặc địa chỉ), hoặc 60 mỗi phút cho một địa chỉ |
| 500 | `internal_error` | Lỗi truy vấn PostgreSQL |
