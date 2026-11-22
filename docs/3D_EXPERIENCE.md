# Trải nghiệm chọn vé 3D

Thiết kế khung 3D cho bước chọn vé, theo hướng **B — Đêm diễn** trong [`CREATIVE_DIRECTION.md`](CREATIVE_DIRECTION.md).
Bản nháp chờ duyệt.

## 1. Phạm vi

- 3D chỉ có ở trang chọn vé, dự kiến là route `/events/:id/tickets`.
- Trang chủ, khám phá, chi tiết sự kiện, thanh toán và xác nhận không dùng Three.js.
- Sơ đồ ghế 2D trong `SeatMap.tsx` được giữ lại làm phương án dự phòng.
  Hiện sơ đồ này nằm ở trang chi tiết và trong hộp thoại ở trang thanh toán.
  Cả hai chỗ sẽ chuyển sang trang chọn vé.

## 2. Dữ liệu

### 2.1 Dữ liệu có sẵn

| Nguồn | Trường | Dùng cho |
|---|---|---|
| `GET /api/events/{slug}` | `zones[].zoneId`, `zoneCode`, `zoneName` | Danh sách khu |
| | `zones[].capacity` | Sức chứa khu |
| | `zones[].basePrice`, `floorPrice`, `ceilingPrice` | Bậc giá, thứ tự khu |
| | `zones[].floor` | Tầng; dữ liệu mẫu đang để trống |
| | `maxTicketsPerUser` | Giới hạn vé |
| `GET /api/events/{id}/seats` | `seatId`, `label`, `row`, `number` | Ghế và mã vị trí |
| | `x`, `y` | Chỉ dùng để sắp thứ tự (xem 2.2) |
| | `status`, `isMyHold` | Trạng thái ghế |
| | `currentPrice` | Giá từng ghế |
| | `zoneId`, `zoneCode`, `zoneName` | Ghế thuộc khu nào |
| `GET /api/events/{id}/stream` | SSE `update`: `type`, `seatId`, `status` | Cập nhật trực tiếp |
| `POST /api/holds` | `eventId`, `seatId` → `expiresAt` | Giữ một ghế |
| `DELETE /api/holds/{seatId}` | | Trả ghế |

Nguồn: `backend/internal/service/event_service.go`, `seat_service.go`, `backend/internal/httpapi/router.go`.

### 2.2 Dữ liệu còn thiếu

| Thiếu | Hệ quả |
|---|---|
| Vị trí sân khấu | Sân khấu luôn đặt ở một đầu sơ đồ |
| Đường biên, vị trí khu | Khu được xếp theo bậc giá (mục 4) |
| Toạ độ ghế thật | `x = số ghế`, `y = hạng khu × 3 + hàng` chỉ là lưới tổng hợp |
| Loại khu (ngồi hay đứng) | Suy ra từ tên khu (mục 3) |
| Màu khu | Tô theo bậc giá |
| Ảnh góc nhìn thật | Góc nhìn chỉ là ước lượng từ sơ đồ (mục 9) |

Kết luận: không dựng được bản sao đúng của sân Mỹ Đình hay Ocean Park.
Khung 3D là **sơ đồ minh hoạ** sinh từ danh sách khu và bậc giá.
Khung luôn hiện dòng chữ:

> Sơ đồ minh hoạ theo hạng vé. Vị trí thật của các khu theo công bố của Ban Tổ chức.

## 3. Khu ngồi và khu đứng

### 3.1 Nhận diện

Backend chưa có trường loại khu.
Frontend coi một khu là **khu đứng** khi `zoneName` chứa chữ "đứng", không phân biệt hoa thường.

Dữ liệu mẫu có 14 khu đứng trên 54 khu, ví dụ:

- `GA 1 (đứng)`
- `CAT 1 (khu đứng)`
- `Đứng - Mứt Gừng 1, 2`

Quy tắc này dễ vỡ.
Hàm nhận diện nằm riêng một chỗ, để đổi sang trường từ backend khi có.

### 3.2 Khu ngồi

- Hiện từng ghế.
- Người dùng chọn ghế cụ thể.
- Mỗi ghế có mã `label`, trạng thái và giá riêng.

### 3.3 Khu đứng

Backend vẫn chia khu đứng thành 24 "ghế" A1–B12.
Hiện các mã này cho người dùng là sai: không có chỗ đứng cố định tên A1.

Cách làm:

1. Khu đứng hiện như một mặt sàn, không có ghế.
   Mặt sàn có nhãn tên khu, giá và số vé còn lại.
