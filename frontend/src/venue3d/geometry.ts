import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROW_DEPTH, ROW_RISE, PitGeometry, TierGeometry, VenueLayout } from '../services/venue';

const DEG = Math.PI / 180;

/** Architecture colours: dark navy concrete and metal, so only the accents carry colour. */
export const PALETTE = {
  background: '#0b0e26',
  floor: '#0d1130',
  concrete: '#1a1f3f',
  concreteDark: '#11152f',
  metal: '#262b4d',
  electric: '#3d7bff',
  violet: '#8b5cf6',
  magenta: '#e040a0',
  gold: '#f2c982'
} as const;

/** Annular sector in the XZ plane (angles from +Z towards +X), extruded upwards from `bottom`. */
export function sectorGeometry(inner: number, outer: number, start: number, end: number, height: number, bottom = 0) {
  const shape = new THREE.Shape();
  const steps = Math.max(8, Math.ceil((end - start) / DEG / 3));
  // Shape space: x = sin(angle) * r, y = -cos(angle) * r. Rotating -90° about X sends
  // shape-y to world +Z (cos(angle) * r) and the extrusion to world +Y.
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    if (i === 0) shape.moveTo(Math.sin(a) * outer, -Math.cos(a) * outer);
    else shape.lineTo(Math.sin(a) * outer, -Math.cos(a) * outer);
  }
  for (let i = steps; i >= 0; i--) {
    const a = start + ((end - start) * i) / steps;
    shape.lineTo(Math.sin(a) * inner, -Math.cos(a) * inner);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  if (bottom !== 0) geometry.translate(0, bottom, 0);
  return geometry;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();
}

/**
 * Vertex colours: treads take the zone tint, risers and sides stay dark concrete, and
 * everything darkens towards the ground. The darkening stands in for ambient occlusion
 * without a post-processing pass.
 */
function paint(geometry: THREE.BufferGeometry, tread: THREE.Color, side: THREE.Color, floorY: number, topY: number) {
  const normals = geometry.getAttribute('normal');
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    c.copy(normals.getY(i) > 0.6 ? tread : side);
    const t = THREE.MathUtils.clamp((positions.getY(i) - floorY) / Math.max(0.01, topY - floorY), 0, 1);
    c.multiplyScalar(0.45 + 0.55 * t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const concrete = new THREE.Color(PALETTE.concrete);

/** Seated tier: one raked step per row, solid down to the ground, with a back parapet. */
export function tierGeometry(tier: TierGeometry, tint: string) {
  const rows = Math.max(1, Math.round(tier.rise / ROW_RISE));
  const parts: THREE.BufferGeometry[] = [];
  let top = tier.baseHeight;
  for (let r = 0; r < rows; r++) {
    const inner = tier.innerRadius + r * ROW_DEPTH;
    const outer = r === rows - 1 ? tier.outerRadius : tier.innerRadius + (r + 1) * ROW_DEPTH;
    top = tier.baseHeight + (r + 1) * ROW_RISE;
    parts.push(sectorGeometry(inner, outer, tier.startAngle, tier.endAngle, top));
  }
  parts.push(sectorGeometry(tier.outerRadius - 0.16, tier.outerRadius, tier.startAngle, tier.endAngle, top + 0.75));
  const merged = mergeGeometries(parts.map(p => p.toNonIndexed()), false)!;
  parts.forEach(p => p.dispose());
  merged.translate(tier.origin[0], 0, tier.origin[2]);
  const tread = concrete.clone().lerp(new THREE.Color(tint), 0.6);
  return paint(merged, tread, concrete, 0, top + 0.75);
}

/** Standing area: a raised floor plate. */
export function pitGeometry(pit: PitGeometry, tint: string) {
  const geometry = box(pit.width, 0.22, pit.depth, pit.center[0], 0.11, pit.center[2]);
  const tread = concrete.clone().lerp(new THREE.Color(tint), 0.55);
  return paint(geometry, tread, concrete, 0, 0.22);
}

export interface StripRange {
  zoneId: string;
  start: number;
  count: number;
}

/**
 * Thin lit edges, one set per zone, merged into a single mesh. Their colours are
 * rewritten per state (idle, hover, chosen, dimmed) without rebuilding geometry.
 */
export function zoneStrips(layout: VenueLayout) {
  const parts: THREE.BufferGeometry[] = [];
  const ranges: StripRange[] = [];
  let cursor = 0;
  for (const zone of layout.zones) {
    const pieces: THREE.BufferGeometry[] = [];
    if (zone.kind === 'tier') {
      const frontTop = zone.baseHeight + ROW_RISE;
      pieces.push(
        sectorGeometry(zone.innerRadius - 0.05, zone.innerRadius + 0.01, zone.startAngle, zone.endAngle, 0.07, frontTop - 0.14)
          .translate(zone.origin[0], 0, zone.origin[2])
          .toNonIndexed()
      );
    } else {
      const [x, , z] = zone.center;
      const y = 0.235;
      pieces.push(
        box(zone.width, 0.03, 0.08, x, y, z + zone.depth / 2 - 0.04),
        box(zone.width, 0.03, 0.08, x, y, z - zone.depth / 2 + 0.04),
        box(0.08, 0.03, zone.depth, x - zone.width / 2 + 0.04, y, z),
        box(0.08, 0.03, zone.depth, x + zone.width / 2 - 0.04, y, z)
      );
    }
    const merged = mergeGeometries(pieces, false)!;
    pieces.forEach(p => p.dispose());
    const count = merged.getAttribute('position').count;
    ranges.push({ zoneId: zone.zoneId, start: cursor, count });
    cursor += count;
    parts.push(merged);
  }
  const geometry = parts.length > 0 ? mergeGeometries(parts, false)! : new THREE.BufferGeometry();
  parts.forEach(p => p.dispose());
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(1, cursor) * 3), 3));
  return { geometry, ranges };
}

