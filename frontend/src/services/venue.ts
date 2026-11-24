import { LayoutStyle, SeatItem, StageLayoutConfig, StageShape, StageTheme, TicketTier, ZoneKind } from '../types';

export function isStandingZoneName(name: string): boolean {
  return name.toLocaleLowerCase('vi').includes('đứng');
}

export function zoneKindOf(name: string): ZoneKind {
  return isStandingZoneName(name) ? 'standing' : 'seated';
}

/** Gel ramp from the most to the least expensive zone; every step keeps ≥3:1 on the stage colour. */
export const PRICE_BAND_COLORS = ['#f2c982', '#f4a782', '#e38c95', '#c37aac', '#9470b9', '#5a6bb5'] as const;

export interface StageThemePalette {
  label: string;
  edge: string;
  ledStops: [string, string, string];
  beamColors: [string, string, string];
  glow: string;
}

export const STAGE_THEMES: Record<StageTheme, StageThemePalette> = {
  electric: {
    label: 'Electric Neon',
    edge: '#3d7bff',
    ledStops: ['#3d7bff', '#8b5cf6', '#e040a0'],
    beamColors: ['#3d7bff', '#e040a0', '#8b5cf6'],
    glow: '#8b5cf6'
  },
  sunset: {
    label: 'Festival Sunset',
    edge: '#fb923c',
    ledStops: ['#f97316', '#ec4899', '#facc15'],
    beamColors: ['#fb923c', '#f43f5e', '#facc15'],
    glow: '#f97316'
  },
  emerald: {
    label: 'Cyber Emerald',
    edge: '#10b981',
    ledStops: ['#06b6d4', '#10b981', '#3b82f6'],
    beamColors: ['#10b981', '#06b6d4', '#60a5fa'],
    glow: '#10b981'
  },
  gold: {
    label: 'Royal Gala Gold',
    edge: '#f59e0b',
    ledStops: ['#f59e0b', '#fde68a', '#d97706'],
    beamColors: ['#f59e0b', '#fde68a', '#a78bfa'],
    glow: '#f59e0b'
  }
};

export interface NormalizedLayoutConfig {
  stageShape: StageShape;
  layoutStyle: LayoutStyle;
  stageTheme: StageTheme;
  stageLabel: string;
  stageWidth: number;
  stageDepth: number;
  stageHeight: number;
  catwalkLength: number;
  catwalkWidth: number;
  tierSpanDeg: number;
  zonesPerRing: number;
  pitWidth: number;
  pitDepth: number;
  zoneStyles: Record<string, { color?: string; rows?: number; seatsPerRow?: number }>;
}

const clamp = (val: number | undefined, min: number, max: number, fallback: number): number => {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return fallback;
  return Math.max(min, Math.min(max, val));
};