2. Người dùng chọn **số lượng**, trong giới hạn:
   - số vé còn được mua theo `maxTicketsPerUser`;
   - số "ghế" còn `available` trong khu.
3. Frontend gọi `POST /api/holds` lần lượt cho từng "ghế" còn trống trong khu.
   - Gặp xung đột (người khác vừa giữ) thì thử ghế trống kế tiếp.
   - Không đủ số lượng thì giữ phần đã được, rồi báo rõ: "Chỉ giữ được 2 trên 3 vé. Khu GA 1 vừa hết chỗ."
4. Vé, giỏ và trang thanh toán hiện `GA 1 · Vé đứng`, không hiện mã "ghế".

Không cần API mới.
Mọi lời gọi vẫn dùng hợp đồng hiện có.

## 4. Dựng sơ đồ

### 4.1 Quy tắc xếp khu

Hàm thuần `buildVenueLayout(zones, seats)` trả về hình học của sơ đồ.
Cùng đầu vào thì luôn cùng đầu ra.

1. Sân khấu là một khối chữ nhật ở đầu sơ đồ (phía −Z).
2. Sắp các khu theo `basePrice` giảm dần.
   Cùng giá thì giữ thứ tự API trả về.
3. Khu đứng nằm trên mặt sàn, ngay trước sân khấu.
   Mỗi khu là một dải chữ nhật, khu đắt hơn gần sân khấu hơn.
4. Khu ngồi xếp thành các cung tròn quanh sân khấu, theo hình móng ngựa.
   - Khu đắt hơn nằm ở cung trong và thấp hơn.
   - Mỗi cung tối đa 3 khu, chia đều góc 150°.
5. Trong một khu ngồi:
   - `row` quyết định độ sâu và độ cao, mỗi hàng nâng 0,4 đơn vị như khán đài có độ dốc;
   - `number` quyết định vị trí dọc theo cung;
   - `x` và `y` từ API chỉ dùng để sắp thứ tự khi `row` hoặc `number` trống.

```mermaid
flowchart LR
    A[zones từ event detail] --> C[buildVenueLayout]
    B[seats từ /seats] --> C
    C --> D[Sân khấu]
    C --> E[Dải khu đứng]
    C --> F[Cung khu ngồi]
    F --> G[Toạ độ từng ghế]
```

### 4.2 Hình khối

| Thành phần | Hình học | Vật liệu |
|---|---|---|
| Sân khấu | Hộp, một lần vẽ | `MeshStandardMaterial`, phát sáng nhẹ |
| Khu đứng | Mặt phẳng | Màu theo bậc giá |
| Khu ngồi | Khối cung đùn | Màu theo bậc giá |
| Ghế | Một `InstancedMesh` cho cả sự kiện | Màu theo trạng thái, đặt theo instance |
| Vòng của bạn | Một `InstancedMesh` hình vòng | Màu `spot`, tự phát sáng |

- Mỗi sự kiện mẫu có 168–288 ghế, nên một `InstancedMesh` là đủ.
- Không có texture ảnh.
- Sọc chéo của ghế `held` vẽ bằng một shader nhỏ dùng chung.

## 5. Tương tác

### 5.1 Luồng

```mermaid
stateDiagram-v2
    [*] --> TongQuan: tải xong
    TongQuan --> KhuNgoi: chọn khu ngồi
    TongQuan --> KhuDung: chọn khu đứng
    KhuNgoi --> KhuNgoi: chạm ghế trống / chạm ghế của mình
    KhuDung --> KhuDung: đổi số lượng
    KhuNgoi --> TongQuan: Quay lại toàn sân
    KhuDung --> TongQuan: Quay lại toàn sân
    KhuNgoi --> ThanhToan: Thanh toán
    KhuDung --> ThanhToan: Thanh toán
    ThanhToan --> [*]
```

### 5.2 Toàn sân

- Camera nhìn chéo từ phía sau khán đài về sân khấu.
- Mỗi khu có nhãn: tên, giá "từ", số chỗ còn.
- Khu hết chỗ thì mờ đi, có nhãn "Hết vé", không chọn được.
- Bảng điều khiển bên cạnh (dưới đáy trên điện thoại) liệt kê cùng các khu đó.

### 5.3 Trong một khu ngồi