/** Seat with pan, backrest and pedestal; base at y = 0, backrest towards local -Z (away from the stage). */
export function chairGeometry() {
  // Seat pan tipped up at the front, backrest reclined away from the stage, two armrests.
  const pan = box(0.5, 0.08, 0.46, 0, 0, 0).rotateX(-0.08).translate(0, 0.27, 0.03);
  const back = box(0.5, 0.46, 0.06, 0, 0.23, 0).rotateX(-0.2).translate(0, 0.3, -0.2);
  return mergeGeometries([
    box(0.1, 0.24, 0.1, 0, 0.12, 0.02),
    pan,
    back,
    box(0.05, 0.05, 0.4, -0.27, 0.42, 0.02),
    box(0.05, 0.05, 0.4, 0.27, 0.42, 0.02)
  ])!;
}

const stairConcrete = new THREE.Color('#2a3058');

/**
 * Staircases in the aisles between neighbouring zones of a ring (two steps per row),
 * plus a glass balustrade and handrail along the front of each ring.
 */
export function tierCirculation(layout: VenueLayout) {
  const tiers = layout.zones.filter((z): z is TierGeometry => z.kind === 'tier');
  const rings = new Map<number, TierGeometry[]>();
  for (const t of tiers) {
    const key = Math.round(t.innerRadius * 100);
    rings.set(key, [...(rings.get(key) ?? []), t]);
  }

  const steps: THREE.BufferGeometry[] = [];
  const glass: THREE.BufferGeometry[] = [];
  const rails: THREE.BufferGeometry[] = [];
  for (const ring of rings.values()) {
    ring.sort((a, b) => a.startAngle - b.startAngle);
    const first = ring[0];
    const rows = Math.max(1, Math.round(first.rise / ROW_RISE));
    for (let i = 0; i < ring.length - 1; i++) {
      const a0 = ring[i].endAngle;
      const a1 = ring[i + 1].startAngle;
      if (a1 <= a0) continue;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < 2; k++) {
          const inner = first.innerRadius + r * ROW_DEPTH + (k * ROW_DEPTH) / 2;
          const outer = r === rows - 1 && k === 1 ? first.outerRadius : inner + ROW_DEPTH / 2;
          const top = first.baseHeight + r * ROW_RISE + ((k + 1) * ROW_RISE) / 2;
          steps.push(sectorGeometry(inner, outer, a0, a1, top).translate(first.origin[0], 0, first.origin[2]).toNonIndexed());
        }
      }
    }
    const last = ring[ring.length - 1];
    const front = first.baseHeight + ROW_RISE;
    glass.push(
      sectorGeometry(first.innerRadius - 0.03, first.innerRadius, first.startAngle, last.endAngle, 0.85, front)
        .translate(first.origin[0], 0, first.origin[2])
        .toNonIndexed()
    );
    rails.push(
      sectorGeometry(first.innerRadius - 0.06, first.innerRadius + 0.03, first.startAngle, last.endAngle, 0.05, front + 0.85)
        .translate(first.origin[0], 0, first.origin[2])
        .toNonIndexed()
    );
  }

  const merge = (parts: THREE.BufferGeometry[]) => {
    const merged = parts.length > 0 ? mergeGeometries(parts)! : new THREE.BufferGeometry();
    parts.forEach(p => p.dispose());
    return merged;
  };
  const stairs = merge(steps);
  if (stairs.getAttribute('position')) paint(stairs, stairConcrete.clone().multiplyScalar(1.35), stairConcrete, 0, tallestTier(layout));
  return { stairs, glass: merge(glass), rails: merge(rails) };
}

