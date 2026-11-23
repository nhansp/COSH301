import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, Share2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ImageCredit } from '../components/ImageCredit';
import { PageShell } from '../components/layout/PageShell';
import { Reveal } from '../components/ui/Reveal';
import { EmptyState } from '../components/ui/EmptyState';
import { eventDate } from '../components/events/EventCard';
import { useEvents } from '../context/EventContext';
import { useFeatures } from '../context/FeatureContext';
import { DEFAULT_BANNER_IMAGE, formatPrice, ticketLimitOf } from '../services/eventService';
import { summarizeZones } from '../services/venue';

const DetailSkeleton: React.FC = () => (
  <div aria-hidden="true" className="mx-auto grid w-full max-w-page gap-10 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-12 lg:px-10">
    <div className="space-y-5 lg:col-span-7">
      <div className="skeleton h-12 w-32" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-24 w-2/3" />
      <div className="skeleton mt-10 h-32 w-full" />
    </div>
    <div className="skeleton aspect-[4/5] lg:col-span-5" />
  </div>
);

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

  const zones = useMemo(() => summarizeZones(event?.ticketTiers ?? [], []), [event?.ticketTiers]);

  if (isLoading || (isFetchingDetail && needsDetail)) {
    return (
      <PageShell>
        <Navbar />
        <main className="flex-1" aria-busy="true">
          <DetailSkeleton />
        </main>
      </PageShell>
    );
  }

  if (!event) {
    return (
      <PageShell>
        <Navbar />
        <main className="mx-auto w-full max-w-page flex-1 px-4 py-16 sm:px-6 lg:px-10">
          <EmptyState
            title="Không tìm thấy sự kiện"
            body="Sự kiện có thể đã kết thúc hoặc không còn mở bán."
            action={
              <Link to="/" className="btn btn-ink">
                Xem lịch diễn
              </Link>
            }
          />
        </main>
        <Footer />
      </PageShell>
    );
  }

  const when = eventDate(event.rawDate);
  const ticketsUrl = isEnabled('seat_map_realtime') ? `/events/${event.id}/tickets` : `/checkout/${event.id}`;
  const soldOut = zones.length > 0 && zones.every(z => z.available === 0);
  const long = event.title.length > 34;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const cta = (full: boolean) =>
    soldOut ? (
      <span aria-disabled="true" className={`btn btn-lg cursor-not-allowed bg-kumo-fill text-kumo-subtle ${full ? 'w-full' : ''}`}>
        Đã hết vé
      </span>
    ) : (
      <Link to={ticketsUrl} className={`btn btn-primary btn-lg ${full ? 'w-full' : ''}`}>
        Chọn vé
      </Link>
    );

  const facts = [
    { label: 'Ngày', value: `${when.weekday}, ${when.full}` },
    { label: 'Giờ mở màn', value: when.time },
    { label: 'Địa điểm', value: `${event.venue}, ${event.city}` },
    { label: 'Thể loại', value: event.genre }
  ];

  return (
    <PageShell className="pb-24 lg:pb-0">
      <Navbar />

      <main className="page-enter flex-1">
        <div className="mx-auto flex max-w-page items-center justify-between gap-3 px-4 pt-6 sm:px-6 lg:px-10">
          <Link to="/" className="btn btn-quiet btn-sm -ml-3">
            <ArrowLeft className="size-4" />
            Lịch diễn
          </Link>
          <button type="button" onClick={handleShare} className="btn btn-quiet btn-sm" aria-live="polite">
            {copiedLink ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copiedLink ? 'Đã sao chép liên kết' : 'Chia sẻ'}
          </button>
        </div>

        <header className="mx-auto grid max-w-page gap-x-10 gap-y-10 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-12 lg:px-10 lg:pb-24">
          <div className="lg:col-span-7 lg:self-end">
            <p className="type-figure text-display-md text-violet-ink">{when.dayMonth}</p>
            <h1 className={`type-display mt-4 ${long ? 'text-display-lg' : 'text-display-xl'}`}>{event.title}</h1>
            <dl className="mt-10 grid border-t border-kumo-contrast sm:grid-cols-2">
              {facts.map(fact => (
                <div key={fact.label} className="border-b border-kumo-hairline py-4 sm:odd:pr-6">
                  <dt className="text-sm text-kumo-subtle">{fact.label}</dt>
                  <dd className="mt-1 text-lg font-medium text-kumo-strong">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="lg:col-span-5">
            <div className="aspect-[4/5] overflow-hidden bg-kumo-fill sm:aspect-[16/11] lg:aspect-[4/5]">
              <img
                src={event.bannerUrl || event.imageUrl}
                alt=""
                className="size-full object-cover motion-safe:animate-[house-up_1200ms_var(--ease-encore)_both]"
                referrerPolicy="no-referrer"
                onError={e => {
                  if (e.currentTarget.src !== DEFAULT_BANNER_IMAGE) e.currentTarget.src = DEFAULT_BANNER_IMAGE;
                }}
              />
            </div>
            <figcaption>
              <ImageCredit credit={event.imageCredit} className="mt-2 text-kumo-subtle" />
            </figcaption>
          </figure>
        </header>

        <div className="mx-auto grid max-w-page gap-16 px-4 pb-24 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-10">
          <div className="space-y-16 lg:col-span-6">
            <Reveal as="div">
              <section aria-labelledby="about">
                <h2 id="about" className="type-display text-display-sm">
                  Về đêm diễn
                </h2>
                <p className="mt-5 max-w-[62ch] text-lg leading-relaxed whitespace-pre-line text-kumo-default">{event.description}</p>
              </section>
            </Reveal>

            <Reveal as="div">
              <section aria-labelledby="venue">
                <h2 id="venue" className="type-display text-display-sm">
                  Địa điểm
                </h2>
                <p className="mt-5 text-xl font-medium text-kumo-strong">{event.venue}</p>
                <p className="mt-1 max-w-[60ch] text-kumo-subtle">{event.address}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue} ${event.city}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="link mt-4 inline-flex items-center gap-1.5"
                >
                  Chỉ đường trên Google Maps
                  <ExternalLink className="size-3.5" />
                </a>
              </section>
            </Reveal>
          </div>

          {/* The price list is the first stage surface the visitor meets: buying starts here. */}
          <aside
            data-mode="dark"
            aria-labelledby="prices"
            className="rounded-card bg-plum p-6 text-kumo-default sm:p-8 lg:sticky lg:top-24 lg:col-span-5 lg:col-start-8 lg:self-start"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="prices" className="type-display text-title">
                Giá vé
              </h2>
              <p className="text-sm text-kumo-subtle">Tối đa {ticketLimitOf(event)} vé mỗi tài khoản</p>
            </div>
            <ul className="mt-5 divide-y divide-kumo-hairline">
              {zones.map(zone => {
                const share = zone.capacity > 0 ? zone.available / zone.capacity : 0;
                return (
                  <li key={zone.id} className="py-4">
                    <div className="flex items-baseline gap-3">
                      {/* Same swatch as on the venue map at the ticket step. */}
                      <span aria-hidden="true" className="size-2.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: zone.color }} />
                      <span className="min-w-0 flex-1 truncate font-medium text-kumo-strong">{zone.name}</span>
                      <span
                        className={`type-figure shrink-0 text-lg ${zone.available === 0 ? 'text-kumo-subtle line-through' : 'text-kumo-strong'}`}
                      >
                        {formatPrice(zone.basePrice)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 pl-5.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-kumo-tint" aria-hidden="true">
                        <span className="block h-full rounded-full bg-violet" style={{ width: `${Math.round(share * 100)}%` }} />
                      </span>
                      <span className="shrink-0 text-sm text-kumo-subtle tabular-nums">
                        {zone.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'},{' '}
                        {zone.available === 0 ? 'hết vé' : `còn ${zone.available}/${zone.capacity}`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 hidden lg:block">{cta(true)}</div>
          </aside>
        </div>
      </main>

      <Footer />

      <div
        data-mode="dark"
        style={{ zIndex: 'var(--z-sheet)' }}
        className="fixed inset-x-0 bottom-0 border-t border-kumo-hairline bg-midnight/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-page items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-kumo-subtle">Giá từ</div>
            <div className="type-figure text-xl text-kumo-strong">{event.priceStart > 0 ? formatPrice(event.priceStart) : 'Chưa có giá'}</div>
          </div>
          {cta(false)}
        </div>
      </div>
    </PageShell>
  );
};
