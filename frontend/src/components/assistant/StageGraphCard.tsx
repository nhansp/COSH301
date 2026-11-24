import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ExternalLink, Flame, Layers, SlidersHorizontal, Sparkles } from 'lucide-react';
import {
  EnrichedEvent,
  StageGraphTab,
  StageMapOverlay,
  ZoneTelemetry
} from '../../services/assistantService';
import { formatPrice, formatPriceShort } from '../../services/eventService';
import { TierGeometry, Vec3, VenueLayout, ZoneGeometry, buildVenueLayout } from '../../services/venue';

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
  for (let i = 0; i <= 10; i++) {
    const a = z.startAngle + ((z.endAngle - z.startAngle) * i) / 10;
    pts.push(polar(z.origin, a, z.innerRadius), polar(z.origin, a, z.outerRadius));
  }
  return pts;
}

function computeViewBox(layout: VenueLayout): Box {
  const { width, depth, center } = layout.stage;
  const pts: [number, number][] = [
    [center[0] - width / 2, center[2] - depth / 2],
    [center[0] + width / 2, center[2] + depth / 2]
  ];
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

/** Heat colour ramp for live occupancy: cool teal/emerald when open, amber at mid-load, coral when packed. */
function occupancyColor(rate: number): string {
  if (rate >= 0.8) return '#ff6f78';
  if (rate >= 0.5) return '#ff9c6e';
  if (rate >= 0.25) return '#e8a23a';
  if (rate > 0) return '#56c28e';
  return '#2d4b5e';
}

interface StageGraphCardProps {
  initialEventId: string;
  events: EnrichedEvent[];
  initialTab?: StageGraphTab;
  initialOverlay?: StageMapOverlay;
}

export const StageGraphCard: React.FC<StageGraphCardProps> = ({
  initialEventId,
  events,
  initialTab = 'map',
  initialOverlay = 'price'
}) => {
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [tab, setTab] = useState<StageGraphTab>(initialTab);
  const [overlay, setOverlay] = useState<StageMapOverlay>(initialOverlay);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const gradientId = useId();

  const current = useMemo(
    () => events.find(e => e.event.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  const layout = useMemo(
    () => buildVenueLayout(current.zoneSummaries, current.seats),
    [current.zoneSummaries, current.seats]
  );
  const viewBox = useMemo(() => computeViewBox(layout), [layout]);

  const zoneMap = useMemo(() => new Map(current.zones.map(z => [z.zoneId, z])), [current.zones]);
  const summaryMap = useMemo(() => new Map(current.zoneSummaries.map(z => [z.id, z])), [current.zoneSummaries]);

  const inspectedZone: ZoneTelemetry | undefined =
    (activeZoneId ? zoneMap.get(activeZoneId) : undefined) ?? current.zones[0];

  const maxCeiling = useMemo(
    () => Math.max(1, ...current.zones.map(z => Math.max(z.ceilingPrice, z.basePrice))),
    [current.zones]
  );

  const stageFront: [number, number] = [layout.stage.center[0], layout.stage.center[2] + layout.stage.depth / 2];
  const standingZones = current.zones.filter(z => z.kind === 'standing').length;
  const seatedZones = current.zones.length - standingZones;
  const topRevenueZone = useMemo(
    () => [...current.zones].sort((a, b) => b.potentialRevenue - a.potentialRevenue)[0],
    [current.zones]
  );
  const spreadRatio =
    current.minPrice > 0 ? (current.maxPrice / current.minPrice).toFixed(1) : '1.0';

  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-kumo-base ring ring-kumo-line">
      {/* Event Switcher */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-kumo-hairline bg-kumo-recessed/70 px-3 py-2 no-scrollbar">
        {events.map(item => {
          const active = item.event.id === current.event.id;
          const shortTitle = item.event.title.replace(/^Concert\s+/i, '').slice(0, 26);
          return (
            <button
              key={item.event.id}
              type="button"
              onClick={() => {
                setSelectedEventId(item.event.id);
                setActiveZoneId(null);
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-kumo-contrast text-kumo-inverse'
                  : 'bg-kumo-base text-kumo-subtle ring ring-kumo-line hover:text-kumo-strong'
              }`}
            >
              {shortTitle}
              {item.event.title.length > 26 ? '…' : ''}
            </button>
          );
        })}
      </div>

      {/* KPI Header Strip */}
      <div className="grid grid-cols-4 gap-2 border-b border-kumo-hairline px-3 py-2.5 text-center">
        <div>
          <p className="text-[11px] text-kumo-subtle">Khu vực</p>
          <p className="type-figure text-sm text-kumo-strong">{current.zones.length}</p>
        </div>
        <div>
          <p className="text-[11px] text-kumo-subtle">Tổng chỗ</p>
          <p className="type-figure text-sm text-kumo-strong">{current.totalSeats}</p>
        </div>
        <div>
          <p className="text-[11px] text-kumo-subtle">Lấp đầy</p>
          <p className="type-figure text-sm text-kumo-strong">{Math.round(current.occupancyRate * 100)}%</p>
        </div>
        <div>
          <p className="text-[11px] text-kumo-subtle">Doanh thu dự kiến</p>
          <p className="type-figure text-sm text-violet-ink">{formatPriceShort(current.potentialRevenue)}</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kumo-hairline px-3 py-2">
        <div role="tablist" aria-label="Chế độ biểu đồ sân khấu" className="flex gap-1">
          {([
            ['map', 'Sơ đồ sân khấu', Layers],
            ['pricing', 'Biểu đồ giá', SlidersHorizontal],
            ['capacity', 'Sức chứa & Lấp đầy', BarChart3]
          ] as const).map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-violet text-midnight'
                    : 'text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-strong'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {tab === 'map' && (
          <div className="flex items-center gap-1 rounded-full bg-kumo-recessed p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setOverlay('price')}
              className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                overlay === 'price' ? 'bg-kumo-contrast text-kumo-inverse' : 'text-kumo-subtle'
              }`}
            >
              Hạng giá
            </button>
            <button
              type="button"
              onClick={() => setOverlay('occupancy')}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors ${
                overlay === 'occupancy' ? 'bg-kumo-contrast text-kumo-inverse' : 'text-kumo-subtle'
              }`}
            >
              <Flame className="size-3" />
              Nhiệt
            </button>
          </div>
        )}
      </div>

      {/* Visualization Body */}
      <div className="p-3">
        {tab === 'map' && (
          <>
            <div className="relative overflow-hidden rounded-xl bg-stage ring ring-stage-line">
              <svg
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                className="h-60 w-full select-none sm:h-68"
                role="img"
                aria-label={`Biểu đồ sân khấu ${current.event.title}`}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9b7bff" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#9b7bff" stopOpacity="0.06" />
                  </linearGradient>
                </defs>

                {/* Acoustic / sightline distance arcs from stage front */}
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
                    rx={0.8}
                    fill={`url(#${gradientId})`}
                    stroke="#9b7bff"
                    strokeWidth={0.28}
                  />
                  <line
                    x1={layout.stage.center[0] - layout.stage.width / 2 + 1}
                    y1={stageFront[1]}
                    x2={layout.stage.center[0] + layout.stage.width / 2 - 1}
                    y2={stageFront[1]}
                    stroke="#ffe2a8"
                    strokeWidth={0.35}
                  />
                  <text
                    x={layout.stage.center[0]}
                    y={layout.stage.center[2] + 0.45}
                    textAnchor="middle"
                    fill="#e7e9f5"
                    fontSize={1.55}
                    fontWeight={700}
                    letterSpacing={0.25}
                  >
                    SÂN KHẤU
                  </text>
                </g>

                {/* Sightline vector to inspected zone */}
                {inspectedZone &&
                  (() => {
                    const geo = layout.zones.find(z => z.zoneId === inspectedZone.zoneId);
                    if (!geo) return null;
                    const [cx, cy] = zoneCenter2D(geo);
                    return (
                      <line
                        x1={stageFront[0]}
                        y1={stageFront[1]}
                        x2={cx}
                        y2={cy}
                        stroke="#ffe2a8"
                        strokeWidth={0.2}
                        strokeDasharray="0.5 0.4"
                        opacity={0.75}
                      />
                    );
                  })()}

                {/* Zone Geometries */}
                {layout.zones.map(geo => {
                  const z = zoneMap.get(geo.zoneId);
                  const summary = summaryMap.get(geo.zoneId);
                  if (!z || !summary) return null;
                  const isActive = inspectedZone?.zoneId === geo.zoneId;
                  const fill = overlay === 'occupancy' ? occupancyColor(z.occupancyRate) : summary.color;
                  const [cx, cy] = zoneCenter2D(geo);
                  const label = z.zoneCode || summary.shortName;

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
                          rx={0.5}
                          fill={fill}
                          fillOpacity={isActive ? 0.92 : 0.62}
                          stroke={isActive ? '#ffe2a8' : '#11121a'}
                          strokeWidth={isActive ? 0.42 : 0.2}
                        />
                      ) : (
                        <path
                          d={sectorPath(geo)}
                          fill={fill}
                          fillOpacity={isActive ? 0.92 : 0.62}
                          stroke={isActive ? '#ffe2a8' : '#11121a'}
                          strokeWidth={isActive ? 0.42 : 0.2}
                        />
                      )}
                      <text
                        x={cx}
                        y={cy + 0.38}
                        textAnchor="middle"
                        fill="#0b0e26"
                        fontSize={1.15}
                        fontWeight={700}
                        style={{ pointerEvents: 'none' }}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Map Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stage-line bg-stage-raised/70 px-3 py-1.5 text-[11px] text-stage-muted">
                {overlay === 'price' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-[#f2c982]" />
                    Gần sân khấu (VIP)
                    <span>→</span>
                    <span className="inline-block size-2 rounded-full bg-[#5a6bb5]" />
                    Xa hơn (Phổ thông)
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-[#2d4b5e]" />
                      0%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-[#56c28e]" />
                      1–25%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-[#e8a23a]" />
                      25–50%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-[#ff6f78]" />
                      80%+
                    </span>
                  </span>
                )}
                <span>Nhấn khu vực để xem chi tiết</span>
              </div>
            </div>

            {/* Selected Zone Telemetry Inspector */}
            {inspectedZone && (
              <div className="mt-2.5 rounded-xl bg-kumo-recessed p-3 ring ring-kumo-line">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-kumo-strong">{inspectedZone.zoneName}</span>
                    <span className="ml-2 rounded-full bg-kumo-base px-2 py-0.5 text-[11px] font-medium text-kumo-subtle ring ring-kumo-line">
                      {inspectedZone.kind === 'standing' ? 'Khu đứng' : 'Ghế ngồi'}
                    </span>
                  </div>
                  <span className="type-figure text-sm text-violet-ink">
                    {formatPrice(inspectedZone.basePrice, '₫')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-kumo-base px-2.5 py-1.5">
                    <span className="block text-[11px] text-kumo-subtle">Trống / Giữ / Bán</span>
                    <span className="type-figure text-kumo-strong">
                      {inspectedZone.available} / {inspectedZone.held} / {inspectedZone.sold}
                    </span>
                  </div>
                  <div className="rounded-lg bg-kumo-base px-2.5 py-1.5">
                    <span className="block text-[11px] text-kumo-subtle">Biên giá sàn–trần</span>
                    <span className="type-figure text-kumo-strong">
                      {formatPriceShort(inspectedZone.floorPrice)}–{formatPriceShort(inspectedZone.ceilingPrice)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-kumo-base px-2.5 py-1.5">
                    <span className="block text-[11px] text-kumo-subtle">Doanh thu khu</span>
                    <span className="type-figure text-kumo-strong">
                      {formatPriceShort(inspectedZone.potentialRevenue)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'pricing' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-kumo-subtle">
              <span>Khung giá (Giá sàn — Giá cơ bản ● — Giá trần)</span>
              <span className="type-figure">Tối đa {formatPriceShort(maxCeiling)}</span>
            </div>
            <ul className="space-y-2">
              {current.zones.map(z => {
                const summary = summaryMap.get(z.zoneId);
                const leftPct = (z.floorPrice / maxCeiling) * 100;
                const widthPct = Math.max(2, ((z.ceilingPrice - z.floorPrice) / maxCeiling) * 100);
                const basePct = (z.basePrice / maxCeiling) * 100;
                return (
                  <li key={z.zoneId} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-kumo-strong">
                        <span
                          className="mr-1.5 inline-block size-2 rounded-full align-middle"
                          style={{ backgroundColor: summary?.color ?? '#9b7bff' }}
                        />
                        {z.zoneName}
                      </span>
                      <span className="type-figure shrink-0 text-kumo-subtle">
                        {formatPriceShort(z.floorPrice)} ·{' '}
                        <strong className="text-kumo-strong">{formatPriceShort(z.basePrice)}</strong> ·{' '}
                        {formatPriceShort(z.ceilingPrice)}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full bg-kumo-recessed">
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-full opacity-55"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: summary?.color ?? '#9b7bff'
                        }}
                      />
                      <div
                        title={`Giá cơ bản: ${formatPrice(z.basePrice, '₫')}`}
                        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-kumo-base bg-violet-ink shadow-sm"
                        style={{ left: `${basePct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tab === 'capacity' && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-kumo-subtle">
              <span>Phân bổ ghế trực tiếp theo khu vực</span>
              <span className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-seat-sold" />
                  Đã bán
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-seat-held" />
                  Đang giữ
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-seat-available" />
                  Còn trống
                </span>
              </span>
            </div>
            <ul className="space-y-2">
              {current.zones.map(z => {
                const total = Math.max(1, z.totalSeats);
                const soldPct = (z.sold / total) * 100;
                const heldPct = (z.held / total) * 100;
                const availPct = (z.available / total) * 100;
                const revShare =
                  current.potentialRevenue > 0 ? Math.round((z.potentialRevenue / current.potentialRevenue) * 100) : 0;
                return (
                  <li key={z.zoneId} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-kumo-strong">{z.zoneName}</span>
                      <span className="type-figure shrink-0 text-kumo-subtle">
                        {z.sold + z.held}/{z.totalSeats} ({Math.round(z.occupancyRate * 100)}%) · {revShare}% DT
                      </span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-kumo-recessed">
                      {soldPct > 0 && <div style={{ width: `${soldPct}%` }} className="bg-seat-sold" />}
                      {heldPct > 0 && <div style={{ width: `${heldPct}%` }} className="bg-seat-held" />}
                      {availPct > 0 && <div style={{ width: `${availPct}%` }} className="bg-seat-available" />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Organizer Stage Insight Footer */}
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-kumo-info-tint/70 px-3 py-2 text-xs text-kumo-default">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-ink" />
          <p className="leading-relaxed">
            Cấu trúc <strong>{seatedZones} khu ngồi / {standingZones} khu đứng</strong>, biên độ giá{' '}
            <strong className="type-figure">{spreadRatio}×</strong>.{' '}
            {topRevenueZone && (
              <>
                Khu đóng góp doanh thu lớn nhất là <strong>{topRevenueZone.zoneName}</strong> (
                {formatPriceShort(topRevenueZone.potentialRevenue)}).
              </>
            )}
          </p>
        </div>

        {/* Action links */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Link
            to={`/events/${current.event.id}/tickets`}
            className="btn btn-secondary btn-sm h-8 flex-1 text-xs"
          >
            Xem sơ đồ 3D trực tiếp
            <ExternalLink className="size-3.5" />
          </Link>
          <Link to="/organizer" className="btn btn-ink btn-sm h-8 flex-1 text-xs">
            Cấu hình giá khu vực
          </Link>
        </div>
      </div>
    </div>
  );
};