export function normalizeLayoutConfig(cfg?: StageLayoutConfig | null): NormalizedLayoutConfig {
  const stageShape: StageShape =
    cfg?.stageShape === 'thrust' || cfg?.stageShape === 'catwalk' || cfg?.stageShape === 'center'
      ? cfg.stageShape
      : 'standard';

  const layoutStyle: LayoutStyle =
    cfg?.layoutStyle === 'theater' || cfg?.layoutStyle === 'amphitheater' || cfg?.layoutStyle === 'arena360'
      ? cfg.layoutStyle
      : 'horseshoe';

  const stageTheme: StageTheme =
    cfg?.stageTheme === 'sunset' || cfg?.stageTheme === 'emerald' || cfg?.stageTheme === 'gold'
      ? cfg.stageTheme
      : 'electric';

  let defaultSpan = 150;
  let defaultPerRing = 3;
  if (layoutStyle === 'theater') {
    defaultSpan = 92;
    defaultPerRing = 2;
  } else if (layoutStyle === 'amphitheater') {
    defaultSpan = 198;
    defaultPerRing = 4;
  } else if (layoutStyle === 'arena360') {
    defaultSpan = 310;
    defaultPerRing = 4;
  }
  if (stageShape === 'center' && !cfg?.tierSpanDeg) {
    defaultSpan = 310;
  }

  return {
    stageShape,
    layoutStyle,
    stageTheme,
    stageLabel: cfg?.stageLabel?.trim() || 'SÂN KHẤU',
    stageWidth: clamp(cfg?.stageWidth, 8, 26, stageShape === 'center' ? 10 : 16),
    stageDepth: clamp(cfg?.stageDepth, 4, 14, stageShape === 'center' ? 10 : 6),
    stageHeight: clamp(cfg?.stageHeight, 0.8, 2.4, 1.2),
    catwalkLength: stageShape === 'thrust' || stageShape === 'catwalk' ? clamp(cfg?.catwalkLength, 3.5, 14, 7.5) : 0,
    catwalkWidth: stageShape === 'thrust' || stageShape === 'catwalk' ? clamp(cfg?.catwalkWidth, 2.4, 6, 3.4) : 0,
    tierSpanDeg: clamp(cfg?.tierSpanDeg, 70, 320, defaultSpan),
    zonesPerRing: Math.round(clamp(cfg?.zonesPerRing, 1, 5, defaultPerRing)),
    pitWidth: clamp(cfg?.pitWidth, 10, 26, 18),
    pitDepth: clamp(cfg?.pitDepth, 2.4, 6, 3.4),
    zoneStyles: cfg?.zoneStyles ?? {}
  };
}

