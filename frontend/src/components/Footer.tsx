import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const footerLink = 'rounded-md text-base font-medium text-kumo-default transition-colors hover:text-coral';

/** Compact closing band: brand and links on one line, copyright and photo credits below. */
export const Footer: React.FC = () => (
  <footer data-mode="dark" className="mt-auto w-full border-t border-kumo-hairline bg-midnight text-kumo-default">
    <div className="mx-auto flex max-w-page flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-10 lg:px-10">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-5">
        <Logo />
        <p className="text-sm text-kumo-subtle md:border-l md:border-kumo-hairline md:pl-5">
          Tìm đêm diễn, chọn chỗ ngồi và giữ chỗ trong 5 phút.
        </p>
      </div>
      <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-x-7 gap-y-2">
        <Link to="/" className={footerLink}>
          Lịch diễn
        </Link>
        <Link to="/my-tickets" className={footerLink}>
          Ghế đang giữ
        </Link>
      </nav>
    </div>
    <div className="border-t border-kumo-hairline">
      <p className="mx-auto max-w-page px-4 py-4 text-xs text-kumo-subtle sm:px-6 lg:px-10">
        © 2026 SortMyScene. Ảnh sự kiện từ Wikimedia Commons theo giấy phép Creative Commons; tác giả ghi dưới từng ảnh.
      </p>
    </div>
  </footer>
);
