import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CircleDot,
  ExternalLink,
  Flame,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { EventSalesSummary, ZoneSalesSummary } from '../../services/organizerService';
import { formatPrice, formatPriceShort } from '../../services/eventService';
import {
  PRICE_BAND_COLORS,
  STAGE_THEMES,
  TierGeometry,
  Vec3,
  VenueLayout,
  ZoneGeometry,
  ZoneSummary,
  buildVenueLayout,
  stageFootprintPoints
} from '../../services/venue';
import { SeatItem } from '../../types';

export type HeatmapMetric = 'fill' | 'revenue' | 'price';

type Box = { x: number; y: number; w: number; h: number };

const HEAT_STOPS: [number, [number, number, number]][] = [
  [0.0, [30, 49, 84]],    // #1e3154 cold slate (0 filled)
  [0.08, [29, 122, 138]], // #1d7a8a ocean teal (early sales)
  [0.25, [34, 176, 125]], // #22b07d emerald (25% filled)
  [0.5, [232, 179, 57]],  // #e8b339 amber gold (50% filled)
  [0.75, [249, 115, 22]], // #f97316 vivid orange (75% filled)
  [1.0, [239, 68, 68]]    // #ef4444 blazing red (100% filled)
];

function heatColor(raw: number): string {
  const t = Math.max(0, Math.min(1, raw));
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [t0, c0] = HEAT_STOPS[i];
    const [t1, c1] = HEAT_STOPS[i + 1];
    if (t >= t0 && t <= t1) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r} ${g} ${b})`;
    }
  }
  return 'rgb(239 68 68)';
}

function heatLabelColor(raw: number): string {
  return raw >= 0.36 ? '#0b0e26' : '#f1f5f9';
}

const polar = (origin: Vec3, angle: number, radius: number): [number, number] => [
  origin[0] + Math.sin(angle) * radius,
  origin[2] + Math.cos(angle) * radius
];

function sectorPath(t: TierGeometry): string {
  const [x1, y1] = polar(t.origin, t.startAngle, t.outerRadius);
  const [x2, y2] = polar(t.origin, t.endAngle, t.outerRadius);
  const [x3, y3] = polar(t.origin, t.endAngle, t.innerRadius);
  const [x4, y4] = polar(t.origin, t.startAngle, t.innerRadius);
  const large = t.endAngle - t.startAngle > Math.PI ? 1 : 0;
  return `M${x1} ${y1}A${t.outerRadius} ${t.outerRadius} 0 ${large} 0 ${x2} ${y2}L${x3} ${y3}A${t.innerRadius} ${t.innerRadius} 0 ${large} 1 ${x4} ${y4}Z`;
}

function zonePoints(z: ZoneGeometry): [number, number][] {
  if (z.kind === 'pit') {
    const [x, , y] = z.center;
    return [
      [x - z.width / 2, y - z.depth / 2],
      [x + z.width / 2, y + z.depth / 2]
    ];
  }
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const a = z.startAngle + ((z.endAngle - z.startAngle) * i) / 10;
    pts.push(polar(z.origin, a, z.innerRadius), polar(z.origin, a, z.outerRadius));
  }
  return pts;
}

function computeViewBox(layout: VenueLayout): Box {
  const pts: [number, number][] = [...stageFootprintPoints(layout.stage)];
  layout.zones.forEach(z => pts.push(...zonePoints(z)));
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const pad = 2.6;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

function zoneCenter2D(z: ZoneGeometry): [number, number] {
  if (z.kind === 'pit') return [z.center[0], z.center[2]];
  const mid = (z.startAngle + z.endAngle) / 2;
  const r = (z.innerRadius + z.outerRadius) / 2;
  return polar(z.origin, mid, r);
}

function toZoneSummaries(zones: ZoneSalesSummary[]): ZoneSummary[] {
  const ordered = [...zones].sort((a, b) => b.basePrice - a.basePrice);
  const lastRank = Math.max(1, ordered.length - 1);
  const shortOf = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
  const shortCounts = new Map<string, number>();
  for (const z of ordered) {
    const s = shortOf(z.zoneName);
    shortCounts.set(s, (shortCounts.get(s) ?? 0) + 1);
  }
  return ordered.map((z, rank) => {
    const band = Math.round((rank / lastRank) * (PRICE_BAND_COLORS.length - 1));
    const baseShort = shortOf(z.zoneName);
    return {
      id: z.zoneId,
      code: z.zoneCode,
      name: z.zoneName,
      shortName:
        (shortCounts.get(baseShort) ?? 0) > 1
          ? `${baseShort} ${z.kind === 'standing' ? 'đứng' : 'ngồi'}`
          : baseShort,
      kind: z.kind,
      basePrice: z.basePrice,
      priceFrom: z.basePrice,
      capacity: z.capacity,
      available: z.available,
      rank,
      band,
      color: PRICE_BAND_COLORS[band]
    };
  });
}

interface StageSalesHeatmapProps {
  summary: EventSalesSummary;
  seats: SeatItem[];
  onInspectPricing?: (zoneId: string) => void;
}

export const StageSalesHeatmap: React.FC<StageSalesHeatmapProps> = ({
  summary,
  seats,
  onInspectPricing
}) => {
  const [metric, setMetric] = useState<HeatmapMetric>('fill');
  const [showSeats, setShowSeats] = useState(true);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const stageGradId = useId();
  const glowFilterId = useId();

  const zoneSummaries = useMemo(() => toZoneSummaries(summary.zones), [summary.zones]);
  const layout = useMemo(
    () => buildVenueLayout(zoneSummaries, seats, summary.layoutConfig),
    [zoneSummaries, seats, summary.layoutConfig]
  );
  const viewBox = useMemo(() => computeViewBox(layout), [layout]);
  const stageTheme = STAGE_THEMES[layout.stage.theme] ?? STAGE_THEMES.electric;

  const zoneMap = useMemo(() => new Map(summary.zones.map(z => [z.zoneId, z])), [summary.zones]);
  const summaryMap = useMemo(() => new Map(zoneSummaries.map(z => [z.id, z])), [zoneSummaries]);
  const seatStatusMap = useMemo(() => new Map(seats.map(s => [s.id, s.status])), [seats]);

  const hasLiveSales = summary.realizedRevenue + summary.heldPipelineRevenue > 0;

  const scaleStats = useMemo(() => {
    const activeRevs = summary.zones.map(z => z.realizedRevenue + z.heldPipelineRevenue);
    const capacities = summary.zones.map(z => z.capacity);
    const prices = summary.zones.map(z => z.basePrice);
    return {
      maxCapacity: Math.max(1, ...capacities),
      maxActiveRev: Math.max(1, ...activeRevs),
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: Math.max(1, ...prices)
    };
  }, [summary.zones]);

  const zoneIntensity = (z: ZoneSalesSummary): number => {
    if (metric === 'fill') {
      const filled = z.sold + z.held;
      if (filled <= 0 || z.capacity <= 0) return 0;
      return Math.min(1, filled / z.capacity);
    }
    if (metric === 'price') {
      const span = scaleStats.maxPrice - scaleStats.minPrice;
      return span > 0 ? (z.basePrice - scaleStats.minPrice) / span : 0.7;
    }
    const activeRev = z.realizedRevenue + z.heldPipelineRevenue;
    if (!hasLiveSales || activeRev <= 0) return 0;
    return Math.min(1, activeRev / scaleStats.maxActiveRev);
  };

  const zoneBadgeText = (z: ZoneSalesSummary): string => {
    if (metric === 'fill') return `${z.sold + z.held}/${z.capacity}`;
    if (metric === 'price') return formatPriceShort(z.basePrice);
    const activeRev = z.realizedRevenue + z.heldPipelineRevenue;
    return activeRev > 0 ? formatPriceShort(activeRev) : '0₫';
  };

  const defaultZone = useMemo(() => {
    if (summary.zones.length === 0) return undefined;
    return [...summary.zones].sort((a, b) => {
      const filledDiff = b.sold + b.held - (a.sold + a.held);
      if (filledDiff !== 0) return filledDiff;
      return b.potentialRevenue - a.potentialRevenue;
    })[0];
  }, [summary.zones]);

  const inspectedZone = (activeZoneId ? zoneMap.get(activeZoneId) : undefined) ?? defaultZone;
  const inspectedGeo = inspectedZone
    ? layout.zones.find(g => g.zoneId === inspectedZone.zoneId)
    : undefined;

  const stageFront: [number, number] =
    layout.stage.shape === 'center'
      ? [layout.stage.center[0], layout.stage.center[2]]
      : [layout.stage.center[0], layout.stage.center[2] + layout.stage.depth / 2];

  const inspectedDistanceM = inspectedGeo
    ? (() => {
        const [cx, cy] = zoneCenter2D(inspectedGeo);
        return Math.round(Math.hypot(cx - stageFront[0], cy - stageFront[1]));
      })()
    : null;

  const scaleLabels =
    metric === 'fill'
      ? {
          min: '0 vé (0%)',
          mid: 'Mật độ theo số vé đã lấp đầy',
          max: `${scaleStats.maxCapacity} vé (100%)`
        }
      : metric === 'price'
        ? {
            min: formatPriceShort(scaleStats.minPrice),
            mid: 'Trung vị',
            max: formatPriceShort(scaleStats.maxPrice)
          }
        : hasLiveSales
          ? {
              min: '0₫',
              mid: formatPriceShort(Math.round(scaleStats.maxActiveRev / 2)),
              max: formatPriceShort(scaleStats.maxActiveRev)
            }
          : {
              min: '0₫',
              mid: 'Chưa phát sinh thực thu',
              max: '100% thực thu'
            };

  return (
    <div className="overflow-hidden rounded-xl bg-kumo-base ring ring-kumo-line">
      {/* Header & Metric Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kumo-hairline px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-kumo-danger-tint text-kumo-danger">
              <Flame className="size-4" />
            </span>
            <h3 className="text-base font-semibold text-kumo-strong">
              Bản đồ nhiệt doanh số sân khấu
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-kumo-subtle">
            {metric === 'fill'
              ? `Màu nhiệt tăng dần theo số vé đã lấp đầy (đã bán + đang giữ) trên từng khu — hiện đã lấp ${summary.soldCount + summary.heldCount}/${summary.totalCapacity} vé.`
              : metric === 'revenue'
                ? hasLiveSales
                  ? 'Cường độ nhiệt theo tổng thực thu + giá trị giữ chỗ trực tiếp từng khu.'
                  : 'Chưa phát sinh vé bán — các khu sẽ đổi màu ngay khi có giao dịch.'
                : 'Phân tầng đơn giá niêm yết tỏa ra từ sân khấu chính.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Chỉ số bản đồ nhiệt"
            className="inline-flex rounded-full bg-kumo-recessed p-0.5 text-xs"
          >
            {(
              [
                ['fill', 'Vé đã lấp đầy'],
                ['revenue', 'Thực thu'],
                ['price', 'Đơn giá']
              ] as const
            ).map(([key, label]) => {
              const active = metric === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMetric(key)}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    active
                      ? 'bg-kumo-contrast text-kumo-inverse'
                      : 'text-kumo-subtle hover:text-kumo-strong'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {seats.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSeats(prev => !prev)}
              aria-pressed={showSeats}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring transition-colors ${
                showSeats
                  ? 'bg-kumo-tint text-kumo-strong ring-violet-ink/60'
                  : 'bg-kumo-base text-kumo-subtle ring-kumo-line hover:text-kumo-strong'
              }`}
            >
              <CircleDot className="size-3.5" />
              <span>Từng ghế</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split: Stage Thermal Canvas + Selected Zone Inspector */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(240px,1fr)]">
        {/* Thermal SVG Stage */}
        <div className="flex flex-col overflow-hidden rounded-xl bg-stage ring ring-stage-line">
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="h-72 w-full select-none sm:h-80"
            role="img"
            aria-label={`Bản đồ nhiệt doanh số sân khấu ${summary.eventName}`}
          >
            <defs>
              <linearGradient id={stageGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9b7bff" stopOpacity="0.52" />
                <stop offset="100%" stopColor="#9b7bff" stopOpacity="0.08" />
              </linearGradient>
              <filter id={glowFilterId} x="-35%" y="-35%" width="170%" height="170%">
                <feGaussianBlur stdDeviation="1.35" />
              </filter>
            </defs>

            {/* Acoustic / sightline distance arcs */}
            {[10, 18, 26].map(r => (
              <circle
                key={r}
                cx={stageFront[0]}
                cy={stageFront[1]}
                r={r}
                fill="none"
                stroke="#2e3563"
                strokeWidth={0.14}
                strokeDasharray="0.6 0.6"
              />
            ))}

            {/* Stage Block */}
            <g>
              <rect
                x={layout.stage.center[0] - layout.stage.width / 2}
                y={layout.stage.center[2] - layout.stage.depth / 2}
                width={layout.stage.width}
                height={layout.stage.depth}
                rx={layout.stage.shape === 'center' ? 1.1 : 0.8}
                fill={`url(#${stageGradId})`}
                stroke={stageTheme.edge}
                strokeWidth={0.28}
              />
              {layout.stage.shape !== 'center' && (
                <line
                  x1={layout.stage.center[0] - layout.stage.width / 2 + 1}
                  y1={layout.stage.center[2] + layout.stage.depth / 2}
                  x2={layout.stage.center[0] + layout.stage.width / 2 - 1}
                  y2={layout.stage.center[2] + layout.stage.depth / 2}
                  stroke="#ffe2a8"
                  strokeWidth={0.38}
                />
              )}
              {layout.stage.runway && (
                <>
                  <rect
                    x={layout.stage.center[0] - layout.stage.runway.width / 2}
                    y={layout.stage.center[2] + layout.stage.depth / 2 - 0.1}
                    width={layout.stage.runway.width}
                    height={layout.stage.runway.length + 0.2}
                    rx={0.4}
                    fill={`url(#${stageGradId})`}
                    stroke={stageTheme.edge}
                    strokeWidth={0.22}
                  />
                  {layout.stage.runway.tipWidth && layout.stage.runway.tipDepth && (
                    <rect
                      x={layout.stage.center[0] - layout.stage.runway.tipWidth / 2}
                      y={layout.stage.center[2] + layout.stage.depth / 2 + layout.stage.runway.length - 0.1}
                      width={layout.stage.runway.tipWidth}
                      height={layout.stage.runway.tipDepth}
                      rx={0.5}
                      fill={`url(#${stageGradId})`}
                      stroke={stageTheme.edge}
                      strokeWidth={0.24}
                    />
                  )}
                </>
              )}
              <text
                x={layout.stage.center[0]}
                y={layout.stage.center[2] + 0.5}
                textAnchor="middle"
                fill="#e7e9f5"
                fontSize={1.45}
                fontWeight={700}
                letterSpacing={0.2}
              >
                {layout.stage.label || 'SÂN KHẤU'}
              </text>
            </g>

            {/* Thermal glow halos proportional to intensity (zero glow on empty zones) */}
            <g filter={`url(#${glowFilterId})`} style={{ pointerEvents: 'none' }}>
              {layout.zones.map(geo => {
                const z = zoneMap.get(geo.zoneId);
                if (!z) return null;
                const intensity = zoneIntensity(z);
                if (intensity <= 0) return null;
                const fill = heatColor(intensity);
                const glowOpacity = Math.min(0.6, 0.22 + intensity * 0.42);
                return geo.kind === 'pit' ? (
                  <rect
                    key={`glow-${geo.zoneId}`}
                    x={geo.center[0] - geo.width / 2}
                    y={geo.center[2] - geo.depth / 2}
                    width={geo.width}
                    height={geo.depth}
                    rx={0.8}
                    fill={fill}
                    fillOpacity={glowOpacity}
                  />
                ) : (
                  <path
                    key={`glow-${geo.zoneId}`}
                    d={sectorPath(geo)}
                    fill={fill}
                    fillOpacity={glowOpacity}
                  />
                );
              })}
            </g>

            {/* Sightline beam from stage front to inspected zone */}
            {inspectedGeo &&
              (() => {
                const [cx, cy] = zoneCenter2D(inspectedGeo);
                return (
                  <line
                    x1={stageFront[0]}
                    y1={stageFront[1]}
                    x2={cx}
                    y2={cy}
                    stroke="#ffe2a8"
                    strokeWidth={0.22}
                    strokeDasharray="0.55 0.45"
                    opacity={0.8}
                  />
                );
              })()}

            {/* Heated Zone Shapes */}
            {layout.zones.map(geo => {
              const z = zoneMap.get(geo.zoneId);
              if (!z) return null;
              const intensity = zoneIntensity(z);
              const fill = heatColor(intensity);
              const isActive = inspectedZone?.zoneId === geo.zoneId;

              return (
                <g
                  key={geo.zoneId}
                  onClick={() => setActiveZoneId(geo.zoneId)}
                  onPointerEnter={() => setActiveZoneId(geo.zoneId)}
                  style={{ cursor: 'pointer' }}
                >
                  {geo.kind === 'pit' ? (
                    <rect
                      x={geo.center[0] - geo.width / 2}
                      y={geo.center[2] - geo.depth / 2}
                      width={geo.width}
                      height={geo.depth}
                      rx={0.55}
                      fill={fill}
                      fillOpacity={isActive ? 0.94 : 0.72}
                      stroke={isActive ? '#ffe2a8' : '#0b0e26'}
                      strokeWidth={isActive ? 0.44 : 0.22}
                    />
                  ) : (
                    <path
                      d={sectorPath(geo)}
                      fill={fill}
                      fillOpacity={isActive ? 0.94 : 0.72}
                      stroke={isActive ? '#ffe2a8' : '#0b0e26'}
                      strokeWidth={isActive ? 0.44 : 0.22}
                    />
                  )}

                  {/* Standing pit fill indicator bar along bottom edge */}
                  {geo.kind === 'pit' && z.fillRate > 0 && (
                    <rect
                      x={geo.center[0] - geo.width / 2 + 0.4}
                      y={geo.center[2] + geo.depth / 2 - 0.52}
                      width={Math.max(0.6, (geo.width - 0.8) * z.fillRate)}
                      height={0.32}
                      rx={0.16}
                      fill="#ffe2a8"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}

            {/* Individual seat status dots overlaid on seated tiers */}
            {showSeats && layout.seats.length > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                {layout.seats.map(seat => {
                  const status = seatStatusMap.get(seat.seatId) ?? 'available';
                  const dotFill =
                    status === 'sold'
                      ? '#34d399'
                      : status === 'held' || status === 'selected'
                        ? '#fbbf24'
                        : 'rgba(255,255,255,0.34)';
                  const r = status === 'available' ? 0.2 : 0.3;
                  return (
                    <circle
                      key={seat.seatId}
                      cx={seat.position[0]}
                      cy={seat.position[2]}
                      r={r}
                      fill={dotFill}
                      stroke={status === 'available' ? 'none' : '#0b0e26'}
                      strokeWidth={status === 'available' ? 0 : 0.08}
                    />
                  );
                })}
              </g>
            )}

            {/* Zone labels rendered above seat dots for crisp legibility */}
            <g style={{ pointerEvents: 'none' }}>
              {layout.zones.map(geo => {
                const z = zoneMap.get(geo.zoneId);
                const meta = summaryMap.get(geo.zoneId);
                if (!z || !meta) return null;
                const intensity = zoneIntensity(z);
                const labelColor = heatLabelColor(intensity);
                const haloColor = intensity >= 0.36 ? 'rgba(255,255,255,0.45)' : 'rgba(11,14,38,0.85)';
                const [cx, cy] = zoneCenter2D(geo);
                const shortCode = z.zoneCode || meta.shortName;

                return (
                  <g key={`label-${geo.zoneId}`}>
                    <text
                      x={cx}
                      y={cy - 0.12}
                      textAnchor="middle"
                      fill={labelColor}
                      stroke={haloColor}
                      strokeWidth={0.28}
                      paintOrder="stroke"
                      fontSize={1.12}
                      fontWeight={700}
                    >
                      {shortCode}
                    </text>
                    <text
                      x={cx}
                      y={cy + 1.05}
                      textAnchor="middle"
                      fill={labelColor}
                      stroke={haloColor}
                      strokeWidth={0.24}
                      paintOrder="stroke"
                      fontSize={0.88}
                      fontWeight={600}
                    >
                      {zoneBadgeText(z)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Continuous Thermal Scale Legend */}
          <div className="space-y-2 border-t border-stage-line bg-stage-raised/80 px-3.5 py-2.5 text-[11px] text-stage-muted">
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 font-medium text-stage-ink">{scaleLabels.min}</span>
              <div
                className="h-2 flex-1 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, #1e3154 0%, #1d7a8a 10%, #22b07d 25%, #e8b339 50%, #f97316 75%, #ef4444 100%)'
                }}
              />
              <span className="shrink-0 font-medium text-stage-ink">{scaleLabels.max}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {showSeats && seats.length > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-[#34d399]" />
                    Ghế đã bán
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-[#fbbf24]" />
                    Đang giữ
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-white/40" />
                    Còn trống
                  </span>
                </div>
              ) : (
                <span>{scaleLabels.mid}</span>
              )}
              <span>Di chuột hoặc nhấn khu để soi chi tiết</span>
            </div>
          </div>
        </div>

        {/* Selected Zone Inspector Side Panel */}
        {inspectedZone && (
          <div className="flex flex-col justify-between rounded-xl bg-kumo-recessed/70 p-4 ring ring-kumo-line">
            <div className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: heatColor(zoneIntensity(inspectedZone)) }}
                  />
                  <h4 className="text-sm font-semibold text-kumo-strong">
                    {inspectedZone.zoneName}
                  </h4>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-kumo-base px-2 py-0.5 text-kumo-subtle ring ring-kumo-line">
                    {inspectedZone.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'}
                  </span>
                  {inspectedDistanceM !== null && (
                    <span className="rounded-full bg-kumo-base px-2 py-0.5 text-kumo-subtle ring ring-kumo-line tabular-nums">
                      ~{inspectedDistanceM}m từ sân khấu
                    </span>
                  )}
                  {inspectedZone.fillRate >= 0.7 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-kumo-danger-tint px-2 py-0.5 font-semibold text-kumo-danger">
                      <TrendingUp className="size-3" />
                      Bán chạy
                    </span>
                  )}
                  {inspectedZone.fillRate < 0.2 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-kumo-warning-tint px-2 py-0.5 font-medium text-kumo-warning">
                      <TrendingDown className="size-3" />
                      Cần kích cầu
                    </span>
                  )}
                </div>
              </div>

              {/* Fill Progress */}
              <div className="rounded-lg bg-kumo-base p-3 ring ring-kumo-line/80">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-kumo-subtle">Tỉ lệ lấp đầy khu vực</span>
                  <span className="type-figure text-sm text-kumo-strong">
                    {Math.round(inspectedZone.fillRate * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-kumo-recessed">
                  {inspectedZone.sold > 0 && (
                    <div
                      className="bg-kumo-success"
                      style={{ width: `${(inspectedZone.sold / Math.max(1, inspectedZone.capacity)) * 100}%` }}
                    />
                  )}
                  {inspectedZone.held > 0 && (
                    <div
                      className="bg-seat-held"
                      style={{ width: `${(inspectedZone.held / Math.max(1, inspectedZone.capacity)) * 100}%` }}
                    />
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] tabular-nums">
                  <div className="rounded bg-kumo-recessed/70 py-1">
                    <span className="block text-kumo-subtle">Đã bán</span>
                    <strong className="text-kumo-success">{inspectedZone.sold}</strong>
                  </div>
                  <div className="rounded bg-kumo-recessed/70 py-1">
                    <span className="block text-kumo-subtle">Đang giữ</span>
                    <strong className="text-kumo-warning">{inspectedZone.held}</strong>
                  </div>
                  <div className="rounded bg-kumo-recessed/70 py-1">
                    <span className="block text-kumo-subtle">Còn trống</span>
                    <strong className="text-kumo-strong">{inspectedZone.available}</strong>
                  </div>
                </div>
              </div>

              {/* Revenue Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-kumo-base p-2.5 ring ring-kumo-line/80">
                  <span className="block text-[11px] text-kumo-subtle">Thực thu khu</span>
                  <span className="type-figure mt-0.5 block text-sm text-kumo-success">
                    {formatPriceShort(inspectedZone.realizedRevenue)}
                  </span>
                </div>
                <div className="rounded-lg bg-kumo-base p-2.5 ring ring-kumo-line/80">
                  <span className="block text-[11px] text-kumo-subtle">Pipeline giữ chỗ</span>
                  <span className="type-figure mt-0.5 block text-sm text-kumo-warning">
                    {formatPriceShort(inspectedZone.heldPipelineRevenue)}
                  </span>
                </div>
                <div className="col-span-2 rounded-lg bg-kumo-base p-2.5 ring ring-kumo-line/80">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-kumo-subtle">Doanh thu mục tiêu khu</span>
                    <span className="text-[11px] font-medium text-violet-ink tabular-nums">
                      {summary.potentialRevenue > 0
                        ? `${Math.round((inspectedZone.potentialRevenue / summary.potentialRevenue) * 100)}% tổng show`
                        : '0%'}
                    </span>
                  </div>
                  <span className="type-figure mt-0.5 block text-sm text-kumo-strong">
                    {formatPrice(inspectedZone.potentialRevenue)}
                  </span>
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="rounded-lg bg-kumo-base px-3 py-2 text-xs ring ring-kumo-line/80">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-kumo-subtle">
                    <Wallet className="size-3.5 text-violet-ink" />
                    Giá cơ bản
                  </span>
                  <strong className="type-figure text-kumo-strong">
                    {formatPrice(inspectedZone.basePrice)}
                  </strong>
                </div>
                <p className="mt-1 text-[11px] text-kumo-subtle tabular-nums">
                  Sàn {formatPriceShort(inspectedZone.floorPrice)} — Trần{' '}
                  {formatPriceShort(inspectedZone.ceilingPrice)}
                  {inspectedZone.priceHeadroomPct > 0
                    ? ` · Dư địa +${Math.round(inspectedZone.priceHeadroomPct * 100)}%`
                    : ''}
                </p>
              </div>
            </div>

            {/* Direct Zone Actions */}
            <div className="mt-3 flex flex-wrap gap-2 pt-2">
              {onInspectPricing && (
                <button
                  type="button"
                  onClick={() => onInspectPricing(inspectedZone.zoneId)}
                  className="btn btn-ink btn-sm h-9 flex-1 text-xs"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Chỉnh giá khu này</span>
                </button>
              )}
              <Link
                to={`/events/${summary.eventId}/tickets`}
                className="btn btn-secondary btn-sm h-9 text-xs"
              >
                <span>3D</span>
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
