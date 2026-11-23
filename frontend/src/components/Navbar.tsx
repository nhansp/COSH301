import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, Ticket, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import type { PageTone } from './layout/PageShell';

const menuItem =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base text-kumo-default transition-colors hover:bg-kumo-tint';

/** Sticky header. On stage pages the theme switch is hidden: those pages are always dark. */
export const Navbar: React.FC<{ tone?: PageTone }> = ({ tone = 'editorial' }) => {
  const { user, isAuthenticated, logout, bookings } = useAuth();
  const { isEnabled } = useFeatures();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
  const showOrganizerLink = isOrganizer && isEnabled('organizer_console');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const activeTickets = bookings.filter(b => b.status === 'confirmed').length;

  useEffect(() => {
    setShowMobileMenu(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  // The hairline under the bar only appears once content scrolls beneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!showUserMenu && !showMobileMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setShowMobileMenu(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (showUserMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [showUserMenu, showMobileMenu]);

  const goToLogin = () => navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);

  const nav = [
    { to: '/', label: 'Lịch diễn', show: true, count: 0 },
    { to: '/my-tickets', label: 'Vé của tôi', show: isAuthenticated, count: activeTickets },
    { to: '/organizer', label: 'Quản lý sự kiện', show: showOrganizerLink, count: 0 }
  ].filter(item => item.show);

  return (
    <header
      style={{ zIndex: 'var(--z-nav)' }}
      className={`sticky top-0 w-full backdrop-blur-xl transition-[background-color,border-color] duration-300 ${
        scrolled ? 'border-b border-kumo-hairline bg-kumo-canvas/85' : 'border-b border-transparent bg-kumo-canvas/60'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-10">
          <Logo />
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-7 md:flex">
            {nav.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-16 items-center gap-2 text-base font-medium transition-colors ${
                    active ? 'text-kumo-strong' : 'text-kumo-subtle hover:text-kumo-strong'
                  }`}
                >
                  {item.label}
                  {item.count > 0 && (
                    <span className="type-figure grid h-5 min-w-5 place-items-center rounded-full bg-violet px-1.5 text-xs text-midnight">
                      {item.count}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-violet-ink transition-transform duration-300 ${
                      active ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {tone === 'editorial' && (
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          )}

          {isAuthenticated && user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(open => !open)}
                aria-expanded={showUserMenu}
                aria-haspopup="menu"
                aria-label="Tài khoản"
                className="flex h-11 items-center gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-kumo-tint md:pr-3"
              >
                <img src={user.avatar} alt="" className="size-9 rounded-full bg-kumo-fill ring-2 ring-kumo-canvas" />
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-kumo-strong md:block">{user.name}</span>
                <ChevronDown className={`hidden size-4 text-kumo-subtle transition-transform md:block ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div
                  role="menu"
                  style={{ zIndex: 'var(--z-modal)' }}
                  className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-kumo-raised p-2 shadow-[var(--shadow-pop)] ring ring-kumo-line motion-safe:animate-[menu-in_180ms_var(--ease-reveal)]"
                >
                  <div className="flex items-center gap-3 px-3 pt-2 pb-3">
                    <img src={user.avatar} alt="" className="size-11 rounded-full bg-kumo-fill" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-kumo-strong">{user.name}</p>
                      <p className="truncate text-sm text-kumo-subtle">{user.phone || user.email}</p>
                    </div>
                  </div>
                  <div className="border-t border-kumo-hairline pt-1.5">
                    <Link role="menuitem" to="/my-tickets" className={menuItem}>
                      <Ticket className="size-4 text-kumo-subtle" />
                      <span className="flex-1">Vé của tôi</span>
                      {activeTickets > 0 && <span className="type-figure text-sm text-kumo-subtle">{activeTickets}</span>}
                    </Link>
                    {showOrganizerLink && (
                      <Link role="menuitem" to="/organizer" className={menuItem}>
                        <LayoutDashboard className="size-4 text-kumo-subtle" />
                        Quản lý sự kiện
                      </Link>
                    )}
                    <button
                      role="menuitem"
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
                </div>
              )}
            </div>
          ) : (
            isEnabled('otp_login') && (
              <button type="button" onClick={goToLogin} className="btn btn-ink btn-sm h-10">
                Đăng nhập
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setShowMobileMenu(open => !open)}
            aria-expanded={showMobileMenu}
            aria-controls="mobile-menu"
            aria-label={showMobileMenu ? 'Đóng menu' : 'Mở menu'}
            className="btn-icon md:hidden"
          >
            {showMobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {showMobileMenu && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto border-t border-kumo-hairline bg-kumo-canvas motion-safe:animate-[sheet-in_220ms_var(--ease-reveal)] md:hidden"
        >
          <nav aria-label="Điều hướng" className="flex flex-col px-4 pt-6">
            {nav.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-baseline justify-between border-b border-kumo-hairline py-4 font-display text-display-sm font-bold ${
                    active ? 'text-violet-ink' : 'text-kumo-strong'
                  }`}
                >
                  {item.label}
                  {item.count > 0 && <span className="type-figure text-lg text-kumo-subtle">{item.count}</span>}
                </Link>
              );
            })}
          </nav>
          {tone === 'editorial' && (
            <div className="flex items-center justify-between px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <span className="text-base text-kumo-default">Giao diện</span>
              <ThemeToggle />
            </div>
          )}
        </div>
      )}
    </header>
  );
};
