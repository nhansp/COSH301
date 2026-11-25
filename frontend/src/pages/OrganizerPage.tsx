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
  X,
  Lock,
  TrendingUp,
  RotateCcw
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

type PriceFieldKey = 'floorPrice' | 'basePrice' | 'ceilingPrice';

interface ZonePriceDraft {
  basePrice: string;
  floorPrice: string;
  ceilingPrice: string;
  isDynamicPricingEnabled: boolean;
}

const PRICING_CACHE_PREFIX = 'sms_organizer_pricing_draft_v1:';

const PRICE_FIELDS: { key: PriceFieldKey; label: string }[] = [
  { key: 'floorPrice', label: 'Giá sàn' },
  { key: 'basePrice', label: 'Giá cơ bản' },
  { key: 'ceilingPrice', label: 'Giá trần' },
];

function toZoneDraft(z: OrganizerZone): ZonePriceDraft {
  return {
    basePrice: String(z.basePrice),
    floorPrice: String(z.floorPrice),
    ceilingPrice: String(z.ceilingPrice),
    isDynamicPricingEnabled: z.isDynamicPricingEnabled,
  };
}

function loadPricingDraftCache(eventId: string): Record<string, ZonePriceDraft> {
  try {
    const raw = localStorage.getItem(`${PRICING_CACHE_PREFIX}${eventId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, ZonePriceDraft> = {};
    for (const [zoneId, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (
        typeof e.basePrice === 'string' &&
        typeof e.floorPrice === 'string' &&
        typeof e.ceilingPrice === 'string' &&
        typeof e.isDynamicPricingEnabled === 'boolean'
      ) {
        out[zoneId] = {
          basePrice: e.basePrice,
          floorPrice: e.floorPrice,
          ceilingPrice: e.ceilingPrice,
          isDynamicPricingEnabled: e.isDynamicPricingEnabled,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function savePricingDraftCache(eventId: string, drafts: Record<string, ZonePriceDraft>): void {
  try {
    const key = `${PRICING_CACHE_PREFIX}${eventId}`;
    if (Object.keys(drafts).length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(drafts));
    }
  } catch {
    // Ignore storage quota or private-mode errors.
  }
}

function isZoneDraftDirty(zone: OrganizerZone, draft: ZonePriceDraft | undefined): boolean {
  if (!draft) return false;
  if (draft.isDynamicPricingEnabled !== zone.isDynamicPricingEnabled) return true;
  if (!draft.isDynamicPricingEnabled) {
    return (
      draft.basePrice.trim() !== String(zone.basePrice) ||
      zone.floorPrice !== zone.basePrice ||
      zone.ceilingPrice !== zone.basePrice
    );
  }
  return (
    draft.basePrice.trim() !== String(zone.basePrice) ||
    draft.floorPrice.trim() !== String(zone.floorPrice) ||
    draft.ceilingPrice.trim() !== String(zone.ceilingPrice)
  );
}

// Returns a Vietnamese error message, or null when the draft is valid.
function validateDraft(d: ZonePriceDraft): string | null {
  if (!d.isDynamicPricingEnabled) {
    const baseStr = d.basePrice.trim();
    if (!/^\d+$/.test(baseStr)) return 'Giá phải là số nguyên không âm (VND).';
    return null;
  }
  const values = PRICE_FIELDS.map(f => d[f.key].trim());
  if (values.some(v => !/^\d+$/.test(v))) return 'Giá phải là số nguyên không âm (VND).';
  const [floor, base, ceiling] = values.map(Number);
  if (!(floor <= base && base <= ceiling)) return 'Cần thỏa mãn: giá sàn ≤ giá cơ bản ≤ giá trần.';
  return null;
}

interface ZoneRowProps {
  zone: OrganizerZone;
  draft: ZonePriceDraft;
  isDirty: boolean;
  error: string | null;
  editable: boolean;
  highlighted?: boolean;
  onChange: (zoneId: string, next: ZonePriceDraft) => void;
}

const ZoneRow: React.FC<ZoneRowProps> = ({
  zone,
  draft,
  isDirty,
  error,
  editable,
  highlighted,
  onChange,
}) => {
  const isDynamic = draft.isDynamicPricingEnabled;

  const handleModeChange = (nextDynamic: boolean) => {
    let next: ZonePriceDraft = { ...draft, isDynamicPricingEnabled: nextDynamic };
    if (nextDynamic && /^\d+$/.test(draft.basePrice.trim())) {
      const base = Number(draft.basePrice.trim());
      const curFloor = /^\d+$/.test(draft.floorPrice.trim()) ? Number(draft.floorPrice.trim()) : base;
      const curCeil = /^\d+$/.test(draft.ceilingPrice.trim()) ? Number(draft.ceilingPrice.trim()) : base;
      if (base > 0 && curFloor === base && curCeil === base) {
        next = {
          ...next,
          floorPrice: String(Math.round((base * 0.8) / 1000) * 1000),
          ceilingPrice: String(Math.round((base * 1.2) / 1000) * 1000),
        };
      }
    }
    onChange(zone.zoneId, next);
  };

  return (
    <article
      id={`zone-pricing-${zone.zoneId}`}
      className={`rounded-xl bg-kumo-base p-4 sm:p-5 transition-shadow ${
        error
          ? 'ring-2 ring-kumo-danger'
          : highlighted || isDirty
            ? 'ring-2 ring-violet-ink'
            : 'ring ring-kumo-line'
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
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isDirty && (
            <span className="rounded-full bg-kumo-warning-tint px-2.5 py-0.5 text-xs font-medium text-kumo-warning">
              Đã lưu nháp
            </span>
          )}
          {isDynamic ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-kumo-success-tint text-kumo-success">
              <TrendingUp className="size-3" />
              Giá động
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-kumo-recessed text-kumo-subtle ring ring-kumo-line">
              <Lock className="size-3" />
              Giá cố định
            </span>
          )}
        </div>
      </div>

      {editable && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-medium text-kumo-subtle">
            Bạn muốn áp dụng chế độ giá nào cho khu vực này?
          </legend>
          <div role="radiogroup" aria-label={`Chế độ giá ${zone.zoneName}`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              role="radio"
              aria-checked={!isDynamic}
              onClick={() => handleModeChange(false)}
              className={`flex items-start gap-2.5 rounded-xl p-3 text-left transition-colors ${
                !isDynamic
                  ? 'bg-kumo-tint ring-2 ring-violet-ink'
                  : 'bg-kumo-recessed/70 ring ring-kumo-line hover:ring-kumo-interact'
              }`}
            >
              <span
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                  !isDynamic ? 'bg-kumo-base text-violet-ink' : 'bg-kumo-base/80 text-kumo-subtle'
                }`}
              >
                <Lock className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-kumo-strong">Giá cố định (Fixed)</span>
                <span className="mt-0.5 block text-xs text-kumo-subtle">
                  Một mức giá niêm yết duy nhất, không biến động theo nhu cầu.
                </span>
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={isDynamic}
              onClick={() => handleModeChange(true)}
              className={`flex items-start gap-2.5 rounded-xl p-3 text-left transition-colors ${
                isDynamic
                  ? 'bg-kumo-tint ring-2 ring-violet-ink'
                  : 'bg-kumo-recessed/70 ring ring-kumo-line hover:ring-kumo-interact'
              }`}
            >
              <span
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                  isDynamic ? 'bg-kumo-success-tint text-kumo-success' : 'bg-kumo-base/80 text-kumo-subtle'
                }`}
              >
                <TrendingUp className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-kumo-strong">Giá động (Dynamic)</span>
                <span className="mt-0.5 block text-xs text-kumo-subtle">
                  Tự điều chỉnh linh hoạt trong khung Giá sàn — Giá trần.
                </span>
              </span>
            </button>
          </div>
        </fieldset>
      )}

      {isDynamic ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRICE_FIELDS.map(({ key, label }) => (
            <label key={key} className="block text-sm font-medium text-kumo-default">
              {label}
              {editable ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft[key]}
                  onChange={e => onChange(zone.zoneId, { ...draft, [key]: e.target.value })}
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
      ) : (
        <div className="max-w-sm">
          <label className="block text-sm font-medium text-kumo-default">
            Giá vé cố định (VND)
            {editable ? (
              <input
                type="text"
                inputMode="numeric"
                value={draft.basePrice}
                onChange={e => onChange(zone.zoneId, { ...draft, basePrice: e.target.value })}
                className="field mt-1.5 font-normal tabular-nums"
              />
            ) : (
              <div className="mt-1.5 rounded-lg bg-kumo-recessed px-3 py-2 text-base font-semibold text-kumo-strong tabular-nums">
                {formatPrice(zone.basePrice)}
              </div>
            )}
            {editable && /^\d+$/.test(draft.basePrice.trim()) && (
              <span className="mt-1 block text-xs font-normal text-kumo-subtle tabular-nums">
                {formatPrice(Number(draft.basePrice))} · Áp dụng đồng nhất cho toàn khu
              </span>
            )}
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-sm bg-kumo-danger-tint text-kumo-danger flex items-start gap-2">
          <AlertCircle className="size-4 flex-shrink-0 mt-px" />
          {error}
        </p>
      )}
    </article>
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
  const [draftsByZone, setDraftsByZone] = useState<Record<string, ZonePriceDraft>>({});
  const [zoneErrors, setZoneErrors] = useState<Record<string, string>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveSummaryError, setSaveSummaryError] = useState<string | null>(null);
  const [saveSummarySuccess, setSaveSummarySuccess] = useState<string | null>(null);
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
    setDraftsByZone(loadPricingDraftCache(ev.id));
    setZoneErrors({});
    setSaveSummaryError(null);
    setSaveSummarySuccess(null);
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
      // Prune any cached drafts that no longer differ from server values or belong to removed zones.
      const cached = loadPricingDraftCache(ev.id);
      const validCached: Record<string, ZonePriceDraft> = {};
      for (const z of zoneList) {
        const d = cached[z.zoneId];
        if (d && isZoneDraftDirty(z, d)) {
          validCached[z.zoneId] = d;
        }
      }
      savePricingDraftCache(ev.id, validCached);
      setDraftsByZone(validCached);
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

  const handleZoneDraftChange = (zoneId: string, next: ZonePriceDraft) => {
    if (!selected) return;
    const baseZone = zones.find(z => z.zoneId === zoneId);
    setSaveSummaryError(null);
    setSaveSummarySuccess(null);
    setZoneErrors(prev => {
      if (!(zoneId in prev)) return prev;
      const copy = { ...prev };
      delete copy[zoneId];
      return copy;
    });
    setDraftsByZone(prev => {
      const updated = { ...prev };
      if (baseZone && !isZoneDraftDirty(baseZone, next)) {
        delete updated[zoneId];
      } else {
        updated[zoneId] = next;
      }
      savePricingDraftCache(selected.id, updated);
      return updated;
    });
  };

  const dirtyZones = zones.filter(z => isZoneDraftDirty(z, draftsByZone[z.zoneId]));

  const handleDiscardDrafts = () => {
    if (!selected) return;
    setDraftsByZone({});
    setZoneErrors({});
    setSaveSummaryError(null);
    setSaveSummarySuccess(null);
    savePricingDraftCache(selected.id, {});
  };

  const handleSaveAllPricing = async () => {
    if (!selected || isSavingAll) return;
    setSaveSummaryError(null);
    setSaveSummarySuccess(null);

    if (dirtyZones.length === 0) {
      setSaveSummarySuccess('Tất cả khu vực đã khớp với giá đang lưu.');
      return;
    }

    const validationErrors: Record<string, string> = {};
    for (const z of dirtyZones) {
      const d = draftsByZone[z.zoneId] ?? toZoneDraft(z);
      const err = validateDraft(d);
      if (err) validationErrors[z.zoneId] = err;
    }
    if (Object.keys(validationErrors).length > 0) {
      setZoneErrors(validationErrors);
      setSaveSummaryError('Một số khu vực có mức giá chưa hợp lệ. Vui lòng kiểm tra các ô báo đỏ.');
      const firstBadId = Object.keys(validationErrors)[0];
      document.getElementById(`zone-pricing-${firstBadId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    setIsSavingAll(true);
    setZoneErrors({});
    const results = await Promise.all(
      dirtyZones.map(async z => {
        const d = draftsByZone[z.zoneId] ?? toZoneDraft(z);
        const base = Number(d.basePrice.trim());
        const pricing: ZonePricing = d.isDynamicPricingEnabled
          ? {
              basePrice: base,
              floorPrice: Number(d.floorPrice.trim()),
              ceilingPrice: Number(d.ceilingPrice.trim()),
              isDynamicPricingEnabled: true,
            }
          : {
              basePrice: base,
              floorPrice: base,
              ceilingPrice: base,
              isDynamicPricingEnabled: false,
            };
        const code = await apiUpdateZonePricing(selected.id, z.zoneId, pricing);
        return { zoneId: z.zoneId, pricing, code };
      })
    );
    setIsSavingAll(false);

    const savedMap = new Map<string, ZonePricing>();
    const failedErrors: Record<string, string> = {};
    for (const r of results) {
      if (r.code) {
        failedErrors[r.zoneId] = pricingErrorMessage(r.code);
      } else {
        savedMap.set(r.zoneId, r.pricing);
      }
    }

    if (savedMap.size > 0) {
      setZones(prev =>
        prev.map(z => {
          const p = savedMap.get(z.zoneId);
          return p
            ? {
                ...z,
                basePrice: p.basePrice,
                floorPrice: p.floorPrice,
                ceilingPrice: p.ceilingPrice,
                isDynamicPricingEnabled: p.isDynamicPricingEnabled ?? z.isDynamicPricingEnabled,
              }
            : z;
        })
      );
      setDraftsByZone(prev => {
        const remaining = { ...prev };
        for (const zid of savedMap.keys()) delete remaining[zid];
        savePricingDraftCache(selected.id, remaining);
        return remaining;
      });
      invalidateAssistantCache();
      loadOverview();
    }

    setZoneErrors(failedErrors);
    const failedCount = Object.keys(failedErrors).length;
    if (failedCount > 0) {
      setSaveSummaryError(
        savedMap.size > 0
          ? `Đã lưu ${savedMap.size} khu vực, nhưng ${failedCount} khu vực gặp lỗi (bản nháp vẫn được giữ lại).`
          : `Chưa thể lưu giá cho ${failedCount} khu vực. Bản nháp vẫn được giữ lại để bạn thử lại.`
      );
    } else {
      setSaveSummarySuccess(`Đã lưu giá cho ${savedMap.size} khu vực.`);
    }
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
                        {dirtyZones.length > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                              activeTab === 'pricing'
                                ? 'bg-kumo-inverse/20 text-kumo-inverse'
                                : 'bg-kumo-warning-tint text-kumo-warning'
                            }`}
                          >
                            {dirtyZones.length}
                          </span>
                        )}
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
                  <div className="space-y-3">
                    {zones.map(zone => {
                      const draft = draftsByZone[zone.zoneId] ?? toZoneDraft(zone);
                      const dirty = isZoneDraftDirty(zone, draftsByZone[zone.zoneId]);
                      return (
                        <ZoneRow
                          key={`${selected.id}-${zone.zoneId}`}
                          zone={zone}
                          draft={draft}
                          isDirty={dirty}
                          error={zoneErrors[zone.zoneId] ?? null}
                          editable={isEnabled('zone_pricing')}
                          highlighted={focusedZoneId === zone.zoneId}
                          onChange={handleZoneDraftChange}
                        />
                      );
                    })}

                    {isEnabled('zone_pricing') && zones.length > 0 && (
                      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-kumo-base/95 p-4 shadow-lg ring ring-kumo-line backdrop-blur">
                        <div className="min-w-0 flex-1 text-sm">
                          {saveSummaryError ? (
                            <p role="alert" className="flex items-start gap-2 text-kumo-danger">
                              <AlertCircle className="mt-0.5 size-4 shrink-0" />
                              <span>{saveSummaryError}</span>
                            </p>
                          ) : saveSummarySuccess ? (
                            <p role="status" className="flex items-center gap-2 text-kumo-success">
                              <CheckCircle2 className="size-4 shrink-0" />
                              <span>{saveSummarySuccess}</span>
                            </p>
                          ) : dirtyZones.length > 0 ? (
                            <p className="text-kumo-default tabular-nums">
                              <strong className="text-kumo-strong">{dirtyZones.length} khu vực</strong> có thay đổi chưa lưu ·{' '}
                              <span className="text-xs text-kumo-subtle">Đã tự động lưu nháp trên trình duyệt</span>
                            </p>
                          ) : (
                            <p className="text-kumo-subtle">
                              Chỉnh sửa giá ở các khu vực bên trên rồi nhấn <strong>Lưu giá</strong> để áp dụng đồng loạt.
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {dirtyZones.length > 0 && (
                            <button
                              type="button"
                              onClick={handleDiscardDrafts}
                              disabled={isSavingAll}
                              className="btn btn-secondary btn-sm h-10"
                            >
                              <RotateCcw className="size-3.5" />
                              <span>Hủy nháp</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSaveAllPricing}
                            disabled={isSavingAll || dirtyZones.length === 0}
                            className="btn btn-ink h-10 px-5"
                          >
                            <Save className="size-4" />
                            <span>
                              {isSavingAll
                                ? 'Đang lưu...'
                                : dirtyZones.length > 0
                                  ? `Lưu giá (${dirtyZones.length} khu)`
                                  : 'Lưu giá'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
