import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useEvents } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice, DEFAULT_BANNER_IMAGE, DEFAULT_EVENT_IMAGE } from '../services/eventService';
import {
  Calendar,
  Clock,
  MapPin,
  Flame,
  ArrowLeft,
  Ticket,
  ShieldCheck,
  Share2,
  CheckCircle2,
  Users,
  Info,
  ExternalLink
} from 'lucide-react';

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEventById } = useEvents();
  const { isAuthenticated } = useAuth();
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const event = id ? getEventById(id) : undefined;

  if (!event) {
    return (
      <div className="min-h-screen purple-glow-bg flex flex-col justify-between">
        <Navbar />
        <div className="max-w-md mx-auto my-auto text-center py-20 px-4">
          <h2 className="text-2xl font-bold text-white mb-2">Không tìm thấy sự kiện</h2>
          <p className="text-purple-300/80 text-sm mb-6">
            Sự kiện bạn đang tìm kiếm có thể đã kết thúc hoặc không còn mở bán.
          </p>
          <Link
            to="/"
            className="px-6 py-2.5 rounded-full bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Khám phá các sự kiện khác</span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Handle "Mua vé ngay" click with strict authentication interception
  const handleProceedToCheckout = (tierId?: string) => {
    const chosenTier = tierId || selectedTierId || event.ticketTiers[0]?.id;
    const checkoutUrl = `/checkout/${event.id}${chosenTier ? `?tier=${chosenTier}` : ''}`;

    if (!isAuthenticated) {
      // Prompt requirement: intercept and redirect to login
      navigate(`/login?redirect=${encodeURIComponent(checkoutUrl)}`);
    } else {
      navigate(checkoutUrl);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen purple-glow-bg flex flex-col selection:bg-purple-600 selection:text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link & Share */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-purple-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tất cả sự kiện</span>
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-950/60 border border-purple-800/50 text-xs text-purple-200 hover:text-white transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Đã sao chép link!' : 'Chia sẻ'}</span>
          </button>
        </div>

        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden bg-[#1a0c2e] border border-purple-900/60 shadow-2xl mb-10">
          <div className="relative h-64 sm:h-96 w-full overflow-hidden">
            <img
              src={event.bannerUrl || event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== DEFAULT_BANNER_IMAGE) {
                  target.src = DEFAULT_BANNER_IMAGE;
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12091c] via-[#12091c]/60 to-transparent" />
          </div>

          <div className="relative px-6 sm:px-10 pb-8 -mt-20 sm:-mt-28 flex flex-col md:flex-row gap-6 items-start justify-between">
            <div className="flex-1 space-y-3">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-semibold shadow-md">
                  {event.genre}
                </span>
                {event.isTrending && (
                  <span className="px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-semibold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                    Trending Now
                  </span>
                )}
                {event.ageRestriction && (
                  <span className="px-2.5 py-1 rounded-full bg-[#1b0d2d] border border-purple-800 text-purple-300 text-xs font-medium">
                    {event.ageRestriction}
                  </span>
                )}
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {event.title}
              </h1>
              {event.subTitle && (
                <p className="text-sm sm:text-base text-purple-200/80 font-medium">
                  {event.subTitle}
                </p>
              )}

              {/* Metadata Grid */}
              <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-purple-300">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span>{event.venue}</span>
                </div>
              </div>
            </div>

            {/* Quick Buy Card on Top Right */}
            <div className="w-full md:w-80 rounded-2xl bg-[#1d0e32]/90 border border-purple-700/60 p-5 shadow-xl backdrop-blur-md">
              <div className="text-xs text-purple-400 font-semibold mb-1">Giá vé từ</div>
              <div className="text-2xl sm:text-3xl font-black text-white mb-3">
                {formatPrice(event.priceStart, event.currency)}
              </div>
              <button
                onClick={() => handleProceedToCheckout()}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Ticket className="w-4 h-4" />
                <span>Mua vé ngay</span>
              </button>
              <div className="mt-2 text-center text-[11px] text-purple-400/80 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                <span>Vé chính hãng • Check-in QR bảo mật</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Layout: Left info & Right Ticket Tiers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Details, Artists, Venue */}
          <div className="lg:col-span-2 space-y-8">
            {/* About the Event */}
            <div className="rounded-3xl bg-[#1d0e32]/70 border border-purple-800/40 p-6 sm:p-8">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-purple-400" />
                <span>Giới thiệu sự kiện</span>
              </h3>
              <p className="text-sm text-purple-200/90 leading-relaxed whitespace-pre-line">
                {event.description}
              </p>

              <div className="mt-6 pt-6 border-t border-purple-900/60 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-900/60 border border-purple-600/40 flex items-center justify-center text-purple-300 font-bold text-sm">
                  {event.organizer.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs text-purple-400">Đơn vị tổ chức</div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{event.organizer.name}</span>
                    {event.organizer.verified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 fill-purple-400/20" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Lineup / Artists */}
            {event.artists && event.artists.length > 0 && (
              <div className="rounded-3xl bg-[#1d0e32]/70 border border-purple-800/40 p-6 sm:p-8">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>Nghệ sĩ biểu diễn (Lineup)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.artists.map((artist, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3.5 p-3 rounded-2xl bg-purple-950/40 border border-purple-900/60"
                    >
                      <img
                        src={artist.avatar}
                        alt={artist.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/40"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="text-sm font-bold text-white">{artist.name}</div>
                        <div className="text-xs text-purple-400">{artist.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location & Venue Map Card */}
            <div className="rounded-3xl bg-[#1d0e32]/70 border border-purple-800/40 p-6 sm:p-8">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-400" />
                <span>Địa điểm &amp; Sơ đồ di chuyển</span>
              </h3>
              <p className="text-sm font-semibold text-purple-100">{event.venue}</p>
              <p className="text-xs text-purple-300/70 mt-1 mb-4">{event.address}</p>

              <div className="rounded-2xl overflow-hidden border border-purple-900/60 bg-[#12091c] p-4 text-center">
                <div className="py-6 text-purple-300/80 text-xs flex flex-col items-center justify-center gap-2">
                  <MapPin className="w-8 h-8 text-pink-500 animate-bounce" />
                  <span className="font-semibold text-white">{event.venue}</span>
                  <span className="text-[11px] text-purple-400">{event.address}</span>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(event.venue + ' ' + event.city)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-purple-400 hover:text-white underline"
                  >
                    <span>Mở chỉ đường trên Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Ticket Tiers Selection & Purchase */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white px-1 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-purple-400" />
              <span>Các hạng vé khả dụng</span>
            </h3>

            {event.ticketTiers.map(tier => {
              const isSelected = selectedTierId === tier.id;
              return (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-900/40 border-purple-400 shadow-xl shadow-purple-950'
                      : 'bg-[#1d0e32]/80 border-purple-800/50 hover:border-purple-600/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-base font-bold text-white">{tier.name}</h4>
                      <p className="text-xs text-purple-300/80 mt-0.5">{tier.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-white">
                        {formatPrice(tier.price, event.currency)}
                      </div>
                      <div className="text-[10px] text-purple-400">
                        Còn lại {tier.available} vé
                      </div>
                    </div>
                  </div>

                  {tier.perks && tier.perks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-900/60 space-y-1">
                      {tier.perks.map((perk, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-2 text-[11px] text-purple-200/90">
                          <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                          <span>{perk}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProceedToCheckout(tier.id);
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Chọn mua hạng vé này</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
