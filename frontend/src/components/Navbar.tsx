import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Search, ChevronDown, User as UserIcon, LogOut, Ticket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventContext';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, bookings } = useAuth();
  const { filterState, setCity } = useEvents();
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const cities = ['All Cities', 'Mumbai', 'Hồ Chí Minh', 'Hà Nội', 'Bangkok', 'Delhi', 'Bengaluru'];

  const handleLoginClick = () => {
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-purple-950/60 bg-[#12091c]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left: Brand Logo & Main Nav Links */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            {/* Logo Icon matching Picture.webp */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-pink-500 p-0.5 shadow-lg shadow-purple-900/30">
              <div className="w-full h-full bg-[#160a26] rounded-full flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-400 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white shadow-sm shadow-white" />
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg sm:text-xl tracking-wider text-white flex items-center gap-1 font-mono">
                SORT<span className="text-purple-400 font-light text-sm italic">MY</span>SCENE
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              to="/"
              className={`transition-colors hover:text-white ${
                location.pathname === '/' ? 'text-white font-semibold' : 'text-purple-200/70'
              }`}
            >
              Concerts & Events
            </Link>
            {isAuthenticated && (
              <Link
                to="/my-tickets"
                className={`transition-colors hover:text-white flex items-center gap-1.5 ${
                  location.pathname === '/my-tickets' ? 'text-white font-semibold' : 'text-purple-200/70'
                }`}
              >
                <Ticket className="w-4 h-4 text-purple-400" />
                <span>My Tickets</span>
                {bookings.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-purple-600 text-white text-xs rounded-full font-bold">
                    {bookings.length}
                  </span>
                )}
              </Link>
            )}
          </nav>
        </div>

        {/* Right: Location Selector, Search, and Auth Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* City Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/40 text-xs sm:text-sm text-purple-200 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-purple-400" />
              <span>{filterState.city === 'All Cities' ? 'Mumbai' : filterState.city}</span>
              <ChevronDown className="w-3.5 h-3.5 text-purple-400 ml-0.5" />
            </button>

            {showCityDropdown && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl bg-[#1b0d2d] border border-purple-800/50 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-xs font-semibold text-purple-400 uppercase tracking-wider">
                  Select Location
                </div>
                {cities.map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setCity(c);
                      setShowCityDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-900/50 transition-colors flex items-center justify-between ${
                      filterState.city === c ? 'text-purple-300 font-semibold bg-purple-900/30' : 'text-purple-100/80'
                    }`}
                  >
                    {c}
                    {filterState.city === c && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Authentication State Button */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/50 transition-all"
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full bg-purple-800 border border-purple-400/40"
                />
                <span className="text-xs sm:text-sm font-medium text-purple-100 max-w-[90px] truncate">
                  {user.name}
                </span>
                <ChevronDown className="w-3 h-3 text-purple-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#1d0e32] border border-purple-700/50 shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-purple-900/60">
                    <p className="text-xs text-purple-400">Đã đăng nhập</p>
                    <p className="text-sm font-bold text-white truncate">{user.name}</p>
                    <p className="text-xs text-purple-300/70 truncate">{user.phone || user.email}</p>
                  </div>
                  <Link
                    to="/my-tickets"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-sm text-purple-200 hover:bg-purple-900/40 flex items-center gap-2"
                  >
                    <Ticket className="w-4 h-4 text-purple-400" />
                    Vé của tôi ({bookings.length})
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/30 flex items-center gap-2 border-t border-purple-900/50"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleLoginClick}
              className="px-4 sm:px-5 py-2 rounded-full bg-white text-[#12091c] font-semibold text-xs sm:text-sm shadow-md hover:bg-purple-100 hover:shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Log in / Sign up</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#12091c]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
