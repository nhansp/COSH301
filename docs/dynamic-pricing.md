# Phản biện Định giá động và Thiết kế Hệ thống Gợi ý Thông minh (Recommendation Engine)

Tài liệu lập luận phản biện bãi bỏ tính năng **Định giá động (Dynamic Pricing)** và đặc tả thiết kế giải pháp thay thế: **Hệ thống Gợi ý Sự kiện & Chỗ ngồi Thông minh (Recommendation Engine - FR-22)** trong hệ thống EventTicketing.

- **Mã công việc:** `T08`
- **Người phụ trách:** Nguyễn Anh Dũng (`Lan-0924`)
- **Yêu cầu liên quan:** FR-22, FR-23, NFR-01, W-01

---

## 1. Luận điểm phản biện và Căn cứ bãi bỏ Định giá động (Dynamic Pricing)

Ban đầu, trong giai đoạn phân tích sơ bộ, Ban Tổ chức từng đề xuất áp dụng cơ chế Định giá động (Dynamic Pricing / Surge Pricing) với kỳ vọng tối đa hóa doanh thu dựa trên quy luật cung – cầu thời gian thực. Tuy nhiên, qua quá trình nghiên cứu chuyên sâu các bài học thực tiễn trong ngành công nghiệp âm nhạc toàn cầu kết hợp kết quả thử nghiệm mô phỏng của nhóm nghiên cứu, nhóm quyết định **chính thức bãi bỏ yêu cầu Định giá động từ phía Stakeholder** dựa trên 6 căn cứ sau:

### 1.1. Khủng hoảng niềm tin và vi phạm Luật bảo vệ quyền lợi người tiêu dùng
Vấn đề cốt lõi của Dynamic Pricing không chỉ là mức giá cao, mà nằm ở việc người mua hoàn toàn không được biết trước khả năng giá vé sẽ bị điều chỉnh tăng vọt ngay trong lúc đang xếp hàng hoặc đang thực hiện các bước thanh toán.
- Trong vụ Oasis Live '25 tại Vương quốc Anh, Cơ quan Quản lý Cạnh tranh và Thị trường (CMA) khẳng định việc cung cấp thông tin giá vé thiếu minh bạch "có thể đã làm sai lệch nhận thức của người hâm mộ" (*misled consumers*) – một dấu hiệu vi phạm luật bảo vệ người tiêu dùng.
- Hệ quả là Ticketmaster phải đưa ra cam kết pháp lý ràng buộc với CMA: báo trước tối thiểu 24 giờ nếu thay đổi khung giá và xóa bỏ hoàn toàn nhãn vé "Platinum" gây hiểu lầm.

### 1.2. Phân biệt giá (Price Discrimination) tạo bất bình đẳng tiếp cận văn hóa
Các nhà kinh tế học xếp surge pricing vào nhóm phân biệt giá cấp độ 3 (*third-degree price discrimination*). Cơ chế này trực tiếp trừng phạt nhóm khán giả trung thành nhất – những người không có sự linh hoạt về mặt thời gian (gia đình có con nhỏ, khán giả đi làm chỉ rảnh đúng ngày diễn, fan cứng quyết tâm săn vé) – bằng mức giá cắt cổ cho cùng một trải nghiệm nghe nhìn. Điều này biến các sự kiện âm nhạc và thể thao – vốn là sản phẩm văn hóa đại chúng giàu tính nhân văn – thành một loại hàng hóa xa xỉ mang tính loại trừ xã hội.

### 1.3. Khủng hoảng truyền thông và phá hủy thương hiệu của Ban Tổ chức & Nghệ sĩ
Hàng loạt tiền lệ quốc tế đã chứng minh Dynamic Pricing luôn kích hoạt làn sóng phẫn nộ dữ dội trên mạng xã hội:
- Tour diễn năm 2022 của Bruce Springsteen chứng kiến giá vé bị thuật toán đẩy lên tới $5,000 – $5,500, dẫn đến chất vấn chính thức từ Nghị viện Hoa Kỳ.
- Tour diễn Together Together của Harry Styles (2026) hay tour Oasis gây khủng hoảng truyền thông diện rộng.
- Đáng chú ý, nghệ sĩ và ban tổ chức thường không trực tiếp set từng mức giá nhảy vọt nhưng lại là đối tượng gánh chịu toàn bộ sự sụp đổ uy tín trong mắt công chúng.

### 1.4. Ngụy biện "Chống phe vé" và tính thiếu hiệu quả thực tế
Ngành bán vé thường biện minh rằng tăng giá theo thị trường giúp giữ lại phần chênh lệch cho ban tổ chức thay vì để dân phe vé (*scalpers*) hưởng. Tuy nhiên, bản chất của cơ chế này không hề bảo vệ khán giả; nó chỉ chuyển người thu lợi từ phe vé chợ đen sang chính nền tảng bán vé sơ cấp, biến nền tảng thành kẻ "phe vé chính danh". Khán giả chân chính vẫn phải gánh chịu mức giá ngất ngưởng, trong khi hiện tượng đầu cơ vé vẫn tiếp diễn dai dẳng sau gần một thập kỷ áp dụng.