export interface ZoneSummary {
  id: string;
  code: string;
  name: string;
  /** Name without the "(ghế ngồi)" style suffix, for tight places such as 3D labels. */
  shortName: string;
  kind: ZoneKind;
  /** List price of the zone; seats may carry a different live price. */
  basePrice: number;
  /** Lowest live seat price in the zone, when seats are loaded. */
  priceFrom: number;
  capacity: number;
  available: number;
  /** 0 = most expensive. */
  rank: number;
  band: number;
  color: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Zones sorted by price (dearest first), with live availability from the seat list. */
export function summarizeZones(
  tiers: TicketTier[],
  seats: SeatItem[],
  layoutConfig?: StageLayoutConfig | null
): ZoneSummary[] {
  const seatsByZone = new Map<string, SeatItem[]>();
  for (const seat of seats) {
    const list = seatsByZone.get(seat.zoneId);
    if (list) list.push(seat);
    else seatsByZone.set(seat.zoneId, [seat]);
  }

  const ordered = tiers
    .map((tier, apiIndex) => ({ tier, apiIndex }))
    .sort((a, b) => b.tier.price - a.tier.price || a.apiIndex - b.apiIndex);

  const lastRank = Math.max(1, ordered.length - 1);
  const shortOf = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
  const shortCounts = new Map<string, number>();
  for (const { tier } of ordered) shortCounts.set(shortOf(tier.name), (shortCounts.get(shortOf(tier.name)) ?? 0) + 1);
  const zoneStyles = layoutConfig?.zoneStyles ?? {};

  return ordered.map(({ tier }, rank) => {
    const zoneSeats = seatsByZone.get(tier.id) ?? [];
    const open = zoneSeats.filter(s => s.status === 'available');
    const band = Math.round((rank / lastRank) * (PRICE_BAND_COLORS.length - 1));
    const codeKey = (tier.code ?? '').toUpperCase();
    const customColor = zoneStyles[codeKey]?.color ?? zoneStyles[tier.code ?? '']?.color;
    const color = customColor && HEX_COLOR.test(customColor) ? customColor : PRICE_BAND_COLORS[band];
    const kind = tier.kind ?? zoneKindOf(tier.name);

    return {
      id: tier.id,
      code: tier.code ?? '',
      name: tier.name,
      shortName:
        (shortCounts.get(shortOf(tier.name)) ?? 0) > 1
          ? `${shortOf(tier.name)} ${kind === 'standing' ? 'đứng' : 'ngồi'}`
          : shortOf(tier.name),
      kind,
      basePrice: tier.price,
      priceFrom: open.length > 0 ? Math.min(...open.map(s => s.price)) : tier.price,
      capacity: tier.capacity ?? zoneSeats.length,
      available: zoneSeats.length > 0 ? open.length : tier.available,
      rank,
      band,
      color
    };
  });
}

/** What a ticket shows: the seat code for seats, the zone for standing areas. */
export function ticketLabelOf(seat: SeatItem, kind: ZoneKind): string {
  return kind === 'standing' ? `${seat.zoneName} · Vé đứng` : seat.label;
}

// ---------------------------------------------------------------------------
// Venue geometry (supports custom stage shapes, runways, 360° center stages,
// and organizer-configured seating arcs/rings).
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

export interface StageRunwayGeometry {
  width: number;
  length: number;
  /** Optional wider T-head B-stage at the audience end of a thrust stage. */
  tipWidth?: number;
  tipDepth?: number;
}

export interface StageGeometry {
  width: number;
  depth: number;
  height: number;
  center: Vec3;
  shape: StageShape;
  label: string;
  theme: StageTheme;
  runway?: StageRunwayGeometry;
}

export interface PitGeometry {
  kind: 'pit';
  zoneId: string;
  center: Vec3;
  width: number;
  depth: number;
}

export interface TierGeometry {
  kind: 'tier';
  zoneId: string;
  /** Polar origin shared by every tier: front edge of main stage, or center for 360° stage. */
  origin: Vec3;
  innerRadius: number;
  outerRadius: number;
  /** Angles in radians, measured from +Z towards +X. */
  startAngle: number;
  endAngle: number;
  baseHeight: number;
  rise: number;
  center: Vec3;
}

export type ZoneGeometry = PitGeometry | TierGeometry;

export interface SeatPlacement {
  seatId: string;
  zoneId: string;
  position: Vec3;
  /** Seats face the stage. */
  rotationY: number;
}

export interface VenueLayout {
  stage: StageGeometry;
  zones: ZoneGeometry[];
  seats: SeatPlacement[];
  /** Radius that encloses the whole venue, for camera framing. */
  extent: number;
}

const PIT_GAP = 0.65;
const TIER_GAP_ANGLE = (3 * Math.PI) / 180;
export const ROW_DEPTH = 0.95;
export const ROW_RISE = 0.4;
const RING_GAP = 1.4;
const RING_LIFT = 1.1;

export function stageFootprintPoints(stage: StageGeometry): [number, number][] {
  const [cx, , cz] = stage.center;
  const frontZ = cz + stage.depth / 2;
  const pts: [number, number][] = [
    [cx - stage.width / 2, cz - stage.depth / 2],
    [cx + stage.width / 2, frontZ]
  ];
  if (stage.runway) {
    const rEndZ = frontZ + stage.runway.length;
    pts.push([cx - stage.runway.width / 2, frontZ], [cx + stage.runway.width / 2, rEndZ]);
    if (stage.runway.tipWidth && stage.runway.tipDepth) {
      pts.push(
        [cx - stage.runway.tipWidth / 2, rEndZ],
        [cx + stage.runway.tipWidth / 2, rEndZ + stage.runway.tipDepth]
      );
    }
  }
  return pts;
}

function groupRows(seats: SeatItem[]): SeatItem[][] {
  const rows = new Map<string, SeatItem[]>();
  for (const seat of seats) {
    const key = seat.row || '';
    const list = rows.get(key);
    if (list) list.push(seat);
    else rows.set(key, [seat]);
  }
  return Array.from(rows.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, list]) => list.sort((a, b) => a.number - b.number));
}

