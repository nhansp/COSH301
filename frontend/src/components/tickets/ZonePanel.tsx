import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { SeatItem } from '../../types';
import { ZoneSummary } from '../../services/venue';
import { formatPrice, formatPriceShort } from '../../services/eventService';
import { SeatGrid, SeatLegend } from './SeatGrid';

interface ZoneListProps {
  zones: ZoneSummary[];
  activeZoneId: string | null;
  heldByZone: Map<string, number>;
  onSelect: (zoneId: string) => void;
}

/**
 * Ticket categories as a compact legend beside the map. They are radios, so the map can
 * also be driven from the keyboard; the map itself is the main way to choose.
 */
export const ZoneList: React.FC<ZoneListProps> = ({ zones, activeZoneId, heldByZone, onSelect }) => (
  <fieldset className="p-3">
    <legend className="sr-only">Chọn hạng vé</legend>
    <p aria-hidden="true" className="px-1 pb-2 text-sm text-kumo-subtle">
      Hạng vé, giá từ cao đến thấp
    </p>
    <ul className="grid grid-cols-2 gap-1.5">
      {zones.map(zone => {
        const soldOut = zone.available === 0;
        const held = heldByZone.get(zone.id) ?? 0;
        const active = zone.id === activeZoneId;
        return (
          <li key={zone.id}>
            <label
              className={`relative flex h-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 ring transition-colors ${
                active ? 'bg-kumo-tint ring-2 ring-kumo-contrast' : 'ring-kumo-line hover:bg-kumo-tint'
              } ${soldOut ? 'opacity-55' : ''}`}
            >
              <input
                type="radio"
                name="zone"
                value={zone.id}
                checked={active}
                onChange={() => onSelect(zone.id)}
                aria-label={`${zone.name}, ${zone.kind === 'standing' ? 'khu đứng' : 'ghế ngồi'}, ${
                  soldOut ? 'hết vé' : `còn ${zone.available} vé`
                }, giá từ ${formatPrice(zone.priceFrom, '₫')}`}
                className="peer sr-only"
              />
              {/* Same colour as the section on the map; dotted for standing floors, solid for seats. */}
              <span
                aria-hidden="true"
                className={`size-3.5 shrink-0 ${zone.kind === 'standing' ? 'rounded-sm' : 'rounded-t-full'}`}
                style={{
                  background:
                    zone.kind === 'standing'
                      ? `radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1.5px) 0 0 / 4px 4px, ${zone.color}`
                      : zone.color
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-kumo-strong">{zone.shortName}</span>
                <span className="block truncate text-xs text-kumo-subtle">
                  {zone.kind === 'standing' ? 'Đứng' : 'Ngồi'} · {soldOut ? 'Hết vé' : `còn ${zone.available}`}
                  {held > 0 && <span className="font-medium text-kumo-strong"> · giữ {held}</span>}
                </span>
              </span>
              <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-kumo-strong [font-stretch:75%]">
                {formatPriceShort(zone.priceFrom)}
              </span>
              <span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-kumo-focus" />
            </label>
          </li>
        );
      })}
    </ul>
  </fieldset>
);

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
            <div className="font-display text-xl font-semibold tabular-nums text-kumo-strong [font-stretch:75%]">
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
              className="w-8 text-center font-display text-2xl font-bold tabular-nums text-kumo-strong [font-stretch:68%]"
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
