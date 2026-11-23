import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Minus, X } from 'lucide-react';
import { SeatItem } from '../../types';
import { ZoneSummary } from '../../services/venue';
import { formatPrice, formatPriceShort, serviceFeeOf, SERVICE_FEE_RATE } from '../../services/eventService';
import { HoldTimer } from './HoldTimer';

interface SelectionTrayProps {
  mine: SeatItem[];
  zones: Map<string, ZoneSummary>;
  /** Null when no ticket limit applies. */
  limit: number | null;
  remaining: number;
  secondsLeft: number | null;
  pending: Set<string>;
  onRelease: (seat: SeatItem) => void;
  onCheckout: () => void;
  /** Shows a toggle that folds the ticket list away; the totals and checkout stay. */
  collapsible?: boolean;
  /** Caps the ticket list; it scrolls on its own past this height. */
  listClassName?: string;
  className?: string;
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

const byLabel = (a: SeatItem, b: SeatItem) => a.label.localeCompare(b.label, undefined, { numeric: true });

/**
 * The order as it stands. Only the ticket list grows with the order: the header (count, hold timer)
 * and the footer (totals, checkout) keep their size, and the list scrolls inside whatever height the
 * container leaves it.
 */
export const SelectionTray: React.FC<SelectionTrayProps> = ({
  mine,
  zones,
  limit,
  remaining,
  secondsLeft,
  pending,
  onRelease,
  onCheckout,
  collapsible = false,
  listClassName = '',
  className = ''
}) => {
  const [listOpen, setListOpen] = useState(true);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const known = useRef(new Set(mine.map(s => s.id)));

  // A newly held seat may land below the fold of the list: bring it into view there, without
  // scrolling the page.
  useEffect(() => {
    const added = mine.find(s => !known.current.has(s.id));
    known.current = new Set(mine.map(s => s.id));
    const list = listRef.current;
    if (!added || !list) return;
    const item = list.querySelector<HTMLElement>(`[data-seat-id="${CSS.escape(added.id)}"]`);
    if (!item) return;
    const top = item.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
    }
  }, [mine]);

  if (mine.length === 0) {
    return (
      <p className={`text-base text-kumo-subtle ${className}`}>
        {remaining > 0
          ? `Chọn hạng vé rồi chọn ghế.${limit !== null ? ` Mỗi tài khoản được giữ tối đa ${limit} vé cho sự kiện này.` : ''}`
          : `Bạn đã giữ đủ ${limit} vé tối đa cho sự kiện này.`}
      </p>
    );
  }

