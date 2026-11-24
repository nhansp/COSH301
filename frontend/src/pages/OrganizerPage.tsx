import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, Bell, CalendarDays, ExternalLink, LayoutGrid, MapPin, PencilLine, Settings2, Tag } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { Footer } from '../components/Footer';
import { EventStatusBadge, formatDateTime, timingOf } from '../components/organizer/EventStatus';
import { InventoryBar } from '../components/organizer/InventoryBar';
import { useFeatures } from '../context/FeatureContext';
import { DEFAULT_EVENT_IMAGE } from '../services/eventService';
import { OrganizerEvent, apiFetchOrganizerEvents } from '../services/organizerService';

/** Upcoming shows first (soonest first), then past ones (latest first). */
function byRelevance(events: OrganizerEvent[]): OrganizerEvent[] {
  const now = Date.now();
  const t = (e: OrganizerEvent) => Date.parse(e.startsAt);
  return [...events.filter(e => t(e) >= now).sort((a, b) => t(a) - t(b)), ...events.filter(e => t(e) < now).sort((a, b) => t(b) - t(a))];
}

const EventCard: React.FC<{ event: OrganizerEvent; pricing: boolean }> = ({ event, pricing }) => {
  const manage = `/organizer/events/${event.id}`;
  const timing = timingOf(event.startsAt, event.endsAt);
  const sellThrough = event.capacity > 0 ? Math.round((event.sold / event.capacity) * 100) : 0;
  const actions = [
    { to: `${manage}?tab=overview&edit=1`, label: 'Sửa thông tin', icon: <PencilLine className="size-4" /> },
    { to: `${manage}?tab=seating`, label: 'Sơ đồ ghế', icon: <LayoutGrid className="size-4" /> },
    { to: `${manage}?tab=pricing`, label: pricing ? 'Giá vé & định giá' : 'Giá vé', icon: <Tag className="size-4" /> }
  ];

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-kumo-base ring ring-kumo-line">
      <Link to={manage} className="group relative block aspect-[16/9] bg-kumo-fill" aria-label={`Quản lý ${event.name}`}>
        <span className="zoom-frame absolute inset-0">
          <img src={event.imageUrl || DEFAULT_EVENT_IMAGE} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        </span>
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-midnight/70 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <EventStatusBadge status={event.status} onImage />
          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold backdrop-blur-sm ${timing.past ? 'bg-black/50 text-white/80' : 'bg-white/90 text-midnight'}`}>
            {timing.label}
          </span>
        </span>
        {(event.unreadAlerts ?? 0) > 0 && pricing && (
          <span className="absolute top-3 right-3 inline-flex h-6 items-center gap-1 rounded-full bg-kumo-danger px-2.5 text-xs font-semibold text-white tabular-nums">
            <Bell className="size-3.5" /> {event.unreadAlerts}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2 className="text-lg leading-snug font-semibold tracking-tight text-kumo-strong">
          <Link to={manage} className="hover:underline">
            {event.name}
          </Link>
        </h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-kumo-subtle">
          <CalendarDays className="size-4 flex-shrink-0" />
          <span className="tabular-nums">{formatDateTime(event.startsAt)}</span>
        </p>
        {event.venueName && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-kumo-subtle">
            <MapPin className="mt-0.5 size-4 flex-shrink-0" />
            <span className="min-w-0">
              {event.venueName}
              {event.city && <span className="text-kumo-subtle/80"> · {event.city}</span>}
            </span>
          </p>
        )}

        <div className="mt-4">
          <p className="mb-1.5 flex items-baseline justify-between text-xs text-kumo-subtle">
            <span>Vé đã bán</span>
            <span className="text-sm font-semibold text-kumo-strong tabular-nums">
              {event.sold}/{event.capacity} · {sellThrough}%
            </span>
          </p>
          <InventoryBar counts={event} compact />
        </div>

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap gap-2">
            <Link to={manage} className="btn btn-ink btn-sm">
              <Settings2 className="size-4" /> Quản lý
            </Link>
            <a href={`/event/${event.id}`} target="_blank" rel="noreferrer" className="btn btn-quiet btn-sm">
              <ExternalLink className="size-4" /> Trang khách xem
            </a>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 border-t border-kumo-hairline pt-2">
            {actions.map(a => (
              <Link
                key={a.label}
                to={a.to}
                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center text-xs font-medium text-kumo-default transition-colors hover:bg-kumo-tint"
              >
                {a.icon}
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
};

export const OrganizerPage: React.FC = () => {
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const consoleEnabled = isEnabled('organizer_console');

  useEffect(() => {
    if (!consoleEnabled) return;
    apiFetchOrganizerEvents()
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách sự kiện.'))
      .finally(() => setIsLoading(false));
  }, [consoleEnabled]);

  const ordered = useMemo(() => byRelevance(events), [events]);
  const totals = useMemo(
    () => ({
      onSale: events.filter(e => e.status === 'ON_SALE').length,
      sold: events.reduce((n, e) => n + e.sold, 0),
      capacity: events.reduce((n, e) => n + e.capacity, 0),
      alerts: events.reduce((n, e) => n + (e.unreadAlerts ?? 0), 0)
    }),
    [events]
  );

  if (featuresLoading) {
    return (
      <PageShell className="items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-kumo-interact border-t-violet-ink" />
      </PageShell>
    );
  }
  if (!consoleEnabled) return <Navigate to="/" replace />;

  return (
    <PageShell>
      <Navbar />
      <main className="page-enter mx-auto w-full max-w-page flex-1 px-4 pt-10 pb-20 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="type-display text-display-lg">Quản lý sự kiện</h1>
            <p className="mt-2 text-kumo-subtle">Chọn một đêm diễn để sửa thông tin, xem sơ đồ ghế và quản lý giá vé.</p>
          </div>
          {events.length > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <dt className="text-kumo-subtle">Sự kiện</dt>
                <dd className="type-figure text-2xl text-kumo-strong">{events.length}</dd>
              </div>
              <div>
                <dt className="text-kumo-subtle">Đang mở bán</dt>
                <dd className="type-figure text-2xl text-kumo-strong">{totals.onSale}</dd>
              </div>
              <div>
                <dt className="text-kumo-subtle">Vé đã bán</dt>
                <dd className="type-figure text-2xl text-kumo-strong tabular-nums">
                  {totals.sold}
                  <span className="text-base text-kumo-subtle">/{totals.capacity}</span>
                </dd>
              </div>
              {isEnabled('dynamic_pricing') && totals.alerts > 0 && (
                <div>
                  <dt className="text-kumo-subtle">Thông báo giá</dt>
                  <dd className="type-figure text-2xl text-kumo-danger">{totals.alerts}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-6 flex items-start gap-2 rounded-lg bg-kumo-danger-tint px-3 py-2 text-sm text-kumo-danger">
            <AlertCircle className="mt-px size-4 flex-shrink-0" />
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-96 animate-pulse rounded-2xl bg-kumo-fill" />
            ))}
          </div>
        ) : events.length === 0 && !error ? (
          <p className="mt-8 rounded-xl bg-kumo-elevated px-4 py-10 text-center text-base text-kumo-subtle ring ring-kumo-line">Bạn chưa có sự kiện nào.</p>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {ordered.map(ev => (
              <li key={ev.id}>
                <EventCard event={ev} pricing={isEnabled('dynamic_pricing')} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </PageShell>
  );
};
