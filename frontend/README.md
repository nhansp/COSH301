# Frontend

SPA React 19 + Vite + TypeScript + Tailwind CSS 4.
Mọi dữ liệu (sự kiện, ghế, giữ chỗ, đăng nhập) lấy từ api Go qua `/api`; frontend không có dữ liệu mẫu.

## Chạy

Cách đơn giản nhất là chạy cả hệ thống bằng Docker Compose ở thư mục gốc (xem [`docs/architecture.md`](../docs/architecture.md)):

```bash
docker compose up --build        # mở http://127.0.0.1:3001
```

Chỉ build frontend:

```bash
bun install
bun run lint                     # tsc --noEmit
bun run build                    # ra dist/
```

`bun run dev` mở cổng 3000 nhưng không proxy `/api`, nên chỉ dùng để xem giao diện.

## Giao diện

Token màu lấy theo [Kumo](https://kumo-ui.com/) của Cloudflare, khai báo trong `src/index.css`:
- mỗi token dùng `light-dark()`, nên đổi giao diện chỉ cần đổi `data-mode` trên `<html>`;
- nút chuyển Sáng / Tối / Theo hệ thống ở thanh điều hướng (`src/components/ThemeToggle.tsx`), lựa chọn lưu trong `localStorage`;
- `index.html` đặt `data-mode` trước khi vẽ trang để không bị nháy màu.

Quy ước:
- màu chính là màu mực (`bg-kumo-brand` đi với `text-kumo-on-brand`), màu sắc còn lại đến từ ảnh sự kiện;
- bề mặt: `kumo-canvas` (nền trang), `kumo-base` (thẻ), `kumo-recessed` (vùng lõm), `kumo-raised` (menu, hộp thoại);
- chữ: `text-kumo-strong`, `text-kumo-default`, `text-kumo-subtle`; liên kết luôn gạch chân;
- font Be Vietnam Pro; cỡ chữ 16px trên điện thoại, 14px từ màn hình `md` trở lên;
- thiết kế cho điện thoại trước, nút chính cao 44px trên điện thoại.