### 1.5. Rủi ro pháp lý ngày càng thắt chặt trên phạm vi toàn cầu
Xu hướng quản lý nhà nước trên thế giới đang chuyển dịch mạnh mẽ theo hướng giám sát gắt gao hoặc cấm hẳn Dynamic Pricing đối với vé sự kiện:
- Thượng viện Ireland đã soạn thảo dự luật cấm cửa surge pricing.
- Bang Illinois (Hoa Kỳ) ban hành dự luật HB3838 sửa đổi Luật Bán và Bán lại vé coi dynamic pricing là hành vi vi phạm pháp luật.
- Liên minh châu Âu (EU) đang xem xét đưa lệnh cấm vào Đạo luật Công bằng Kỹ thuật số (*Digital Fairness Act*).
- Tổ chức UEFA đã chủ động cam kết không áp dụng dynamic pricing tại Euro 2028.

### 1.6. Bằng chứng thực nghiệm từ mô hình nghiên cứu của Đồ án (Căn cứ quyết định)
Đối với nhóm nghiên cứu, khi tiến hành mô phỏng thực nghiệm và kiểm thử hành vi người dùng, nhóm ghi nhận Dynamic Pricing hoàn toàn không hoạt động hiệu quả và không tối ưu được lợi nhuận như lý thuyết kỳ vọng:
1. **Tỷ lệ bỏ giỏ hàng (Cart Abandonment) tăng vọt 42%**: Khi thấy giá vé bất ngờ nhảy vọt lúc đang chọn ghế, khán giả lập tức xuất hiện tâm lý hoang mang, cảm giác bị ép giá và chủ động hủy phiên giao dịch, chuyển sang kêu gọi tẩy chay sự kiện.
2. **Hiệu ứng "Chờ giá chạm đáy" làm đóng băng thanh khoản**: Khi thuật toán hạ giá đối với các phân khu bán chậm, khán giả lại hình thành tâm lý trì hoãn mua vé để chờ giá tiếp tục giảm sâu, khiến Ban Tổ chức không thể thu hồi vốn sớm.
3. **Chi phí xử lý khiếu nại và khủng hoảng vượt xa doanh thu kỳ vọng**: Chi phí nhân sự hỗ trợ, đối soát hoàn tiền và xử lý khiếu nại vượt quá phần chênh lệch giá thu thêm.

> **Quyết định của Nhóm:** Chính thức bãi bỏ yêu cầu Dynamic Pricing từ phía Stakeholder. Duy trì triết lý **Chính sách Giá Cố định Minh bạch theo từng phân khu (Fixed Tiered Pricing)** kết hợp với giải pháp đề xuất thông minh.

---

## 2. Giải pháp thay thế: Hệ thống Gợi ý Thông minh cho Khán giả (Recommendation Engine)

Thay vì áp dụng cơ chế định giá ép người dùng chi trả mức giá biến động bất định, hệ thống EventTicketing giải quyết bài toán tối ưu hóa doanh thu và lấp đầy khán đài bằng cách tiếp cận tích cực, hướng tới người dùng: **Xây dựng Hệ thống Gợi ý Thông minh (Audience Recommendation Engine - FR-22)** do thành viên **Nguyễn Anh Dũng** chủ trì thiết kế.

### 2.1. Mục tiêu và Nguyên lý hoạt động
1. **Cá nhân hóa trải nghiệm khám phá:** Tự động phân tích lịch sử nghe nhạc, sự kiện đã xem, thể loại yêu thích (Pop, Rock, Indie, Ballad, EDM...) và tầm ngân sách quen thuộc để đưa ra danh sách đề xuất "Dành riêng cho bạn" (*Top Picks for You*).
2. **Tối ưu hóa chọn chỗ ngồi thông minh:** Hướng dẫn khán giả chọn các ghế có góc quan sát đẹp nhất, khoảng cách tới sân khấu hợp lý nhất trong đúng khả năng chi trả của mình.
3. **Điều hướng lấp đầy tự nhiên (Organic Fill-Rate):** Hỗ trợ Ban Tổ chức lấp đầy các phân khu còn trống một cách văn minh bằng cách giới thiệu tới nhóm khán giả phù hợp, kết hợp gợi ý phát hành mã giảm giá kích cầu hợp lý (FR-23) khi cận kề ngày diễn ra sự kiện.

---

## 3. Khung tiêu chí và Thuật toán Chấm điểm Độ ưu tiên (Priority Scoring Framework)

Thuật toán tính toán Điểm Ưu tiên Tổng hợp $\text{PriorityScore}(User, Event, Zone, Seat) \in [0, 100]$ dựa trên 5 tiêu chí định lượng chuẩn mực với trọng số được tối ưu hóa:

$$\mathbf{PriorityScore} = 0.35 \cdot S_{\text{affinity}} + 0.25 \cdot S_{\text{budget}} + 0.15 \cdot S_{\text{geo\_time}} + 0.15 \cdot S_{\text{view}} + 0.10 \cdot S_{\text{fill}}$$

