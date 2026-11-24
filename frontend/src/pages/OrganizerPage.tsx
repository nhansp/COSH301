import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CalendarDays, MapPin, Save, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageShell } from '../components/layout/PageShell';
import { Footer } from '../components/Footer';
import { FeedbackResults } from '../components/FeedbackResults';
import { useFeatures } from '../context/FeatureContext';
import { formatPrice } from '../services/eventService';
import {
  OrganizerEvent,
  OrganizerZone,
  ZonePricing,
  apiFetchOrganizerEvents,
  apiFetchEventZones,
  apiUpdateZonePricing,
  pricingErrorMessage,
} from '../services/organizerService';
import {
  PricingOverview,
  ZonePricingState,
  apiFetchPricingOverview,
  apiRunPricingNow,
  pricingActionError,
} from '../services/pricingService';
import { ZonePricingPanel } from '../components/organizer/ZonePricingPanel';

// How often the console reloads the live inputs while an event is open.
const PRICING_POLL_MS = 4000;

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
  onSaved: (zoneId: string, pricing: ZonePricing) => void;
  /** Dynamic pricing state of the zone; absent while it loads or when the feature is off. */
  dynamic?: { overview: PricingOverview; zone: ZonePricingState };
  onPricingChanged: () => void;
}

const ZoneRow: React.FC<ZoneRowProps> = ({ eventId, zone, editable, onSaved, dynamic, onPricingChanged }) => {
  const [draft, setDraft] = useState<PriceDraft>(toDraft(zone));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // An approved suggestion or another organizer's edit changes the stored prices: show them.
  useEffect(() => {
    setDraft(toDraft(zone));
  }, [zone.basePrice, zone.floorPrice, zone.ceilingPrice]); // eslint-disable-line react-hooks/exhaustive-deps

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
    onPricingChanged();
  };

  return (
    <form onSubmit={handleSave} className="rounded-xl bg-kumo-base ring ring-kumo-line p-4 sm:p-5">
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
      {dynamic && (
        <ZonePricingPanel
          eventId={eventId}
          zone={dynamic.zone}
          settings={dynamic.overview.settings}
          now={Date.parse(dynamic.overview.generatedAt)}
          onChanged={onPricingChanged}
        />
      )}
    </form>
  );
};