- Camera bay đến khu, thời lượng `scene` 700 ms.
- Chạm ghế trống thì gọi `POST /api/holds`.
- Chạm ghế của mình thì gọi `DELETE /api/holds/{seatId}`.
- Chạm ghế không chọn được thì hiện thông báo.
  Ghế không vào giỏ (mục 4.1, bước 7 của thiết kế gốc).
- Đạt giới hạn thì hiện "Đã đạt giới hạn số vé cho sự kiện này".

### 5.4 Camera

Dùng `CameraControls` của Drei, có giới hạn:

- góc ngẩng từ 15° đến 70°, không chui xuống dưới sàn;
- góc xoay ngang ±80° quanh trục sân khấu, không nhìn từ sau sân khấu;
- khoảng cách bị giới hạn để toàn sân luôn còn trong khung.

Nút "Quay lại toàn sân" luôn hiện khi đang ở trong một khu.

## 6. Đồng bộ trạng thái

Hiện `SeatMap.tsx` tự giữ trạng thái ghế.
Trang chọn vé tách phần này thành hook `useSeatInventory(eventId)`.

Hook này lo các việc:

- tải `/seats` lần đầu;
- nghe SSE `/stream` và cập nhật từng ghế;
- gọi `POST /api/holds` và `DELETE /api/holds/{seatId}`;
- lưu `expiresAt` của từng ghế đang giữ;
- tính số vé còn được mua, dùng `ticketLimitOf(event)` và `ticketsBookedFor(eventId)` đã có.

Khung 3D, sơ đồ 2D dự phòng và bảng điều khiển DOM cùng đọc một nguồn này.
Ba nơi không bao giờ lệch nhau.

```mermaid
flowchart TD
    API[REST /seats] --> H[useSeatInventory]
    SSE[SSE /stream] --> H
    H --> V3[Khung 3D]
    H --> V2[Sơ đồ 2D dự phòng]
    H --> P[Bảng điều khiển DOM]
    V3 -- giữ / trả ghế --> H
    V2 -- giữ / trả ghế --> H
    P -- giữ / trả ghế --> H
```

## 7. Hiệu năng

### 7.1 Tải lười

- Trang chọn vé tải khung 3D qua `React.lazy(() => import('./venue3d/VenueScene'))`.
- Các trang khác không chứa mã Three.js.
  Kiểm tra bằng cách xem các chunk sinh ra sau `vite build`.
- Trong lúc tải, bảng điều khiển DOM đã dùng được.
  Người dùng có thể chọn khu trước khi khung 3D hiện ra.

### 7.2 Ngân sách

Đây là mục tiêu, sẽ đo sau khi dựng.

| Chỉ số | Mục tiêu |
|---|---|
| Chunk 3D sau gzip | ≤ 250 KB |
| Draw call ở toàn sân | ≤ 30 |
| Khung hình khi xoay, Android tầm trung | ≥ 50 fps |
| Bộ nhớ GPU | ≤ 64 MB |

### 7.3 Cách tiết kiệm GPU

- `frameloop="demand"`: chỉ vẽ lại khi camera di chuyển hoặc dữ liệu đổi.
- `dpr={[1, 1.75]}`.
- Không bóng đổ thời gian thực, không bloom, không SSAO.
- Đèn dõi là mặt nón phát sáng, không phải `SpotLight` đổ bóng.
- Tab bị ẩn thì dừng vẽ.
- Rời trang thì giải phóng geometry và material.

## 8. Dự phòng

| Tình huống | Xử lý |
|---|---|
| Đang tải chunk 3D | Bảng điều khiển DOM dùng được; khung 3D hiện khung xương tĩnh |
| Trình duyệt không có WebGL | Hiện sơ đồ 2D, kèm một dòng giải thích |
| Mất WebGL context | Hiện sơ đồ 2D; nút "Thử lại khung 3D" |
| Người dùng chọn "Xem sơ đồ phẳng" | Hiện sơ đồ 2D; nhớ lựa chọn trong `localStorage` |
| Lỗi tải `/seats` | Báo lỗi và có nút tải lại; không vẽ sơ đồ rỗng |

## 9. Góc nhìn ước lượng

Không bắt buộc, làm ở giai đoạn sau.

- Chỉ có cho khu ngồi.
- Camera đặt ở tâm khu, cao bằng mắt người ngồi, nhìn về sân khấu.
- Luôn ghi "Góc nhìn ước lượng từ sơ đồ minh hoạ, không phải ảnh thật".
- Không làm cho khu đứng: chỗ đứng không cố định nên góc nhìn không có nghĩa.

## 10. Điện thoại

