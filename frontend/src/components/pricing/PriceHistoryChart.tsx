import React from 'react';
import { PricePoint } from '../../services/pricingService';
import { formatPriceShort } from '../../services/eventService';

interface Props {
  history: PricePoint[];
  current: number;
  floor: number;
  ceiling: number;
  /** Price the engine would move to; drawn as a dashed step from the current price. */
  suggested?: number;
  now: number;
}

const W = 340;
const H = 120;
const PAD = { top: 10, right: 62, bottom: 18, left: 8 };

/**
 * Step chart of a zone's price over its recent changes, inside the floor and
 * ceiling band. A price holds until the next change, so lines are horizontal
 * and jump vertically at the time of each change.
 */
export const PriceHistoryChart: React.FC<Props> = ({ history, current, floor, ceiling, suggested, now }) => {
  const times = history.map(p => Date.parse(p.at));
  const firstAt = times.length > 0 ? times[0] : now - 30 * 60_000;
  const span = Math.max(now - firstAt, 10 * 60_000);
  const t0 = firstAt - span * 0.2;
  const t1 = now;

  const lo = Math.min(floor, current, suggested ?? current);
  const hi = Math.max(ceiling, current, suggested ?? current);
  const range = Math.max(hi - lo, 1);

  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (price: number) => PAD.top + (1 - (price - lo) / range) * (H - PAD.top - PAD.bottom);

  // Walk the changes: stay at the old price, then jump to the new one.
  const path: string[] = [];
  const startPrice = history.length > 0 ? history[0].oldPrice : current;
  path.push(`M${x(t0)},${y(startPrice)}`);
  history.forEach((p, i) => {
    path.push(`H${x(times[i])}`, `V${y(p.newPrice)}`);
  });
  path.push(`H${x(t1)}`);

  const label =
    history.length === 0
      ? `Giá ${formatPriceShort(current)}, chưa đổi lần nào gần đây`
      : `Giá đổi ${history.length} lần gần đây, hiện ${formatPriceShort(current)}`;

  const bandLine = (price: number, text: string) => (
    <g key={text}>
      <line x1={PAD.left} x2={W - PAD.right} y1={y(price)} y2={y(price)} className="stroke-kumo-line" strokeDasharray="3 3" />
      <text x={W - PAD.right + 4} y={y(price) + 3} className="fill-kumo-subtle" fontSize="9">
        {text} {formatPriceShort(price)}
      </text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full h-auto">
      {bandLine(ceiling, 'Trần')}
      {bandLine(floor, 'Sàn')}
      <path d={path.join(' ')} fill="none" className="stroke-kumo-contrast" strokeWidth="2" strokeLinejoin="round" />
      {history.map((p, i) => (
        <circle key={p.at + i} cx={x(times[i])} cy={y(p.newPrice)} r="3" className="fill-kumo-base stroke-kumo-contrast" strokeWidth="1.5">
          <title>{`${new Date(p.at).toLocaleString('vi-VN')}: ${formatPriceShort(p.oldPrice)} → ${formatPriceShort(p.newPrice)} (${p.reason})`}</title>
        </circle>
      ))}
      {suggested !== undefined && suggested !== current && (
        <g>
          <line
            x1={x(t1)}
            x2={x(t1)}
            y1={y(current)}
            y2={y(suggested)}
            className={suggested > current ? 'stroke-kumo-success' : 'stroke-kumo-danger'}
            strokeWidth="2"
            strokeDasharray="3 2"
          />
          <circle
            cx={x(t1)}
            cy={y(suggested)}
            r="4"
            className={suggested > current ? 'fill-kumo-success' : 'fill-kumo-danger'}
          />
        </g>
      )}
      <circle cx={x(t1)} cy={y(current)} r="3.5" className="fill-kumo-contrast" />
      <text x={W - PAD.right + 4} y={y(current) + 3} className="fill-kumo-strong" fontSize="10" fontWeight="600">
        {formatPriceShort(current)}
      </text>
      <text x={PAD.left} y={H - 4} className="fill-kumo-subtle" fontSize="9">
        {history.length === 0 ? 'Chưa đổi giá' : new Date(firstAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
      </text>
      <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-kumo-subtle" fontSize="9">
        bây giờ
      </text>
    </svg>
  );
};
