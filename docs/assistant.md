# Trợ lý chatbot hỗ trợ đặt vé và Ban Tổ chức (FR-24)

Khán giả hỏi về lịch diễn, giá vé, ghế còn trống và cách đặt vé.
Ban Tổ chức hỏi nhanh doanh số các sự kiện của mình.
Câu trả lời tùy vai trò của người hỏi.

Cờ tính năng: `chatbot` (Sprint 2, bật trong mọi profile).
Cờ tắt thì `POST /api/assistant/chat` trả `404 feature_disabled` và giao diện ẩn nút "Trợ lý".

Đặc tả endpoint nằm ở [`api/openapi.yaml`](api/openapi.yaml). Sơ đồ tuần tự nằm ở [`sequences/assistant.md`](sequences/assistant.md).

## 1. Nguyên tắc thiết kế

Mô hình ngôn ngữ dùng ở đây rất nhỏ (Qwen3.5-0.8B chạy bằng llama.cpp).
Mô hình nhỏ hay bịa. Khi thử với "Sân vận động Quốc gia Mỹ Đình", nó từng trả lời "Mỹ Tâm là thành viên của nhóm nhạc Mỹ Tâm".

Vì vậy mô hình **không được viết câu trả lời**. Nó chỉ làm một việc: đọc câu hỏi và chọn một ý định (intent) trong danh sách cố định.
Mọi tên, ngày, giá và số ghế đều do server đọc từ PostgreSQL và ghép vào mẫu câu.
Dù mô hình trả gì, chữ đó không bao giờ tới người dùng.

Hệ quả:
- không có thông tin bịa trong câu trả lời;
- mô hình lỗi, chậm hoặc tắt thì vẫn trả lời được, bằng bộ so khớp từ khóa (chế độ `fallback`);
- câu hỏi lạ chỉ nhận câu "mình chưa hiểu", không nhận câu trả lời tự chế.

## 2. Luồng xử lý

1. `AssistantHandler` lấy vai trò từ phiên đăng nhập trên server. Không đọc vai trò từ body. Chưa đăng nhập thì chỉ nhận thông tin công khai.
2. `AssistantService` chuẩn hóa câu hỏi: bỏ dấu, chữ thường, bỏ dấu câu. "Mỹ Tâm", "my tam" và "MY TAM!" là một.
3. Bộ từ khóa chấm điểm cho từng ý định.
4. Nếu có cấu hình mô hình, `LLMClient` gửi câu hỏi tới máy chủ tương thích OpenAI. Kết quả bắt buộc theo JSON schema: `intent` thuộc danh sách, kèm `event` và `zone` là chuỗi mô hình đọc được.
5. Server kiểm tra kết quả của mô hình (mục 4) rồi chốt ý định.
6. Server tìm sự kiện và khu vực trong cơ sở dữ liệu theo tên, chịu được lỗi gõ và thiếu dấu.
7. Server truy vấn PostgreSQL và dựng câu trả lời từ mẫu.
8. Phản hồi gồm `reply`, `intent`, `mode`, `links`, `suggestions`.

## 3. Ý định

| Intent | Câu hỏi ví dụ | Ai được hỏi | Dữ liệu |
|---|---|---|---|
| `list_events` | "Tuần này có concert nào?" | Mọi người | Sự kiện chưa kết thúc, lọc theo tuần, tháng, thành phố, địa điểm, thể loại |
| `event_info` | "Mỹ Tâm bao giờ diễn?" | Mọi người | Giờ, địa điểm, tình trạng bán, giá thấp nhất |
| `prices` | "Giá vé VIP Blackpink?" | Mọi người | Giá theo khu (`event_zones.base_price`) |
| `availability` | "Concert Mỹ Tâm còn vé khu nào?" | Mọi người | Số ghế `AVAILABLE` trên tổng số ghế của từng khu |
| `how_to_book` | "Cách đặt vé thế nào?" | Mọi người | Các bước, thay đổi theo cờ `otp_login`, `seat_hold`, `payments` |
| `my_holds` | "Mình đang giữ ghế nào?" | Người đã đăng nhập, chỉ của mình | `seat_holds` còn hạn, kèm thời gian còn lại |
| `my_tickets` | "Vé của tôi đâu?" | Người đã đăng nhập, chỉ của mình | `tickets` chưa `VOID` |
| `organizer_sales` | "Doanh số sự kiện của tôi" | `ORGANIZER` (sự kiện của mình), `ADMIN` (tất cả) | Vé đã bán, doanh thu, ghế đang giữ, khu bán chạy |
| `greeting` | "Xin chào", "cảm ơn" | Mọi người | Không |
| `unknown` | "Thủ đô của Pháp là gì?" | Mọi người | Không |

`my_holds` cần cờ `seat_hold`. `my_tickets` cần cờ `payments`. `organizer_sales` cần cờ `organizer_console`.
Cờ tắt thì trợ lý nói phần đó chưa mở.

Khi câu hỏi chỉ có tên một sự kiện, trợ lý trả thông tin sự kiện đó.
Khi tên sự kiện khớp nhiều sự kiện ("anh trai say hi"), trợ lý hỏi lại và đưa các lựa chọn.
Đang mở trang một sự kiện thì giao diện gửi kèm `context.event`, nên "giá vé bao nhiêu?" hiểu là sự kiện đó.