export function buildVenueLayout(
  zones: ZoneSummary[],
  seats: SeatItem[],
  layoutConfig?: StageLayoutConfig | null
): VenueLayout {
  const cfg = normalizeLayoutConfig(layoutConfig);
  const seatsByZone = new Map<string, SeatItem[]>();
  for (const seat of seats) {
    const list = seatsByZone.get(seat.zoneId);
    if (list) list.push(seat);
    else seatsByZone.set(seat.zoneId, [seat]);
  }

  const isCenter = cfg.stageShape === 'center';
  const stageWidth = isCenter ? Math.min(cfg.stageWidth, 14) : cfg.stageWidth;
  const stageDepth = isCenter ? Math.min(Math.max(cfg.stageDepth, 7), 14) : cfg.stageDepth;
  const stageCenter: Vec3 = isCenter ? [0, cfg.stageHeight / 2, 0] : [0, cfg.stageHeight / 2, -14];
  const stageFrontZ = stageCenter[2] + stageDepth / 2;

  let runway: StageRunwayGeometry | undefined;
  if (cfg.stageShape === 'catwalk') {
    runway = {
      width: cfg.catwalkWidth,
      length: cfg.catwalkLength
    };
  } else if (cfg.stageShape === 'thrust') {
    runway = {
      width: cfg.catwalkWidth,
      length: cfg.catwalkLength,
      tipWidth: Math.min(stageWidth * 0.72, Math.max(cfg.catwalkWidth * 2.2, 7.6)),
      tipDepth: 2.9
    };
  }

  const stage: StageGeometry = {
    width: stageWidth,
    depth: stageDepth,
    height: cfg.stageHeight,
    center: stageCenter,
    shape: cfg.stageShape,
    label: cfg.stageLabel,
    theme: cfg.stageTheme,
    runway
  };

  const geometries: ZoneGeometry[] = [];
  const placements: SeatPlacement[] = [];
  const pits = zones.filter(z => z.kind === 'standing');
  const origin: Vec3 = isCenter ? [0, 0, 0] : [0, 0, stageFrontZ];

  // Track furthest corner distance from polar origin so seated tiers never clip pits or runway.
  let maxReach = isCenter ? Math.hypot(stageWidth / 2, stageDepth / 2) + 1.5 : 0;

  if (runway) {
    const totalRunwayLen = runway.length + (runway.tipDepth ?? 0);
    const tipHalfW = (runway.tipWidth ?? runway.width) / 2;
    maxReach = Math.max(maxReach, Math.hypot(tipHalfW, totalRunwayLen) + 1.0);
  }

  const registerPit = (zoneId: string, cx: number, cz: number, w: number, d: number) => {
    geometries.push({ kind: 'pit', zoneId, center: [cx, 0.02, cz], width: w, depth: d });
    const corners: [number, number][] = [
      [cx - w / 2, cz - d / 2],
      [cx + w / 2, cz - d / 2],
      [cx - w / 2, cz + d / 2],
      [cx + w / 2, cz + d / 2]
    ];
    for (const [px, pz] of corners) {
      maxReach = Math.max(maxReach, Math.hypot(px - origin[0], pz - origin[2]));
    }
  };

  if (isCenter) {
    // Arrange standing pits around the four flanks of the center island stage.
    const gap = 0.9;
    const pDepth = Math.min(cfg.pitDepth, 3.6);
    pits.forEach((zone, i) => {
      const slot = i % 4;
      const ringOffset = Math.floor(i / 4) * (pDepth + PIT_GAP);
      if (slot === 0) {
        registerPit(zone.id, 0, stageDepth / 2 + gap + pDepth / 2 + ringOffset, stageWidth * 0.95, pDepth);
      } else if (slot === 1) {
        registerPit(zone.id, -(stageWidth / 2 + gap + pDepth / 2 + ringOffset), 0, pDepth, stageDepth * 0.95);
      } else if (slot === 2) {
        registerPit(zone.id, stageWidth / 2 + gap + pDepth / 2 + ringOffset, 0, pDepth, stageDepth * 0.95);
      } else {
        registerPit(zone.id, 0, -(stageDepth / 2 + gap + pDepth / 2 + ringOffset), stageWidth * 0.95, pDepth);
      }
    });
  } else if (runway && pits.length > 0) {
    // Flank pairs of pits neatly along left/right of the runway; remaining pits sit in front of the runway tip.
    const sideGap = 0.7;
    const sideW = Math.max(4.6, (cfg.pitWidth - runway.width) / 2 - sideGap);
    const stemDepth = Math.max(2.2, runway.length - PIT_GAP * 2);
    const maxFlankRows = Math.max(1, Math.floor((runway.length + 0.2) / (Math.min(cfg.pitDepth, stemDepth) + PIT_GAP)));
    const flankCapacity = maxFlankRows * 2;
    const flankDepth = Math.min(cfg.pitDepth, (runway.length - (maxFlankRows + 1) * PIT_GAP) / maxFlankRows);
    const usableFlankDepth = Math.max(2.1, flankDepth);

    const runwayEndZ = stageFrontZ + runway.length + (runway.tipDepth ?? 0);
    let frontRow = 0;

    if (pits.length === 1) {
      registerPit(pits[0].id, 0, runwayEndZ + PIT_GAP + cfg.pitDepth / 2, cfg.pitWidth, cfg.pitDepth);
    } else {
      pits.forEach((zone, idx) => {
        if (idx < flankCapacity) {
          const row = Math.floor(idx / 2);
          const sign = idx % 2 === 0 ? -1 : 1;
          const cx = sign * (runway.width / 2 + sideGap + sideW / 2);
          const cz = stageFrontZ + PIT_GAP + usableFlankDepth / 2 + row * (usableFlankDepth + PIT_GAP);
          registerPit(zone.id, cx, cz, sideW, usableFlankDepth);
        } else {
          const cz = runwayEndZ + PIT_GAP + cfg.pitDepth / 2 + frontRow * (cfg.pitDepth + PIT_GAP);
          frontRow++;
          registerPit(zone.id, 0, cz, cfg.pitWidth, cfg.pitDepth);
        }
      });
    }
  } else {
    pits.forEach((zone, i) => {
      const cz = stageFrontZ + PIT_GAP + cfg.pitDepth / 2 + i * (cfg.pitDepth + PIT_GAP);
      registerPit(zone.id, 0, cz, cfg.pitWidth, cfg.pitDepth);
    });
  }

  let innerRadius = Math.max(isCenter ? 7.5 : 9, maxReach + 2.0);
  const tierSpan = (cfg.tierSpanDeg * Math.PI) / 180;
  const zonesPerRing = cfg.zonesPerRing;

  const seated = zones.filter(z => z.kind === 'seated');
  for (let ring = 0; ring * zonesPerRing < seated.length; ring++) {
    const ringZones = seated.slice(ring * zonesPerRing, (ring + 1) * zonesPerRing);
    const rowCounts = ringZones.map(z => Math.max(1, groupRows(seatsByZone.get(z.id) ?? []).length));
    const ringDepth = Math.max(...rowCounts) * ROW_DEPTH + 0.8;
    const baseHeight = 0.3 + ring * RING_LIFT;
    const slice = tierSpan / ringZones.length;

    ringZones.forEach((zone, i) => {
      const startAngle = -tierSpan / 2 + i * slice + TIER_GAP_ANGLE / 2;
      const endAngle = startAngle + slice - TIER_GAP_ANGLE;
      const mid = (startAngle + endAngle) / 2;
      const rows = groupRows(seatsByZone.get(zone.id) ?? []);
      const rise = Math.max(1, rows.length) * ROW_RISE;
      const midRadius = innerRadius + ringDepth / 2;
      geometries.push({
        kind: 'tier',
        zoneId: zone.id,
        origin,
        innerRadius,
        outerRadius: innerRadius + ringDepth,
        startAngle,
        endAngle,
        baseHeight,
        rise,
        center: [origin[0] + Math.sin(mid) * midRadius, baseHeight + rise / 2, origin[2] + Math.cos(mid) * midRadius]
      });

      rows.forEach((row, rowIndex) => {
        const radius = innerRadius + 0.6 + rowIndex * ROW_DEPTH;
        const y = baseHeight + (rowIndex + 1) * ROW_RISE;
        const margin = 0.06 * (endAngle - startAngle);
        row.forEach((seat, seatIndex) => {
          const t = row.length === 1 ? 0.5 : seatIndex / (row.length - 1);
          const angle = startAngle + margin + t * (endAngle - startAngle - 2 * margin);
          placements.push({
            seatId: seat.id,
            zoneId: zone.id,
            position: [origin[0] + Math.sin(angle) * radius, y, origin[2] + Math.cos(angle) * radius],
            rotationY: angle + Math.PI
          });
        });
      });
    });

    innerRadius += ringDepth + RING_GAP;
  }

  return {
    stage,
    zones: geometries,
    seats: placements,
    extent: Math.max(innerRadius, maxReach) + 2
  };
}

