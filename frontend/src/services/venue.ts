import { PriceTrend, SeatItem, TicketTier, ZoneKind } from '../types';

/**
 * The backend has no zone type yet; standing areas are only named as such
 * ("GA 1 (đứng)", "CAT 1 (khu đứng)", "Đứng - Mứt Gừng 1, 2").
 * Replace this with the API field once `venue_zones` gains one.
 */
export function isStandingZoneName(name: string): boolean {
  return name.toLocaleLowerCase('vi').includes('đứng');
}

export function zoneKindOf(name: string): ZoneKind {
  return isStandingZoneName(name) ? 'standing' : 'seated';
}

/** Gel ramp from the most to the least expensive zone; every step keeps ≥3:1 on the stage colour. */
export const PRICE_BAND_COLORS = ['#f2c982', '#f4a782', '#e38c95', '#c37aac', '#9470b9', '#5a6bb5'] as const;

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
  /** Latest price change of the zone, if any. */
  trend?: PriceTrend;
}

/** Zones sorted by price (dearest first), with live availability from the seat list. */
export function summarizeZones(tiers: TicketTier[], seats: SeatItem[], liveTrends: Record<string, PriceTrend> = {}): ZoneSummary[] {
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

  return ordered.map(({ tier }, rank) => {
    const zoneSeats = seatsByZone.get(tier.id) ?? [];
    const open = zoneSeats.filter(s => s.status === 'available');
    const band = Math.round((rank / lastRank) * (PRICE_BAND_COLORS.length - 1));
    return {
      id: tier.id,
      code: tier.code ?? '',
      name: tier.name,
      // "CAT 1 (ghế ngồi)" and "CAT 1 (khu đứng)" would both shorten to "CAT 1", so keep the kind there.
      shortName:
        (shortCounts.get(shortOf(tier.name)) ?? 0) > 1
          ? `${shortOf(tier.name)} ${(tier.kind ?? zoneKindOf(tier.name)) === 'standing' ? 'đứng' : 'ngồi'}`
          : shortOf(tier.name),
      kind: tier.kind ?? zoneKindOf(tier.name),
      basePrice: tier.price,
      priceFrom: open.length > 0 ? Math.min(...open.map(s => s.price)) : tier.price,
      capacity: tier.capacity ?? zoneSeats.length,
      available: zoneSeats.length > 0 ? open.length : tier.available,
      rank,
      band,
      color: PRICE_BAND_COLORS[band],
      // A change that arrived over the stream is newer than the one loaded with the event.
      trend: liveTrends[tier.id] ?? tier.trend
    };
  });
}

/** What a ticket shows: the seat code for seats, the zone for standing areas. */
export function ticketLabelOf(seat: SeatItem, kind: ZoneKind): string {
  return kind === 'standing' ? `${seat.zoneName} · Vé đứng` : seat.label;
}

// ---------------------------------------------------------------------------
// Illustrative venue geometry
// ---------------------------------------------------------------------------
//
// There is no venue geometry in the API, so the layout is generated from the
// zone list: stage at -Z, standing pits in front of it, seated zones on
// horseshoe tiers behind, dearer zones closer. Units are roughly metres.

export type Vec3 = [number, number, number];

export interface StageGeometry {
  width: number;
  depth: number;
  height: number;
  center: Vec3;
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
  /** Polar origin shared by every tier: the front edge of the stage. */
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

const STAGE: StageGeometry = { width: 16, depth: 6, height: 1.2, center: [0, 0.6, -14] };
const STAGE_FRONT_Z = STAGE.center[2] + STAGE.depth / 2;
const PIT_WIDTH = 18;
const PIT_DEPTH = 3.4;
const PIT_GAP = 0.6;
const TIER_SPAN = (150 * Math.PI) / 180;
const TIER_GAP_ANGLE = (3 * Math.PI) / 180;
const ZONES_PER_RING = 3;
export const ROW_DEPTH = 0.95;
export const ROW_RISE = 0.4;
const RING_GAP = 1.4;
const RING_LIFT = 1.1;

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

export function buildVenueLayout(zones: ZoneSummary[], seats: SeatItem[]): VenueLayout {
  const seatsByZone = new Map<string, SeatItem[]>();
  for (const seat of seats) {
    const list = seatsByZone.get(seat.zoneId);
    if (list) list.push(seat);
    else seatsByZone.set(seat.zoneId, [seat]);
  }

  const geometries: ZoneGeometry[] = [];
  const placements: SeatPlacement[] = [];

  const pits = zones.filter(z => z.kind === 'standing');
  pits.forEach((zone, i) => {
    const z = STAGE_FRONT_Z + PIT_GAP + PIT_DEPTH / 2 + i * (PIT_DEPTH + PIT_GAP);
    geometries.push({ kind: 'pit', zoneId: zone.id, center: [0, 0.02, z], width: PIT_WIDTH, depth: PIT_DEPTH });
  });

  const pitEnd = STAGE_FRONT_Z + pits.length * (PIT_DEPTH + PIT_GAP);
  const origin: Vec3 = [0, 0, STAGE_FRONT_Z];
  // The first ring clears the pit's far corners.
  const pitReach = Math.hypot(PIT_WIDTH / 2, pitEnd - STAGE_FRONT_Z);
  let innerRadius = Math.max(9, pitReach + 2);

  const seated = zones.filter(z => z.kind === 'seated');
  for (let ring = 0; ring * ZONES_PER_RING < seated.length; ring++) {
    const ringZones = seated.slice(ring * ZONES_PER_RING, (ring + 1) * ZONES_PER_RING);
    const rowCounts = ringZones.map(z => Math.max(1, groupRows(seatsByZone.get(z.id) ?? []).length));
    const ringDepth = Math.max(...rowCounts) * ROW_DEPTH + 0.8;
    const baseHeight = 0.3 + ring * RING_LIFT;
    const slice = TIER_SPAN / ringZones.length;

    ringZones.forEach((zone, i) => {
      const startAngle = -TIER_SPAN / 2 + i * slice + TIER_GAP_ANGLE / 2;
      const endAngle = startAngle + slice - TIER_GAP_ANGLE;
      const mid = (startAngle + endAngle) / 2;
      const rows = groupRows(seatsByZone.get(zone.id) ?? []);
      const rise = rows.length * ROW_RISE;
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
    stage: STAGE,
    zones: geometries,
    seats: placements,
    extent: Math.max(innerRadius, pitReach) + 2
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
  // Eyes go to the performers and the screen above them, not the stage floor.
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