- Khung 3D chiếm 55% chiều cao màn hình (`55svh`).
- Bảng điều khiển là sheet kéo được ở dưới đáy.
- Chạm một ngón để xoay, hai ngón để thu phóng.
  Không dùng kéo một ngón để dời camera, tránh tranh với cuộn trang.
- Ghế nhỏ hơn 44 px trên màn hình thì chạm vào khu sẽ mở danh sách ghế trong sheet.
  Danh sách có mã, giá và trạng thái của từng ghế.

## 11. Tiếp cận và giảm chuyển động

- `<canvas>` có `aria-hidden="true"`.
- Mọi thao tác có bản tương đương trong bảng điều khiển DOM:
  - danh sách khu là nhóm radio;
  - ghế là lưới nút, có `aria-label` dạng "Ghế A5, khu VIP, 9.800.000 ₫, còn trống".
- Chọn trong DOM thì camera 3D đi theo.
  Chọn trong 3D thì focus DOM đi theo.
- Thay đổi từ SSE ảnh hưởng đến ghế của bạn thì đọc qua `aria-live="polite"`.
  Ví dụ: ghế bạn đang giữ đã hết giờ.
- Khi `prefers-reduced-motion: reduce`:
  - camera chuyển cảnh tức thì;
  - không có hiệu ứng đèn khán phòng tắt.

## 12. Cấu trúc component

```text
TicketSelectionPage                    route /events/:id/tickets
├── useSeatInventory(eventId)          REST + SSE + giữ/trả ghế
├── useVenueLayout(zones, seats)       gọi buildVenueLayout, có memo
├── ZonePanel                          DOM: khu, giá, số còn
├── SelectionTray                      DOM: ghế đã giữ, đồng hồ, tổng, "Thanh toán"
├── Suspense
│   └── VenueScene (lazy)              Canvas của R3F
│       ├── Stage
│       ├── ZoneMeshes
│       ├── SeatInstances
│       ├── SpotRings
│       ├── ZoneLabels                 Html của Drei, chỉ ở toàn sân
│       └── CameraRig                  CameraControls của Drei
└── SeatMap2D                          dự phòng, từ SeatMap.tsx hiện tại
```

## 13. Thư viện

Chưa cài.
Dự kiến cài khi bắt đầu giai đoạn 3D (xem [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md)).

| Gói | Lý do | Ghi chú |
|---|---|---|
| `three` | Lõi 3D | |
| `@react-three/fiber` | Dùng Three.js trong React | Cần bản 9.x để chạy với React 19 |
| `@react-three/drei` | `CameraControls`, `Html` | Import từng phần để tree-shake |
| `@types/three` | Kiểu TypeScript | `devDependencies` |

Chốt phiên bản cụ thể lúc cài.
Không cần GSAP hay Framer Motion riêng: gói `motion` đã có sẵn.

## 14. Đề nghị gửi backend

Đây là đề nghị, frontend không tự làm.
Thiếu các trường này thì frontend vẫn chạy được theo các mục ở trên.

1. Trường loại khu trong `venue_zones`, ví dụ `kind`: `SEATED` hoặc `STANDING`.
   Thay cho cách đoán theo tên ở mục 3.1.
2. Trường màu và thứ tự hiển thị của khu.
   Thiết kế gốc mục 4.2 đã nói khu có "mã, tên, màu", nhưng bảng chưa có cột màu.
3. Hình học địa điểm: vị trí sân khấu, đa giác từng khu.
   Có dữ liệu này thì bỏ được chữ "minh hoạ".
4. API giữ chỗ theo số lượng cho khu đứng.
   Thay cho việc frontend giữ từng "ghế".
5. API đơn hàng và thanh toán.
   Hiện trang thanh toán chỉ mô phỏng và lưu vào `localStorage`.

## 15. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Người dùng tưởng sơ đồ là vị trí thật | Dòng chữ "minh hoạ" luôn hiện; nhãn khu dùng đúng tên Ban Tổ chức |
| Đoán sai khu đứng | Hàm nhận diện nằm một chỗ, có kiểm thử theo dữ liệu mẫu |
| Giữ nhiều ghế khu đứng bị xung đột | Thử ghế kế tiếp; báo rõ số đã giữ được |
| Máy yếu bị giật | `frameloop="demand"`, giới hạn DPR, chuyển sang 2D nếu fps thấp kéo dài |
| Ba nơi hiển thị lệch nhau | Một nguồn trạng thái duy nhất, `useSeatInventory` |
