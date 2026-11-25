import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  MapPin,
  Save,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  SlidersHorizontal,
  Plus,
  ExternalLink,
  X
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { Footer } from '../components/Footer';
import { EventSalesDashboard, PortfolioSalesBanner } from '../components/organizer/OrganizerSalesDashboard';
import { useFeatures } from '../context/FeatureContext';
import { formatPrice, apiFetchSeats } from '../services/eventService';
import { SeatItem } from '../types';
import { invalidateAssistantCache, openAssistant } from '../services/assistantService';
import {
  CreatedOrganizerEvent,
  EventSalesSummary,
  OrganizerCancellationRecord,
  OrganizerEvent,
  OrganizerSalesOverview,
  OrganizerZone,
  ZonePricing,
  apiFetchOrganizerCancellations,
  apiFetchOrganizerEvents,
  apiFetchOrganizerSalesOverview,
  apiFetchEventZones,
  apiUpdateZonePricing,
  pricingErrorMessage,
} from '../services/organizerService';

type PriceDraft = Record<keyof ZonePricing, string>;

const PRICE_FIELDS: { key: keyof ZonePricing; label: string }[] = [
  { key: 'floorPrice', label: 'Giá sàn' },
  { key: 'basePrice', label: 'Giá cơ bản' },
  { key: 'ceilingPrice', label: 'Giá trần' },
];

function toDraft(z: ZonePricing): PriceDraft {
  return {
    basePrice: String(z.basePrice),
    floorPrice: String(z.floorPrice),
    ceilingPrice: String(z.ceilingPrice),
  };
}

// Returns a Vietnamese error message, or null when the draft is valid.
function validateDraft(d: PriceDraft): string | null {
  const values = PRICE_FIELDS.map(f => d[f.key].trim());
  if (values.some(v => !/^\d+$/.test(v))) return 'Giá phải là số nguyên không âm (VND).';
  const [floor, base, ceiling] = values.map(Number);
  if (!(floor <= base && base <= ceiling)) return 'Cần thỏa mãn: giá sàn ≤ giá cơ bản ≤ giá trần.';
  return null;
}

interface ZoneRowProps {
  eventId: string;
  zone: OrganizerZone;
  editable: boolean;
  highlighted?: boolean;
  onSaved: (zoneId: string, pricing: ZonePricing) => void;
}

