import React, { useEffect, useState } from 'react';
import { Armchair, Check, Minus, Plus, Users } from 'lucide-react';
import { SeatItem } from '../../types';
import { ZoneSummary } from '../../services/venue';
import { formatPrice } from '../../services/eventService';
import { SeatGrid, SeatLegend } from './SeatGrid';

interface ZoneListProps {
  zones: ZoneSummary[];
  activeZoneId: string | null;
  heldByZone: Map<string, number>;
  onSelect: (zoneId: string) => void;
  /** Lights the section up on the map without moving the camera. */
  onHover: (zoneId: string | null) => void;
}

type KindFilter = 'all' | 'seated' | 'standing';
type SortOrder = 'price-desc' | 'price-asc' | 'available';

const SORTS: Record<SortOrder, { label: string; compare: (a: ZoneSummary, b: ZoneSummary) => number }> = {
  'price-desc': { label: 'Giá cao đến thấp', compare: (a, b) => b.priceFrom - a.priceFrom },
  'price-asc': { label: 'Giá thấp đến cao', compare: (a, b) => a.priceFrom - b.priceFrom },
  available: { label: 'Còn nhiều chỗ nhất', compare: (a, b) => b.available - a.available }
};

/**
 * Ticket categories beside the map. Each one is a radio, so the venue can be driven from
 * the keyboard; hovering or focusing one lights up its section on the map.
 */
