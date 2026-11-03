# Sơ đồ tuần tự: Đăng nhập bằng OTP (FR-01, FR-04)

Tài liệu đặc tả sơ đồ tuần tự (Sequence Diagram) cho quy trình xác thực không mật khẩu (Passwordless Authentication) qua mã OTP gửi bằng Email hoặc SMS, tích hợp chống bot bằng Cloudflare Turnstile và quản lý phiên làm việc tập trung theo chuẩn kiến trúc BCE tại [`docs/class-diagram.md`](../class-diagram.md).

---

## 1. Tổng quan cơ chế bảo mật xác thực OTP

1. **Xác minh người thật (Turnstile Challenge - `FR-10`):** Mỗi yêu cầu gửi mã OTP bắt buộc phải kèm theo `turnstile_token` do Cloudflare cấp nhằm ngăn chặn hoàn toàn việc bot spam SMS/Email gây kiệt quệ tài nguyên.
2. **Băm mã an toàn trong cơ sở dữ liệu:** Hệ thống không lưu mã OTP dưới dạng văn bản thô (plain-text). Mã OTP 6 chữ số được băm bằng thuật toán SHA-256 trước khi ghi vào bảng `otp_verifications`.
3. **Giới hạn số lần thử (Rate-limit & Brute-force Prevention):** Mỗi mã OTP chỉ có hiệu lực trong 5 phút và cho phép tối đa 5 lần nhập sai (`attempts <= 5`). Quá 5 lần, mã lập tức bị vô hiệu hóa.
4. **Quản lý phiên tập trung trên máy chủ (`sessions`):** Sau khi xác thực thành công, hệ thống sinh mã phiên ngẫu nhiên an toàn 256-bit, lưu trong bảng `sessions` và gắn vào trình duyệt qua HTTP Cookie `event_session` có cờ `HttpOnly`, `SameSite=Lax`, `Secure`.

---

## 2. Sơ đồ tuần tự tương tác (Sequence Diagram)

