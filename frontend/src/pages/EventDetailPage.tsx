import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, Share2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ImageCredit } from '../components/ImageCredit';
import { useEvents } from '../context/EventContext';
import { useFeatures } from '../context/FeatureContext';
import { accentStyle, useEventAccent } from '../hooks/useEventAccent';
import { DEFAULT_BANNER_IMAGE, formatPrice, ticketLimitOf } from '../services/eventService';
import { summarizeZones } from '../services/venue';

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getEventById, loadEventDetail, isLoading } = useEvents();
  const { isEnabled } = useFeatures();
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  const event = id ? getEventById(id) : undefined;
  // List entries carry no zones; load the detail once for prices and availability.
  const needsDetail = !event || event.ticketTiers.length === 0;

  useEffect(() => {
    if (!id || !needsDetail) return;
    setIsFetchingDetail(true);
    loadEventDetail(id).finally(() => setIsFetchingDetail(false));
  }, [id, needsDetail, loadEventDetail]);

  const accent = useEventAccent(event?.imageUrl);
  const zones = useMemo(() => summarizeZones(event?.ticketTiers ?? [], []), [event?.ticketTiers]);

  if (isLoading || (isFetchingDetail && needsDetail)) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <p className="m-auto text-kumo-subtle">Đang tải sự kiện…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <div className="m-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-bold text-kumo-strong">Không tìm thấy sự kiện</h1>
          <p className="mt-2 text-kumo-subtle">Sự kiện có thể đã kết thúc hoặc không còn mở bán.</p>
          <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-kumo-contrast px-4 font-medium text-kumo-inverse">
            Xem lịch diễn
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const ticketsUrl = isEnabled('seat_map_realtime') ? `/events/${event.id}/tickets` : `/checkout/${event.id}`;
  const soldOut = zones.length > 0 && zones.every(z => z.available === 0);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const cta = (
    <Link
      to={ticketsUrl}
      aria-disabled={soldOut}
      className={`inline-flex h-12 items-center justify-center rounded-lg px-6 font-semibold transition-opacity ${
        soldOut ? 'pointer-events-none bg-kumo-fill text-kumo-subtle' : 'bg-accent text-accent-ink hover:opacity-90'
      }`}
    >
      {soldOut ? 'Đã hết vé' : 'Chọn vé'}
    </Link>
  );

  return (
    <div style={accentStyle(accent)} className="flex min-h-dvh flex-col pb-24 lg:pb-0">
      <Navbar />

      {/* The photo opens the page; the title sits on it, lit from below. */}
      <header className="relative isolate overflow-hidden bg-black">
        <img
          src={event.bannerUrl || event.imageUrl}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover object-[center_30%] opacity-90"
          referrerPolicy="no-referrer"
          onError={e => {
            if (e.currentTarget.src !== DEFAULT_BANNER_IMAGE) e.currentTarget.src = DEFAULT_BANNER_IMAGE;
          }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div className="mx-auto flex min-h-[70svh] max-w-6xl flex-col justify-between px-4 pt-4 pb-8 sm:px-6 lg:min-h-[64svh] lg:px-10 lg:pb-12">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Lịch diễn
            </Link>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-white/85 ring ring-white/25 transition-colors hover:bg-white/10 hover:text-white"
            >
              {copiedLink ? <Check className="size-4" /> : <Share2 className="size-4" />}
              {copiedLink ? 'Đã sao chép liên kết' : 'Chia sẻ'}
            </button>
          </div>

          <div className="max-w-4xl text-white">
            <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-white/85">
              <span className="inline-block h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
              <span>
                {event.date}, {event.time}
              </span>
              <span>{event.genre}</span>
            </p>
            <h1 className="font-display text-4xl leading-[1.08] font-bold text-balance [font-stretch:118%] sm:text-display-md lg:text-display-lg">
              {event.title}
            </h1>
            <p className="mt-3 text-lg text-white/85">
              {event.venue}, {event.city}
            </p>
          </div>
        </div>
        <ImageCredit credit={event.imageCredit} className="absolute right-4 bottom-2 max-w-[60%] truncate text-white/60 sm:right-6" />
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 lg:px-10 lg:py-14">
        <div className="space-y-12">
          <section aria-labelledby="about">
            <h2 id="about" className="mb-3 font-display text-2xl font-semibold text-kumo-strong [font-stretch:112%]">
              Về đêm diễn
            </h2>
            <p className="max-w-[65ch] text-lg leading-relaxed whitespace-pre-line text-kumo-default">{event.description}</p>
          </section>

          <section aria-labelledby="venue">
            <h2 id="venue" className="mb-3 font-display text-2xl font-semibold text-kumo-strong [font-stretch:112%]">
              Địa điểm
            </h2>
            <p className="text-lg font-medium text-kumo-strong">{event.venue}</p>
            <p className="mt-1 max-w-[60ch] text-kumo-subtle">{event.address}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue} ${event.city}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-kumo-link underline decoration-kumo-interact underline-offset-4 hover:decoration-current"
            >
              Chỉ đường trên Google Maps
              <ExternalLink className="size-3.5" />
            </a>
          </section>
        </div>

        <aside aria-labelledby="prices" className="lg:sticky lg:top-20 lg:self-start">
          <h2 id="prices" className="mb-1 font-display text-2xl font-semibold text-kumo-strong [font-stretch:112%]">
            Giá vé
          </h2>
          <p className="mb-4 text-sm text-kumo-subtle">Tối đa {ticketLimitOf(event)} vé mỗi tài khoản.</p>
          <ul className="divide-y divide-kumo-hairline border-y border-kumo-hairline">
            {zones.map(zone => (
              <li key={zone.id} className="flex items-center gap-3 py-3">
                {/* Same swatch as on the venue map at the ticket step. */}
                <span aria-hidden="true" className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: zone.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-kumo-strong">{zone.name}</span>
                  <span className="block text-sm text-kumo-subtle">
                    {zone.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'}
                    {zone.available === 0 && ' · Hết vé'}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-display text-lg font-semibold tabular-nums [font-stretch:75%] ${
                    zone.available === 0 ? 'text-kumo-subtle line-through' : 'text-kumo-strong'
                  }`}
                >
                  {formatPrice(zone.basePrice, event.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 hidden lg:block">{cta}</div>
        </aside>
      </main>

      <Footer />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-kumo-hairline bg-kumo-raised/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-kumo-subtle">Giá từ</div>
            <div className="font-display text-xl font-bold tabular-nums text-kumo-strong [font-stretch:75%]">
              {formatPrice(event.priceStart, event.currency)}
            </div>
          </div>
          {cta}
        </div>
      </div>
    </div>
  );
};