export const ZoneList: React.FC<ZoneListProps> = ({ zones, activeZoneId, heldByZone, onSelect, onHover }) => {
  const [kind, setKind] = useState<KindFilter>('all');
  // The list unmounts when a category opens, often with the pointer still on a card: drop its highlight.
  useEffect(() => () => onHover(null), [onHover]);
  const [sort, setSort] = useState<SortOrder>('price-desc');
  const hasBothKinds = zones.some(z => z.kind === 'seated') && zones.some(z => z.kind === 'standing');
  const shown = zones.filter(z => kind === 'all' || z.kind === kind).sort(SORTS[sort].compare);

  const chip = (active: boolean) =>
    `h-9 rounded-full px-3 text-sm font-medium transition-colors ${
      active ? 'bg-kumo-contrast text-kumo-inverse' : 'text-kumo-default ring ring-kumo-line hover:bg-kumo-tint'
    }`;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kumo-hairline px-3 py-2.5">
        {hasBothKinds ? (
          <div role="group" aria-label="Lọc theo loại vé" className="flex gap-1.5">
            {(
              [
                ['all', 'Tất cả'],
                ['seated', 'Ghế ngồi'],
                ['standing', 'Khu đứng']
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={chip(kind === value)}>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className="px-1 text-sm text-kumo-subtle">{zones.length} hạng vé</span>
        )}
        <label className="flex items-center gap-1.5 text-sm text-kumo-subtle">
          <span className="sr-only">Sắp xếp</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortOrder)}
            className="h-9 rounded-lg bg-kumo-control px-2 text-sm text-kumo-default ring ring-kumo-line focus:outline-none focus-visible:ring-2 focus-visible:ring-kumo-contrast"
          >
            {(Object.keys(SORTS) as SortOrder[]).map(key => (
              <option key={key} value={key}>
                {SORTS[key].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="p-3">
        <legend className="sr-only">Chọn hạng vé</legend>
        <ul className="space-y-2">
          {shown.map(zone => {
            const soldOut = zone.available === 0;
            const held = heldByZone.get(zone.id) ?? 0;
            const active = zone.id === activeZoneId;
            return (
              <li key={zone.id} onMouseEnter={() => onHover(zone.id)} onMouseLeave={() => onHover(null)}>
                <label
                  className={`relative flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors ${
                    active
                      ? 'bg-kumo-tint ring-2 ring-kumo-contrast'
                      : 'ring ring-kumo-line hover:bg-kumo-tint hover:ring-kumo-interact'
                  }`}
                >
                  <input
                    type="radio"
                    name="zone"
                    value={zone.id}
                    checked={active}
                    onChange={() => onSelect(zone.id)}
                    onFocus={() => onHover(zone.id)}
                    onBlur={() => onHover(null)}
                    aria-label={`${zone.name}, ${zone.kind === 'standing' ? 'khu đứng' : 'ghế ngồi'}, ${
                      soldOut ? 'hết vé' : `còn ${zone.available} trên ${zone.capacity} vé`
                    }, giá từ ${formatPrice(zone.priceFrom, '₫')}`}
                    className="peer sr-only"
                  />
                  {/* Selection mark: a filled check, not colour alone. */}
                  <span
                    aria-hidden="true"
                    className={`grid size-5 shrink-0 place-items-center rounded-full ${
                      active ? 'bg-kumo-contrast text-kumo-inverse' : 'ring-2 ring-kumo-line'
                    }`}
                  >
                    {active && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  {/* Same colour as the section on the map; dotted for standing floors. */}
                  <span
                    aria-hidden="true"
                    className={`h-10 w-1.5 shrink-0 rounded-full ${soldOut ? 'opacity-40' : ''}`}
                    style={{
                      background:
                        zone.kind === 'standing'
                          ? `radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1.5px) 0 0 / 6px 6px, ${zone.color}`
                          : zone.color
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block leading-snug font-medium ${soldOut ? 'text-kumo-subtle' : 'text-kumo-strong'}`}>{zone.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-kumo-subtle">
                      <span className="inline-flex items-center gap-1 rounded-md bg-kumo-recessed px-1.5 py-0.5 font-medium text-kumo-default">
                        {zone.kind === 'standing' ? <Users className="size-3" /> : <Armchair className="size-3" />}
                        {zone.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'}
                      </span>
                      {soldOut ? (
                        <span className="font-medium text-kumo-danger">Hết vé</span>
                      ) : (
                        <span>
                          Còn {zone.available}/{zone.capacity}
                        </span>
                      )}
                      {held > 0 && <span className="rounded-md bg-spot px-1.5 py-0.5 font-medium text-spot-ink">Bạn giữ {held}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block font-display text-lg leading-tight font-bold tabular-nums ${
                        soldOut ? 'text-kumo-subtle line-through' : 'text-kumo-strong'
                      }`}
                    >
                      {formatPrice(zone.priceFrom, '₫')}
                    </span>
                    <span className="text-xs text-kumo-subtle">mỗi vé</span>
                  </span>
                  <span className="pointer-events-none absolute inset-0 rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-kumo-focus" />
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
};

interface ZoneDetailProps {
  zone: ZoneSummary;
  seats: SeatItem[];
  pending: Set<string>;
  heldInZone: number;
  /** Further tickets the user may still hold for this event. */
  remaining: number;
  onSeatClick: (seat: SeatItem) => void;
  onStandingCount: (count: number) => void;
}

export const ZoneDetail: React.FC<ZoneDetailProps> = ({
  zone,
  seats,
  pending,
  heldInZone,
  remaining,
  onSeatClick,
  onStandingCount
}) => {
  const busy = seats.some(s => pending.has(s.id));

  if (zone.kind === 'standing') {
    const max = Math.min(heldInZone + remaining, heldInZone + zone.available);
    return (
      <div className="space-y-3">
        <p className="text-sm text-kumo-subtle">
          Khu đứng không có chỗ cố định. Chọn số vé, hệ thống sẽ giữ chỗ cho bạn trong 5 phút.
        </p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-xl font-semibold tabular-nums text-kumo-strong">
              {formatPrice(zone.priceFrom, '₫')}
            </div>
            <div className="text-sm text-kumo-subtle">mỗi vé</div>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label={`Số vé đứng ở ${zone.name}`}>
            <button
              type="button"
              onClick={() => onStandingCount(heldInZone - 1)}
              disabled={busy || heldInZone === 0}
              aria-label="Bớt một vé"
              className="grid size-11 place-items-center rounded-lg bg-kumo-base text-kumo-default ring ring-kumo-line transition-colors hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <output
              aria-live="polite"
              className="w-8 text-center font-display text-2xl font-bold tabular-nums text-kumo-strong"
            >
              {heldInZone}
            </output>
            <button
              type="button"
              onClick={() => onStandingCount(heldInZone + 1)}
              disabled={busy || heldInZone >= max}
              aria-label="Thêm một vé"
              className="grid size-11 place-items-center rounded-lg bg-kumo-contrast text-kumo-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {remaining === 0 && heldInZone > 0 && (
          <p className="text-sm text-kumo-subtle">Bạn đã chọn đủ số vé tối đa cho sự kiện này.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SeatGrid seats={seats} pending={pending} onSeatClick={onSeatClick} />
      <SeatLegend />
    </div>
  );
};
