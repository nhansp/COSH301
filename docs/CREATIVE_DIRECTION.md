# Định hướng sáng tạo

Tài liệu đề xuất ba hướng thiết kế cho frontend và chọn một hướng.
Chưa sửa mã nguồn, chưa cài thư viện.
Cần duyệt hướng thiết kế trước khi làm.

Tài liệu đi kèm:

- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md): hệ thống thiết kế của hướng được đề xuất.
- [`3D_EXPERIENCE.md`](3D_EXPERIENCE.md): trải nghiệm chọn vé 3D.
- [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md): kế hoạch triển khai.

## 1. Bối cảnh

### 1.1 Sản phẩm và người dùng

- Sản phẩm bán vé concert tại Việt Nam: K-pop, V-pop, live show trong sân vận động và khu ngoài trời.
- Người dùng chính là fan 18–30 tuổi, mua chủ yếu trên điện thoại.
- Họ mua dưới áp lực thời gian: ghế chỉ được giữ 5 phút, sự kiện đông có phòng chờ.
- Việc chính của giao diện: giúp fan chọn được chỗ tốt, biết rõ giá, và thanh toán trước khi hết giờ giữ ghế.

### 1.2 Hiện trạng đã kiểm tra trong mã nguồn

| Hạng mục | Hiện trạng | Nguồn |
|---|---|---|
| Khung | React 19, Vite 6, TypeScript, Tailwind 4, `react-router-dom` 7 | `frontend/package.json` |
| Token màu | Bộ token Kumo, chạy qua `light-dark()`, có chế độ tối | `frontend/src/index.css` |
| Phông chữ | Be Vietnam Pro, 400–700 | `frontend/index.html` |
| Chuyển động | Gói `motion` đã có trong `package.json` nhưng chưa file `.tsx` nào dùng | `frontend/package.json` |
| Sơ đồ ghế | Lưới 2D trong `SeatMap.tsx`, nằm ở trang sự kiện và trong hộp thoại ở trang thanh toán | `frontend/src/components/SeatMap.tsx` |
| Ảnh | Mỗi sự kiện một ảnh, lấy từ Wikimedia Commons, có giấy phép CC | `frontend/public/events/CREDITS.md` |
| Thanh toán | Chưa có API đơn hàng hay thanh toán; trang thanh toán chỉ mô phỏng và lưu vào `localStorage` | `backend/internal/httpapi/router.go` |

### 1.3 Ràng buộc từ dữ liệu thật

Các ràng buộc này áp dụng cho cả ba hướng.

- Không có dữ liệu hình học địa điểm.
  Bảng `venues` chỉ có tên, địa chỉ, múi giờ.
  Không có vị trí sân khấu, đường biên khu, hay màu khu.
- Toạ độ ghế là lưới tổng hợp, không phải vị trí thật.
  Dữ liệu mẫu đặt `x = số ghế`, `y = thứ hạng khu × 3 + hàng`.
- Không có trường phân biệt khu ngồi và khu đứng.
  14 trên 54 khu trong dữ liệu mẫu là khu đứng, chỉ nhận ra qua tên (ví dụ `GA 1 (đứng)`).
  Khu đứng vẫn được chia thành 24 "ghế" A1–B12 như khu ngồi.
- Mỗi sự kiện chỉ có một ảnh.
  Một ảnh là toàn cảnh sân Mỹ Đình, không phải ảnh biểu diễn.
- Giới hạn vé lấy từ `maxTicketsPerUser` của từng sự kiện (hiện là 4).
- Bốn trạng thái ghế và dấu hiệu không phụ thuộc màu đã được chốt ở mục 4.1 của [`design/README.md`](design/README.md).
  Cả ba hướng đều giữ nguyên quy ước này.

## 2. Ba hướng thiết kế

### Hướng A — Biển chỉ dẫn sân vận động

**Ý tưởng.**
Giao diện nói bằng ngôn ngữ của địa điểm: cổng, khu, hàng, ghế.
Mã vị trí như `A12` là chữ lớn nhất trên màn hình, giống biển số khu trong sân vận động.

**Nhận diện.**
Mặt phẳng bê tông, vạch sơn, chữ hẹp và cao.
Ảnh biểu diễn chỉ xuất hiện ở trang chủ và trang sự kiện.
Ngoài hai trang đó, mọi thứ là thông tin chỉ đường.

