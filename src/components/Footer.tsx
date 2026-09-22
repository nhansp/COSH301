import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, ShieldCheck, Ticket } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0d0615] border-t border-purple-950/80 pt-16 pb-12 text-purple-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-purple-950/80">
          {/* Brand Logo column */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-pink-500 p-0.5 shadow-lg shadow-purple-900/30">
                <div className="w-full h-full bg-[#160a26] rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-400 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>
              </div>
              <span className="font-extrabold text-xl tracking-wider text-white font-mono">
                SORT<span className="text-purple-400 font-light text-sm italic">MY</span>SCENE
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-purple-300/70 max-w-sm leading-relaxed">
              Nền tảng khám phá và mua vé concert âm nhạc, festival và live show hàng đầu. 100% vé điện tử chính hãng, check-in mã QR bảo mật và xác thực tức thì.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Bảo vệ quyền lợi khán giả • Hoàn tiền nếu hủy show</span>
            </div>
          </div>

          {/* Column 1: Khám phá vé concert */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wider">Concerts</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  / All Concerts
                </Link>
              </li>
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  / Popular Events
                </Link>
              </li>
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  / Trending Venues
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Ticket Support */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wider">Ticket Support</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/my-tickets" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-purple-400" />
                  <span>/ My Tickets (Vé của tôi)</span>
                </Link>
              </li>
              <li>
                <a href="#help" className="hover:text-white transition-colors">
                  / Hướng dẫn quét mã QR
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  / Câu hỏi thường gặp (FAQ)
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Company & Policies */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wider">Company</h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  / About Us
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-white transition-colors">
                  / Privacy Policy
                </a>
              </li>
              <li>
                <a href="#terms" className="hover:text-white transition-colors">
                  / Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & Socials */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-purple-400/70">
          <p>© 2026 SortMyScene • Live Concert &amp; Event Ticketing Platform</p>
          <div className="flex items-center gap-4">
            <span className="text-purple-300/80 font-medium">Follow us :</span>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-full bg-purple-950/60 hover:bg-purple-800 text-purple-200 hover:text-white transition-colors"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-full bg-purple-950/60 hover:bg-purple-800 text-purple-200 hover:text-white transition-colors"
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
