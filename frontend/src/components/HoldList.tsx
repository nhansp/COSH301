import React from 'react';
import { X } from 'lucide-react';
import { Hold } from '../types';
import { formatPrice } from '../services/eventService';
import { HoldTimer } from './tickets/HoldTimer';

interface HoldListProps {
  holds: Hold[];
  now: number;
  releasingId: string | null;
  onRelease: (hold: Hold) => void;
}

/** The user's held seats, each with a countdown from the server's expiry and a release button. */
export const HoldList: React.FC<HoldListProps> = ({ holds, now, releasingId, onRelease }) => (
  <ul className="divide-y divide-kumo-hairline">
    {holds.map(hold => (
      <li key={hold.seatId} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-4">
        <div className="min-w-0 flex-1">
          <p className="type-figure text-2xl text-kumo-strong">{hold.seatLabel}</p>
          <p className="text-sm text-kumo-subtle">{hold.zoneName}</p>
        </div>
        <HoldTimer secondsLeft={Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - now) / 1000))} label="Còn" />
        <span className="type-figure w-32 text-right text-lg text-kumo-strong">{formatPrice(hold.price)}</span>
        <button
          type="button"
          onClick={() => onRelease(hold)}
          disabled={releasingId === hold.seatId}
          aria-label={`Trả ghế ${hold.seatLabel}`}
          className="btn btn-quiet btn-sm hover:bg-kumo-danger-tint hover:text-kumo-danger"
        >
          <X className="size-4" />
          Trả ghế
        </button>
      </li>
    ))}
  </ul>
);
