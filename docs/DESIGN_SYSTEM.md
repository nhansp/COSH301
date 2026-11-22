# Hệ thống thiết kế

Hệ thống thiết kế cho hướng **B — Đêm diễn** trong [`CREATIVE_DIRECTION.md`](CREATIVE_DIRECTION.md).
Đây là bản nháp chờ duyệt.
Nếu chọn hướng khác, tài liệu này sẽ được viết lại.

## 1. Nguyên tắc

1. **Ánh sáng báo vị trí trong hành trình.**
   Trước bước chọn vé thì đèn khán phòng sáng.
   Ở bước chọn vé thì sân khấu tối.
   Ở bước xác nhận thì có đèn dõi.
2. **Đèn dõi chỉ dành cho "của bạn".**
   Màu `spot` chỉ dùng cho ghế bạn đang giữ, khu bạn đang chọn và vé của bạn.
   Không dùng màu này để trang trí.
3. **Ảnh sự kiện cấp màu, giao diện giữ trung tính.**
   Điều khiển vẫn đơn sắc như quy ước trong `index.css` hiện tại.
   Màu nhấn của sự kiện chỉ xuất hiện ở vùng thuộc về sự kiện đó.
4. **Mỗi trang một khoảnh khắc chuyển động.**
   Các chuyển động còn lại đều phải trả lời một thao tác.
5. **Dữ liệu thật, nói thật.**
   Sơ đồ minh hoạ thì ghi là minh hoạ.
   Khu đứng thì không cho chọn vị trí.
   Thanh toán mô phỏng thì không giả làm cổng thật.

## 2. Màu

### 2.1 Bảng gốc

| Token | Sáng | Tối | Vai trò |
|---|---|---|---|
| `house` | `#F2F3F5` | `#15161C` | Nền trang |
| `ink` | `#16171D` | `#ECEDF0` | Chữ chính |
| `ink-muted` | `#5B5E6B` | `#A3A6B3` | Chữ phụ |
| `stage` | `#131735` | `#131735` | Nền khung 3D, không đổi theo chế độ |
| `spot` | `#FFE2A8` | `#FFE2A8` | Đèn dõi: vị trí của bạn |
| `accent` | Lấy từ ảnh | Lấy từ ảnh | Màu nhấn của sự kiện |
| `accent-fallback` | `#D6336C` | `#E0577F` | Khi ảnh không cho được màu dùng được |

`stage` không đổi theo chế độ sáng tối.
Khung 3D là một ô cửa nhìn vào khán phòng đã tắt đèn.

### 2.2 Ánh xạ sang token Kumo hiện có

Không xoá bộ token Kumo trong `frontend/src/index.css`.
Các tên token ngữ nghĩa giữ nguyên để không phải sửa mọi component một lúc.

| Token Kumo | Nhận giá trị mới |
|---|---|
| `--color-kumo-canvas` | `house` |
| `--text-color-kumo-default` | `ink` |
| `--text-color-kumo-subtle` | `ink-muted` |
| `--color-kumo-brand` | Giữ màu mực đơn sắc như hiện tại |

Token mới thêm vào cùng file:

- `--color-stage`
- `--color-spot`
- `--color-accent`
- `--color-accent-ink`: màu chữ đặt trên `accent`.

### 2.3 Màu nhấn theo ảnh

Màu nhấn được tính ở trình duyệt từ ảnh `imageUrl` của sự kiện.
Không cần trường mới ở backend.

Quy trình:

1. Vẽ ảnh lên canvas 32 × 32 điểm ảnh.
   Ảnh nằm cùng origin tại `frontend/public/events/`, nên không vướng CORS.
2. Lấy màu có độ bão hoà cao nhất trong nhóm màu chiếm nhiều điểm ảnh.
3. Đổi sang OKLCH, rồi ép các thành phần:
   - độ sáng L về 0.62 ở chế độ sáng và 0.72 ở chế độ tối;
   - độ bão hoà C tối đa 0.17.
4. Kiểm tra tương phản với `accent-ink`.
   Không đạt 4.5:1 thì dùng `accent-fallback`.
5. Lưu kết quả vào `sessionStorage` theo `eventId`.

Màu nhấn chỉ dùng cho:

- nút hành động chính trên trang sự kiện;
- vạch thời gian của sự kiện trong lịch diễn;
- dải màu trên cuống vé.

### 2.4 Trạng thái ghế

Giữ đúng mục 4.1 của [`design/README.md`](design/README.md).
Mỗi trạng thái có một dấu hiệu không phụ thuộc màu.

