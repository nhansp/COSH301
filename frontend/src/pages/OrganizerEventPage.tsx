import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BarChart3, CalendarDays, ExternalLink, Info, LayoutGrid, MapPin, Tag } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { Footer } from '../components/Footer';
import { EventStatusBadge, formatDateTime, timingOf } from '../components/organizer/EventStatus';
import { EventInfoPanel } from '../components/organizer/EventInfoPanel';
import { SeatingPanel } from '../components/organizer/SeatingPanel';
import { SalesPanel } from '../components/organizer/SalesPanel';
import { ZonePriceEditor } from '../components/organizer/ZonePriceEditor';
import { PricingPanel } from './PricingPage';
import { useFeatures } from '../context/FeatureContext';
import { DEFAULT_BANNER_IMAGE } from '../services/eventService';
import { OrganizerEventDetail, apiFetchOrganizerEvent, apiFetchOrganizerEvents, eventSaveMessage } from '../services/organizerService';

const TABS = [
  { key: 'overview', label: 'Tổng quan', icon: <Info className="size-4" /> },
  { key: 'seating', label: 'Sơ đồ ghế', icon: <LayoutGrid className="size-4" /> },
  { key: 'pricing', label: 'Vé & giá', icon: <Tag className="size-4" /> },
  { key: 'sales', label: 'Doanh số', icon: <BarChart3 className="size-4" /> }
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** One event's management: information, seating, ticket pricing and sales, as tabs. */
export const OrganizerEventPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const [event, setEvent] = useState<OrganizerEventDetail | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const tab: TabKey = TABS.some(t => t.key === params.get('tab')) ? (params.get('tab') as TabKey) : 'overview';
  const dynamicPricing = isEnabled('dynamic_pricing');
  const consoleEnabled = isEnabled('organizer_console');

  const load = useCallback(async () => {
    try {
      setEvent(await apiFetchOrganizerEvent(id));
      setError(null);
    } catch (e) {
      setError(eventSaveMessage(e) === 'Không thể lưu. Vui lòng thử lại.' ? 'Không tải được sự kiện.' : eventSaveMessage(e));
    }
  }, [id]);

  const loadAlerts = useCallback(() => {
    apiFetchOrganizerEvents()
      .then(list => setUnreadAlerts(list.find(e => e.id === id)?.unreadAlerts ?? 0))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!consoleEnabled || !id) return;
    load();
    loadAlerts();
  }, [consoleEnabled, id, load, loadAlerts]);

  const selectTab = (key: TabKey) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    next.delete('edit');
    setParams(next, { replace: true });
  };

  if (featuresLoading) {
    return (
      <PageShell className="items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-kumo-interact border-t-violet-ink" />
      </PageShell>
    );
  }
  if (!consoleEnabled) return <Navigate to="/" replace />;

  const timing = event ? timingOf(event.startsAt, event.endsAt) : null;

  return (
    <PageShell>
      <Navbar />
      <main className="page-enter mx-auto w-full max-w-page flex-1 px-4 pt-6 pb-20 sm:px-6 lg:px-10">
        <Link to="/organizer" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-kumo-subtle hover:text-kumo-strong">
          <ArrowLeft className="size-4" /> Tất cả sự kiện
        </Link>

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-kumo-danger-tint px-3 py-2 text-sm text-kumo-danger">
            <AlertCircle className="mt-px size-4 flex-shrink-0" />
            {error}
          </p>
        )}

        {event && (
          <>
            <header className="relative mt-2 isolate overflow-hidden rounded-3xl bg-midnight text-white">
              <img src={event.imageUrl || DEFAULT_BANNER_IMAGE} alt="" referrerPolicy="no-referrer" className="absolute inset-0 -z-10 size-full object-cover object-[center_30%] opacity-70" />
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-midnight via-midnight/60 to-midnight/10" />
              <div className="flex min-h-56 flex-col justify-end gap-3 p-5 sm:min-h-64 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <EventStatusBadge status={event.status} onImage />
                  {timing && (
                    <span className="inline-flex h-6 items-center rounded-full bg-white/15 px-2.5 text-xs font-semibold text-white ring ring-white/25 backdrop-blur-sm">
                      {timing.label}
                    </span>
                  )}
                  {event.genre && (
                    <span className="inline-flex h-6 items-center rounded-full bg-white/15 px-2.5 text-xs font-semibold text-white ring ring-white/25 backdrop-blur-sm">
                      {event.genre}
                    </span>
                  )}
                </div>
                <h1 className="type-display max-w-4xl text-3xl text-white sm:text-4xl">{event.name}</h1>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1 text-sm text-white/85">
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="size-4" />
                      <span className="tabular-nums">{formatDateTime(event.startsAt)}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {event.venueName}
                      {event.city && ` · ${event.city}`}
                    </p>
                  </div>
                  <a href={`/event/${event.id}`} target="_blank" rel="noreferrer" className="btn btn-sm bg-white/90 text-midnight hover:bg-white">
                    <ExternalLink className="size-4" /> Trang khách xem
                  </a>
                </div>
              </div>
            </header>

            <div role="tablist" aria-label="Quản lý sự kiện" className="no-scrollbar sticky top-16 z-10 -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-kumo-hairline bg-kumo-canvas/90 px-4 backdrop-blur sm:mx-0 sm:px-0">
              {TABS.map(t => {
                const active = t.key === tab;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    type="button"
                    id={`tab-${t.key}`}
                    aria-selected={active}
                    aria-controls={`panel-${t.key}`}
                    onClick={() => selectTab(t.key)}
                    className={`relative flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-medium transition-colors ${
                      active ? 'text-kumo-strong' : 'text-kumo-subtle hover:text-kumo-strong'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                    {t.key === 'pricing' && dynamicPricing && unreadAlerts > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-kumo-danger px-1.5 text-xs font-semibold text-white tabular-nums">
                        {unreadAlerts}
                      </span>
                    )}
                    <span aria-hidden="true" className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-violet-ink ${active ? '' : 'hidden'}`} />
                  </button>
                );
              })}
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
              {tab === 'overview' && <EventInfoPanel event={event} startEditing={params.get('edit') === '1'} onSaved={setEvent} />}
              {tab === 'seating' && <SeatingPanel eventId={event.id} />}
              {tab === 'pricing' &&
                (dynamicPricing ? (
                  <PricingPanel
                    eventId={event.id}
                    onChange={() => {
                      load();
                      loadAlerts();
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-kumo-strong">Giá vé theo khu vực</h2>
                    {(event.zones ?? []).map(z => (
                      <ZonePriceEditor key={z.zoneId} eventId={event.id} zone={z} editable={isEnabled('zone_pricing')} onSaved={() => load()} />
                    ))}
                  </div>
                ))}
              {tab === 'sales' && <SalesPanel event={event} paymentsLive={isEnabled('payments')} />}
            </div>
          </>
        )}
        {!event && !error && <div className="mt-4 h-64 animate-pulse rounded-3xl bg-kumo-fill" aria-busy="true" />}
      </main>
      <Footer />
    </PageShell>
  );
};
