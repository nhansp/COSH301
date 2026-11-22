import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Scan } from 'lucide-react';
import { SeatItem } from '../../types';
import { SeatPlacement, TierGeometry, Vec3, VenueLayout, ZoneGeometry, ZoneSummary, zoneStats } from '../../services/venue';
import { formatPriceShort } from '../../services/eventService';
import { VenueOverlay } from './VenueOverlay';

/*
 * Top-down projection of the same VenueLayout the 3D scene is built from:
 * world X stays X, world Z becomes SVG Y. Stage at the top, audience below.
 */

type Box = { x: number; y: number; w: number; h: number };

const SPOT = '#ffe2a8';
const ELECTRIC = '#3d7bff';
const SEAT = { available: '#2fa86b', held: '#e8a23a', sold: '#4a4e62' } as const;
const SOLD_OUT = '#4a4d60';
const CLICK_SLOP = 6;
const MIN_WIDTH = 8;

const polar = (origin: Vec3, angle: number, radius: number): [number, number] => [
  origin[0] + Math.sin(angle) * radius,
  origin[2] + Math.cos(angle) * radius
];

/** Annular sector as SVG arcs; angles grow from +Z towards +X, which runs counter-clockwise on screen. */
function sectorPath(t: TierGeometry) {
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

function boxOf(points: [number, number][], pad: number): Box {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

function stageBox(layout: VenueLayout): Box {
  const { width, depth, center } = layout.stage;
  return { x: center[0] - width / 2, y: center[2] - depth / 2, w: width, h: depth };
}

/** Where a zone's one-line label sits: in the aisle behind a tier, or inside a standing floor. */
function labelAnchor(z: ZoneGeometry): { x: number; y: number; anchor: 'middle' | 'start' } {
  if (z.kind === 'pit') return { x: z.center[0] - z.width / 2 + 0.6, y: z.center[2], anchor: 'start' };
  const mid = (z.startAngle + z.endAngle) / 2;
  const [x, y] = polar(z.origin, mid, z.outerRadius + 0.72);
  return { x, y, anchor: 'middle' };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------------------
// Seat dots: memoised apart from hover state, so pointer moves do not redraw hundreds of circles.
// ---------------------------------------------------------------------------

interface SeatDotsProps {
  placements: SeatPlacement[];
  seatsById: Map<string, SeatItem>;
  activeZoneId: string | null;
  onPick: (seat: SeatItem) => void;
  onHover: (seat: SeatItem | null) => void;
}

const SeatDots = memo<SeatDotsProps>(({ placements, seatsById, activeZoneId, onPick, onHover }) => (
  <g>
    {placements.map(p => {
      const seat = seatsById.get(p.seatId);
      if (!seat) return null;
      const [x, , y] = p.position;
      const dim = activeZoneId !== null && seat.zoneId !== activeZoneId;
      const common = {
        onClick: () => onPick(seat),
        onPointerEnter: () => onHover(seat),
        onPointerLeave: () => onHover(null),
        style: { cursor: 'pointer', opacity: dim ? 0.35 : 1 }
      };
      if (seat.status === 'selected') {
        return (
          <g key={p.seatId} {...common}>
            <circle cx={x} cy={y} r={0.5} fill="none" stroke={SPOT} strokeWidth={0.1} />
            <circle cx={x} cy={y} r={0.32} fill={SPOT} />
          </g>
        );
      }
      if (seat.status === 'sold') return <circle key={p.seatId} cx={x} cy={y} r={0.17} fill={SEAT.sold} {...common} />;
      return (
        <circle
          key={p.seatId}
          cx={x}
          cy={y}
          r={0.3}
          fill={seat.status === 'held' ? 'url(#fp-hatch)' : SEAT.available}
          {...common}
        />
      );
    })}
  </g>
));

// ---------------------------------------------------------------------------
// Floor plan
// ---------------------------------------------------------------------------

export interface FloorPlan2DProps {
  layout: VenueLayout;
  zones: ZoneSummary[];
  seats: SeatItem[];
  activeZoneId: string | null;
  reducedMotion: boolean;
  onZoneSelect: (zoneId: string | null) => void;
  onSeatClick: (seat: SeatItem) => void;
  /** Category hovered in the side panel, lit up here as well. */
  highlightZoneId: string | null;
}

export const FloorPlan2D: React.FC<FloorPlan2DProps> = ({
  layout,
  zones,
  seats,
  activeZoneId,
  reducedMotion,
  onZoneSelect,
  onSeatClick,
  highlightZoneId
}) => {
  const zoneById = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones]);
  const seatsById = useMemo(() => new Map(seats.map(s => [s.id, s])), [seats]);
  const stats = useMemo(() => zoneStats(seats), [seats]);

  const stage = stageBox(layout);
  const overview = useMemo(() => {
    const pts: [number, number][] = [
      [stage.x, stage.y],
      [stage.x + stage.w, stage.y + stage.h]
    ];
    layout.zones.forEach(z => pts.push(...zonePoints(z)));
    return boxOf(pts, 2.4);
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusBox = useMemo(() => {
    const zone = activeZoneId ? layout.zones.find(z => z.zoneId === activeZoneId) : undefined;
    if (!zone) return overview;
    const b = boxOf(zonePoints(zone), 2.5);
    // Small zones get a minimum frame so they never fill the whole view.
    const w = Math.max(b.w, 14);
    const h = Math.max(b.h, 9);
    return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
  }, [activeZoneId, layout, overview]);

  // --- view box, animated between overview and zone focus -------------------
  const [view, setView] = useState<Box>(overview);
  const viewRef = useRef(view);
  viewRef.current = view;
  const raf = useRef(0);

  const animateTo = useCallback(
    (target: Box) => {
      cancelAnimationFrame(raf.current);
      if (reducedMotion) {
        setView(target);
        return;
      }
      const from = viewRef.current;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 500);
        const k = ease(t);
        setView({
          x: from.x + (target.x - from.x) * k,
          y: from.y + (target.y - from.y) * k,
          w: from.w + (target.w - from.w) * k,
          h: from.h + (target.h - from.h) * k
        });
        if (t < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [reducedMotion]
  );

  useEffect(() => {
    animateTo(focusBox);
  }, [focusBox, animateTo]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // --- zoom and pan -----------------------------------------------------------
  const svgRef = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => setFrame({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      cancelAnimationFrame(raf.current);
      const v = viewRef.current;
      const w = Math.min(overview.w * 1.6, Math.max(MIN_WIDTH, v.w * factor));
      const k = w / v.w;
      setView({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w, h: v.h * k });
    },
    [overview.w]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toWorld(e.clientX, e.clientY);
      zoomAt(Math.exp(e.deltaY * 0.0015), p.x, p.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinch?: number }>({ moved: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { moved: 0 };
    cancelAnimationFrame(raf.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const v = viewRef.current;
    const scale = Math.min(rect.width / v.w, rect.height / v.h);

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = Array.from(pointers.current.values());
      const after = Math.hypot(c.x - d.x, c.y - d.y);
      const mid = toWorld((c.x + d.x) / 2, (c.y + d.y) / 2);
      if (before > 0 && after > 0) zoomAt(before / after, mid.x, mid.y);
      gesture.current.moved += CLICK_SLOP + 1;
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved <= CLICK_SLOP) return;
    // Capture only once it is a drag, so plain clicks still reach the section or seat underneath.
    if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
    setView({ ...v, x: v.x - dx / scale, y: v.y - dy / scale });
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  const dragged = () => gesture.current.moved > CLICK_SLOP;

  // --- hover and picking ------------------------------------------------------
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [hoverSeat, setHoverSeat] = useState<SeatItem | null>(null);

  const pickZone = (zoneId: string) => {
    if (!dragged()) onZoneSelect(zoneId);
  };
  const pickSeat = useCallback(
    (seat: SeatItem) => {
      if (gesture.current.moved > CLICK_SLOP) return;
      // Outside the zone in focus, a tap picks the zone first so stray taps never hold a seat.
      if (seat.zoneId !== activeZoneId) onZoneSelect(seat.zoneId);
      else onSeatClick(seat);
    },
    [activeZoneId, onZoneSelect, onSeatClick]
  );
  const hoverOnSeat = useCallback((seat: SeatItem | null) => {
    setHoverSeat(seat);
    if (seat) setHoverZoneId(seat.zoneId);
  }, []);

  const hoveredZoneId = hoverZoneId ?? highlightZoneId;
  const infoZoneId = hoveredZoneId ?? activeZoneId;
  const infoZone = infoZoneId ? zoneById.get(infoZoneId) ?? null : null;
  const infoSeat = hoverSeat && hoverSeat.zoneId === activeZoneId ? seatsById.get(hoverSeat.id) ?? hoverSeat : null;
  // Map units to screen pixels, matching preserveAspectRatio="xMidYMid meet".
  const pxPerUnit = frame.width > 0 ? Math.min(frame.width / view.w, frame.height / view.h) : 12;
  // Small maps (phones, zoomed out) get smaller labels without prices; the legend still lists them.
  const labelSize = Math.max(9, Math.min(12, pxPerUnit * 0.95));
  const showPrice = pxPerUnit >= 9;
  const toScreen = (x: number, y: number) => ({
    x: (frame.width - view.w * pxPerUnit) / 2 + (x - view.x) * pxPerUnit,
    y: (frame.height - view.h * pxPerUnit) / 2 + (y - view.y) * pxPerUnit
  });

  return (
    <div className="relative size-full select-none">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        className="size-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => {
          setHoverZoneId(null);
          setHoverSeat(null);
        }}
      >
        <defs>
          <pattern id="fp-hatch" width="0.4" height="0.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="0.4" height="0.4" fill={SEAT.held} />
            <rect width="0.14" height="0.4" fill="rgba(40,24,0,0.55)" />
          </pattern>
          <pattern id="fp-crowd" width="0.7" height="0.7" patternUnits="userSpaceOnUse">
            <circle cx="0.35" cy="0.35" r="0.09" fill="rgba(255,255,255,0.35)" />
          </pattern>
          <pattern id="fp-grid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M4 0H0V4" fill="none" stroke="rgba(120,130,200,0.08)" strokeWidth="0.05" />
          </pattern>
          <linearGradient id="fp-led" x1="0" x2="1">
            <stop offset="0" stopColor="#3d7bff" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#e040a0" />
          </linearGradient>
        </defs>

        <rect x={overview.x - overview.w} y={overview.y - overview.h} width={overview.w * 3} height={overview.h * 3} fill="url(#fp-grid)" />

        {/* Stage: deck, LED wall along the back, lit edge facing the audience. */}
        <rect x={stage.x} y={stage.y} width={stage.w} height={stage.h} rx={0.3} fill="#1b1f40" />
        <rect x={stage.x + stage.w * 0.1} y={stage.y + 0.15} width={stage.w * 0.8} height={0.3} fill="url(#fp-led)" />
        <line x1={stage.x} y1={stage.y + stage.h} x2={stage.x + stage.w} y2={stage.y + stage.h} stroke={ELECTRIC} strokeWidth={0.12} />

        {layout.zones.map(z => {
          const zone = zoneById.get(z.zoneId);
          if (!zone) return null;
          const active = z.zoneId === activeZoneId;
          const hover = z.zoneId === hoveredZoneId;
          const dim = activeZoneId !== null && !active;
          const soldOut = zone.available === 0;
          const tint = soldOut ? SOLD_OUT : zone.color;
          const fillOpacity = active ? 0.5 : hover ? 0.45 : dim ? 0.12 : 0.3;
          const stroke = active ? SPOT : tint;
          const strokeWidth = active ? 0.18 : hover ? 0.14 : 0.08;
          const handlers = {
            onClick: () => pickZone(z.zoneId),
            onPointerEnter: () => setHoverZoneId(z.zoneId),
            onPointerLeave: () => setHoverZoneId(id => (id === z.zoneId ? null : id)),
            style: { cursor: 'pointer' }
          };
          if (z.kind === 'pit') {
            const x = z.center[0] - z.width / 2;
            const y = z.center[2] - z.depth / 2;
            return (
              <g key={z.zoneId} {...handlers}>
                <rect x={x} y={y} width={z.width} height={z.depth} rx={0.2} fill={tint} fillOpacity={fillOpacity} />
                <rect x={x} y={y} width={z.width} height={z.depth} rx={0.2} fill="url(#fp-crowd)" opacity={dim ? 0.3 : 0.8} />
                <rect x={x} y={y} width={z.width} height={z.depth} rx={0.2} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={dim ? 0.4 : 1} />
              </g>
            );
          }
          return (
            <path
              key={z.zoneId}
              d={sectorPath(z)}
              fill={tint}
              fillOpacity={fillOpacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeOpacity={dim ? 0.4 : 1}
              {...handlers}
            />
          );
        })}

        <SeatDots placements={layout.seats} seatsById={seatsById} activeZoneId={activeZoneId} onPick={pickSeat} onHover={hoverOnSeat} />

      </svg>

      {/*
        Text lives in a second, unscaled layer: Chrome squashes glyphs drawn at a fraction of a
        map unit and scaled up. Positions are projected from map units to screen pixels.
      */}
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
        <text
          {...toScreen(stage.x + stage.w / 2, stage.y + stage.h / 2)}
          dy="0.35em"
          textAnchor="middle"
          fontSize={13}
          className="fill-[#c9cdf5] font-display font-semibold [font-stretch:120%]"
        >
          Sân khấu
        </text>
        {layout.zones.map(z => {
          const zone = zoneById.get(z.zoneId);
          if (!zone) return null;
          const { x, y, anchor } = labelAnchor(z);
          const dim = activeZoneId !== null && z.zoneId !== activeZoneId;
          return (
            <text
              key={z.zoneId}
              {...toScreen(x, y)}
              dy="0.35em"
              textAnchor={anchor}
              fontSize={labelSize}
              opacity={dim ? 0.45 : 1}
              paintOrder="stroke"
              stroke="#0b0e26"
              strokeWidth={3.5}
              strokeLinejoin="round"
              className="fill-[#e7e9f5] font-medium"
            >
              {zone.shortName}
              {showPrice && (
              <tspan dx={6} className="font-display font-bold [font-stretch:75%]" fill={zone.available === 0 ? '#a5abcf' : zone.color}>
                {zone.available === 0 ? 'Hết vé' : formatPriceShort(zone.priceFrom)}
              </tspan>
              )}
            </text>
          );
        })}
      </svg>

      <div className="absolute top-3 right-3 flex flex-col gap-1 sm:top-4 sm:right-4">
        {(
          [
            ['Phóng to', Plus, () => zoomAt(0.7, view.x + view.w / 2, view.y + view.h / 2)],
            ['Thu nhỏ', Minus, () => zoomAt(1 / 0.7, view.x + view.w / 2, view.y + view.h / 2)],
            ['Vừa khung', Scan, () => animateTo(focusBox)]
          ] as const
        ).map(([label, Icon, action]) => (
          <button
            key={label}
            type="button"
            onClick={action}
            aria-label={label}
            title={label}
            className="grid size-10 place-items-center rounded-lg bg-[#0f1330]/88 text-stage-ink ring-1 ring-stage-line backdrop-blur-md transition-colors hover:bg-stage-raised"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      <VenueOverlay
        mode="2d"
        zone={infoZone}
        isActive={!!infoZone && infoZone.id === activeZoneId}
        seat={infoSeat}
        held={infoZone ? stats.heldByZone.get(infoZone.id) ?? 0 : 0}
        priceRange={infoZone ? stats.priceRange.get(infoZone.id) ?? null : null}
        canGoBack={!!activeZoneId}
        onBack={() => onZoneSelect(null)}
      />
    </div>
  );
};