**Chữ.**

- Big Shoulders Display cho tiêu đề và mã vị trí.
  Đây là bộ chữ hẹp dựng theo biển hiệu đô thị.
- Be Vietnam Pro cho nội dung (đang dùng sẵn).

**Màu.**

| Tên | Hex | Vai trò |
|---|---|---|
| Bê tông | `#D9DBD7` | Nền |
| Mực biển báo | `#1E2124` | Chữ, viền |
| Vạch sơn | `#F5F5F0` | Mặt nổi |
| Xanh ghế nhựa | `#2457C5` | Hành động chính |
| Vàng vạch | `#F2C230` | Đồng hồ giữ ghế, cảnh báo |

**Bố cục.**
Lưới 12 cột, canh trái tuyệt đối.
Mã vị trí và giá nằm ở cột trái, ảnh và mô tả ở cột phải.

```text
┌──────────────────────────────────────────┐
│ KHU VIP   │  BLACKPINK BORN PINK          │
│ Hàng A    │  Mỹ Đình · 29/7               │
│ ┌──────┐  │  ───────────────────────────  │
│ │ A12  │  │  9.800.000 ₫                  │
│ └──────┘  │  [ Giữ ghế ]                  │
└──────────────────────────────────────────┘
```

**Tương tác.**
Mã vị trí đổi bằng hiệu ứng lật số như bảng giờ tàu.
Giá và đồng hồ dùng chữ số đều cột.

**3D ở bước chọn vé.**
Sân dựng như mô hình kiến trúc màu trắng đục.
Không đổ bóng phức tạp, chỉ có ánh sáng môi trường.
Khu được tô theo bậc giá, chọn khu thì camera bay đến khu đó.

**Đánh đổi.**

- Dễ đọc nhất, dễ đạt chuẩn tương phản nhất.
- Nhẹ nhất cho GPU.
- Ít cảm xúc. Dễ giống ứng dụng giao thông hơn là sản phẩm âm nhạc.

### Hướng B — Đêm diễn

**Ý tưởng.**
Hành trình mua vé đi theo nhịp một đêm concert:

- Trước giờ diễn (trang chủ, khám phá, chi tiết): đèn khán phòng bật, nền sáng, ảnh biểu diễn dẫn dắt.
- Tắt đèn (chọn vé): khung 3D chuyển sang tông sân khấu tối, chỉ sân khấu và khu đang chọn được chiếu sáng.
- Encore (xác nhận, vé của tôi): tấm vé hiện ra dưới đèn dõi.

Độ sáng của giao diện là tín hiệu cho biết người dùng đang ở bước nào.
3D chỉ nằm ở bước tắt đèn, nên có lý do rõ ràng để tồn tại ở đó.

**Nhận diện.**

- Màu nhấn lấy từ chính ảnh của từng sự kiện, tính ở phía trình duyệt.
  Concert BLACKPINK sẽ khác concert Mỹ Tâm mà không cần backend lưu màu.
- Đèn dõi (followspot) màu vàng ấm là dấu hiệu duy nhất cho "vị trí của bạn".
  Nó xuất hiện nhất quán từ sơ đồ 3D đến tấm vé.

**Chữ.**

- Archivo (biến thể độ rộng 62–125) cho tiêu đề, mã vị trí và giá.
  - Độ rộng giãn: tên sự kiện, như chữ trên bảng đèn trước cửa nhà hát.
  - Độ rộng hẹp: mã vị trí, giá, đồng hồ đếm ngược.
  - Một họ chữ, hai vai trò, phân biệt bằng trục độ rộng.
- Be Vietnam Pro cho nội dung và điều khiển (đang dùng sẵn).

**Màu.**

| Tên | Hex | Vai trò |
|---|---|---|
| Khán phòng | `#F2F3F5` | Nền các trang trước và sau bước chọn vé |
| Mực | `#16171D` | Chữ trên nền sáng |
| Sân khấu chờ | `#0B0E26` | Nền khung 3D, luôn tối |
| Đèn dõi | `#FFE2A8` | Vị trí của bạn: ghế đang giữ, khu đang chọn, tấm vé |
| Gel đỏ tía | `#D6336C` | Màu nhấn dự phòng khi ảnh không cho được màu đủ tương phản |