/**
 * Dim bowl of the wider arena beyond the outer wall: no seats, just scale. Open at the
 * back, like the cut-away shell, so it never stands between the camera and the stands.
 */
export function arenaShell(layout: VenueLayout) {
  const front = layout.stage.center[2] + layout.stage.depth / 2;
  return { radius: shellRadius(layout) + 15, height: 15, origin: [0, 0, front] as const, thetaStart: 40 * DEG, thetaLength: 280 * DEG };
}

/** LED wall placement, shared by the screen mesh and its frame. */
export function ledWall(layout: VenueLayout) {
  const { width: W, depth: D, height: H, center } = layout.stage;
  return { width: W * 0.8, height: 5.4, x: center[0], y: H + 3.3, z: center[2] - D / 2 + 0.35 };
}

/** Drum riser at the back of the deck, lower wings either side, and a flight of steps at each front corner. */
export function stageExtras(layout: VenueLayout) {
  const { width: W, depth: D, height: H, center } = layout.stage;
  const wingH = H * 0.6;
  const parts: THREE.BufferGeometry[] = [
    box(W * 0.36, 0.45, D * 0.34, center[0], H + 0.225, center[2] - D * 0.22),
    box(3, wingH, D * 0.8, center[0] - (W / 2 + 2.9), wingH / 2, center[2] - D * 0.08),
    box(3, wingH, D * 0.8, center[0] + (W / 2 + 2.9), wingH / 2, center[2] - D * 0.08)
  ];
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const h = (H * (i + 1)) / 4;
      parts.push(box(1.1, h, 0.42, center[0] + sign * (W / 2 + 0.75), h / 2, center[2] + D / 2 - 0.3 - i * 0.42));
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return paint(merged, new THREE.Color('#2b3062'), new THREE.Color('#161a38'), 0, H + 0.45);
}

export interface Placed {
  position: [number, number, number];
  scale: [number, number, number];
  rotationY?: number;
}

/** The furthest seated ring, or the pits, sets where the outer shell stands. */
function shellRadius(layout: VenueLayout) {
  const tiers = layout.zones.filter((z): z is TierGeometry => z.kind === 'tier');
  if (tiers.length > 0) return Math.max(...tiers.map(t => t.outerRadius));
  const pits = layout.zones.filter((z): z is PitGeometry => z.kind === 'pit');
  const reach = pits.length > 0 ? Math.max(...pits.map(p => Math.hypot(p.width / 2, p.center[2] + p.depth / 2 - layout.stage.center[2]))) : 8;
  return reach + 2;
}

function tallestTier(layout: VenueLayout) {
  return Math.max(1, ...layout.zones.filter((z): z is TierGeometry => z.kind === 'tier').map(t => t.baseHeight + t.rise));
}

export const STAGE_TRUSS_HEIGHT = 9;

/**
 * Outer wall, canopy and columns that wrap the stands, plus the stage frame:
 * towers, trusses, hung speakers, barriers. All boxes share one instanced mesh.
 */