## 4. Chống bịa và kiểm soát đầu ra của mô hình

- **Schema nghiêm ngặt.** Máy chủ mô hình chỉ sinh được JSON đúng schema. Server vẫn kiểm tra lại: sai thì bỏ.
- **Ý định phải có bằng chứng.** Nếu từ khóa cho thấy rõ một ý định khác, từ khóa thắng. Ví dụ mô hình đoán `prices` cho "my tam bao gio dien", từ khóa "bao giờ" chọn `event_info`.
- **Tên sự kiện phải có trong câu hỏi.** Chuỗi `event` của mô hình chỉ được dùng khi mọi từ của nó có mặt trong câu hỏi của người dùng. Mô hình không thể đưa vào một tên mà người dùng không gõ. Phần còn lại luôn do server đối chiếu với tên sự kiện trong cơ sở dữ liệu.
- **Tên địa điểm không phải tên nghệ sĩ.** Một từ lẻ như "Mỹ" không đủ để chọn sự kiện. Phải khớp từ hiếm và dài, hoặc ít nhất hai từ thường. "Mỹ Đình" không chọn "Mỹ Tâm".
- **Quyền không đến từ mô hình.** Mô hình chọn `organizer_sales` cho một khách hàng thì khách vẫn bị từ chối, vì kiểm tra vai trò nằm ở server.
- **Phạm vi nằm trong SQL.** Truy vấn doanh số lọc theo `events.organizer_id` của người gọi. Người tổ chức hỏi sự kiện của người khác nhận câu "không thấy trong danh sách của bạn" và không có số liệu nào.
- **Không ghi gì.** Trợ lý chỉ đọc. Không có câu hỏi nào đổi giá, giữ ghế hay hủy vé.
- **Câu hỏi không được đưa vào log.** Log chỉ ghi `intent`, `mode`, vai trò và thời gian.

## 5. Chế độ fallback

Server dùng từ khóa thay cho mô hình khi:
- không đặt `LLM_BASE_URL`;
- mô hình quá 8 giây, trả mã lỗi hoặc không kết nối được;
- phản hồi hỏng, gồm cả JSON bị cắt giữa một ký tự nhiều byte (llama.cpp có thể làm vậy khi chạm `max_tokens`);
- `intent` ngoài danh sách;
- đã có quá 4 yêu cầu tới mô hình cùng lúc.

Sau một lần mô hình không trả lời được (hết giờ, lỗi mạng hoặc lỗi 5xx), server bỏ qua mô hình trong 20 giây.
Nhờ vậy máy chủ mô hình chết không làm mỗi tin nhắn chậm thêm 8 giây.

Chế độ fallback có độ phủ thấp hơn: nó hiểu các cách hỏi quen thuộc và câu không dấu, nhưng không hiểu cách diễn đạt lạ.
Câu trả lời giống hệt chế độ có mô hình, vì cả hai dùng chung mẫu câu.

## 6. Giới hạn

- Mỗi tài khoản 20 yêu cầu mỗi phút, người chưa đăng nhập tính theo địa chỉ. Mỗi địa chỉ tối đa 60 yêu cầu mỗi phút. Vượt thì trả `429 rate_limited`.
- Câu hỏi dài tối đa 300 ký tự. Body tối đa 4 KB.
- Trợ lý không nhớ hội thoại. Mỗi câu hỏi được xử lý riêng.
- Danh sách trả tối đa 5 sự kiện. Doanh số lấy tối đa 20 sự kiện gần nhất theo ngày diễn và hiển thị 5 sự kiện có doanh thu cao nhất.
- Chỉ tìm trong sự kiện đang bán hoặc đã hết vé và chưa kết thúc.
- Ngày giờ hiển thị theo giờ Việt Nam.

## 7. Cấu hình

| Biến | Ý nghĩa |
|---|---|
| `LLM_BASE_URL` | Địa chỉ máy chủ tương thích OpenAI, có `/v1`. Để trống thì chạy bằng từ khóa |
| `LLM_MODEL` | Tên mô hình. Mặc định `cosh301-assistant` |
| `LLM_API_KEY` | Khóa Bearer. Không có giá trị mặc định, không đưa vào mã nguồn |

Server gửi `chat_template_kwargs: {"enable_thinking": false}` để mô hình Qwen không "suy nghĩ" trước khi trả lời.
Một lần phân loại mất khoảng 0,2 giây với mô hình đang dùng.

## 8. Kiểm thử

- Bộ so khớp từ khóa, tìm sự kiện và khu vực, thời gian: `backend/internal/service/assistant_match_test.go`.
- Mẫu câu trả lời: `backend/internal/service/assistant_compose_test.go`.
- Máy khách mô hình với máy chủ giả (JSON đúng, rác, bị cắt, hết giờ, lỗi 5xx): `backend/internal/service/assistant_llm_test.go`.
- Phân quyền theo vai trò và số liệu khớp cơ sở dữ liệu, cần `TEST_DATABASE_URL`: `backend/internal/service/assistant_service_test.go`.
- Cờ tính năng, giới hạn tốc độ, đầu vào sai: `backend/internal/httpapi/assistant_test.go`.
