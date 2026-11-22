import React from 'react';
import { X } from 'lucide-react';
import { SeatItem } from '../../types';
import { ZoneSummary } from '../../services/venue';
import { formatPrice } from '../../services/eventService';
import { HoldTimer } from './HoldTimer';

interface SelectionTrayProps {
  mine: SeatItem[];
  zones: Map<string, ZoneSummary>;
  limit: number;
  remaining: number;
  secondsLeft: number | null;
  pending: Set<string>;
  onRelease: (seat: SeatItem) => void;
  onCheckout: () => void;
}

/** What the user holds right now, the clock, and the way to checkout. */
export const SelectionTray: React.FC<SelectionTrayProps> = ({
  mine,
  zones,
  limit,
  remaining,
  secondsLeft,
  pending,
  onRelease,
  onCheckout
}) => {
  const total = mine.reduce((sum, seat) => sum + seat.price, 0);

  if (mine.length === 0) {
    return (
      <p className="text-base text-kumo-subtle">
        {remaining > 0
          ? `Chọn khu rồi chọn ghế. Mỗi tài khoản được mua tối đa ${limit} vé cho sự kiện này.`
          : `Bạn đã mua đủ ${limit} vé tối đa cho sự kiện này.`}
      </p>
    );
  }

  // Standing places are interchangeable, so they are listed per zone, not per slot.
  const seated = mine.filter(s => zones.get(s.zoneId)?.kind !== 'standing');
  const standing = Array.from(
    mine
      .filter(s => zones.get(s.zoneId)?.kind === 'standing')
      .reduce((acc, seat) => acc.set(seat.zoneId, [...(acc.get(seat.zoneId) ?? []), seat]), new Map<string, SeatItem[]>())
      .values()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-kumo-strong">
          Bạn đang giữ {mine.length}/{limit} vé
        </h2>
        {secondsLeft !== null && <HoldTimer secondsLeft={secondsLeft} />}
      </div>

      <ul className="flex flex-wrap gap-2">
        {seated.map(seat => (
          <li key={seat.id} className="flex items-center gap-1 rounded-lg bg-spot py-1 pr-1 pl-2.5 text-spot-ink">
            <span className="font-display text-lg font-bold leading-none tabular-nums [font-stretch:68%]">{seat.label}</span>
            <span className="text-xs">{seat.zoneName}</span>
            <button
              type="button"
              onClick={() => onRelease(seat)}
              disabled={pending.has(seat.id)}
              aria-label={`Trả ghế ${seat.label}`}
              className="grid size-8 place-items-center rounded-md hover:bg-black/10 disabled:opacity-50"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {standing.map(group => (
          <li key={group[0].zoneId} className="flex items-center gap-1.5 rounded-lg bg-spot px-2.5 py-1.5 text-spot-ink">
            <span className="font-display text-lg font-bold leading-none tabular-nums [font-stretch:68%]">{group.length}×</span>
            <span className="text-xs">{group[0].zoneName} · Vé đứng</span>
          </li>
        ))}
      </ul>

      <div className="flex items-end justify-between gap-4 border-t border-kumo-hairline pt-4">
        <div>
          <div className="text-sm text-kumo-subtle">Tạm tính</div>
          <div className="font-display text-2xl font-bold tabular-nums text-kumo-strong [font-stretch:75%]">
            {formatPrice(total, '₫')}
          </div>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          className="h-12 shrink-0 rounded-lg bg-kumo-contrast px-5 font-semibold text-kumo-inverse transition-opacity hover:opacity-90"
        >
          Thanh toán
        </button>
      </div>
    </div>
  );
};