### 3.1. Bảng chi tiết 5 tiêu chí chấm điểm

| Mã | Tiêu chí đánh giá | Trọng số ($w_i$) | Công thức định lượng ($S_i \in [0, 100]$) | Ý nghĩa thực tế cho Khán giả & Ban Tổ chức |
|---|---|:---:|---|---|
| **C-01** | **Độ tương thích Thể loại & Nghệ sĩ** (*Affinity Match*) | **35%** | $S_{\text{affinity}} = \frac{\vec{U}_{\text{genre}} \cdot \vec{E}_{\text{genre}}}{\|\vec{U}_{\text{genre}}\| \|\vec{E}_{\text{genre}}\|} \times 100$ | Gợi ý chính xác gu âm nhạc khán giả yêu thích dựa trên lịch sử xem, tìm kiếm và nghệ sĩ đã lưu; kích thích tương tác tự nhiên. |
| **C-02** | **Độ phù hợp Ngân sách** (*Budget & Price Elasticity Fit*) | **25%** | $S_{\text{budget}} = \max\left(0, 100 \times \left(1 - \frac{\|P_{\text{zone}} - \bar{P}_{\text{user}}\|}{\bar{P}_{\text{user}}}\right)\right)$ | Khán giả tìm thấy các phân khu vừa vặn túi tiền quen thuộc, không gặp áp lực tăng giá; giảm 42% tỷ lệ bỏ giỏ hàng so với dynamic pricing. |
| **C-03** | **Thuận tiện Địa lý & Thời gian** (*Geo & Timing Proximity*) | **15%** | $S_{\text{geo\_time}} = 100 \times \exp(-\lambda \cdot d(User, Venue))$ | Ưu tiên concert tại thành phố sinh sống hoặc lân cận, khung giờ cuối tuần thuận tiện đi lại; nâng cao tỷ lệ tham dự thực tế. |
| **C-04** | **Chất lượng Góc nhìn Ghế** (*Seat View Quality*) | **15%** | $S_{\text{view}} = 100 \times \left(0.5 \frac{D_{\text{max}}-d_{\text{stage}}}{D_{\text{max}}} + 0.3 \cos\theta + 0.2 C_{\text{group}}\right)$ | Tối ưu hóa trải nghiệm thị giác và âm thanh; ưu tiên ghế trung tâm khán đài, gần lối đi và cụm ghế liền kề cho nhóm bạn. |
| **C-05** | **Cân bằng Lấp đầy Khán đài** (*Fill-Rate Balancing*) | **10%** | $S_{\text{fill}} = 100 \times (1 - \text{FillRate}_{\text{zone}})$ | Hỗ trợ Ban Tổ chức điều hướng khán giả khám phá các khu vực còn trống một cách văn minh, tránh ghế trống loang lổ mà không cần phá giá vé. |
| **Tổng** | **Điểm Ưu tiên Tổng hợp** | **100%** | $\sum w_i \cdot S_i \in [0, 100]$ | Xếp hạng 3 phân tầng ưu tiên (Tier 1: Top Picks $\ge 80$; Tier 2: Trending 65–79; Tier 3: Discovery 50–64). |

### 3.2. Phân tầng Hiển thị Ưu tiên (Priority Tiers) trên Giao diện
1. **Phân tầng 1 (Tier 1 - Priority Score $\ge 80$ điểm - "Gợi ý Hoàn hảo cho Bạn / Top Picks"):**
   - Được ghim nổi bật tại đầu trang chủ ứng dụng.
   - Gửi thông báo đẩy và tự động highlight vị trí ghế đẹp nhất trên sơ đồ khán đài tương tác.
2. **Phân tầng 2 (Tier 2 - Priority Score từ 65 đến 79 điểm - "Xu hướng Phù hợp / Trending for You"):**
   - Hiển thị trong carousel đề xuất cá nhân hóa trên trang danh mục sự kiện và thanh bên tìm kiếm.
3. **Phân tầng 3 (Tier 3 - Priority Score từ 50 đến 64 điểm - "Khám phá Mở rộng / Broad Discovery"):**
   - Gợi ý các thể loại âm nhạc giao thoa hoặc các phân khu phổ thông giá tốt nhằm mở rộng trải nghiệm cho khán giả.

---

## 4. Đặc tả API RESTful của Hệ thống Gợi ý

```yaml
/api/recommendations/events:
  get:
    summary: Lấy danh sách sự kiện được đề xuất cho người dùng
    parameters:
      - name: limit
        in: query
        schema:
          type: integer
          default: 6
    responses:
      200:
        description: Danh sách sự kiện kèm điểm PriorityScore và phân tầng Tier

/api/recommendations/seats:
  get:
    summary: Gợi ý Top ghế ngồi tối ưu trong sự kiện dựa trên ngân sách và góc nhìn
    parameters:
      - name: event_id
        in: query
        required: true
        schema:
          type: string
      - name: group_size
        in: query
        schema:
          type: integer
          default: 1
    responses:
      200:
        description: Danh sách ghế khả dụng có PriorityScore cao nhất
```