| Trạng thái API | Màu 2D | Dấu hiệu 2D | Dấu hiệu 3D |
|---|---|---|---|
| `available` | Xanh lá `#2FA86B` | Ô đặc | Khối ghế cao bình thường |
| `sold` | Xám `#8C909C` | Số bị gạch ngang | Khối ghế hạ thấp, mờ |
| `held` | Vàng cam `#E8A23A` | Sọc chéo | Sọc chéo trên mặt ghế |
| `selected` (của bạn) | Mực, có viền | Viền dày | Vòng sáng màu `spot` quanh ghế |

Trong khung 3D, `selected` dùng màu `spot` thay cho màu mực.
Lý do: nền `stage` tối, mực đen không nhìn thấy.
Thiết kế gốc cũng cho phép đổi mực sang trắng ở giao diện tối.

### 2.5 Thang màu theo bậc giá

Khu được tô theo thứ hạng giá trong sự kiện, không theo tên khu.
Lý do: backend chưa có trường màu khu.

- Khu đắt nhất: sáng và ấm nhất.
- Khu rẻ nhất: tối và lạnh nhất.
- Thang có 6 bậc, nội suy trong OKLCH từ `#F0C987` đến `#3B4C8C`.
- Sự kiện nhiều hơn 6 khu thì các khu cùng bậc phân biệt bằng nhãn tên.

## 3. Chữ

### 3.1 Họ chữ

| Họ chữ | Vai trò | Trục dùng |
|---|---|---|
| Archivo (variable) | Tên sự kiện, mã vị trí, giá, đồng hồ | `wdth` 62–125, `wght` 400–800 |
| Be Vietnam Pro | Nội dung, nhãn, nút, biểu mẫu | `wght` 400–700 (đang dùng) |

Archivo dùng hai độ rộng cho hai vai trò:

- `wdth` 112–125: tên sự kiện, như chữ trên bảng đèn trước nhà hát.
- `wdth` 62–75: mã vị trí, giá, đồng hồ. Gọn và dễ so sánh.

Cần kiểm tra trước khi dùng:

- Archivo trên Google Fonts có subset `vietnamese` và trục `wdth`.
- Be Vietnam Pro có `font-feature-settings: "tnum"`.
  Nếu không có, giá và đồng hồ dùng Archivo.

### 3.2 Thang cỡ chữ

Dùng thang cổ điển trong *The Elements of Typographic Style*.

| Bước | px | Dùng cho |
|---|---|---|
| `xs` | 12 | Ghi nguồn ảnh, chú thích |
| `sm` | 14 | Nhãn phụ |
| `base` | 16 | Nội dung (điện thoại) |
| `md` | 18 | Nội dung nổi bật |
| `lg` | 21 | Tiêu đề khối |
| `xl` | 24 | Tiêu đề trang (điện thoại) |
| `2xl` | 36 | Tiêu đề trang (máy tính), mã vị trí trong khay |
| `3xl` | 48 | Tên sự kiện ở trang chi tiết |
| `4xl` | 72 | Tên sự kiện ở ảnh mở đầu, mã vị trí trên vé |

### 3.3 Quy tắc

- Chiều dài dòng nội dung tối đa 70 ký tự.
- Chữ có dấu tiếng Việt cần khoảng trống phía trên:
  - tiêu đề `line-height` tối thiểu 1.15;
  - nội dung 1.55.
- Không dùng `text-transform: uppercase`.
  Tên sự kiện đã viết hoa trong dữ liệu (ví dụ `BLACKPINK WORLD TOUR`) thì giữ nguyên.
- Không tô riêng một từ trong tiêu đề bằng màu hay chữ nghiêng.
- Giá viết đầy đủ ở trang thanh toán: `9.800.000 ₫`.
  Giá rút gọn chỉ dùng ở lịch diễn và nhãn trong khung 3D: `9,8 tr`.

## 4. Bố cục

### 4.1 Lưới

| Kích thước | Cột | Lề | Khoảng cột |
|---|---|---|---|
| < 640 px | 4 | 16 px | 12 px |
| 640–1023 px | 8 | 24 px | 16 px |
| ≥ 1024 px | 12 | 40 px | 24 px |

- Chiều rộng nội dung tối đa 1200 px.
- Ảnh mở đầu được tràn lề.

### 4.2 Khoảng cách

Bước 4 px: 4, 8, 12, 16, 24, 32, 48, 64, 96.
Khoảng giữa các khối lớn trong trang là 64 px trên máy tính, 48 px trên điện thoại.

### 4.3 Bo góc theo cấp

| Cấp | Bán kính | Dùng cho |
|---|---|---|
| Điều khiển | 8 px | Nút, ô nhập, chip ghế |
| Bề mặt | 16 px | Bảng điều khiển, sheet dưới đáy |
| Ảnh | 0 px | Ảnh tràn lề, ảnh trong lịch diễn |
| Vé | 20 px, có khuyết bán nguyệt ở đường xé | Tấm vé |

### 4.4 Độ nổi