Tên các đối tượng tuân thủ chặt chẽ mô hình BCE đã thiết kế:
- **Boundary:** `AuthHandler` (`internal/httpapi`)
- **Control:** `AuthService` (`internal/service`)
- **External:** `Cloudflare Turnstile`, `Notifier (SMTP / SMS Gateway)`
- **Entity / Store:** `DB (PostgreSQL 18)` (`internal/store`: `otp_verifications`, `users`, `sessions`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Khán giả (Browser)
    participant Turnstile as Cloudflare Turnstile
    participant Boundary as AuthHandler (Boundary)
    participant Control as AuthService (Control)
    participant Notifier as Notifier (SMTP / SMS)
    participant DB as PostgreSQL 18 (Entity / Store)

    %% GIAI ĐOẠN 1: YÊU CẦU GỬI OTP
    rect rgb(245, 248, 255)
    Note over User,DB: Giai đoạn 1: Khởi tạo yêu cầu và gửi mã OTP (Request OTP Flow)
    User->>Turnstile: Hoàn thành thử thách ngầm (Invisible Turnstile)
    Turnstile-->>User: Cấp turnstile_token
    User->>Boundary: POST /api/auth/otp/request {destination, channel, turnstile_token}
    activate Boundary
    Boundary->>Control: RequestOTP(ctx, req)
    activate Control

    Control->>Turnstile: Xác thực turnstile_token qua API Cloudflare
    Turnstile-->>Control: Kết quả hợp lệ (Success: true)

    Control->>Control: Sinh mã OTP ngẫu nhiên 6 chữ số (e.g. "849201")
    Control->>Control: Băm mã: otp_hash = SHA256(raw_otp)

    Control->>DB: INSERT INTO otp_verifications (destination, channel, otp_hash, expires_at: now() + 5m)
    DB-->>Control: Ghi nhận thành công

    alt channel == 'email'
        Control->>Notifier: Gửi email chứa mã OTP (qua SMTP Server)
    else channel == 'sms'
        Control->>Notifier: Gửi tin nhắn SMS chứa mã OTP (qua SMS Gateway)
    end
    Notifier-->>Control: Gửi thành công

    Control-->>Boundary: Trả về thành công
    deactivate Control
    Boundary-->>User: 200 OK {"status":"sent","expires_in":300}
    deactivate Boundary
    Note over User: Giao diện chuyển sang màn hình nhập 6 số OTP
    end

    %% GIAI ĐOẠN 2: XÁC THỰC MÃ OTP VÀ TẠO PHIÊN
    rect rgb(245, 255, 248)
    Note over User,DB: Giai đoạn 2: Xác thực mã OTP và cấp phát phiên làm việc (Verify OTP Flow)
    User->>Boundary: POST /api/auth/otp/verify {destination, otp_code}
    activate Boundary
    Boundary->>Control: VerifyOTP(ctx, req)
    activate Control

    Control->>Control: Băm mã nhập vào: input_hash = SHA256(otp_code)
    Control->>DB: SELECT * FROM otp_verifications WHERE destination = $1 AND verified_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1
    DB-->>Control: Trả về bản ghi OTP hợp lệ

    alt input_hash != otp_hash (Mã sai)
        Control->>DB: UPDATE otp_verifications SET attempts = attempts + 1
        Control-->>Boundary: Trả về ErrInvalidOTP
        Boundary-->>User: 400 Bad Request {"error":"invalid_otp","message":"Mã xác thực không chính xác"}
    else input_hash == otp_hash (Mã đúng)
        Control->>DB: UPDATE otp_verifications SET verified_at = now() WHERE id = $id

        Note over Control,DB: Kiểm tra hoặc tạo người dùng mới
        Control->>DB: SELECT * FROM users WHERE phone = $dest OR email = $dest
        alt Người dùng chưa tồn tại
            Control->>DB: INSERT INTO users (role: 'CUSTOMER', phone/email) RETURNING *
            DB-->>Control: Bản ghi User mới tạo
        else Người dùng đã tồn tại
            DB-->>Control: Bản ghi User hiện có
        end

        Note over Control,DB: Tạo phiên làm việc mới trên máy chủ
        Control->>Control: Sinh session_token ngẫu nhiên 32 bytes (hex)
        Control->>DB: INSERT INTO sessions (user_id, token_hash, expires_at: now() + 7 days)
        DB-->>Control: Bản ghi Session tạo thành công

        Control-->>Boundary: Trả về User & SessionToken
        deactivate Control
        Boundary->>User: Set-Cookie: event_session=token; HttpOnly; Secure; SameSite=Lax; Path=/
        Boundary-->>User: 200 OK {"user":{"id":"...","role":"CUSTOMER","destination":"..."}}
        deactivate Boundary
        Note over User: Đăng nhập thành công, điều hướng về luồng mua vé
    end
    end

    %% GIAI ĐOẠN 3: ĐĂNG XUẤT VÀ HỦY PHIÊN
    rect rgb(255, 248, 248)
    Note over User,DB: Giai đoạn 3: Đăng xuất người dùng (Logout Flow)
    User->>Boundary: POST /api/auth/logout (Cookie: event_session=token)
    activate Boundary
    Boundary->>Control: Logout(ctx, session_token)
    activate Control
    Control->>DB: DELETE FROM sessions WHERE token_hash = SHA256(session_token)
    DB-->>Control: Xóa thành công
    Control-->>Boundary: Hoàn tất
    deactivate Control
    Boundary->>User: Set-Cookie: event_session=; Max-Age=0; Path=/
    Boundary-->>User: 200 OK {"status":"logged_out"}
    deactivate Boundary
    end
```

---

## 3. Bảng mã phản hồi API Xác thực

| Endpoint | Tình huống | Mã HTTP | Thân phản hồi |
|---|---|:---:|---|
| `POST /api/auth/otp/request` | Yêu cầu gửi mã thành công | `200 OK` | `{"status":"sent","expires_in":300}` |
| `POST /api/auth/otp/request` | Bot không vượt qua Turnstile | `400 Bad Request` | `{"error":"bot_check_failed","message":"Xác minh người thật thất bại"}` |
| `POST /api/auth/otp/request` | Gửi yêu cầu quá nhanh (< 60s) | `429 Too Many Requests` | `{"error":"rate_limited","message":"Vui lòng đợi 60 giây trước khi yêu cầu lại"}` |
| `POST /api/auth/otp/verify` | Mã OTP chính xác, đăng nhập thành công | `200 OK` | `{"user":{"id":"...","role":"CUSTOMER"},"expires_at":"..."}` |
| `POST /api/auth/otp/verify` | Mã OTP sai hoặc hết hạn | `400 Bad Request` | `{"error":"invalid_otp","message":"Mã xác thực không đúng hoặc đã hết hạn"}` |
| `POST /api/auth/otp/verify` | Nhập sai quá 5 lần | `429 Too Many Requests` | `{"error":"max_attempts_exceeded","message":"Đã thử sai quá số lần quy định"}` |
| `GET /api/auth/me` | Phiên hợp lệ | `200 OK` | `{"user":{"id":"...","role":"CUSTOMER"}}` |
| `GET /api/auth/me` | Chưa đăng nhập hoặc phiên hết hạn | `401 Unauthorized` | `{"error":"unauthorized","message":"Phiên làm việc không hợp lệ"}` |
