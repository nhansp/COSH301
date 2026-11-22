import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Ticket, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const menuPanel = 'absolute right-0 mt-2 rounded-xl bg-kumo-raised py-1.5 shadow-lg ring ring-kumo-line z-50';
const menuItem = 'mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-md px-3 py-2 text-left text-base transition-colors';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, bookings } = useAuth();
  const { isEnabled } = useFeatures();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
  const showOrganizerLink = isOrganizer && isEnabled('organizer_console');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const activeTickets = bookings.filter(b => b.status === 'confirmed').length;

  useEffect(() => {
    setShowMobileMenu(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  const goToLogin = () => navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);

  const navLink = (active: boolean) =>
    `flex h-9 items-center gap-1.5 rounded-md px-3 transition-colors ${
      active ? 'bg-kumo-tint text-kumo-strong' : 'text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default'
    }`;
  const mobileLink = (active: boolean) =>
    `-mx-3 flex h-12 items-center gap-2 rounded-lg px-3 text-lg transition-colors ${
      active ? 'bg-kumo-tint font-medium text-kumo-strong' : 'text-kumo-default hover:bg-kumo-tint'
    }`;

  const links = (
    <>
      <Link to="/" className={navLink(location.pathname === '/')}>
        Lịch diễn
      </Link>
      {isAuthenticated && (
        <Link to="/my-tickets" className={navLink(location.pathname === '/my-tickets')}>
          Vé của tôi
          {activeTickets > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-kumo-contrast px-1.5 text-xs font-medium tabular-nums text-kumo-inverse">
              {activeTickets}
            </span>
          )}
        </Link>
      )}
      {showOrganizerLink && (
        <Link to="/organizer" className={navLink(location.pathname === '/organizer')}>
          Quản lý sự kiện
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-kumo-hairline bg-kumo-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-6">
          <Logo />
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 text-base font-medium md:flex">
            {links}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-label="Tài khoản"
                className="flex h-11 items-center gap-2 rounded-lg pr-1.5 pl-1 transition-colors hover:bg-kumo-tint md:h-9 md:pr-2"
              >
                <img src={user.avatar} alt="" className="size-7 rounded-full bg-kumo-fill ring ring-kumo-line" />
                <span className="hidden max-w-[110px] truncate text-sm font-medium text-kumo-default md:block">{user.name}</span>
                <ChevronDown className="hidden size-3.5 text-kumo-subtle md:block" />
              </button>

              {showUserMenu && (
                <div className={`${menuPanel} w-60`}>
                  <div className="mb-1 border-b border-kumo-hairline px-3 pt-1 pb-2.5">
                    <p className="truncate text-base font-semibold text-kumo-strong">{user.name}</p>
                    <p className="truncate text-sm text-kumo-subtle">{user.phone || user.email}</p>
                  </div>
                  <Link to="/my-tickets" className={`${menuItem} text-kumo-default hover:bg-kumo-tint`}>
                    <Ticket className="size-4 text-kumo-subtle" />
                    Vé của tôi
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className={`${menuItem} text-kumo-danger hover:bg-kumo-danger-tint`}
                  >
                    <LogOut className="size-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            isEnabled('otp_login') && (
              <button
                type="button"
                onClick={goToLogin}
                className="h-11 rounded-lg bg-kumo-contrast px-4 text-sm font-medium whitespace-nowrap text-kumo-inverse transition-opacity hover:opacity-90 md:h-9"
              >
                Đăng nhập
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-expanded={showMobileMenu}
            aria-controls="mobile-menu"
            aria-label={showMobileMenu ? 'Đóng menu' : 'Mở menu'}
            className="grid size-11 place-items-center rounded-lg text-kumo-default transition-colors hover:bg-kumo-tint md:hidden"
          >
            {showMobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {showMobileMenu && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-kumo-hairline bg-kumo-raised shadow-lg md:hidden"
        >
          <nav aria-label="Điều hướng" className="flex flex-col px-4 py-3">
            <Link to="/" className={mobileLink(location.pathname === '/')}>
              Lịch diễn
            </Link>
            {isAuthenticated && (
              <Link to="/my-tickets" className={mobileLink(location.pathname === '/my-tickets')}>
                Vé của tôi
                {activeTickets > 0 && <span className="ml-auto text-base text-kumo-subtle tabular-nums">{activeTickets}</span>}
              </Link>
            )}
            {showOrganizerLink && (
              <Link to="/organizer" className={mobileLink(location.pathname === '/organizer')}>
                Quản lý sự kiện
              </Link>
            )}
          </nav>
          <div className="flex items-center justify-between border-t border-kumo-hairline px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <span className="text-base text-kumo-default">Giao diện</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
};
