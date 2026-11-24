import React, { useEffect, useMemo, useRef, useState } from 'react';

/** Series colors: the first three slots of the validated categorical palette, light and dark steps. */
export const SERIES_COLORS = ['light-dark(#2a78d6, #3987e5)', 'light-dark(#eb6834, #d95926)', 'light-dark(#1baf7a, #199e70)'];

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  points: ChartPoint[];
  /** Draw as steps: the value holds until the next point (prices). */
  step?: boolean;
}

interface LineChartProps {
  title: string;
  series: ChartSeries[];
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  /** Dashed horizontal guides, such as a price floor and ceiling. */
  guides?: { y: number; label: string }[];
  /** Start the y axis at zero (counts) or near the data (prices). */
  zeroBased?: boolean;
  height?: number;
}

const PAD = { top: 12, right: 92, bottom: 26, left: 56 };

function niceStep(span: number, ticks: number): number {
  const raw = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

/** Value of a series at x: the exact point, or for steps the last point at or before x. */
function valueAt(s: ChartSeries, x: number): number | null {
  let found: ChartPoint | null = null;
  for (const p of s.points) {
    if (p.x === x) return p.y;
    if (s.step && p.x <= x) found = p;
  }
  return found ? found.y : null;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export const LineChart: React.FC<LineChartProps> = ({ title, series, formatX, formatY, guides = [], zeroBased = true, height = 220 }) => {
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const xs = useMemo(() => Array.from(new Set(series.flatMap(s => s.points.map(p => p.x)))).sort((a, b) => a - b), [series]);
  const ys = series.flatMap(s => s.points.map(p => p.y)).concat(guides.map(g => g.y));
  const hasData = xs.length > 0 && ys.length > 0;

  const yMaxRaw = hasData ? Math.max(...ys) : 1;
  const yMinRaw = hasData ? Math.min(...ys) : 0;
  const step = niceStep(Math.max(yMaxRaw - (zeroBased ? 0 : yMinRaw), 1), 4);
  const yMin = zeroBased ? 0 : Math.floor(yMinRaw / step) * step - step;
  const yMax = Math.max(Math.ceil(yMaxRaw / step) * step, yMin + step);
  const xMin = xs[0] ?? 0;
  const xMax = xs[xs.length - 1] ?? 1;

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (xMax === xMin ? innerW / 2 : ((x - xMin) / (xMax - xMin)) * innerW);
  const sy = (y: number) => PAD.top + innerH - ((y - yMin) / (yMax - yMin)) * innerH;

  const path = (s: ChartSeries) => {
    const pts = [...s.points].sort((a, b) => a.x - b.x);
    if (s.step && pts.length > 0) pts.push({ x: xMax, y: pts[pts.length - 1].y });
    return pts
      .map((p, i) => {
        if (i === 0) return `M${sx(p.x)},${sy(p.y)}`;
        return s.step ? `H${sx(p.x)}V${sy(p.y)}` : `L${sx(p.x)},${sy(p.y)}`;
      })
      .join('');
  };

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(v);
  // Ticks are spread evenly in time, so points that cluster (several price changes in one hour) never pile labels up.
  const xTickCount = Math.max(2, Math.floor(innerW / 120));
  const xTicks = xs.length <= 1 ? xs : Array.from({ length: xTickCount }, (_, i) => xMin + (i * (xMax - xMin)) / (xTickCount - 1));

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    let best = 0;
    xs.forEach((x, i) => {
      if (Math.abs(sx(x) - px) < Math.abs(sx(xs[best]) - px)) best = i;
    });
    return best;
  };

  const hoverX = hover !== null ? xs[hover] : null;
  const tipLeft = hoverX !== null ? Math.min(Math.max(sx(hoverX) + 12, 0), width - 190) : 0;

  // Direct labels at each line's end, nudged apart so they never overlap.
  const endLabels = series
    .filter(s => s.points.length > 0)
    .map(s => ({ s, y: sy(s.step ? s.points[s.points.length - 1].y : valueAt(s, xMax) ?? s.points[s.points.length - 1].y) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < 14) endLabels[i].y = endLabels[i - 1].y + 14;
  }
  // Lines that end at the same low value would push labels below the plot; lift the stack back inside.
  const overflow = endLabels.length > 0 ? endLabels[endLabels.length - 1].y - (PAD.top + innerH) : 0;
  if (overflow > 0) endLabels.forEach(l => (l.y = Math.max(PAD.top, l.y - overflow)));

  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-kumo-strong">{title}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-kumo-subtle" aria-hidden="true">
            {series.map(s => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>

      <div ref={boxRef} className="relative mt-2">
        {!hasData ? (
          <p className="rounded-lg bg-kumo-recessed px-3 py-8 text-center text-sm text-kumo-subtle">Chưa có dữ liệu.</p>
        ) : (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${title}. Dùng phím mũi tên trái, phải để xem từng mốc.`}
            tabIndex={0}
            className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-kumo-focus rounded-lg"
            onPointerMove={e => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={e => {
              if (e.key === 'ArrowRight') setHover(h => Math.min((h ?? -1) + 1, xs.length - 1));
              else if (e.key === 'ArrowLeft') setHover(h => Math.max((h ?? xs.length) - 1, 0));
              else return;
              e.preventDefault();
            }}
          >
            {yTicks.map(v => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={sy(v)} y2={sy(v)} className="stroke-kumo-hairline" strokeWidth={1} />
                <text x={PAD.left - 8} y={sy(v)} dy="0.32em" textAnchor="end" fill="currentColor" className="text-kumo-subtle text-[11px] tabular-nums">
                  {formatY(v)}
                </text>
              </g>
            ))}
            {xTicks.map(x => (
              <text key={x} x={sx(x)} y={height - 6} textAnchor="middle" fill="currentColor" className="text-kumo-subtle text-[11px] tabular-nums">
                {formatX(x)}
              </text>
            ))}
            {guides.map(g => (
              <g key={g.label}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={sy(g.y)} y2={sy(g.y)} stroke="currentColor" className="text-kumo-subtle" strokeWidth={1} strokeDasharray="4 4" />
                <text x={PAD.left + innerW + 6} y={sy(g.y)} dy="0.32em" fill="currentColor" className="text-kumo-subtle text-[11px]">
                  {g.label}
                </text>
              </g>
            ))}
            {series.map(s => (
              <path key={s.key} d={path(s)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: s.color }} />
            ))}
            {guides.length === 0 &&
              endLabels.map(({ s, y }) => (
                <g key={s.key}>
                  <line x1={PAD.left + innerW + 6} x2={PAD.left + innerW + 14} y1={y} y2={y} strokeWidth={2} style={{ stroke: s.color }} />
                  <text x={PAD.left + innerW + 18} y={y} dy="0.32em" fill="currentColor" className="text-kumo-default text-[11px]">
                    {s.label}
                  </text>
                </g>
              ))}
            {hoverX !== null && (
              <g>
                <line x1={sx(hoverX)} x2={sx(hoverX)} y1={PAD.top} y2={PAD.top + innerH} stroke="currentColor" className="text-kumo-subtle" strokeWidth={1} />
                {series.map(s => {
                  const v = valueAt(s, hoverX);
                  return v === null ? null : (
                    <circle key={s.key} cx={sx(hoverX)} cy={sy(v)} r={4} strokeWidth={2} className="stroke-kumo-base" style={{ fill: s.color }} />
                  );
                })}
              </g>
            )}
          </svg>
        )}

        {hoverX !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 w-44 rounded-lg bg-kumo-raised p-2.5 text-xs shadow-lg ring ring-kumo-line"
            style={{ left: tipLeft }}
          >
            <p className="mb-1.5 text-kumo-subtle tabular-nums">{formatX(hoverX)}</p>
            {series.map(s => {
              const v = valueAt(s, hoverX);
              return (
                <p key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-kumo-subtle">
                    <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <strong className="font-semibold text-kumo-strong tabular-nums">{v === null ? '—' : formatY(v)}</strong>
                </p>
              );
            })}
          </div>
        )}
      </div>

      {hasData && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-kumo-subtle hover:text-kumo-default">Xem dạng bảng</summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-lg ring ring-kumo-line">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="sticky top-0 bg-kumo-recessed text-kumo-subtle">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Thời điểm</th>
                  {series.map(s => (
                    <th key={s.key} className="px-3 py-1.5 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {xs.map(x => (
                  <tr key={x} className="border-t border-kumo-hairline">
                    <td className="px-3 py-1 text-kumo-subtle">{formatX(x)}</td>
                    {series.map(s => {
                      const v = valueAt(s, x);
                      return (
                        <td key={s.key} className="px-3 py-1 text-right text-kumo-default">
                          {v === null ? '—' : formatY(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
};