// ---------------------------------------------------------------------------
// Shared per-zone figures and the view-from-seat camera, used by both 2D and 3D
// ---------------------------------------------------------------------------

export interface ZoneStats {
  /** Cheapest and dearest live seat price in the zone. */
  priceRange: Map<string, [number, number]>;
  /** Seats the current user holds, per zone. */
  heldByZone: Map<string, number>;
}

export function zoneStats(seats: SeatItem[]): ZoneStats {
  const priceRange = new Map<string, [number, number]>();
  const heldByZone = new Map<string, number>();
  for (const s of seats) {
    const r = priceRange.get(s.zoneId);
    priceRange.set(s.zoneId, r ? [Math.min(r[0], s.price), Math.max(r[1], s.price)] : [s.price, s.price]);
    if (s.status === 'selected') heldByZone.set(s.zoneId, (heldByZone.get(s.zoneId) ?? 0) + 1);
  }
  return { priceRange, heldByZone };
}

/** Eye height above the tread for a seated adult, and above the floor plate for a standing one. */
const SEATED_EYE = 1.15;
const STANDING_EYE = 1.62;
const PIT_FLOOR = 0.22;

export interface PovView {
  zoneId: string;
  /** Set when the view is taken from one seat of the illustrative layout. */
  seatId?: string;
  eye: Vec3;
  lookAt: Vec3;
  standing: boolean;
}

