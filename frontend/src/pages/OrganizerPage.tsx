import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CalendarDays, MapPin, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
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
}

const ZoneRow: React.FC<ZoneRowProps> = ({ eventId, zone, editable, onSaved }) => {
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
                className="mt-1.5 w-full h-11 sm:h-9 rounded-lg bg-kumo-control ring ring-kumo-line px-3 text-base font-normal text-kumo-default tabular-nums placeholder:text-kumo-placeholder focus:outline-none focus:ring-2 focus:ring-kumo-brand"
              />
            ) : (
              <div className="mt-1.5 rounded-lg bg-kumo-recessed px-3 py-2 text-base font-semibold text-kumo-strong tabular-nums">
                {formatPrice(zone[key], '₫')}
              </div>
            )}
            {editable && /^\d+$/.test(draft[key].trim()) && (
              <span className="mt-1 block text-xs font-normal text-kumo-subtle tabular-nums">
                {formatPrice(Number(draft[key]), '₫')}
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
            className="h-11 sm:h-9 px-3.5 rounded-lg bg-kumo-brand hover:bg-kumo-brand-hover text-kumo-on-brand text-base font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  const { isEnabled, isLoading: featuresLoading } = useFeatures();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [selected, setSelected] = useState<OrganizerEvent | null>(null);
  const [zones, setZones] = useState<OrganizerZone[]>([]);
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

  const handleSelect = async (ev: OrganizerEvent) => {
    setSelected(ev);
    setZones([]);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-kumo-interact border-t-kumo-brand animate-spin" />
      </div>
    );
  }
  if (!consoleEnabled) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-strong mb-6">Quản lý sự kiện</h1>

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
                          ? 'bg-kumo-base ring-2 ring-kumo-brand'
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
                {zones.map(zone => (
                  <ZoneRow
                    key={`${selected.id}-${zone.zoneId}`}
                    eventId={selected.id}
                    zone={zone}
                    editable={isEnabled('zone_pricing')}
                    onSaved={handleSaved}
                  />
                ))}
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};
