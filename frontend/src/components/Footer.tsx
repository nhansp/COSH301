import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

interface FooterLink {
  label: string;
  to?: string;
  href?: string;
}

const COLUMNS: ReadonlyArray<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Concerts',
    links: [
      { label: 'All Concerts', to: '/' },
      { label: 'Popular Events', to: '/' },
      { label: 'Trending Venues', to: '/' },
    ],
  },
  {
    title: 'Ticket Support',
    links: [
      { label: 'Vé của tôi', to: '/my-tickets' },
      { label: 'Hướng dẫn quét mã QR', href: '#help' },
      { label: 'Câu hỏi thường gặp', href: '#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '#about' },
      { label: 'Privacy Policy', href: '#privacy' },
      { label: 'Terms of Service', href: '#terms' },
    ],
  },
];

const linkClass = 'text-kumo-subtle hover:text-kumo-default transition-colors';
const socialClass =
  'grid size-8 place-items-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full mt-auto bg-kumo-elevated border-t border-kumo-hairline">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-10 pb-10">
          <div className="col-span-2 space-y-3">
            <Logo />
            <p className="text-base text-kumo-subtle max-w-sm leading-relaxed">
              Nền tảng khám phá và mua vé concert âm nhạc, festival và live show hàng đầu. 100% vé điện tử chính hãng, check-in mã QR bảo mật và xác thực tức thì.
            </p>
            <p className="flex items-start gap-2 text-sm text-kumo-success">
              <ShieldCheck className="size-4 flex-shrink-0 mt-px" />
              <span>Bảo vệ quyền lợi khán giả. Hoàn tiền nếu hủy show.</span>
            </p>
          </div>

          {COLUMNS.map(column => (
            <nav key={column.title} aria-label={column.title}>
              <h4 className="text-sm font-semibold text-kumo-strong mb-3">{column.title}</h4>
              <ul className="space-y-2 text-base">
                {column.links.map(link => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="pt-6 border-t border-kumo-hairline flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-kumo-subtle">
          <p>© 2026 SortMyScene. Live concert &amp; event ticketing.</p>
          <div className="flex items-center gap-1">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className={socialClass}>
              <Facebook className="size-4" />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className={socialClass}>
              <Instagram className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