/**
 * Camera for "view from seat". Every view comes from the illustrative layout, so it is
 * an estimate either way: from one seat's place on the map, or, without a seat, from
 * the middle of the zone (the middle of the floor for standing areas).
 */
export function povFor(layout: VenueLayout, zoneId: string, seatId?: string): PovView | null {
  const zone = layout.zones.find(z => z.zoneId === zoneId);
  if (!zone) return null;
  const { center, height } = layout.stage;
  const lookAt: Vec3 = [center[0], height + 2.2, center[2]];

  if (zone.kind === 'pit') {
    return { zoneId, eye: [zone.center[0], PIT_FLOOR + STANDING_EYE, zone.center[2]], lookAt, standing: true };
  }

  const seat = seatId ? layout.seats.find(p => p.seatId === seatId && p.zoneId === zoneId) : undefined;
  if (seat) {
    return { zoneId, seatId, eye: [seat.position[0], seat.position[1] + SEATED_EYE, seat.position[2]], lookAt, standing: false };
  }

  const rows = Math.max(1, Math.round(zone.rise / ROW_RISE));
  const row = Math.floor((rows - 1) / 2);
  const mid = (zone.startAngle + zone.endAngle) / 2;
  const radius = zone.innerRadius + 0.6 + row * ROW_DEPTH;
  const tread = zone.baseHeight + (row + 1) * ROW_RISE;
  return {
    zoneId,
    eye: [zone.origin[0] + Math.sin(mid) * radius, tread + SEATED_EYE, zone.origin[2] + Math.cos(mid) * radius],
    lookAt,
    standing: false
  };
}
