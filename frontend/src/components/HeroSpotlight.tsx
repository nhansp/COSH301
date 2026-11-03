import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar, MapPin, Ticket, ShieldCheck, Zap, Users, ArrowRight } from 'lucide-react';
import { useEvents } from '../context/EventContext';
import { formatPrice } from '../services/eventService';

interface HeroSpotlightProps {
  onExploreClick?: () => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({ onExploreClick }) => {
  const { events, setSearchQuery } = useEvents();
  const navigate = useNavigate();

  // Find featured concert (prefer Mỹ Tâm or Blackpink or first trending event)
  const featuredEvent =
    events.find(e => e.title.includes('Mỹ Tâm') || e.title.includes('BLACKPINK')) ||
    events[0];

  const handleFeaturedClick = () => {
    if (featuredEvent) {
      navigate(`/event/${featuredEvent.id}`);
    }
  };

  const handleQuickSearch = (keyword: string) => {
    setSearchQuery(keyword);
    onExploreClick?.();
  };

  return (
    <section className="relative overflow-hidden rounded-3xl mb-10 border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 via-emerald-500/[0.04] to-transparent p-6 sm:p-8 md:p-10">
      {/* Background ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-teal-500/10 blur-3xl"
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Left Column: Headlines & Trust stats */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          {/* Live announcement badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-medium w-fit shadow-xs">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span>Mở Bán Vé Concert &amp; Festival Âm Nhạc 2025 - 2026</span>
          </div>

          {/* Main Hero Title */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-kumo-strong leading-[1.15]">
              Sống trọn đam mê cùng những{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 dark:from-emerald-400 dark:via-teal-300 dark:to-green-300">
                đêm nhạc đỉnh cao
              </span>
            </h1>
            <p className="text-base sm:text-lg text-kumo-subtle max-w-xl leading-relaxed">
              Khám phá và đặt vé concert chính hãng từ các nghệ sĩ hàng đầu. Chọn chỗ trực quan theo sơ đồ thời gian thực, quét mã QR check-in siêu tốc không cần vé giấy.
            </p>
          </div>

          {/* Quick Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={onExploreClick}
              className="h-11 sm:h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 font-semibold text-sm sm:text-base flex items-center gap-2 shadow-md shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Ticket className="size-4" />
              <span>Khám phá sự kiện</span>
              <ArrowRight className="size-4" />
            </button>

            {featuredEvent && (
              <button
                onClick={handleFeaturedClick}
                className="h-11 sm:h-12 px-5 rounded-xl bg-kumo-base ring ring-kumo-line hover:ring-emerald-500/40 text-kumo-strong font-medium text-sm sm:text-base flex items-center gap-2 transition-colors hover:bg-kumo-tint"
              >
                <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Spotlight: {featuredEvent.genre}</span>
              </button>
            )}
          </div>

          {/* Quick Filter Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs sm:text-sm text-kumo-subtle">
            <span className="font-medium text-kumo-default">Tìm kiếm hot:</span>
            {['Anh Trai Say Hi', 'Mỹ Tâm', 'BLACKPINK', 'G-Dragon', 'Hà Nội', 'TP.HCM'].map(
              tag => (
                <button
                  key={tag}
                  onClick={() => handleQuickSearch(tag)}
                  className="px-2.5 py-1 rounded-lg bg-kumo-base border border-emerald-500/20 text-kumo-default hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 transition-colors"
                >
                  {tag}
                </button>
              )
            )}
          </div>

          {/* Trust Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-emerald-500/15">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users className="size-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-kumo-strong">67,000+</p>
                <p className="text-xs text-kumo-subtle">Vé đã bán</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-kumo-strong">100%</p>
                <p className="text-xs text-kumo-subtle">Vé chính hãng</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Zap className="size-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-kumo-strong">Check-in</p>
                <p className="text-xs text-kumo-subtle">Mã QR 2 giây</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-kumo-strong">4.9 / 5.0</p>
                <p className="text-xs text-kumo-subtle">Hài lòng</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Featured Concert Spotlight Card */}
        {featuredEvent && (
          <div className="lg:col-span-5">
            <div
              onClick={handleFeaturedClick}
              className="group relative cursor-pointer rounded-2xl overflow-hidden bg-kumo-base ring-1 ring-emerald-500/30 hover:ring-emerald-500 transition-all shadow-xl shadow-emerald-950/10 hover:shadow-emerald-900/20 hover:-translate-y-1"
            >
              {/* Image banner with genre badge */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-emerald-950/20">
                <img
                  src={featuredEvent.imageUrl}
                  alt={featuredEvent.title}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-600/90 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1 shadow-xs">
                    <Sparkles className="size-3" />
                    Sự kiện nổi bật
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium">
                    {featuredEvent.genre}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-medium mb-1">
                    <Calendar className="size-3.5" />
                    <span>{featuredEvent.date}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold leading-snug line-clamp-2">
                    {featuredEvent.title}
                  </h3>
                </div>
              </div>

              {/* Card Bottom Details */}
              <div className="p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm text-kumo-subtle">
                  <span className="flex items-center gap-1.5 truncate">
                    <MapPin className="size-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{featuredEvent.venue}</span>
                  </span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-300 flex-shrink-0 ml-2">
                    {featuredEvent.city}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-kumo-hairline">
                  <div>
                    <span className="text-xs text-kumo-subtle block">Giá vé từ</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {formatPrice(featuredEvent.priceStart, featuredEvent.currency)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/checkout/${featuredEvent.id}`);
                    }}
                    className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Ticket className="size-4" />
                    Đặt vé ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
