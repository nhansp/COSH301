import React from 'react';
import { X } from 'lucide-react';
import { SeatItem } from '../../types';
import { ZoneSummary } from '../../services/venue';
import { formatPrice, serviceFeeOf, SERVICE_FEE_RATE } from '../../services/eventService';
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

export interface OrderTotals {
  subtotal: number;
  fee: number;
  total: number;
}

/** Same arithmetic as the checkout page, so the two never disagree. */
export function orderTotals(mine: SeatItem[]): OrderTotals {
  const subtotal = mine.reduce((sum, seat) => sum + seat.price, 0);
  const fee = serviceFeeOf(subtotal);
  return { subtotal, fee, total: subtotal + fee };
}

/** The order as it stands: what is held per category, what it costs, and the way to checkout. */
export const SelectionTray: React.FC<SelectionTrayProps> = ({ mine, zones, limit, remaining, secondsLeft, pending, onRelease, onCheckout }) => {
  if (mine.length === 0) {
    return (
      <p className="text-base text-kumo-subtle">
        {remaining > 0
          ? `Chọn hạng vé rồi chọn ghế. Mỗi tài khoản được mua tối đa ${limit} vé cho sự kiện này.`
          : `Bạn đã mua đủ ${limit} vé tối đa cho sự kiện này.`}
      </p>
    );
  }

  const groups = Array.from(
    mine.reduce((acc, seat) => acc.set(seat.zoneId, [...(acc.get(seat.zoneId) ?? []), seat]), new Map<string, SeatItem[]>()).values()
  );
  const { subtotal, fee, total } = orderTotals(mine);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-lg font-semibold text-kumo-strong [font-stretch:108%]">
          Đơn của bạn <span className="font-sans text-sm font-normal text-kumo-subtle">· {mine.length}/{limit} vé</span>
        </h2>
        {secondsLeft !== null && <HoldTimer secondsLeft={secondsLeft} />}
      </div>

      <ul className="space-y-3">
        {groups.map(group => {
          const zone = zones.get(group[0].zoneId);
          const standing = zone?.kind === 'standing';
          const prices = new Set(group.map(s => s.price));
          const lineTotal = group.reduce((sum, s) => sum + s.price, 0);
          return (
            <li key={group[0].zoneId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="leading-snug font-medium text-kumo-strong">{group[0].zoneName}</p>
                  <p className="text-sm text-kumo-subtle tabular-nums">
                    {group.length} × {prices.size === 1 ? formatPrice(group[0].price, '₫') : 'giá theo từng ghế'}
                    {standing && ' · vé đứng'}
                  </p>
                </div>
                <span className="shrink-0 font-display text-base font-semibold tabular-nums text-kumo-strong [font-stretch:75%]">
                  {formatPrice(lineTotal, '₫')}
                </span>
              </div>
              {!standing && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {group.map(seat => (
                    <li key={seat.id} className="flex items-center gap-0.5 rounded-lg bg-spot py-0.5 pr-0.5 pl-2 text-spot-ink">
                      <span className="font-display text-base font-bold tabular-nums [font-stretch:68%]">{seat.label}</span>
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
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="space-y-1.5 border-t border-kumo-hairline pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-kumo-subtle">Tạm tính</dt>
          <dd className="tabular-nums text-kumo-default">{formatPrice(subtotal, '₫')}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-kumo-subtle">Phí dịch vụ ({Math.round(SERVICE_FEE_RATE * 100)}%)</dt>
          <dd className="tabular-nums text-kumo-default">{formatPrice(fee, '₫')}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <dt className="font-medium text-kumo-strong">Tổng cộng</dt>
          <dd className="font-display text-2xl font-bold tabular-nums text-kumo-strong [font-stretch:75%]">{formatPrice(total, '₫')}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onCheckout}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-kumo-contrast px-5 font-semibold text-kumo-inverse transition-opacity hover:opacity-90"
      >
        Tiếp tục thanh toán
      </button>
    </div>
  );
};