export function architecture(layout: VenueLayout) {
  const { width: W, depth: D, height: H, center } = layout.stage;
  const front = center[2] + D / 2;
  const back = center[2] - D / 2;
  const origin = new THREE.Vector3(0, 0, front);
  const R = shellRadius(layout);
  const span = 82 * DEG;
  // The shell is cut away behind the audience, where the camera looks in from:
  // a low wall all round, canopy and columns only along the two sides.
  const cutaway = 38 * DEG;
  const wallTop = tallestTier(layout) + 0.9;
  const canopyBottom = wallTop + 4.2;

  const wall = paint(sectorGeometry(R + 0.4, R + 1, -span, span, wallTop).translate(0, 0, front), concrete, new THREE.Color(PALETTE.concreteDark), 0, wallTop);
  const sides: [number, number][] = [
    [-span, -cutaway],
    [cutaway, span]
  ];
  const canopyParts = sides.map(([a, b]) => sectorGeometry(R + 0.2, R + 4.6, a, b, 0.35, canopyBottom).translate(0, 0, front).toNonIndexed());
  const canopy = paint(
    mergeGeometries(canopyParts)!,
    new THREE.Color(PALETTE.concreteDark),
    new THREE.Color(PALETTE.concreteDark),
    canopyBottom,
    canopyBottom + 0.35
  );
  canopyParts.forEach(p => p.dispose());
  // Two quiet accent lines: wall coping in violet, canopy edge in electric blue.
  const coping = sectorGeometry(R + 0.85, R + 1.02, -span, span, 0.05, wallTop).translate(0, 0, front).toNonIndexed();
  const edges = sides.map(([a, b]) => sectorGeometry(R + 0.15, R + 0.3, a, b, 0.06, canopyBottom - 0.06).translate(0, 0, front).toNonIndexed());
  const firstCount = coping.getAttribute('position').count;
  const accents = mergeGeometries([coping, ...edges])!;
  [coping, ...edges].forEach(p => p.dispose());
  const accentColors = new Float32Array(accents.getAttribute('position').count * 3);
  const violet = new THREE.Color(PALETTE.violet).multiplyScalar(0.32);
  const electric = new THREE.Color(PALETTE.electric).multiplyScalar(0.7);
  for (let i = 0; i < accentColors.length / 3; i++) {
    const c = i < firstCount ? violet : electric;
    accentColors.set([c.r, c.g, c.b], i * 3);
  }
  accents.setAttribute('color', new THREE.BufferAttribute(accentColors, 3));

  const columns: Placed[] = [];
  for (const [a0, a1] of sides) {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + ((a1 - a0) * i) / 4;
      const r = R + 3.6;
      columns.push({ position: [origin.x + Math.sin(a) * r, canopyBottom / 2, origin.z + Math.cos(a) * r], scale: [1, canopyBottom, 1] });
    }
  }

  const boxes: Placed[] = [];
  const tx = W / 2 + 0.5;
  // Truss towers and the roof grid over the stage.
  for (const x of [-tx, tx]) {
    for (const z of [front - 0.3, back + 0.3]) boxes.push({ position: [x, STAGE_TRUSS_HEIGHT / 2, z], scale: [0.45, STAGE_TRUSS_HEIGHT, 0.45] });
    boxes.push({ position: [x, STAGE_TRUSS_HEIGHT, center[2]], scale: [0.4, 0.4, D - 0.2] });
  }
  for (const z of [front - 0.3, back + 0.3, center[2]]) boxes.push({ position: [0, STAGE_TRUSS_HEIGHT, z], scale: [W + 1.4, 0.4, 0.4] });
  // Hung line-array speakers either side.
  for (const x of [-(tx + 1.4), tx + 1.4]) boxes.push({ position: [x, 6.4, front - 0.8], scale: [1.1, 3.4, 1.1] });
  // Side screen frames.
  for (const sign of [-1, 1]) boxes.push({ position: [sign * (tx + 3.4), 1.6, center[2] + 0.6], scale: [0.25, 3.2, 0.25] });
  // Frame round the LED wall.
  const led = ledWall(layout);
  boxes.push(
    { position: [led.x, led.y + led.height / 2 + 0.12, led.z - 0.05], scale: [led.width + 0.5, 0.24, 0.2] },
    { position: [led.x, led.y - led.height / 2 - 0.12, led.z - 0.05], scale: [led.width + 0.5, 0.24, 0.2] },
    { position: [led.x - led.width / 2 - 0.13, led.y, led.z - 0.05], scale: [0.24, led.height + 0.48, 0.2] },
    { position: [led.x + led.width / 2 + 0.13, led.y, led.z - 0.05], scale: [0.24, led.height + 0.48, 0.2] }
  );
  // Crowd barrier in front of the stage and round each standing area.
  const rail = (x: number, z: number, w: number, d: number) => boxes.push({ position: [x, 0.55, z], scale: [w, 1.1, d] });
  rail(0, front + 0.25, W + 3, 0.08);
  for (const zone of layout.zones) {
    if (zone.kind !== 'pit') continue;
    const [x, , z] = zone.center;
    rail(x, z + zone.depth / 2 + 0.2, zone.width, 0.06);
    rail(x - zone.width / 2 - 0.2, z, 0.06, zone.depth);
    rail(x + zone.width / 2 + 0.2, z, 0.06, zone.depth);
  }

  // Lamps along the front and back trusses.
  const fixtures: Placed[] = [];
  for (const z of [front - 0.3, back + 0.3]) {
    for (let x = -W / 2 + 1.2; x <= W / 2 - 1.2 + 1e-6; x += (W - 2.4) / 5) {
      fixtures.push({ position: [x, STAGE_TRUSS_HEIGHT - 0.42, z], scale: [1, 1, 1] });
    }
  }

  return {
    wall,
    canopy,
    accents,
    columns,
    boxes,
    fixtures,
    stage: { W, D, H, center, front, back },
    shell: { R, wallTop, canopyBottom }
  };
}

export function composeMatrix(item: Placed, target: THREE.Matrix4) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.rotationY ?? 0);
  return target.compose(new THREE.Vector3(...item.position), q, new THREE.Vector3(...item.scale));
}