Màu nhấn của từng sự kiện được ép về một khoảng độ sáng cố định.
Quy tắc nằm ở [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

**Bố cục.**
Trang khám phá là lịch diễn theo ngày, không phải lưới thẻ giống nhau.
Concert gắn với ngày giờ, nên ngày là thông tin đầu tiên.

```text
Trang chủ (điện thoại)
┌────────────────────────────┐
│ [ảnh biểu diễn tràn]       │
│                            │
│ BLACKPINK                  │
│ Born Pink in Hanoi         │
│ 29/7 · Mỹ Đình             │
│ [ Chọn vé ]                │
├────────────────────────────┤
│ Lịch diễn                  │
│ 29/7  BLACKPINK   từ 1,2tr │
│ 7/12  Anh Trai…   từ 0,5tr │
│ …                          │
└────────────────────────────┘

Chọn vé (máy tính)
┌───────────────────────────────┬──────────────┐
│                               │ Khu          │
│   [khung 3D, tông tối]        │ ○ VIP  9,8tr │
│        ▄▄ sân khấu ▄▄         │ ● CAT1 6,8tr │
│     ░░░ khu đứng ░░░          │ ○ GA 1 1,8tr │
│   ▒▒▒ khu ngồi ▒▒▒            ├──────────────┤
│                               │ A5  A6       │
│ [Xem sơ đồ phẳng]             │ 04:12  Thanh │
└───────────────────────────────┴──────────────┘
```

Nội dung canh trái.
Chỉ khung 3D và tấm vé được canh giữa, vì cả hai lấy sân khấu làm tâm.

**Tương tác.**

- Mỗi trang có tối đa một chuyển động chủ đích, không tự chạy:
  - trang chủ: ảnh mở đầu lộ dần một lần khi tải;
  - chọn vé: đèn khán phòng tắt khi khung 3D vào khung nhìn;
  - xác nhận: tấm vé trượt ra dưới đèn dõi.
- Mọi chuyển động khác đều trả lời một thao tác của người dùng.

**3D ở bước chọn vé.**

- Sân khấu được chiếu sáng, khu đang chọn sáng lên.
- Các khu khác tối dần theo khoảng cách đến lựa chọn.
- Ghế người khác đang giữ có sọc chéo.
- Ghế của bạn có vòng đèn dõi.
- Không dùng hậu kỳ (bloom, AO) để giữ GPU nhẹ.

**Đánh đổi.**

- Cảm xúc nhất, gắn chặt với âm nhạc trực tiếp.
- Màu nhấn theo ảnh cần kiểm soát tương phản, nếu không dễ ra màu bẩn.
- Khung 3D tối phải tự đạt chuẩn tương phản, kể cả khi trang đang ở chế độ sáng.
- Nặng hơn hướng A một chút vì có ánh sáng có hướng.

### Hướng C — Poster in lụa

**Ý tưởng.**
Lấy cảm hứng từ poster gig in lụa và in riso.
Hai mực in chồng lên nhau, ảnh tram chấm, tấm vé như một bản in sưu tầm.

**Nhận diện.**
Mọi ảnh được chuyển thành ảnh hai màu (duotone).
Chỗ hai mực chồng nhau tạo màu thứ ba.

**Chữ.**

- Phudu cho tiêu đề: bộ chữ hẹp, đậm, có hỗ trợ tiếng Việt.
- Be Vietnam Pro cho nội dung.

**Màu.**

| Tên | Hex | Vai trò |
|---|---|---|
| Giấy lạnh | `#F4F6F8` | Nền |
| Hồng huỳnh quang | `#FF48B0` | Mực thứ nhất |
| Xanh riso | `#0078BF` | Mực thứ hai |
| Chồng mực | `#5A3E9B` | Vùng hai mực chồng |
| Mực đen | `#1B1B1F` | Chữ |

**Bố cục.**
Tiêu đề lớn xếp chồng, lệch khỏi lưới.
Ảnh tràn lề, chữ đè lên ảnh.

```text
┌────────────────────────┐
│ MỸ TÂM ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓ SEE ▓▓▓[ảnh duotone]│
│ ▓▓ THE LIGHT ▓▓▓▓▓▓▓▓▓ │
│ 2025 · TP.HCM          │
│ [ Chọn vé ]            │
└────────────────────────┘
```

**Tương tác.**
Chuyển cảnh bằng hiệu ứng lệch bản in (misregistration).
Hai lớp màu tách ra rồi khớp lại.

**3D ở bước chọn vé.**
Sân dựng bằng shader hai màu kiểu tram chấm (toon và halftone).

**Đánh đổi.**

- Khác biệt nhất về thị giác.
- Đi ngược yêu cầu "ảnh biểu diễn chất lượng cao": ảnh bị biến đổi mạnh.
- Rủi ro giấy phép.
  Ảnh `anh-trai-say-hi-ha-noi-2024.jpg` dùng CC BY-SA 3.0.
  Bản duotone là tác phẩm phái sinh, phải phát hành lại theo cùng giấy phép.
- Shader tram chấm làm sơ đồ ghế khó đọc hơn, nhất là trên điện thoại.

## 3. So sánh

| Tiêu chí | A. Biển chỉ dẫn | B. Đêm diễn | C. Poster in lụa |
|---|---|---|---|
| Dễ dùng khi gấp | Rất tốt | Tốt | Trung bình |
| Cảm xúc âm nhạc | Thấp | Cao | Cao |
| Lý do 3D chỉ ở bước chọn vé | Yếu | Mạnh, gắn với "tắt đèn" | Trung bình |
| Tôn trọng ảnh gốc | Tốt | Tốt | Kém |
| Rủi ro tương phản | Thấp | Trung bình | Trung bình |
| Tải GPU | Thấp | Trung bình | Cao hơn |
| Tận dụng mã hiện có | Tốt | Tốt (giữ Be Vietnam Pro, token Kumo) | Trung bình |

## 4. Đề xuất: Hướng B — Đêm diễn

Lý do:

1. Đây là hướng duy nhất có lý do nội tại để 3D chỉ xuất hiện ở bước chọn vé.
   Ánh sáng là ngôn ngữ của cả sản phẩm.
   Bước chọn vé là lúc đèn tắt và sân khấu sáng lên.
2. Màu nhấn lấy từ ảnh nên mỗi sự kiện có bản sắc riêng mà không cần thêm dữ liệu ở backend.
3. Ảnh biểu diễn được giữ nguyên, đúng yêu cầu và an toàn về giấy phép.
4. Dấu hiệu đèn dõi xuyên suốt từ sơ đồ đến vé giúp người dùng luôn biết "chỗ của mình" ở đâu.

Mượn từ hướng A một điểm: mã vị trí là chữ lớn nhất trên tấm vé và trong khay chọn ghế.

### 4.1 Rà soát so với lối mòn

Bản nháp đầu của hướng B bị kéo về các lối mòn.
Những điểm đã sửa:

- Nền đen tuyền với một màu neon duy nhất → sửa thành nền sáng cho các trang khám phá.
  Tông tối chỉ dùng trong khung 3D.
  Nền tối là xanh navy sân khấu `#0B0E26`; màu chỉ nằm ở mặt khu và vài đường đèn mảnh.
- Trang chủ là lưới thẻ sự kiện bo góc giống nhau → sửa thành lịch diễn theo ngày.
  Ảnh lớn chỉ dành cho sự kiện đầu tiên.
- Nhãn chữ in hoa giãn cách phía trên mỗi tiêu đề → bỏ hẳn.
  Chữ in hoa tiếng Việt còn làm dấu chồng lên nhau.
- Số thứ tự 01 / 02 / 03 trang trí → chỉ dùng ở các bước thanh toán, vì đó thật sự là một trình tự.
- Một bán kính bo góc cho mọi thứ → bo góc theo cấp bậc, quy định trong [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

## 5. Cần duyệt

1. Chọn hướng: A, B, hoặc C.
2. Đồng ý chuyển sơ đồ ghế khỏi trang chi tiết sự kiện sang một trang chọn vé riêng.
   Trang mới dự kiến là `/events/:id/tickets`.
3. Đồng ý ghi rõ trên sơ đồ 3D rằng đây là sơ đồ minh hoạ, không theo vị trí thật.
   Lý do: backend chưa có dữ liệu hình học địa điểm (mục 1.3).
4. Đồng ý cách xử lý khu đứng:
   - chọn số lượng, không chọn vị trí;
   - frontend tự giữ các "ghế" còn trống trong khu đó.
   Chi tiết ở [`3D_EXPERIENCE.md`](3D_EXPERIENCE.md).