export const OrganizerPage: React.FC = () => {
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [selected, setSelected] = useState<OrganizerEvent | null>(null);
  const [zones, setZones] = useState<OrganizerZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<PricingOverview | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runNote, setRunNote] = useState<string | null>(null);

  const consoleEnabled = isEnabled('organizer_console');
  const dynamicEnabled = isEnabled('dynamic_pricing');
  const selectedId = selected?.id;

  useEffect(() => {
    if (!consoleEnabled) return;
    apiFetchOrganizerEvents()
      .then(setEvents)
      .catch(() => setError('Không thể tải danh sách sự kiện.'))
      .finally(() => setIsLoading(false));
  }, [consoleEnabled]);

  // Applies a fresh pricing overview. Prices the engine or another organizer changed
  // flow into the zone forms too, so they never show a price that is no longer current.
  const applyOverview = useCallback((next: PricingOverview) => {
    setOverview(next);
    setZones(prev =>
      prev.map(z => {
        const live = next.zones.find(p => p.zoneId === z.zoneId);
        return live
          ? {
              ...z,
              basePrice: live.basePrice,
              floorPrice: live.floorPrice,
              ceilingPrice: live.ceilingPrice,
              isDynamicPricingEnabled: live.isDynamicPricingEnabled,
            }
          : z;
      })
    );
  }, []);

  const refreshOverview = useCallback(async () => {
    if (!selectedId) return;
    const res = await apiFetchPricingOverview(selectedId);
    if (res.ok) applyOverview(res.data);
  }, [selectedId, applyOverview]);

  // Reload the live inputs every few seconds while the tab is visible.
  useEffect(() => {
    if (!dynamicEnabled || !selectedId) return;
    setOverview(null);
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      const res = await apiFetchPricingOverview(selectedId);
      if (!stopped && res.ok) applyOverview(res.data);
    };
    tick();
    const timer = setInterval(tick, PRICING_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [dynamicEnabled, selectedId, applyOverview]);

  // A run reply must not be overwritten by a slower poll that started before it.
  const runSeq = useRef(0);
  const handleRunNow = async () => {
    if (!selectedId) return;
    const seq = ++runSeq.current;
    setIsRunning(true);
    setRunNote(null);
    const res = await apiRunPricingNow(selectedId);
    setIsRunning(false);
    if (!res.ok) {
      setRunNote(pricingActionError(res.error));
      return;
    }
    if (seq === runSeq.current) applyOverview(res.data.overview);
    const { created, updated, withdrawn, zones: n } = res.data.run;
    setRunNote(`Đã phân tích ${n} khu vực: ${created} đề xuất mới, ${updated} đề xuất cập nhật, ${withdrawn} đề xuất rút lại.`);
  };

  const handleSelect = async (ev: OrganizerEvent) => {
    setSelected(ev);
    setZones([]);
    setOverview(null);
    setRunNote(null);
    setError(null);
    try {
      setZones(await apiFetchEventZones(ev.id));
    } catch {
      setError('Không thể tải các khu vực của sự kiện.');
    }
  };

  const handleSaved = (zoneId: string, pricing: ZonePricing) =>
    setZones(prev => prev.map(z => (z.zoneId === zoneId ? { ...z, ...pricing } : z)));

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
        <h1 className="type-display text-display-lg mb-10">Quản lý sự kiện</h1>

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
                <h2 id="organizer-zones" className="text-sm font-medium text-kumo-subtle">
                  Khu vực: <span className="text-kumo-default">{selected.name}</span>
                </h2>
                {dynamicEnabled && overview && (
                  <div className="rounded-xl bg-kumo-elevated ring ring-kumo-line p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-kumo-strong flex items-center gap-2">
                        <span className="size-2 rounded-full bg-kumo-success animate-pulse" aria-hidden="true" />
                        Số liệu cập nhật trực tiếp
                        <span className="font-normal text-kumo-subtle tabular-nums">
                          {new Date(overview.generatedAt).toLocaleTimeString('vi-VN')}
                        </span>
                      </p>
                      <p className="text-xs text-kumo-subtle">
                        Tự động phân tích mỗi {Math.round(overview.settings.intervalSeconds / 60)} phút, đo tốc độ bán trong{' '}
                        {overview.settings.windowMinutes} phút gần nhất.
                        {overview.lastRunAt && <> Lần phân tích gần nhất: {new Date(overview.lastRunAt).toLocaleTimeString('vi-VN')}.</>}
                      </p>
                      {runNote && (
                        <p role="status" className="text-xs text-kumo-default">
                          {runNote}
                        </p>
                      )}
                    </div>
                    <button type="button" className="btn btn-ink flex-shrink-0" onClick={handleRunNow} disabled={isRunning}>
                      <RefreshCw className={`size-4 ${isRunning ? 'animate-spin' : ''}`} />
                      {isRunning ? 'Đang phân tích...' : 'Chạy lại phân tích ngay'}
                    </button>
                  </div>
                )}
                {zones.map(zone => {
                  const live = overview?.zones.find(p => p.zoneId === zone.zoneId);
                  return (
                    <ZoneRow
                      key={`${selected.id}-${zone.zoneId}`}
                      eventId={selected.id}
                      zone={zone}
                      editable={isEnabled('zone_pricing')}
                      onSaved={handleSaved}
                      dynamic={dynamicEnabled && overview && live ? { overview, zone: live } : undefined}
                      onPricingChanged={refreshOverview}
                    />
                  );
                })}
              </>
            )}
          </section>
        </div>

        {isEnabled('user_testing') && <FeedbackResults />}
      </main>
      <Footer />
    </PageShell>
  );
};
