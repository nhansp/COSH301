import React from 'react';
import { SeatItem } from '../../types';
import { formatPrice } from '../../services/eventService';

const STATUS_LABEL: Record<SeatItem['status'], string> = {
  available: 'còn trống',
  selected: 'bạn đang giữ',
  held: 'người khác đang giữ',
  sold: 'đã bán'
};

// Each state also has a cue that does not rely on colour: ring, hatching, strike-through.
const STATUS_CLASS: Record<SeatItem['status'], string> = {
  available: 'bg-seat-available text-white hover:brightness-110',
  selected: 'bg-kumo-contrast text-kumo-inverse ring-2 ring-kumo-contrast ring-offset-2 ring-offset-kumo-base',
  held: 'bg-seat-held seat-held text-black/75 cursor-not-allowed',
  sold: 'bg-kumo-fill text-kumo-subtle line-through cursor-not-allowed'
};

interface SeatGridProps {
  seats: SeatItem[];
  pending: Set<string>;
  onSeatClick: (seat: SeatItem) => void;
}

export const SeatGrid: React.FC<SeatGridProps> = ({ seats, pending, onSeatClick }) => {
  const rows = Array.from(new Set(seats.map(s => s.row))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const columns = Math.max(1, ...rows.map(row => seats.filter(s => s.row === row).length));

  // Seats share the panel width; on touch screens they keep a 36px minimum and the grid scrolls.
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 py-2 [--seat-min:2.25rem] lg:[--seat-min:1.5rem]">
      <div role="grid" aria-label="Ghế trong khu" className="flex min-w-max flex-col gap-1 lg:min-w-0">
        {rows.map(row => (
          <div
            role="row"
            key={row}
            className="grid items-center gap-1"
            style={{ gridTemplateColumns: `1.5rem repeat(${columns}, minmax(var(--seat-min), 1fr))` }}
          >
            <span role="rowheader" className="text-center font-display text-sm font-semibold text-kumo-subtle [font-stretch:75%]">
              {row}
            </span>
            {seats
              .filter(s => s.row === row)
              .map(seat => {
                const busy = pending.has(seat.id);
                return (
                  <span role="gridcell" key={seat.id} className="block">
                    <button
                      type="button"
                      onClick={() => onSeatClick(seat)}
                      disabled={busy}
                      aria-pressed={seat.status === 'selected'}
                      aria-label={`Ghế ${seat.label}, ${seat.zoneName}, ${formatPrice(seat.price, '₫')}, ${STATUS_LABEL[seat.status]}`}
                      className={`grid aspect-square w-full max-w-10 place-items-center rounded-md font-display text-xs font-semibold tabular-nums transition [font-stretch:75%] ${STATUS_CLASS[seat.status]} ${
                        busy ? 'animate-pulse' : ''
                      }`}
                    >
                      {seat.number}
                    </button>
                  </span>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SeatLegend: React.FC<{ className?: string }> = ({ className = '' }) => (
  <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-kumo-subtle ${className}`}>
    <li className="flex items-center gap-2">
      <span className="size-3.5 rounded bg-seat-available" />
      Còn trống
    </li>
    <li className="flex items-center gap-2">
      <span className="size-3.5 rounded bg-kumo-contrast ring-2 ring-kumo-contrast ring-offset-1 ring-offset-kumo-base" />
      Bạn đang giữ
    </li>
    <li className="flex items-center gap-2">
      <span className="seat-held size-3.5 rounded bg-seat-held" />
      Người khác đang giữ
    </li>
    <li className="flex items-center gap-2">
      <span className="grid size-3.5 place-items-center rounded bg-kumo-fill text-[9px] leading-none text-kumo-subtle line-through">
        8
      </span>
      Đã bán
    </li>
  </ul>
);