const ZoneRow: React.FC<ZoneRowProps> = ({ eventId, zone, editable, highlighted, onSaved }) => {
  const [draft, setDraft] = useState<PriceDraft>(toDraft(zone));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const invalid = validateDraft(draft);
    setError(invalid);
    if (invalid) return;

    const pricing: ZonePricing = {
      basePrice: Number(draft.basePrice),
      floorPrice: Number(draft.floorPrice),
      ceilingPrice: Number(draft.ceilingPrice),
    };
    setIsSaving(true);
    const code = await apiUpdateZonePricing(eventId, zone.zoneId, pricing);
    setIsSaving(false);
    if (code) {
      setError(pricingErrorMessage(code));
      return;
    }
    onSaved(zone.zoneId, pricing);
    setSaved(true);
  };

  return (
    <form
      id={`zone-pricing-${zone.zoneId}`}
      onSubmit={handleSave}
      className={`rounded-xl bg-kumo-base p-4 sm:p-5 transition-shadow ${
        highlighted ? 'ring-2 ring-violet-ink' : 'ring ring-kumo-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-kumo-strong truncate">{zone.zoneName}</h3>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-kumo-subtle">
            <span>{zone.zoneCode}</span>
            {zone.floor && <span>{zone.floor}</span>}
            <span className="tabular-nums">{zone.capacity} chỗ</span>
          </p>
        </div>
        {zone.isDynamicPricingEnabled && (
          <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-kumo-success-tint text-kumo-success">
            Giá động
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PRICE_FIELDS.map(({ key, label }) => (
          <label key={key} className="block text-sm font-medium text-kumo-default">
            {label}
            {editable ? (
              <input
                type="text"
                inputMode="numeric"
                value={draft[key]}
                onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                className="field mt-1.5 font-normal tabular-nums"
              />
            ) : (
              <div className="mt-1.5 rounded-lg bg-kumo-recessed px-3 py-2 text-base font-semibold text-kumo-strong tabular-nums">
                {formatPrice(zone[key])}
              </div>
            )}
            {editable && /^\d+$/.test(draft[key].trim()) && (
              <span className="mt-1 block text-xs font-normal text-kumo-subtle tabular-nums">
                {formatPrice(Number(draft[key]))}
              </span>
            )}
          </label>
        ))}
      </div>

      {editable && (
        <div className="mt-4 pt-4 border-t border-kumo-hairline flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-ink"
          >
            <Save className="size-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu giá'}</span>
          </button>
          {error && (
            <p role="alert" className="rounded-lg px-3 py-2 text-sm bg-kumo-danger-tint text-kumo-danger flex items-start gap-2">
              <AlertCircle className="size-4 flex-shrink-0 mt-px" />
              {error}
            </p>
          )}
          {saved && !error && (
            <p role="status" className="rounded-lg px-3 py-2 text-sm bg-kumo-success-tint text-kumo-success flex items-center gap-2">
              <CheckCircle2 className="size-4 flex-shrink-0" />
              Đã lưu giá
            </p>
          )}
        </div>
      )}
    </form>
  );
};

export const OrganizerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const incomingCreated = (location.state as { createdEvent?: CreatedOrganizerEvent } | null)?.createdEvent ?? null;
  const initialCreatedIdRef = useRef<string | null>(incomingCreated?.id ?? null);

  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [overview, setOverview] = useState<OrganizerSalesOverview | null>(null);
  const [cancellations, setCancellations] = useState<OrganizerCancellationRecord[]>([]);
  const [selected, setSelected] = useState<OrganizerEvent | null>(null);
  const [zones, setZones] = useState<OrganizerZone[]>([]);
  const [eventSeats, setEventSeats] = useState<SeatItem[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing'>('dashboard');
  const [createdBanner, setCreatedBanner] = useState<CreatedOrganizerEvent | null>(incomingCreated);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear router navigation state once captured so page reloads do not replay the banner.
  useEffect(() => {
    if (incomingCreated) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [incomingCreated, location.pathname, navigate]);

  const consoleEnabled = isEnabled('organizer_console');

  const loadOverview = useCallback(async () => {
    const [data, cancelledList] = await Promise.all([
      apiFetchOrganizerSalesOverview(),
      apiFetchOrganizerCancellations()
    ]);
    if (data) setOverview(data);
    setCancellations(cancelledList);
    return data;
  }, []);

  const selectSeqRef = useRef(0);

  const handleSelect = useCallback(async (ev: OrganizerEvent) => {
    const seq = ++selectSeqRef.current;
    setSelected(ev);
    setZones([]);
    setEventSeats([]);
    setFocusedZoneId(null);
    setError(null);
    try {
      const [zoneList, seatList] = await Promise.all([
        apiFetchEventZones(ev.id),
        apiFetchSeats(ev.id)
      ]);
      if (selectSeqRef.current !== seq) return;
      setZones(zoneList);
      setEventSeats(seatList ?? []);
    } catch {
      if (selectSeqRef.current === seq) {
        setError('Không thể tải các khu vực của sự kiện.');
      }
    }
  }, []);

  useEffect(() => {
    if (!consoleEnabled) return;
    let active = true;
    Promise.all([apiFetchOrganizerEvents(), loadOverview()])
      .then(([list]) => {
        if (!active) return;
        setEvents(list);
        if (list.length > 0) {
          const targetId = initialCreatedIdRef.current;
          const initial = (targetId ? list.find(e => e.id === targetId) : undefined) ?? list[0];
          initialCreatedIdRef.current = null;
          handleSelect(initial);
        }
      })
      .catch(() => {
        if (active) setError('Không thể tải danh sách sự kiện.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [consoleEnabled, loadOverview, handleSelect]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    invalidateAssistantCache();
    await loadOverview();
    if (selected) {
      await Promise.all([
        apiFetchEventZones(selected.id).then(setZones).catch(() => {}),
        apiFetchSeats(selected.id).then(s => setEventSeats(s ?? [])).catch(() => {})
      ]);
    }
    setIsRefreshing(false);
  };

  const handleInspectZonePricing = (zoneId: string) => {
    setFocusedZoneId(zoneId);
    setActiveTab('pricing');
    window.requestAnimationFrame(() => {
      document.getElementById(`zone-pricing-${zoneId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    });
  };

  const handleSaved = (zoneId: string, pricing: ZonePricing) => {
    setZones(prev => prev.map(z => (z.zoneId === zoneId ? { ...z, ...pricing } : z)));
    invalidateAssistantCache();
    loadOverview();
  };

  const selectedSummary: EventSalesSummary | undefined = selected
    ? overview?.events.find(e => e.eventId === selected.id)
    : undefined;

  if (featuresLoading) {
    return (
      <PageShell className="items-center justify-center">
        <div className="size-8 rounded-full border-2 border-kumo-interact border-t-violet-ink animate-spin" />
      </PageShell>
    );
  }
  if (!consoleEnabled) return <Navigate to="/" replace />;

  return (
    <PageShell>
      <Navbar />
      <main className="page-enter flex-1 max-w-page w-full mx-auto px-4 sm:px-6 lg:px-10 pt-10 pb-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="type-display text-display-lg">Quản lý sự kiện &amp; Doanh số</h1>
            <p className="mt-2 text-kumo-subtle">
              Theo dõi doanh thu, tỉ lệ lấp đầy trực tiếp từ cơ sở dữ liệu và cấu hình khung giá theo khu vực.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/organizer/events/new" className="btn btn-ink btn-sm h-10">
              <Plus className="size-4" />
              <span>Tạo sự kiện mới</span>
            </Link>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn btn-secondary btn-sm h-10"
            >
              <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Đang cập nhật...' : 'Làm mới số liệu'}</span>
            </button>
          </div>
        </div>

        {createdBanner && (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-kumo-success-tint px-4 py-3.5 text-sm text-kumo-success ring ring-kumo-success/30"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>
                Đã tạo sự kiện <strong>{createdBanner.name}</strong> ({createdBanner.zoneCount} khu ·{' '}
                {createdBanner.totalCapacity.toLocaleString('vi-VN')} chỗ) với thiết kế sân khấu trực tiếp!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/events/${createdBanner.slug}/tickets`}
                className="btn btn-secondary btn-sm h-9 text-xs text-kumo-strong"
              >
                <span>Xem sơ đồ 2D / 3D</span>
                <ExternalLink className="size-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setCreatedBanner(null)}
                aria-label="Ẩn thông báo"
                className="rounded-lg p-1.5 text-kumo-success/80 transition-colors hover:bg-kumo-success/10 hover:text-kumo-success"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        {overview && (
          <PortfolioSalesBanner
            overview={overview}
            cancellations={cancellations}
            selectedEventId={selected?.id ?? null}
            onSelectEvent={eventId => {
              const found = events.find(e => e.id === eventId);
              if (found) handleSelect(found);
            }}
          />
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm bg-kumo-danger-tint text-kumo-danger flex items-start gap-2">
            <AlertCircle className="size-4 flex-shrink-0 mt-px" />
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 lg:items-start">
          <section aria-labelledby="organizer-events" className="space-y-2">
            <h2 id="organizer-events" className="text-sm font-medium text-kumo-subtle">Sự kiện của bạn</h2>
            {isLoading ? (
              <p className="text-base text-kumo-subtle">Đang tải...</p>
            ) : events.length === 0 ? (
              <p className="rounded-xl bg-kumo-elevated ring ring-kumo-line px-4 py-6 text-center text-base text-kumo-subtle">
                Bạn chưa có sự kiện nào.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map(ev => {
                  const active = selected?.id === ev.id;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => handleSelect(ev)}
                      aria-pressed={active}
                      className={`w-full min-h-11 text-left rounded-xl p-4 transition-colors ${
                        active
                          ? 'bg-kumo-base ring-2 ring-violet-ink'
                          : 'bg-kumo-base ring ring-kumo-line hover:ring-kumo-interact'
                      }`}
                    >
                      <p className="font-semibold text-kumo-strong">{ev.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-kumo-subtle">
                        <span className="flex items-center gap-1 tabular-nums">
                          <CalendarDays className="size-3.5" />
                          {new Date(ev.startsAt).toLocaleDateString('vi-VN')}
                        </span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-kumo-tint ring ring-kumo-line text-kumo-default">
                          {ev.status}
                        </span>
                      </p>
                      {ev.venueName && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-kumo-subtle min-w-0">
                          <MapPin className="size-3.5 flex-shrink-0" />
                          <span className="truncate">{ev.venueName}</span>
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="organizer-zones" className="lg:col-span-2 space-y-3">
            {!selected ? (
              <p className="rounded-xl bg-kumo-elevated ring ring-kumo-line px-4 py-10 text-center text-base text-kumo-subtle">
                Chọn một sự kiện để xem các khu vực và giá vé.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="organizer-zones" className="text-base font-semibold text-kumo-strong truncate">
                      {selected.name}
                    </h2>
                    <div role="tablist" aria-label="Chế độ xem sự kiện" className="mt-2 inline-flex gap-1 rounded-full bg-kumo-recessed p-1">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                          activeTab === 'dashboard'
                            ? 'bg-kumo-contrast text-kumo-inverse'
                            : 'text-kumo-subtle hover:text-kumo-strong'
                        }`}
                      >
                        <BarChart3 className="size-3.5" />
                        <span>Bảng điều khiển doanh số</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'pricing'}
                        onClick={() => setActiveTab('pricing')}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                          activeTab === 'pricing'
                            ? 'bg-kumo-contrast text-kumo-inverse'
                            : 'text-kumo-subtle hover:text-kumo-strong'
                        }`}
                      >
                        <SlidersHorizontal className="size-3.5" />
                        <span>Cấu hình giá khu vực</span>
                      </button>
                    </div>
                  </div>
                </div>

                {activeTab === 'dashboard' && selectedSummary ? (
                  <EventSalesDashboard
                    summary={selectedSummary}
                    seats={eventSeats}
                    cancellations={cancellations}
                    onOpenAiAnalysis={() => openAssistant({ eventId: selected.id, mode: 'sales_analysis' })}
                    onOpenStageGraph={overlay =>
                      openAssistant({
                        eventId: selected.id,
                        mode: 'stage_graph',
                        stageTab: 'map',
                        stageOverlay: overlay ?? 'occupancy'
                      })
                    }
                    onSwitchToPricing={() => {
                      setFocusedZoneId(null);
                      setActiveTab('pricing');
                    }}
                    onInspectPricing={handleInspectZonePricing}
                  />
                ) : (
                  zones.map(zone => (
                    <ZoneRow
                      key={`${selected.id}-${zone.zoneId}`}
                      eventId={selected.id}
                      zone={zone}
                      editable={isEnabled('zone_pricing')}
                      highlighted={focusedZoneId === zone.zoneId}
                      onSaved={handleSaved}
                    />
                  ))
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </PageShell>
  );
};
