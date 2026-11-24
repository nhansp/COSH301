import React, { useId, useMemo, useState } from 'react';
import { CircleDot, Eye, Layers, Sparkles } from 'lucide-react';
import { SeatItem, StageLayoutConfig } from '../../types';
import {
  STAGE_THEMES,
  TierGeometry,
  Vec3,
  VenueLayout,
  ZoneGeometry,
  ZoneSummary,
  buildVenueLayout,
  normalizeLayoutConfig,
  stageFootprintPoints
} from '../../services/venue';
import { formatPriceShort } from '../../services/eventService';

type Box = { x: number; y: number; w: number; h: number };

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
  for (let i = 0; i <= 12; i++) {
    const a = z.startAngle + ((z.endAngle - z.startAngle) * i) / 12;
    pts.push(polar(z.origin, a, z.innerRadius), polar(z.origin, a, z.outerRadius));
  }
  return pts;
}

function computeViewBox(layout: VenueLayout): Box {
  const pts: [number, number][] = [...stageFootprintPoints(layout.stage)];
  layout.zones.forEach(z => pts.push(...zonePoints(z)));
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const pad = 2.8;
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

const SHAPE_LABELS = {
  standard: 'Sân khấu chuẩn',
  thrust: 'Chữ T (Thrust)',
  catwalk: 'Catwalk Runway',
  center: 'Trung tâm 360°'
} as const;

export interface StageLayoutPreviewProps {
  zones: ZoneSummary[];
  seats: SeatItem[];
  layoutConfig: StageLayoutConfig;
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  title?: string;
  compact?: boolean;
}

export const StageLayoutPreview: React.FC<StageLayoutPreviewProps> = ({
  zones,
  seats,
  layoutConfig,
  selectedZoneId = null,
  onSelectZone,
  title = 'Xem trước sân khấu & sơ đồ chỗ ngồi',
  compact = false
}) => {
  const [showSeats, setShowSeats] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const ledGradId = useId();
  const gridPatId = useId();
  const crowdPatId = useId();

  const normalized = useMemo(() => normalizeLayoutConfig(layoutConfig), [layoutConfig]);
  const theme = STAGE_THEMES[normalized.stageTheme];
  const layout = useMemo(() => buildVenueLayout(zones, seats, layoutConfig), [zones, seats, layoutConfig]);
  const viewBox = useMemo(() => computeViewBox(layout), [layout]);
  const zoneMap = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones]);

  const stats = useMemo(() => {
    let seatedCap = 0;
    let standingCap = 0;
    let potentialRevenue = 0;
    for (const z of zones) {
      if (z.kind === 'standing') standingCap += z.capacity;
      else seatedCap += z.capacity;
      potentialRevenue += z.capacity * z.basePrice;
    }
    return {
      totalCap: seatedCap + standingCap,
      seatedCap,
      standingCap,
      potentialRevenue
    };
  }, [zones]);

  const activeId = hoveredId ?? selectedZoneId;
  const activeZone = activeId ? zoneMap.get(activeId) ?? null : null;
  const stage = layout.stage;
  const stageX = stage.center[0] - stage.width / 2;
  const stageY = stage.center[2] - stage.depth / 2;
  const stageFrontY = stage.center[2] + stage.depth / 2;
  const arcOrigin: [number, number] =
    stage.shape === 'center' ? [stage.center[0], stage.center[2]] : [stage.center[0], stageFrontY];

  return (
    <div className="overflow-hidden rounded-2xl bg-kumo-base ring ring-kumo-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kumo-hairline px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet/15 text-violet-ink">
              <Eye className="size-4" />
            </span>
            <h3 className="truncate text-sm font-semibold text-kumo-strong">{title}</h3>
          </div>
          <p className="mt-0.5 text-xs text-kumo-subtle">
            {SHAPE_LABELS[normalized.stageShape]} · {normalized.stageWidth}×{normalized.stageDepth}m · Góc khán đài{' '}
            {Math.round(normalized.tierSpanDeg)}°
          </p>
        </div>

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
          <span>Hiện từng ghế</span>
        </button>
      </div>

      {/* Live Blueprint Canvas */}
      <div className="relative bg-stage">
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className={`w-full select-none ${compact ? 'h-72 sm:h-80' : 'h-80 sm:h-[26rem]'}`}
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={ledGradId} x1="0" x2="1">
              <stop offset="0%" stopColor={theme.ledStops[0]} />
              <stop offset="50%" stopColor={theme.ledStops[1]} />
              <stop offset="100%" stopColor={theme.ledStops[2]} />
            </linearGradient>
            <pattern id={gridPatId} width="3" height="3" patternUnits="userSpaceOnUse">
              <path d="M3 0H0V3" fill="none" stroke="rgba(148,163,219,0.09)" strokeWidth="0.06" />
            </pattern>
            <pattern id={crowdPatId} width="0.85" height="0.85" patternUnits="userSpaceOnUse">
              <circle cx="0.42" cy="0.42" r="0.1" fill="rgba(255,255,255,0.34)" />
            </pattern>
          </defs>

          <rect
            x={viewBox.x - viewBox.w}
            y={viewBox.y - viewBox.h}
            width={viewBox.w * 3}
            height={viewBox.h * 3}
            fill={`url(#${gridPatId})`}
          />

          {/* Subtle sightline rings */}
          {[10, 18, 26].map(r => (
            <circle
              key={r}
              cx={arcOrigin[0]}
              cy={arcOrigin[1]}
              r={r}
              fill="none"
              stroke="rgba(148,163,219,0.12)"
              strokeWidth={0.12}
              strokeDasharray="0.55 0.55"
            />
          ))}

          {/* Stage Deck + LED Wall + Optional Runway / Thrust B-Stage */}
          <g>
            <rect
              x={stageX}
              y={stageY}
              width={stage.width}
              height={stage.depth}
              rx={stage.shape === 'center' ? 1.1 : 0.45}
              fill="#1b1f40"
              stroke={theme.edge}
              strokeWidth={0.22}
            />
            {stage.shape === 'center' ? (
              <rect
                x={stageX + 0.9}
                y={stageY + 0.9}
                width={Math.max(1, stage.width - 1.8)}
                height={Math.max(1, stage.depth - 1.8)}
                rx={0.6}
                fill="none"
                stroke={`url(#${ledGradId})`}
                strokeWidth={0.26}
              />
            ) : (
              <>
                <rect
                  x={stageX + stage.width * 0.1}
                  y={stageY + 0.25}
                  width={stage.width * 0.8}
                  height={0.45}
                  rx={0.18}
                  fill={`url(#${ledGradId})`}
                />
                <line
                  x1={stageX + 0.4}
                  y1={stageFrontY}
                  x2={stageX + stage.width - 0.4}
                  y2={stageFrontY}
                  stroke={theme.edge}
                  strokeWidth={0.26}
                />
              </>
            )}

            {stage.runway && (
              <>
                <rect
                  x={stage.center[0] - stage.runway.width / 2}
                  y={stageFrontY - 0.12}
                  width={stage.runway.width}
                  height={stage.runway.length + 0.24}
                  rx={0.3}
                  fill="#1b1f40"
                  stroke={theme.edge}
                  strokeWidth={0.2}
                />
                {stage.runway.tipWidth && stage.runway.tipDepth && (
                  <rect
                    x={stage.center[0] - stage.runway.tipWidth / 2}
                    y={stageFrontY + stage.runway.length - 0.1}
                    width={stage.runway.tipWidth}
                    height={stage.runway.tipDepth}
                    rx={0.45}
                    fill="#1b1f40"
                    stroke={theme.edge}
                    strokeWidth={0.24}
                  />
                )}
              </>
            )}

            <text
              x={stage.center[0]}
              y={stage.center[2] + 0.48}
              textAnchor="middle"
              fill="#eef0ff"
              fontSize={Math.max(1.15, Math.min(1.6, stage.width * 0.1))}
              fontWeight={700}
              letterSpacing={0.18}
            >
              {stage.label}
            </text>
          </g>

          {/* Zones (Pits & Seated Tiers) */}
          {layout.zones.map(geo => {
            const z = zoneMap.get(geo.zoneId);
            if (!z) return null;
            const isSelected = selectedZoneId === geo.zoneId;
            const isHovered = hoveredId === geo.zoneId;
            const highlight = isSelected || isHovered;
            const stroke = isSelected ? '#ffe2a8' : z.color;

            return (
              <g
                key={geo.zoneId}
                onClick={() => onSelectZone?.(geo.zoneId)}
                onPointerEnter={() => setHoveredId(geo.zoneId)}
                onPointerLeave={() => setHoveredId(cur => (cur === geo.zoneId ? null : cur))}
                style={{ cursor: onSelectZone ? 'pointer' : 'default' }}
              >
                {geo.kind === 'pit' ? (
                  <>
                    <rect
                      x={geo.center[0] - geo.width / 2}
                      y={geo.center[2] - geo.depth / 2}
                      width={geo.width}
                      height={geo.depth}
                      rx={0.45}
                      fill={z.color}
                      fillOpacity={highlight ? 0.56 : 0.34}
                      stroke={stroke}
                      strokeWidth={highlight ? 0.34 : 0.18}
                    />
                    <rect
                      x={geo.center[0] - geo.width / 2}
                      y={geo.center[2] - geo.depth / 2}
                      width={geo.width}
                      height={geo.depth}
                      rx={0.45}
                      fill={`url(#${crowdPatId})`}
                      style={{ pointerEvents: 'none' }}
                    />
                  </>
                ) : (
                  <path
                    d={sectorPath(geo)}
                    fill={z.color}
                    fillOpacity={highlight ? 0.54 : 0.32}
                    stroke={stroke}
                    strokeWidth={highlight ? 0.34 : 0.18}
                  />
                )}
              </g>
            );
          })}

          {/* Individual Seat Dots */}
          {showSeats && layout.seats.length > 0 && (
            <g style={{ pointerEvents: 'none' }}>
              {layout.seats.map(p => (
                <circle
                  key={p.seatId}
                  cx={p.position[0]}
                  cy={p.position[2]}
                  r={0.22}
                  fill="rgba(241,245,249,0.72)"
                />
              ))}
            </g>
          )}

          {/* Zone Labels */}
          <g style={{ pointerEvents: 'none' }}>
            {layout.zones.map(geo => {
              const z = zoneMap.get(geo.zoneId);
              if (!z) return null;
              const [cx, cy] = zoneCenter2D(geo);
              const label = z.code || z.shortName;
              return (
                <g key={`lbl-${geo.zoneId}`}>
                  <text
                    x={cx}
                    y={cy - 0.15}
                    textAnchor="middle"
                    fill="#f8fafc"
                    stroke="#0b0e26"
                    strokeWidth={0.34}
                    paintOrder="stroke"
                    fontSize={1.08}
                    fontWeight={700}
                  >
                    {label}
                  </text>
                  <text
                    x={cx}
                    y={cy + 0.98}
                    textAnchor="middle"
                    fill={z.color}
                    stroke="#0b0e26"
                    strokeWidth={0.28}
                    paintOrder="stroke"
                    fontSize={0.84}
                    fontWeight={600}
                  >
                    {formatPriceShort(z.basePrice)} · {z.capacity} chỗ
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Active zone floating chip */}
        {activeZone && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-[#0f1330]/90 px-3 py-1.5 text-xs text-stage-ink ring-1 ring-stage-line backdrop-blur-md">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: activeZone.color }} />
            <span className="font-semibold">{activeZone.name}</span>
            <span className="text-stage-muted">
              {activeZone.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'} · {activeZone.capacity} chỗ ·{' '}
              {formatPriceShort(activeZone.basePrice)}
            </span>
          </div>
        )}
      </div>

      {/* Live Blueprint Summary Metrics */}
      <div className="grid grid-cols-3 divide-x divide-kumo-hairline border-t border-kumo-hairline bg-kumo-recessed/50 text-center">
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-kumo-subtle">Tổng sức chứa</p>
          <p className="type-figure mt-0.5 text-sm font-semibold text-kumo-strong">
            {stats.totalCap.toLocaleString('vi-VN')} chỗ
          </p>
          <p className="text-[10px] text-kumo-subtle tabular-nums">
            {stats.seatedCap} ngồi · {stats.standingCap} đứng
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-kumo-subtle">Khu vực</p>
          <p className="type-figure mt-0.5 flex items-center justify-center gap-1 text-sm font-semibold text-kumo-strong">
            <Layers className="size-3.5 text-violet-ink" />
            {zones.length} khu
          </p>
          <p className="text-[10px] text-kumo-subtle">
            {normalized.zonesPerRing} khu / tầng ngồi
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-kumo-subtle">Doanh thu mục tiêu</p>
          <p className="type-figure mt-0.5 flex items-center justify-center gap-1 text-sm font-semibold text-kumo-success">
            <Sparkles className="size-3.5" />
            {formatPriceShort(stats.potentialRevenue)}
          </p>
          <p className="text-[10px] text-kumo-subtle">Theo giá cơ bản</p>
        </div>
      </div>
    </div>
  );
};
