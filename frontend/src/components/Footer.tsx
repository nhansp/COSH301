import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export const Footer: React.FC = () => (
  <footer className="mt-auto w-full border-t border-kumo-hairline">
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-10">
      <div className="max-w-sm space-y-2">
        <Logo />
        <p className="text-kumo-subtle">Mua vé concert, chọn chỗ trên sơ đồ sân khấu và nhận vé điện tử ngay.</p>
      </div>
      <nav aria-label="Liên kết cuối trang" className="flex gap-6 text-base">
        <Link to="/" className="text-kumo-subtle transition-colors hover:text-kumo-default">
          Lịch diễn
        </Link>
        <Link to="/my-tickets" className="text-kumo-subtle transition-colors hover:text-kumo-default">
          Vé của tôi
        </Link>
      </nav>
    </div>
    <div className="mx-auto max-w-6xl border-t border-kumo-hairline px-4 py-5 text-sm text-kumo-subtle sm:px-6 lg:px-10">
      <p>© 2026 SortMyScene. Ảnh sự kiện từ Wikimedia Commons theo giấy phép Creative Commons; tác giả ghi dưới từng ảnh.</p>
    </div>
  </footer>
);
