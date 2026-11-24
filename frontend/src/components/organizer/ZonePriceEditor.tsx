import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { formatPrice } from '../../services/eventService';
import { ZoneInventory, ZonePricing, apiUpdateZonePricing, pricingErrorMessage } from '../../services/organizerService';

type PriceDraft = Record<keyof ZonePricing, string>;

const PRICE_FIELDS: { key: keyof ZonePricing; label: string }[] = [
  { key: 'floorPrice', label: 'Giá sàn' },
  { key: 'basePrice', label: 'Giá cơ bản' },
  { key: 'ceilingPrice', label: 'Giá trần' }
];

const toDraft = (z: ZonePricing): PriceDraft => ({
  basePrice: String(z.basePrice),
  floorPrice: String(z.floorPrice),
  ceilingPrice: String(z.ceilingPrice)
});

/** A Vietnamese error message, or null when the draft is valid. */
function validateDraft(d: PriceDraft): string | null {
  const values = PRICE_FIELDS.map(f => d[f.key].trim());
  if (values.some(v => !/^\d+$/.test(v))) return 'Giá phải là số nguyên không âm (VND).';
  const [floor, base, ceiling] = values.map(Number);
  if (!(floor <= base && base <= ceiling)) return 'Cần thỏa mãn: giá sàn ≤ giá cơ bản ≤ giá trần.';
  return null;
}

/** One ticket category's base price, floor and ceiling (FR-08). */
export const ZonePriceEditor: React.FC<{
  eventId: string;
  zone: ZoneInventory;
  editable: boolean;
  onSaved: (zoneId: string, pricing: ZonePricing) => void;
}> = ({ eventId, zone, editable, onSaved }) => {
  const [draft, setDraft] = useState<PriceDraft>(toDraft(zone));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setDraft(toDraft(zone)), [zone.basePrice, zone.floorPrice, zone.ceilingPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const invalid = validateDraft(draft);
    setError(invalid);
    if (invalid) return;

    const pricing: ZonePricing = {
      basePrice: Number(draft.basePrice),
      floorPrice: Number(draft.floorPrice),
      ceilingPrice: Number(draft.ceilingPrice)
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
    <form onSubmit={handleSave} className="rounded-xl bg-kumo-base p-4 ring ring-kumo-line sm:p-5">
      <div className="mb-4 min-w-0">
        <h3 className="truncate text-lg font-semibold tracking-tight text-kumo-strong">{zone.zoneName}</h3>
        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-kumo-subtle">
          <span>{zone.zoneCode}</span>
          {zone.floor && <span>{zone.floor}</span>}
          <span className="tabular-nums">{zone.capacity} chỗ</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <div className="mt-1.5 rounded-lg bg-kumo-recessed px-3 py-2 text-base font-semibold text-kumo-strong tabular-nums">{formatPrice(zone[key])}</div>
            )}
            {editable && /^\d+$/.test(draft[key].trim()) && (
              <span className="mt-1 block text-xs font-normal text-kumo-subtle tabular-nums">{formatPrice(Number(draft[key]))}</span>
            )}
          </label>
        ))}
      </div>

      {editable && (
        <div className="mt-4 flex flex-col gap-3 border-t border-kumo-hairline pt-4 sm:flex-row sm:items-center">
          <button type="submit" disabled={isSaving} className="btn btn-ink">
            <Save className="size-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu giá'}</span>
          </button>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-kumo-danger-tint px-3 py-2 text-sm text-kumo-danger">
              <AlertCircle className="mt-px size-4 flex-shrink-0" />
              {error}
            </p>
          )}
          {saved && !error && (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-kumo-success-tint px-3 py-2 text-sm text-kumo-success">
              <CheckCircle2 className="size-4 flex-shrink-0" />
              Đã lưu giá
            </p>
          )}
        </div>
      )}
    </form>
  );
};
