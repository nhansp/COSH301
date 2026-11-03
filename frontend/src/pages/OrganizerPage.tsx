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
    <form onSubmit={handleSave} className="rounded-2xl bg-[#1d0e32]/70 border border-purple-800/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-white">{zone.zoneName}</h3>
          <p className="text-xs text-purple-300/70">
            {zone.zoneCode}{zone.floor ? ` • ${zone.floor}` : ''} • {zone.capacity} chỗ
          </p>
        </div>
        {zone.isDynamicPricingEnabled && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-500/40 font-semibold">
            Giá động
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PRICE_FIELDS.map(({ key, label }) => (
          <label key={key} className="block text-xs text-purple-300">
            {label}
            {editable ? (
              <input
                type="text"
                inputMode="numeric"
                value={draft[key]}
                onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-purple-950/60 border border-purple-700/50 text-white text-sm focus:outline-none focus:border-purple-400"
              />
            ) : (
              <div className="mt-1 text-sm font-semibold text-white">{formatPrice(zone[key], '₫')}</div>
            )}
            {editable && /^\d+$/.test(draft[key].trim()) && (
              <span className="text-[11px] text-purple-400/80">{formatPrice(Number(draft[key]), '₫')}</span>
            )}
          </label>
        ))}
      </div>

      {editable && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu giá'}</span>
          </button>
          {error && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </span>
          )}
          {saved && !error && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Đã lưu giá
            </span>
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
      <div className="min-h-screen flex items-center justify-center bg-[#12091c]">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!consoleEnabled) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#12091c] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-black mb-6">Quản lý sự kiện</h1>

        {error && (
          <div className="mb-4 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-purple-300">Sự kiện của bạn</h2>
            {isLoading ? (
              <p className="text-sm text-purple-300/70">Đang tải...</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-purple-300/70">Bạn chưa có sự kiện nào.</p>
            ) : (
              events.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => handleSelect(ev)}
                  className={`w-full text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                    selected?.id === ev.id
                      ? 'bg-purple-900/50 border-purple-400'
                      : 'bg-[#1d0e32]/70 border-purple-800/40 hover:border-purple-600'
                  }`}
                >
                  <p className="font-bold">{ev.name}</p>
                  <p className="text-xs text-purple-300/70 flex items-center gap-1 mt-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {new Date(ev.startsAt).toLocaleDateString('vi-VN')} • {ev.status}
                  </p>
                  {ev.venueName && (
                    <p className="text-xs text-purple-300/70 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {ev.venueName}
                    </p>
                  )}
                </button>
              ))
            )}
          </section>

          <section className="lg:col-span-2 space-y-4">
            {!selected ? (
              <p className="text-sm text-purple-300/70">Chọn một sự kiện để xem các khu vực và giá vé.</p>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-purple-300">Khu vực: {selected.name}</h2>
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
