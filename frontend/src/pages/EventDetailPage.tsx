import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useEvents } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureContext';
import { formatPrice, DEFAULT_BANNER_IMAGE, DEFAULT_EVENT_IMAGE, apiFetchEventDetail } from '../services/eventService';
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
  ExternalLink,
  Armchair
} from 'lucide-react';
import { SeatMap } from '../components/SeatMap';
import { SeatItem } from '../types';

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEventById, isLoading } = useEvents();
  const { isAuthenticated } = useAuth();
  const { isEnabled } = useFeatures();
  const seatMapEnabled = isEnabled('seat_map_realtime');
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SeatItem[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'seatmap'>('seatmap');
  const [copiedLink, setCopiedLink] = useState(false);
  const [directEvent, setDirectEvent] = useState<any>(null);
  const [isFetchingDirect, setIsFetchingDirect] = useState<boolean>(false);

  const contextEvent = id ? getEventById(id) : undefined;
  const event = contextEvent || directEvent;

  useEffect(() => {
    if (!contextEvent && id) {
      setIsFetchingDirect(true);
      apiFetchEventDetail(id).then(res => {
        if (res) setDirectEvent(res);
      }).finally(() => {
        setIsFetchingDirect(false);
      });
    }
  }, [contextEvent, id]);

  if (isLoading || isFetchingDirect) {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <Navbar />
        <div className="max-w-md mx-auto my-auto text-center py-20 px-4">
          <div className="size-8 rounded-full border-2 border-kumo-interact border-t-kumo-brand animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-kumo-strong">Đang tải thông tin sự kiện...</h2>
        </div>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <Navbar />
        <div className="max-w-md mx-auto my-auto text-center py-20 px-4">
          <h2 className="text-2xl font-semibold tracking-tight text-kumo-strong mb-2">Không tìm thấy sự kiện</h2>
          <p className="text-kumo-subtle mb-6">
            Sự kiện bạn đang tìm kiếm có thể đã kết thúc hoặc không còn mở bán.
          </p>
          <Link
            to="/"
            className="h-11 sm:h-9 px-3.5 rounded-lg bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand font-medium inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Khám phá các sự kiện khác</span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Handle proceed with chosen seats from the interactive seat map
  const handleProceedWithSeats = (chosenSeats: SeatItem[]) => {
    const seatIds = chosenSeats.map(s => s.id).join(',');
    const tierId = chosenSeats[0]?.tierId || selectedTierId || event.ticketTiers[0]?.id;
    const checkoutUrl = `/checkout/${event.id}?tier=${tierId}&seats=${encodeURIComponent(seatIds)}`;

    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(checkoutUrl)}`);
    } else {
      navigate(checkoutUrl);
    }
  };

  // Handle "Mua vé ngay" click with strict authentication interception
  const handleProceedToCheckout = (tierId?: string) => {
    const chosenTier = tierId || selectedTierId || event.ticketTiers[0]?.id;
    const checkoutUrl = `/checkout/${event.id}${chosenTier ? `?tier=${chosenTier}` : ''}`;

    if (!isAuthenticated) {
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

  const openSeatMap = () => {
    setActiveTab('seatmap');
    const el = document.getElementById('seat-map-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const tabClass = (active: boolean) =>
    `h-11 sm:h-8 px-3 shrink-0 rounded-md font-medium flex items-center gap-2 transition-colors cursor-pointer ${
      active
        ? 'bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line'
        : 'text-kumo-subtle hover:text-kumo-default'
    }`;

  return (
    <div className="min-h-screen flex flex-col pb-24 lg:pb-0">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link & Share */}
        <div className="flex items-center justify-between mb-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 h-11 sm:h-8 px-2 -ml-2 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Tất cả sự kiện</span>
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 h-11 sm:h-9 px-3 rounded-lg bg-kumo-base ring ring-kumo-line hover:bg-kumo-tint text-kumo-default font-medium transition-colors cursor-pointer"
          >
            {copiedLink ? (
              <CheckCircle2 className="size-3.5 text-kumo-success" />
            ) : (
              <Share2 className="size-3.5" />
            )}
            <span>{copiedLink ? 'Đã sao chép link!' : 'Chia sẻ'}</span>
          </button>
        </div>

        {/* Hero: the banner carries the colour, everything else stays neutral */}
        <div className="relative -mx-4 sm:mx-0 aspect-[4/3] sm:aspect-[21/9] overflow-hidden rounded-none sm:rounded-xl bg-kumo-recessed sm:ring ring-kumo-line">
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
        </div>

        <div className="mt-5 sm:mt-6 mb-8 sm:mb-10 flex flex-col lg:flex-row gap-6 items-start justify-between">
          <div className="w-full lg:flex-1 min-w-0 space-y-3">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-kumo-tint ring ring-kumo-line text-kumo-default">
                {event.genre}
              </span>
              {event.isTrending && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-kumo-tint ring ring-kumo-line text-kumo-default flex items-center gap-1">
                  <Flame className="size-3 fill-current" />
                  Trending Now
                </span>
              )}
              {event.ageRestriction && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-kumo-tint ring ring-kumo-line text-kumo-subtle">
                  {event.ageRestriction}
                </span>
              )}
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-kumo-strong tracking-tight text-balance break-words">
              {event.title}
            </h1>
            {event.subTitle && (
              <p className="text-base sm:text-lg text-kumo-subtle max-w-[65ch]">
                {event.subTitle}
              </p>
            )}

            {/* Metadata */}
            <div className="pt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-kumo-default">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4 text-kumo-subtle" />
                <span>{event.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-kumo-subtle" />
                <span className="tabular-nums">{event.time}</span>
              </div>
              <div className="flex items-start gap-1.5 min-w-0">
                <MapPin className="size-4 mt-0.5 shrink-0 text-kumo-subtle" />
                <span className="min-w-0 break-words">{event.venue}</span>
              </div>
            </div>

            {/* Secondary quick-buy stays inline below lg; the primary CTA lives in the sticky bar */}
            <button
              onClick={() => handleProceedToCheckout()}
              className="lg:hidden mt-2 w-full sm:w-auto h-11 sm:h-9 px-3 rounded-lg bg-kumo-base ring ring-kumo-line hover:bg-kumo-tint text-kumo-default font-medium transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Ticket className="size-3.5" />
              <span>Mua vé nhanh theo hạng</span>
            </button>
          </div>

          {/* Quick Buy Card */}
          <div className="hidden lg:block w-80 shrink-0 rounded-xl bg-kumo-base ring ring-kumo-line shadow-xs p-5">
            <div className="text-xs font-medium text-kumo-subtle mb-0.5">Giá vé từ</div>
            <div className="text-3xl font-semibold tracking-tight text-kumo-strong tabular-nums mb-4">
              {formatPrice(event.priceStart, event.currency)}
            </div>
            <div className="space-y-2">
              {seatMapEnabled && (
                <button
                  onClick={openSeatMap}
                  className="w-full h-11 px-3.5 rounded-lg bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Armchair className="size-4" />
                  <span>Chọn ghế trực quan (Seat Map)</span>
                </button>
              )}
              <button
                onClick={() => handleProceedToCheckout()}
                className="w-full h-9 px-3 rounded-lg bg-kumo-base ring ring-kumo-line hover:bg-kumo-tint text-kumo-default font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Ticket className="size-3.5" />
                <span>Mua vé nhanh theo hạng</span>
              </button>
            </div>
            <div className="mt-4 pt-3 border-t border-kumo-hairline text-xs text-kumo-subtle flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-kumo-success" />
                Giữ chỗ 5 phút
              </span>
              <span>Zero Double-Booking</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs between Seat Map and Event Info */}
        <div
          id="seat-map-section"
          role="tablist"
          className="flex sm:inline-flex max-w-full items-center gap-0.5 p-0.5 mb-6 rounded-lg bg-kumo-recessed ring ring-kumo-line overflow-x-auto no-scrollbar whitespace-nowrap scroll-mt-24"
        >
          {seatMapEnabled && (
            <button
              role="tab"
              aria-selected={activeTab === 'seatmap'}
              onClick={() => setActiveTab('seatmap')}
              className={tabClass(activeTab === 'seatmap')}
            >
              <Armchair className="size-4" />
              <span>
                Sơ đồ ghế<span className="hidden sm:inline"> trực quan</span>
              </span>
              <span className="rounded-full px-1.5 py-px text-xs font-medium bg-kumo-success-tint text-kumo-success">
                Real-time
              </span>
            </button>
          )}

          <button
            role="tab"
            aria-selected={activeTab === 'info'}
            onClick={() => setActiveTab('info')}
            className={tabClass(activeTab === 'info')}
          >
            <Info className="size-4" />
            <span>
              Chi tiết<span className="hidden sm:inline"> &amp; Nghệ sĩ biểu diễn</span>
            </span>
          </button>
        </div>

        {activeTab === 'seatmap' && (
          <div className="mb-10 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {seatMapEnabled ? (
              <SeatMap
                eventId={event.id}
                currency={event.currency}
                selectedSeatIds={selectedSeats.map(s => s.id)}
                onSeatsChange={setSelectedSeats}
                onProceedToCheckout={handleProceedWithSeats}
                maxSeats={4}
              />
            ) : (
              <div className="rounded-xl bg-kumo-recessed ring ring-kumo-line p-5 text-base text-kumo-default">
                Sơ đồ ghế hiện chưa được mở. Bạn có thể mua vé nhanh theo hạng vé.
              </div>
            )}
          </div>
        )}

        {/* Content Layout: Left info & Right Ticket Tiers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left 2 Cols: Details, Artists, Venue */}
          <div className="lg:col-span-2 space-y-6">
            {/* About the Event */}
            <section className="rounded-xl bg-kumo-base ring ring-kumo-line p-5 sm:p-7">
              <h3 className="text-lg font-semibold tracking-tight text-kumo-strong mb-3 flex items-center gap-2">
                <Info className="size-4 text-kumo-subtle" />
                <span>Giới thiệu sự kiện</span>
              </h3>
              <p className="text-kumo-default leading-relaxed whitespace-pre-line max-w-[70ch]">
                {event.description}
              </p>

              <div className="mt-6 pt-5 border-t border-kumo-hairline flex items-center gap-3">
                <div className="size-10 rounded-full bg-kumo-recessed ring ring-kumo-line grid place-items-center text-kumo-default font-semibold">
                  {event.organizer.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs text-kumo-subtle">Đơn vị tổ chức</div>
                  <div className="font-semibold text-kumo-strong flex items-center gap-1.5">
                    <span>{event.organizer.name}</span>
                    {event.organizer.verified && (
                      <CheckCircle2 className="size-3.5 text-kumo-success" aria-label="Đã xác minh" />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Lineup / Artists */}
            {event.artists && event.artists.length > 0 && (
              <section className="rounded-xl bg-kumo-base ring ring-kumo-line p-5 sm:p-7">
                <h3 className="text-lg font-semibold tracking-tight text-kumo-strong mb-4 flex items-center gap-2">
                  <Users className="size-4 text-kumo-subtle" />
                  <span>Nghệ sĩ biểu diễn (Lineup)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {event.artists.map((artist, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg bg-kumo-recessed"
                    >
                      <img
                        src={artist.avatar}
                        alt={artist.name}
                        className="size-11 rounded-full object-cover ring ring-kumo-line"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-kumo-strong truncate">{artist.name}</div>
                        <div className="text-xs text-kumo-subtle">{artist.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Location & Venue */}
            <section className="rounded-xl bg-kumo-base ring ring-kumo-line p-5 sm:p-7">
              <h3 className="text-lg font-semibold tracking-tight text-kumo-strong mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-kumo-subtle" />
                <span>Địa điểm &amp; Sơ đồ di chuyển</span>
              </h3>
              <p className="font-semibold text-kumo-strong">{event.venue}</p>
              <p className="text-kumo-subtle mt-0.5 mb-4">{event.address}</p>

              <div className="rounded-lg bg-kumo-recessed py-8 px-4 flex flex-col items-center justify-center gap-2 text-center">
                <MapPin className="size-7 text-kumo-danger" />
                <span className="font-semibold text-kumo-strong">{event.venue}</span>
                <span className="text-xs text-kumo-subtle">{event.address}</span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.venue + ' ' + event.city)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-kumo-link underline decoration-kumo-interact hover:decoration-current underline-offset-4 rounded-sm"
                >
                  <span>Mở chỉ đường trên Google Maps</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </section>
          </div>

          {/* Right Col: Ticket Tiers Selection & Purchase */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight text-kumo-strong px-1 flex items-center gap-2">
              <Ticket className="size-4 text-kumo-subtle" />
              <span>Các hạng vé khả dụng</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {event.ticketTiers.map(tier => {
              const isSelected = selectedTierId === tier.id;
              return (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`flex flex-col p-4 sm:p-5 rounded-xl bg-kumo-base transition-shadow cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-kumo-brand shadow-xs'
                      : 'ring ring-kumo-line hover:ring-kumo-interact'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 mb-2">
                    <div className="min-w-0">
                      <h4 className="text-lg font-semibold text-kumo-strong">{tier.name}</h4>
                      <p className="text-kumo-subtle mt-0.5">{tier.description}</p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <div className="text-lg font-semibold text-kumo-strong tabular-nums">
                        {formatPrice(tier.price, event.currency)}
                      </div>
                      <div className="text-xs text-kumo-subtle tabular-nums">
                        Còn lại {tier.available} vé
                      </div>
                    </div>
                  </div>

                  {tier.perks && tier.perks.length > 0 && (
                    <ul className="mt-3 pt-3 border-t border-kumo-hairline space-y-1.5">
                      {tier.perks.map((perk, pIdx) => (
                        <li key={pIdx} className="flex items-center gap-2 text-sm text-kumo-default">
                          <CheckCircle2 className="size-3.5 text-kumo-success shrink-0" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div aria-hidden="true" className="flex-1 min-h-4" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProceedToCheckout(tier.id);
                    }}
                    className={`w-full h-11 sm:h-9 px-3.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand'
                        : 'bg-kumo-base ring ring-kumo-line hover:bg-kumo-tint text-kumo-default'
                    }`}
                  >
                    <Ticket className="size-3.5" />
                    <span>Chọn mua hạng vé này</span>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Mobile/tablet buy bar replaces the quick-buy panel below lg */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden bg-kumo-raised/95 backdrop-blur border-t border-kumo-hairline px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-kumo-subtle">Giá vé từ</div>
            <div className="text-lg font-semibold text-kumo-strong tabular-nums truncate">
              {formatPrice(event.priceStart, event.currency)}
            </div>
          </div>
          <button
            onClick={seatMapEnabled ? openSeatMap : () => handleProceedToCheckout()}
            className="h-11 px-4 shrink-0 rounded-lg bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand font-medium transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            {seatMapEnabled ? <Armchair className="size-4" /> : <Ticket className="size-4" />}
            <span>{seatMapEnabled ? 'Chọn ghế' : 'Mua vé'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
