import React from 'react';

export interface InventoryCounts {
  capacity: number;
  sold: number;
  held: number;
  available: number;
}

/** Sold, held and available seats as one segmented bar, with the counts in text beside it. */
export const InventoryBar: React.FC<{ counts: InventoryCounts; compact?: boolean }> = ({ counts, compact = false }) => {
  const parts = [
    { key: 'sold', n: counts.sold, label: 'Đã bán', className: 'bg-seat-sold' },
    { key: 'held', n: counts.held, label: 'Đang giữ', className: 'bg-seat-held' },
    { key: 'available', n: counts.available, label: 'Còn trống', className: 'bg-seat-available' }
  ];
  const total = Math.max(counts.capacity, 1);
  return (
    <div>
      <div className={`flex gap-0.5 overflow-hidden rounded-full ${compact ? 'h-1.5' : 'h-2.5'}`} aria-hidden="true">
        {parts
          .filter(p => p.n > 0)
          .map(p => (
            <span key={p.key} className={`${p.className} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(p.n / total) * 100}%` }} />
          ))}
      </div>
      <dl className={`grid grid-cols-3 gap-2 text-xs ${compact ? 'mt-1.5' : 'mt-2'}`}>
        {parts.map(p => (
          <div key={p.key}>
            <dt className="flex items-center gap-1 text-kumo-subtle">
              <span className={`inline-block size-2 rounded-full ${p.className}`} />
              {p.label}
            </dt>
            <dd className="font-semibold text-kumo-strong tabular-nums">{p.n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