  const groups = Array.from(
    mine.reduce((acc, seat) => acc.set(seat.zoneId, [...(acc.get(seat.zoneId) ?? []), seat]), new Map<string, SeatItem[]>()).values()
  );
  const { subtotal, fee, total } = orderTotals(mine);
  const showList = !collapsible || listOpen;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-2">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setListOpen(open => !open)}
            aria-expanded={listOpen}
            aria-controls={listId}
            className="-ml-2 flex min-h-10 items-center gap-1.5 rounded-md px-2 text-left hover:bg-kumo-tint"
          >
            <ChevronDown className={`size-4 shrink-0 text-kumo-subtle transition-transform ${listOpen ? '' : '-rotate-90'}`} />
            <OrderHeading count={mine.length} limit={limit} />
          </button>
        ) : (
          <OrderHeading count={mine.length} limit={limit} />
        )}
        {secondsLeft !== null && <HoldTimer secondsLeft={secondsLeft} />}
      </div>

      {showList ? (
        <div
          ref={listRef}
          id={listId}
          className={`-mx-1 min-h-0 shrink overflow-y-auto overscroll-contain border-y border-kumo-hairline px-1 py-1 ${listClassName}`}
        >
          <ul className="divide-y divide-kumo-hairline">
            {groups.map(group => (
              <TicketGroup
                key={group[0].zoneId}
                seats={[...group].sort(byLabel)}
                zone={zones.get(group[0].zoneId)}
                pending={pending}
                onRelease={onRelease}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p id={listId} className="shrink-0 border-y border-kumo-hairline py-2 text-sm text-kumo-subtle">
          {groups.map(g => `${g[0].zoneName} × ${g.length}`).join(', ')}
        </p>
      )}

      <div className="shrink-0 pt-3">
        {remaining === 0 && <p className="mb-2 text-sm text-kumo-subtle">Đã chọn đủ {limit} vé tối đa cho sự kiện này.</p>}
        <dl className="space-y-0.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-kumo-subtle">Tạm tính</dt>
            <dd className="tabular-nums text-kumo-default">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-kumo-subtle">Phí dịch vụ ({Math.round(SERVICE_FEE_RATE * 100)}%)</dt>
            <dd className="tabular-nums text-kumo-default">{formatPrice(fee)}</dd>
          </div>
        </dl>
        {/* Total beside the button: one row less, so the list keeps more of the height. */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0">
            <span className="block text-sm font-medium text-kumo-strong">Tổng cộng</span>
            <span className="type-figure block text-2xl leading-tight text-kumo-strong">
              {formatPrice(total)}
            </span>
          </p>
          <button type="button" onClick={onCheckout} className="btn btn-primary h-12 shrink-0">
            Xem ghế đã giữ
          </button>
        </div>
      </div>
    </div>
  );
};

const OrderHeading: React.FC<{ count: number; limit: number | null }> = ({ count, limit }) => (
  <h2 className="type-display text-lg">
    Đơn của bạn <span className="font-sans text-sm font-normal text-kumo-subtle tabular-nums">· {count}{limit !== null && `/${limit}`} vé</span>
  </h2>
);

interface TicketGroupProps {
  seats: SeatItem[];
  zone: ZoneSummary | undefined;
  pending: Set<string>;
  onRelease: (seat: SeatItem) => void;
}

/** One category: a single summary line, then each seat with its own remove button. */
const TicketGroup: React.FC<TicketGroupProps> = ({ seats, zone, pending, onRelease }) => {
  const standing = zone?.kind === 'standing';
  const samePrice = new Set(seats.map(s => s.price)).size === 1;
  const lineTotal = seats.reduce((sum, s) => sum + s.price, 0);
  const last = seats[seats.length - 1];

  return (
    <li className="py-2.5">
      <div className="flex items-baseline gap-2">
        <span aria-hidden="true" className="size-2.5 shrink-0 translate-y-px rounded-full" style={{ background: zone?.color }} />
        <p className="min-w-0 flex-1 truncate font-medium text-kumo-strong">{seats[0].zoneName}</p>
        <span className="type-figure shrink-0 text-base text-kumo-strong">
          {formatPrice(lineTotal)}
        </span>
      </div>
      <p className="pl-4.5 text-sm text-kumo-subtle tabular-nums">
        {seats.length} × {samePrice ? formatPrice(seats[0].price) : 'giá theo từng ghế'}
        {standing && ' · vé đứng'}
      </p>

      {standing ? (
        // Standing tickets have no seat to point at; they come off one at a time.
        <div className="mt-1.5 pl-4.5">
          <button
            type="button"
            data-seat-id={last.id}
            onClick={() => onRelease(last)}
            disabled={pending.has(last.id)}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-kumo-default ring ring-kumo-line hover:bg-kumo-tint disabled:opacity-50"
          >
            <Minus className="size-3.5" />
            Bớt 1 vé
          </button>
        </div>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5 pl-4.5">
          {seats.map(seat => (
            <li key={seat.id} data-seat-id={seat.id} className="flex items-center gap-0.5 rounded-lg bg-spot py-0.5 pr-0.5 pl-2 text-spot-ink">
              <span className="type-figure text-base">{seat.label}</span>
              {!samePrice && <span className="text-xs tabular-nums opacity-75">{formatPriceShort(seat.price)}</span>}
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
};
