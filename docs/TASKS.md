# Phân công công việc

Nhánh làm việc chung: `staging` (tên cũ: `rewrite`).
`main` là bản ổn định, chỉ cập nhật từ `staging`.
Thiết kế gốc: [`docs/design/README.md`](design/README.md). Đọc file này trước khi bắt tay vào việc.

## 1. Bảng phân công

| Mã | Việc | Người làm | File | Phụ thuộc |
|---|---|---|---|---|
| T01 | ERD sinh từ database mới | Huy (`vdhwy`) | `docs/erd.md` | T12 |
| T02 | Sơ đồ lớp theo BCE | Huy (`vdhwy`) | `docs/class-diagram.md` | T12 |
| T03 | Kế hoạch Sprint, WBS, ước lượng | Huy (`vdhwy`) | `docs/sprints.md` | — |
| T04 | Sequence: giữ ghế 5 phút (FR-06) | Dũng (`Lan-0924`) | `docs/sequences/hold.md` | — |
| T05 | Kiểm thử thủ công FR-06 theo US-03 | Dũng (`Lan-0924`) | `docs/checks/fr-06.md` | T12 |
| T06 | Sequence: chống bán trùng (FR-07) | Phúc (`phukzz`) | `docs/sequences/double-booking.md` | — |
| T07 | DFD mức ngữ cảnh, mức 0, mức 1 | Phúc (`phukzz`) | `docs/dfd.md` | — |
| T08 | Bài toán và thiết kế Định giá động | Thành (`Th4nhDT716`) | `docs/dynamic-pricing.md` | — |
| T09 | Bảng FR/NFR, trạng thái, truy vết | Thành (`Th4nhDT716`) | `docs/spec.md` | — |
| T10 | Sơ đồ và đặc tả Use Case | Đức Anh | `docs/use-cases.md` | — |
| T11 | Kiểm thử với người dùng | Đức Anh | `docs/testing.md` | T12 |
| T12 | Backend Go, frontend, Docker, cờ tính năng | Nhân (`nhansp`) | `backend/`, `frontend/`, `compose.yaml` | — |
| T13 | Sequence: đăng nhập OTP (FR-04) | Nhân (`nhansp`) | `docs/sequences/otp-login.md` | — |
| T14 | Kiến trúc và đặc tả API | Nhân (`nhansp`) | `docs/architecture.md`, `docs/api/openapi.yaml` | T12 |

Việc có phụ thuộc T12 thì chờ backend lên nhánh `staging` rồi mới làm.
Các việc còn lại làm được ngay.

## 2. Yêu cầu từng việc

**T01 — ERD.**
Chạy hệ thống, lấy schema từ PostgreSQL và vẽ lại ERD bằng Mermaid.
Ghi rõ điểm khác so với ERD Sprint 1 (mục 5 của thiết kế).

**T02 — Sơ đồ lớp.**
Làm theo bài B05: Entity lấy từ `internal/store`, Control từ `internal/service`, Boundary từ `internal/httpapi`.
Mỗi Entity phải khớp một bảng trong ERD.

**T03 — Sprint.**
Giữ nguyên Sprint 1 như đã báo cáo.
Từ Sprint 2 trở đi: danh sách việc, người làm, ước lượng giờ, profile cờ tương ứng.

**T04, T06, T13 — Sequence.**
Bám đúng quy tắc ở mục 6 của thiết kế.
Tên đối tượng trùng tên lớp trong sơ đồ lớp (T02).

**T05 — Kiểm thử FR-06.**
Đi từng tiêu chí chấp nhận của US-03.
Mỗi tiêu chí ghi: các bước, kết quả mong đợi, kết quả thực tế, đạt/không đạt.

**T07 — DFD.**
Dựa trên DFD Level 1 của Sprint 1, cập nhật theo tác nhân và luồng ở mục 2 và 4 của thiết kế.
Mỗi kho dữ liệu phải ứng với bảng có thật trong ERD.

**T08 — Định giá động.**
Đây là phần chấm điểm giữa kỳ.
Cần có: mô tả bài toán, mô hình giả định, dữ liệu đầu vào, quy tắc đổi giá, ví dụ tính tay.
Bám mục 6 của thiết kế; muốn đổi quy tắc thì ghi lý do trong PR.

**T09 — Đặc tả.**
Liệt kê FR-01 … FR-23, NFR-01 … NFR-13 theo đúng mã trong tài liệu SA.
Mỗi yêu cầu ghi: cờ tính năng, Sprint, trạng thái (chưa làm / đang làm / xong).

**T10 — Use Case.**
Tác nhân lấy từ mục 2 của thiết kế.
Mỗi Use Case có: tác nhân, tiền điều kiện, luồng chính, luồng phụ, mã FR liên quan.

**T11 — Kiểm thử người dùng.**
Viết kịch bản kiểm thử và form khảo sát.
Mời 5–10 người dùng thật, tổng hợp kết quả và đề xuất sửa.

## 3. Quy trình gửi PR

Nhánh `main` và `staging` đã khóa: không ai push thẳng được.
Mọi thay đổi phải qua Pull Request và được duyệt trước khi merge.

### Các bước

```bash
git fetch origin
git switch -c <github-user>/<mã-việc> origin/staging   # ví dụ: vdhwy/T03
# ... làm việc ...
git add <các file của việc này>
git commit --signoff
git push -u origin HEAD
gh pr create --base staging                             # hoặc tạo PR trên web, base là staging
```

### Quy tắc

- Một PR làm đúng một việc trong bảng phân công.
- PR luôn nhắm vào `staging`, không nhắm vào `main`.
- `main` chỉ nhận bản đã chạy ổn trên `staging` (fast-forward).
- Chỉ sửa file thuộc việc của mình. Cần sửa file khác thì ghi lý do trong PR.
- Commit theo [`AGENTS.md`](../AGENTS.md): tiêu đề dạng `docs: Add use case diagram`, tối đa 80 ký tự, luôn có `--signoff`.
- Nhánh `staging` có thay đổi mới và PR bị xung đột thì `git rebase origin/staging` rồi push lại.
- Nhánh cũ tạo từ `rewrite` vẫn dùng được: GitHub đã đổi tên, chỉ cần `git fetch --prune` rồi rebase lên `origin/staging`.
- Người duyệt yêu cầu sửa thì sửa trên chính nhánh đó, không mở PR mới.

### Không đưa lên repo

- Thư mục cài đặt và build: `node_modules/`, `.venv/`, `dist/`, `build/`.
- File xuất ra: `.docx`, `.pdf`, `.png` xuất từ sơ đồ.
- File nháp: script thử, file `*_output.txt`, bản sao kiểu `abc (1).md`.
- File bí mật: `.env`, khóa API, mật khẩu.
- Cấu hình riêng của máy: `.vscode/`, `.idea/`.
- Cả một project lạ copy vào repo.

Sơ đồ viết bằng Mermaid ngay trong file `.md`.
GitHub tự hiển thị, không cần đính kèm ảnh.

## 4. Dùng AI

Được dùng ChatGPT, Gemini, Claude, Copilot… nhưng:

- Trước khi giao việc, cho AI đọc [`AGENTS.md`](../AGENTS.md), [`docs/AGENTS.md`](AGENTS.md) và [`docs/design/README.md`](design/README.md).
- Tự đọc lại toàn bộ kết quả trước khi commit. Người gửi PR chịu trách nhiệm nội dung.
- Xóa phần thừa của AI: lời chào, "Dưới đây là…", "Hy vọng giúp ích…", ghi chú không liên quan.
- AI không được tự bịa yêu cầu mới hay đổi mã FR.
