import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ChevronDown, LogOut, Ticket, Check, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';
import { useFeatures } from '../context/FeatureContext';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const CITIES = ['All Cities', 'Mumbai', 'Hồ Chí Minh', 'Hà Nội', 'Bangkok', 'Delhi', 'Bengaluru'];

const menuPanel =
  'absolute right-0 mt-2 rounded-xl bg-kumo-raised ring ring-kumo-line shadow-lg shadow-black/5 py-1.5 z-50';
const menuItem =
  'w-[calc(100%-0.75rem)] text-left px-3 py-1.5 mx-1.5 rounded-md text-base transition-colors flex items-center gap-2';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, bookings } = useAuth();
  const { filterState, setCity } = useEvents();
  const { isEnabled } = useFeatures();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
  const showOrganizerLink = isOrganizer && isEnabled('organizer_console');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setShowMobileMenu(false);
    setShowUserMenu(false);
    setShowCityDropdown(false);
  }, [location.pathname]);

  const handleLoginClick = () => {
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
  };

  const selectCity = (city: string) => {
    setCity(city);
    setShowCityDropdown(false);
    setShowMobileMenu(false);
  };

  const cityLabel = filterState.city === 'All Cities' ? 'Mumbai' : filterState.city;

  const navLink = (active: boolean) =>
    `h-8 px-2.5 rounded-md flex items-center gap-1.5 transition-colors ${
      active
        ? 'text-kumo-strong bg-kumo-tint'
        : 'text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint'
    }`;

  const mobileLink = (active: boolean) =>
    `h-11 px-3 -mx-3 rounded-lg flex items-center gap-2 text-lg transition-colors ${
      active ? 'text-kumo-strong bg-kumo-tint font-medium' : 'text-kumo-default hover:bg-kumo-tint'
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-kumo-hairline bg-kumo-canvas/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Logo />

          <nav className="hidden md:flex items-center gap-1 text-base font-medium">
            <Link to="/" className={navLink(location.pathname === '/')}>
              Concerts & Events
            </Link>
            {isAuthenticated && (
              <Link to="/my-tickets" className={navLink(location.pathname === '/my-tickets')}>
                <Ticket className="size-4" />
                <span>My Tickets</span>
                {bookings.length > 0 && (
                  <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-kumo-brand text-kumo-on-brand text-xs font-medium tabular-nums">
                    {bookings.length}
                  </span>
                )}
              </Link>
            )}
            {showOrganizerLink && (
              <Link to="/organizer" className={navLink(location.pathname === '/organizer')}>
                Quản lý sự kiện
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              aria-expanded={showCityDropdown}
              className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-kumo-base ring ring-kumo-line hover:bg-kumo-tint text-sm font-medium text-kumo-default transition-colors"
            >
              <MapPin className="size-3.5 text-kumo-subtle" />
              <span>{cityLabel}</span>
              <ChevronDown className="size-3.5 text-kumo-subtle" />
            </button>

            {showCityDropdown && (
              <div className={`${menuPanel} w-48`}>
                <p className="px-3 pt-1 pb-1.5 text-xs font-medium text-kumo-subtle">Chọn địa điểm</p>
                {CITIES.map(c => {
                  const active = filterState.city === c;
                  return (
                    <button
                      key={c}
                      onClick={() => selectCity(c)}
                      className={`${menuItem} justify-between hover:bg-kumo-tint ${
                        active ? 'text-kumo-strong font-medium' : 'text-kumo-default'
                      }`}
                    >
                      {c}
                      {active && <Check className="size-3.5 text-kumo-strong" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-label="Tài khoản"
                className="h-11 md:h-8 flex items-center gap-2 pl-1 pr-1.5 md:pr-2 rounded-lg hover:bg-kumo-tint transition-colors"
              >
                <img
                  src={user.avatar}
                  alt=""
                  className="size-7 md:size-6 rounded-full bg-kumo-fill ring ring-kumo-line"
                />
                <span className="hidden md:block text-sm font-medium text-kumo-default max-w-[90px] truncate">
                  {user.name}
                </span>
                <ChevronDown className="hidden md:block size-3.5 text-kumo-subtle" />
              </button>

              {showUserMenu && (
                <div className={`${menuPanel} w-56`}>
                  <div className="px-3 pt-1 pb-2.5 mb-1 border-b border-kumo-hairline">
                    <p className="text-xs text-kumo-subtle">Đã đăng nhập</p>
                    <p className="text-base font-semibold text-kumo-strong truncate">{user.name}</p>
                    <p className="text-sm text-kumo-subtle truncate">{user.phone || user.email}</p>
                  </div>
                  <Link
                    to="/my-tickets"
                    onClick={() => setShowUserMenu(false)}
                    className={`${menuItem} text-kumo-default hover:bg-kumo-tint`}
                  >
                    <Ticket className="size-4 text-kumo-subtle" />
                    Vé của tôi
                    <span className="ml-auto text-sm text-kumo-subtle tabular-nums">{bookings.length}</span>
                  </Link>
                  <button
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
          ) : isEnabled('otp_login') && (
            <button
              onClick={handleLoginClick}
              className="h-11 md:h-8 px-3 rounded-lg bg-kumo-contrast text-kumo-inverse text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <span className="md:hidden">Đăng nhập</span>
              <span className="hidden md:inline">Log in / Sign up</span>
            </button>
          )}

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-expanded={showMobileMenu}
            aria-controls="mobile-menu"
            aria-label={showMobileMenu ? 'Đóng menu' : 'Mở menu'}
            className="md:hidden grid size-9 place-items-center rounded-lg text-kumo-default hover:bg-kumo-tint transition-colors"
          >
            {showMobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {showMobileMenu && (
        <div
          id="mobile-menu"
          className="md:hidden absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem)] overflow-y-auto bg-kumo-raised border-b border-kumo-hairline shadow-lg shadow-black/10"
        >
          <nav className="px-4 py-3 flex flex-col" aria-label="Điều hướng">
            <Link to="/" className={mobileLink(location.pathname === '/')}>
              Concerts & Events
            </Link>
            {isAuthenticated && (
              <Link to="/my-tickets" className={mobileLink(location.pathname === '/my-tickets')}>
                My Tickets
                {bookings.length > 0 && (
                  <span className="ml-auto min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-kumo-brand text-kumo-on-brand text-sm font-medium tabular-nums">
                    {bookings.length}
                  </span>
                )}
              </Link>
            )}
            {showOrganizerLink && (
              <Link to="/organizer" className={mobileLink(location.pathname === '/organizer')}>
                Quản lý sự kiện
              </Link>
            )}
          </nav>

          <div className="px-4 py-3 border-t border-kumo-hairline">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-kumo-subtle">
              <MapPin className="size-3.5" />
              Địa điểm
            </p>
            <div className="flex flex-wrap gap-2">
              {CITIES.map(c => {
                const active = filterState.city === c;
                return (
                  <button
                    key={c}
                    onClick={() => selectCity(c)}
                    aria-pressed={active}
                    className={`h-9 px-3 rounded-full text-base transition-colors ${
                      active
                        ? 'bg-kumo-contrast text-kumo-inverse font-medium'
                        : 'bg-kumo-base ring ring-kumo-line text-kumo-default hover:bg-kumo-tint'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-kumo-hairline flex items-center justify-between">
            <span className="text-base text-kumo-default">Giao diện</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
};