- Không đổ bóng cho thẻ trong danh sách.
- Phân tầng bằng nền (`house` và `kumo-elevated`) và đường kẻ `kumo-hairline`.
- Chỉ sheet, hộp thoại và tấm vé có bóng.

## 5. Ảnh

- Ảnh dùng nguyên bản. Không chuyển hai màu, không lồng gradient trang trí.
- Được phép phủ một lớp tối từ dưới lên để chữ đè lên đạt tương phản 4.5:1.
- Luôn hiện `imageCredit` cạnh ảnh, cỡ `xs`.
  Điều này bắt buộc theo giấy phép CC trong `frontend/public/events/CREDITS.md`.
- Vùng cắt ảnh:
  - ảnh mở đầu: 4:5 trên điện thoại, 21:9 trên máy tính;
  - lịch diễn: 1:1.
- Ảnh chỉ có toàn cảnh sân thì đặt điểm cắt vào sân khấu.
  Điểm cắt lưu trong mã frontend, theo `slug`.

## 6. Chuyển động

### 6.1 Thời lượng và easing

| Token | Thời lượng | Easing | Dùng cho |
|---|---|---|---|
| `tap` | 100 ms | `ease-out` | Phản hồi chạm, đổi trạng thái nút |
| `reveal` | 240 ms | `cubic-bezier(0.2, 0, 0, 1)` | Mở sheet, mở rộng khối |
| `scene` | 700 ms | `cubic-bezier(0.65, 0, 0.35, 1)` | Camera 3D bay, đèn khán phòng tắt |
| `encore` | 900 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Tấm vé hiện ra ở bước xác nhận |

### 6.2 Khoảnh khắc chủ đích

| Trang | Khoảnh khắc |
|---|---|
| Trang chủ | Ảnh mở đầu sáng dần một lần khi tải |
| Chọn vé | Viền trang tối dần khi khung 3D vào khung nhìn |
| Xác nhận | Tấm vé trượt ra, đèn dõi quét qua mã vị trí |

### 6.3 Giảm chuyển động

Khi `prefers-reduced-motion: reduce`:

- bỏ ba khoảnh khắc trên, hiện trạng thái cuối ngay;
- camera 3D chuyển cảnh tức thì, không bay;
- đồng hồ đếm ngược vẫn chạy, vì đó là thông tin.

### 6.4 Thư viện

Dùng gói `motion` đã có trong `package.json`.
Không thêm GSAP hay một thư viện chuyển động thứ hai.

## 7. Thành phần chính

### 7.1 Mã vị trí

- Archivo `wdth` 68, `wght` 700.
- Khu đứng hiện tên khu, không hiện mã "ghế".
  Ví dụ: `GA 1 · Vé đứng`, không phải `A1`.

### 7.2 Giá

- Archivo `wdth` 75, chữ số đều cột.
- Hiện giá của chính ghế (`currentPrice`), không hiện giá hạng chung.

### 7.3 Đồng hồ giữ ghế

- Đếm theo `expiresAt` do server trả về.
- Còn dưới 60 giây thì đổi sang màu `held` và đọc qua `aria-live="polite"` một lần.
- Hết giờ thì nói rõ ghế nào đã được trả, và chỉ cách chọn lại.

### 7.4 Tấm vé

- Mã vị trí cỡ `4xl`.
- Dải màu `accent` ở cuống vé.
- Có đường xé với hai khuyết bán nguyệt.
- QR nằm ở cuống.

### 7.5 Các bước thanh toán

Đây là trình tự thật, nên được đánh số:

1. Vị trí
2. Thông tin người tham dự
3. Thanh toán

## 8. Giọng văn

- Viết tiếng Việt tự nhiên, câu ngắn, kiểu chữ thường đầu câu.
- Nút nói đúng việc sẽ xảy ra:
  - "Giữ ghế", không phải "Xác nhận";
  - "Thanh toán 34.196.000 ₫", không phải "Tiếp tục".
- Một hành động giữ một tên xuyên suốt.
  Nút "Giữ ghế" thì thông báo là "Đã giữ ghế A5".
- Lỗi nói chuyện gì đã xảy ra và cách sửa.
  Ví dụ: "Ghế A5 vừa có người giữ. Chọn ghế khác trong khu VIP."
- Trang trống mời người dùng hành động.
  Ví dụ: "Bạn chưa có vé nào. Xem lịch diễn."

## 9. Tiếp cận

- Tương phản chữ tối thiểu 4.5:1, chữ lớn và biểu tượng 3:1.
  Áp dụng cả trong khung 3D.
- Vùng chạm tối thiểu 44 × 44 px.
  Trên điện thoại, ghế 3D được chọn qua danh sách khi ghế quá nhỏ.
- Viền focus rõ: 2 px màu `kumo-focus`, cách phần tử 2 px.
- Mọi thao tác trong khung 3D có đường làm tương đương bằng bàn phím trong bảng điều khiển DOM.
