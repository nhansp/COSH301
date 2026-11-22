import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import * as THREE from 'three';
import { SeatItem } from '../types';
import { PovView, SeatPlacement, VenueLayout, ZoneGeometry, ZoneSummary, zoneStats } from '../services/venue';
import {
  PALETTE,
  Placed,
  STAGE_TRUSS_HEIGHT,
  architecture,
  chairGeometry,
  composeMatrix,
  pitGeometry,
  tierGeometry,
  zoneStrips
} from './geometry';
import { beamTexture, floorTexture, hatchTexture, hazeTexture, ledTexture } from './textures';
import { LogOut, RotateCcw } from 'lucide-react';
import { VenueOverlay } from '../components/tickets/VenueOverlay';

const SPOT = '#ffe2a8';
const SEAT_COLORS = { available: '#2fa86b', held: '#e8a23a', sold: '#4a4e62' } as const;
const SOLD_OUT_TINT = '#4a4d60';
/** Pointer travel (px) above which a press is a camera drag, not a click. */
const CLICK_SLOP = 6;

const DEG = Math.PI / 180;
const { ACTION } = CameraControlsImpl;

export interface VenueSceneProps {
  layout: VenueLayout;
  zones: ZoneSummary[];
  seats: SeatItem[];
  activeZoneId: string | null;
  reducedMotion: boolean;
  onZoneSelect: (zoneId: string | null) => void;
  onSeatClick: (seat: SeatItem) => void;
  onContextLost: () => void;
  /** First-person view from a seat or a zone's representative spot; null for the venue views. */
  pov: PovView | null;
  /** Tells the user what the view is taken from, and that it is an estimate. */
  povCaption: string;
  /** Bumped to put the head back to facing the stage. */
  povResetKey: number;
  onResetPov: () => void;
  onExitPov: () => void;
  /** True while the 2D map is shown: the scene stays mounted but stops drawing. */
  paused: boolean;
}

type ZoneState = 'idle' | 'hover' | 'active' | 'dimmed';

/** Sets instance matrices once per list; the meshes never move after that. */
function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: Placed[]) {
  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    items.forEach((item, i) => {
      mesh.setMatrixAt(i, composeMatrix(item, m));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [ref, items, invalidate]);
}

function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: React.DependencyList): T {
  const value = useMemo(factory, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

// ---------------------------------------------------------------------------
// Architecture: stage, rigging, shell. Static once the layout is known.
// ---------------------------------------------------------------------------

const BEAM_COLORS = [PALETTE.electric, PALETTE.magenta, PALETTE.violet];

const Architecture: React.FC<{ layout: VenueLayout; shadows: boolean }> = ({ layout, shadows }) => {
  const arch = useMemo(() => architecture(layout), [layout]);
  useEffect(
    () => () => {
      arch.wall.dispose();
      arch.canopy.dispose();
      arch.accents.dispose();
    },
    [arch]
  );
  const { W, D, H, center, front, back } = arch.stage;

  const led = useDisposable(ledTexture, []);
  const haze = useDisposable(hazeTexture, []);
  const beam = useDisposable(beamTexture, []);
  const floor = useDisposable(() => {
    const t = floorTexture();
    t.repeat.set(layout.extent / 2, layout.extent / 2);
    return t;
  }, [layout.extent]);
  // Beam cones hang from their apex, so the lamp end sits at the instance origin.
  const beamGeometry = useDisposable(() => new THREE.ConeGeometry(1.7, 9, 24, 1, true).translate(0, -4.5, 0), []);

  const boxesRef = useRef<THREE.InstancedMesh>(null);
  const columnsRef = useRef<THREE.InstancedMesh>(null);
  const fixturesRef = useRef<THREE.InstancedMesh>(null);
  const beamsRef = useRef<THREE.InstancedMesh>(null);
  useInstances(boxesRef, arch.boxes);
  useInstances(columnsRef, arch.columns);
  useInstances(fixturesRef, arch.fixtures);

  // Front-truss lamps throw beams down and back onto the stage, fanned slightly.
  const beams = useMemo(() => {
    const lamps = arch.fixtures.filter(f => f.position[2] > center[2]);
    return lamps.map((f, i) => ({
      position: f.position,
      tilt: (i - (lamps.length - 1) / 2) * 0.09,
      color: BEAM_COLORS[i % BEAM_COLORS.length]
    }));
  }, [arch.fixtures, center]);
  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    const mesh = beamsRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    beams.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(0.32, 0, b.tilt));
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(...b.position), q, one));
      mesh.setColorAt(i, new THREE.Color(b.color));
    });
    mesh.count = beams.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [beams, invalidate]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, center[2] + layout.extent * 0.45]} receiveShadow raycast={() => null}>
        <circleGeometry args={[layout.extent * 1.9, 72]} />
        <meshStandardMaterial map={floor} color="#ffffff" roughness={0.55} metalness={0.25} />
      </mesh>

      {/* Stage: plinth, glossy deck, one electric-blue lip facing the audience. */}
      <mesh position={[center[0], 0.18, center[2]]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[W + 1.2, 0.36, D + 1]} />
        <meshStandardMaterial color={PALETTE.concreteDark} roughness={0.8} />
      </mesh>
      <mesh position={[center[0], 0.36 + (H - 0.36) / 2, center[2]]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[W, H - 0.36, D]} />
        <meshStandardMaterial color="#1b1f40" roughness={0.3} metalness={0.55} />
      </mesh>
      <mesh position={[center[0], H - 0.05, front + 0.01]} raycast={() => null}>
        <boxGeometry args={[W, 0.06, 0.06]} />
        <meshBasicMaterial color={PALETTE.electric} toneMapped={false} />
      </mesh>

      {/* LED wall behind the band and two angled side screens. */}
      <mesh position={[center[0], H + 3.3, back + 0.35]} raycast={() => null}>
        <planeGeometry args={[W * 0.8, 5.4]} />
        <meshBasicMaterial map={led} toneMapped={false} />
      </mesh>
      {[-1, 1].map(sign => (
        <mesh
          key={sign}
          position={[sign * (W / 2 + 3.9), 4.6, center[2] + 0.6]}
          rotation={[0, -sign * 0.35, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[3.4, 2.6]} />
          <meshBasicMaterial map={led} toneMapped={false} />
        </mesh>
      ))}

      <mesh position={[center[0], 7, back - 1.2]} raycast={() => null}>
        <planeGeometry args={[W * 3, 16]} />
        <meshBasicMaterial map={haze} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      <instancedMesh ref={boxesRef} args={[undefined, undefined, arch.boxes.length]} castShadow={shadows} receiveShadow raycast={() => null}>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.metal} roughness={0.45} metalness={0.7} />
      </instancedMesh>
      <instancedMesh ref={fixturesRef} args={[undefined, undefined, arch.fixtures.length]} raycast={() => null}>
        <cylinderGeometry args={[0.2, 0.26, 0.42, 12]} />
        <meshBasicMaterial color="#fff2d8" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beamsRef} args={[beamGeometry, undefined, Math.max(1, beams.length)]} raycast={() => null}>
        <meshBasicMaterial
          map={beam}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Outer shell: wall behind the top tier, columns, canopy. */}
      <mesh geometry={arch.wall} castShadow={shadows} receiveShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      {/* Translucent, so orbiting to the side never hides the stands behind it. */}
      <mesh geometry={arch.canopy} renderOrder={1} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.3} metalness={0.4} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh geometry={arch.accents} raycast={() => null}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <instancedMesh ref={columnsRef} args={[undefined, undefined, arch.columns.length]} castShadow={shadows} raycast={() => null}>
        <cylinderGeometry args={[0.22, 0.28, 1, 10]} />
        <meshStandardMaterial color={PALETTE.metal} roughness={0.6} metalness={0.5} />
      </instancedMesh>
    </group>
  );
};

/** Key light with soft shadows, a magenta rim from behind the stage and two warm stage spots. */
const Lighting: React.FC<{ layout: VenueLayout; shadows: boolean }> = ({ layout, shadows }) => {
  const { width: W, depth: D, center } = layout.stage;
  const r = layout.extent;
  const stageTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(center[0], 1.2, center[2]);
    return target;
  }, [center]);

  return (
    <>
      <hemisphereLight args={['#aab3ff', '#0a0b1c', 1.1]} />
      <directionalLight
        position={[-r * 0.55, r * 1.1, r * 0.9]}
        intensity={1.6}
        color="#e4e9ff"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-r * 1.2}
        shadow-camera-right={r * 1.2}
        shadow-camera-top={r * 1.2}
        shadow-camera-bottom={-r * 1.2}
        shadow-camera-near={1}
        shadow-camera-far={r * 4}
      />
      <directionalLight position={[0, 9, center[2] - r]} intensity={0.7} color={PALETTE.magenta} />
      <primitive object={stageTarget} />
      {[-1, 1].map(sign => (
        <spotLight
          key={sign}
          position={[sign * (W / 2), STAGE_TRUSS_HEIGHT - 0.5, center[2] + D / 2]}
          target={stageTarget}
          angle={0.55}
          penumbra={0.7}
          intensity={60}
          distance={30}
          decay={1.6}
          color="#ffe9c4"
        />
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Ticket zones
// ---------------------------------------------------------------------------

interface ZoneMeshProps {
  geometry: ZoneGeometry;
  zone: ZoneSummary;
  state: ZoneState;
  shadows: boolean;
  onSelect: (zoneId: string) => void;
  onHover: (zoneId: string | null) => void;
}

const ZoneMesh: React.FC<ZoneMeshProps> = ({ geometry, zone, state, shadows, onSelect, onHover }) => {
  const tint = zone.available === 0 ? SOLD_OUT_TINT : zone.color;
  const mesh = useDisposable(
    () => (geometry.kind === 'tier' ? tierGeometry(geometry, tint) : pitGeometry(geometry, tint)),
    [geometry, tint]
  );

  const color = state === 'dimmed' ? '#3a3e57' : '#ffffff';
  const emissive = state === 'hover' ? 0.22 : state === 'active' ? 0.16 : 0;

  return (
    <mesh
      geometry={mesh}
      castShadow={shadows && geometry.kind === 'tier'}
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > CLICK_SLOP) return;
        e.stopPropagation();
        onSelect(zone.id);
      }}
      onPointerOver={e => {
        e.stopPropagation();
        onHover(zone.id);
      }}
      onPointerOut={() => onHover(null)}
    >
      <meshStandardMaterial vertexColors color={color} emissive={zone.color} emissiveIntensity={emissive} roughness={0.85} />
    </mesh>
  );
};

/** All zone edge lights in one mesh; colour carries the state. */
const ZoneStrips: React.FC<{ layout: VenueLayout; zoneById: Map<string, ZoneSummary>; stateOf: (id: string) => ZoneState }> = ({
  layout,
  zoneById,
  stateOf
}) => {
  const strips = useMemo(() => zoneStrips(layout), [layout]);
  useEffect(() => () => strips.geometry.dispose(), [strips]);
  const invalidate = useThree(s => s.invalidate);
  const states = layout.zones.map(z => `${z.zoneId}:${stateOf(z.zoneId)}:${zoneById.get(z.zoneId)?.available === 0}`).join();

  useLayoutEffect(() => {
    const attr = strips.geometry.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (const range of strips.ranges) {
      const zone = zoneById.get(range.zoneId);
      if (!zone) continue;
      const state = stateOf(range.zoneId);
      if (state === 'active') c.set(SPOT);
      else if (zone.available === 0) c.set(SOLD_OUT_TINT).multiplyScalar(state === 'dimmed' ? 0.4 : 0.9);
      else c.set(zone.color).multiplyScalar(state === 'hover' ? 1.2 : state === 'dimmed' ? 0.18 : 0.7);
      for (let i = range.start; i < range.start + range.count; i++) attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
    invalidate();
  }, [strips, states, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <mesh geometry={strips.geometry} raycast={() => null}>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

type SeatBucket = SeatItem['status'];

interface SeatLayerProps {
  placements: SeatPlacement[];
  seatsById: Map<string, SeatItem>;
  activeZoneId: string | null;
  onSeatClick: (seat: SeatItem) => void;
  onZoneSelect: (zoneId: string) => void;
  onHoverSeat: (seat: SeatItem | null) => void;
  onHoverZone: (zoneId: string | null) => void;
}

/** One instanced mesh per seat state: four draw calls for every seat in the venue. */
const SeatLayer: React.FC<SeatLayerProps> = ({ placements, seatsById, activeZoneId, onSeatClick, onZoneSelect, onHoverSeat, onHoverZone }) => {
  const invalidate = useThree(s => s.invalidate);
  const refs: Record<SeatBucket, React.RefObject<THREE.InstancedMesh | null>> = {
    available: useRef<THREE.InstancedMesh>(null),
    held: useRef<THREE.InstancedMesh>(null),
    sold: useRef<THREE.InstancedMesh>(null),
    selected: useRef<THREE.InstancedMesh>(null)
  };
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const ids = useRef<Record<SeatBucket, string[]>>({ available: [], held: [], sold: [], selected: [] });

  const chair = useDisposable(chairGeometry, []);
  const hatch = useDisposable(() => hatchTexture(SEAT_COLORS.held), []);
  // Laid flat on the tier, around the seat.
  const ring = useDisposable(() => new THREE.RingGeometry(0.5, 0.74, 32).rotateX(-Math.PI / 2), []);
  const capacity = Math.max(1, placements.length);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const buckets: Record<SeatBucket, string[]> = { available: [], held: [], sold: [], selected: [] };
    let rings = 0;

    for (const p of placements) {
      const seat = seatsById.get(p.seatId);
      if (!seat) continue;
      const bucket = seat.status;
      // Height is the colour-free cue: sold seats fold flat, held seats sit lower, yours stand taller.
      const height = bucket === 'sold' ? 0.35 : bucket === 'held' ? 0.8 : bucket === 'selected' ? 1.3 : 1;
      position.set(p.position[0], p.position[1], p.position[2]);
      rotation.setFromAxisAngle(up, p.rotationY);
      scale.set(1, height, 1);
      refs[bucket].current?.setMatrixAt(buckets[bucket].length, matrix.compose(position, rotation, scale));
      buckets[bucket].push(seat.id);

      if (bucket === 'selected' && ringRef.current) {
        position.y += 0.02;
        ringRef.current.setMatrixAt(rings++, matrix.compose(position, rotation, scale.set(1, 1, 1)));
      }
    }

    (Object.keys(refs) as SeatBucket[]).forEach(key => {
      const mesh = refs[key].current;
      if (!mesh) return;
      mesh.count = buckets[key].length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    if (ringRef.current) {
      ringRef.current.count = rings;
      ringRef.current.instanceMatrix.needsUpdate = true;
      ringRef.current.computeBoundingSphere();
    }
    ids.current = buckets;
    invalidate();
  }, [placements, seatsById, invalidate]); // eslint-disable-line react-hooks/exhaustive-deps

  const seatFrom = (bucket: SeatBucket, e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const id = e.instanceId === undefined ? undefined : ids.current[bucket][e.instanceId];
    return id ? seatsById.get(id) : undefined;
  };

  const handlers = (bucket: SeatBucket) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > CLICK_SLOP) return;
      e.stopPropagation();
      const seat = seatFrom(bucket, e);
      if (!seat) return;
      // Outside the zone in focus, a click picks the zone first so stray taps never hold a seat.
      if (seat.zoneId !== activeZoneId) onZoneSelect(seat.zoneId);
      else onSeatClick(seat);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const seat = seatFrom(bucket, e);
      if (!seat) return;
      onHoverSeat(seat.zoneId === activeZoneId ? seat : null);
      onHoverZone(seat.zoneId);
    },
    onPointerOut: () => {
      onHoverSeat(null);
      onHoverZone(null);
    }
  });

  return (
    <group>
      <instancedMesh ref={refs.available} args={[chair, undefined, capacity]} receiveShadow {...handlers('available')}>
        <meshStandardMaterial color={SEAT_COLORS.available} roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={refs.held} args={[chair, undefined, capacity]} receiveShadow {...handlers('held')}>
        <meshStandardMaterial map={hatch} roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={refs.sold} args={[chair, undefined, capacity]} receiveShadow {...handlers('sold')}>
        <meshStandardMaterial color={SEAT_COLORS.sold} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={refs.selected} args={[chair, undefined, capacity]} {...handlers('selected')}>
        <meshStandardMaterial color={SPOT} emissive={SPOT} emissiveIntensity={0.7} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[ring, undefined, capacity]} raycast={() => null}>
        <meshBasicMaterial color={SPOT} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  );
};

/** Soft cone of light over the zone in focus. */
const Followspot: React.FC<{ target: THREE.Vector3 | null }> = ({ target }) => {
  if (!target) return null;
  const height = 16;
  return (
    <mesh position={[target.x, target.y + height / 2, target.z]} raycast={() => null}>
      <coneGeometry args={[4.2, height, 40, 1, true]} />
      <meshBasicMaterial color={SPOT} transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const OVERVIEW_FOV = 38;
const POV_FOV = 58;

/** Normal orbit limits; the POV mode swaps in tighter ones and puts these back on exit. */
function applyOrbitLimits(c: CameraControlsImpl, layout: VenueLayout) {
  c.minPolarAngle = 22 * DEG;
  c.maxPolarAngle = 74 * DEG;
  c.minAzimuthAngle = -80 * DEG;
  c.maxAzimuthAngle = 80 * DEG;
  c.minDistance = 6;
  c.maxDistance = layout.extent * 2.6;
  c.azimuthRotateSpeed = 1;
  c.polarRotateSpeed = 1;
}

interface CameraRigProps {
  layout: VenueLayout;
  focus: ZoneGeometry | null;
  pov: PovView | null;
  povResetKey: number;
  reducedMotion: boolean;
}

const CameraRig: React.FC<CameraRigProps> = ({ layout, focus, pov, povResetKey, reducedMotion }) => {
  const controls = useRef<CameraControlsImpl>(null);
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree(s => s.invalidate);
  // Portrait frames (phones) cannot afford the angled view: face the stage and frame wider.
  const portrait = useThree(s => s.size.width < s.size.height);
  const focusId = focus?.zoneId ?? null;

  // The camera pose just before entering POV, so leaving puts the user back where they were.
  const saved = useRef<{ position: THREE.Vector3; target: THREE.Vector3; focusId: string | null } | null>(null);
  const settled = useRef(false);

  // Field of view eases between the overview lens and a wider, human one in POV.
  const fovTarget = useRef(OVERVIEW_FOV);
  useFrame((_, delta) => {
    const diff = fovTarget.current - camera.fov;
    if (Math.abs(diff) < 0.05) return;
    camera.fov = reducedMotion ? fovTarget.current : camera.fov + diff * Math.min(1, delta * 5);
    camera.updateProjectionMatrix();
    invalidate();
  });

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const animate = !reducedMotion;

    if (pov) {
      if (settled.current && !saved.current) {
        saved.current = { position: c.getPosition(new THREE.Vector3()), target: c.getTarget(new THREE.Vector3()), focusId };
      }
      const eye = new THREE.Vector3(...pov.eye);
      const forward = new THREE.Vector3(...pov.lookAt).sub(eye).normalize();
      // First person with camera-controls: orbit a target placed at the eye at a tiny radius,
      // with inverted rotation so dragging turns the head instead of circling the seat.
      const offset = forward.clone().multiplyScalar(-0.01);
      const facing = new THREE.Spherical().setFromVector3(offset);
      c.minDistance = c.maxDistance = 0.01;
      c.minAzimuthAngle = facing.theta - 70 * DEG;
      c.maxAzimuthAngle = facing.theta + 70 * DEG;
      c.minPolarAngle = Math.max(0.35, facing.phi - 28 * DEG);
      c.maxPolarAngle = Math.min(Math.PI - 0.35, facing.phi + 22 * DEG);
      c.azimuthRotateSpeed = -0.35;
      c.polarRotateSpeed = -0.35;
      // Close geometry (the row in front, the seat itself) must not be cut by the near plane.
      camera.near = 0.05;
      camera.updateProjectionMatrix();
      fovTarget.current = POV_FOV;
      const position = eye.clone().add(offset);
      c.setLookAt(position.x, position.y, position.z, eye.x, eye.y, eye.z, animate);
      invalidate();
      return;
    }

    applyOrbitLimits(c, layout);
    camera.near = 0.5;
    camera.updateProjectionMatrix();
    fovTarget.current = OVERVIEW_FOV;
    invalidate();

    const back = saved.current;
    saved.current = null;
    if (back && back.focusId === focusId) {
      c.setLookAt(back.position.x, back.position.y, back.position.z, back.target.x, back.target.y, back.target.z, animate);
      return;
    }

    if (!focus) {
      // Three-quarter view from behind the audience on the left: stage height and tier rake both read.
      const centre = new THREE.Vector3(0, 1.5, layout.stage.center[2] + layout.extent * 0.42);
      c.setTarget(centre.x, centre.y, centre.z, animate);
      c.rotateTo((portrait ? -8 : -24) * DEG, (portrait ? 46 : 50) * DEG, animate);
      c.fitToSphere(new THREE.Sphere(centre, layout.extent * (portrait ? 0.74 : 0.62)), animate);
    } else if (focus.kind === 'pit') {
      // Wide and shallow: look down on it from behind, with the stage in the background.
      const [x, y, z] = focus.center;
      c.setLookAt(x - 4, y + 12, z + 14, x, y, z - 1.5, animate);
    } else {
      // Back off far enough to see the whole tier, looking down over it towards the stage.
      const [x, y, z] = focus.center;
      const mid = (focus.startAngle + focus.endAngle) / 2;
      const radius = (focus.innerRadius + focus.outerRadius) / 2;
      const chord = 2 * radius * Math.sin((focus.endAngle - focus.startAngle) / 2);
      // Capped: a lone zone spanning the whole horseshoe would otherwise push the camera out of the venue.
      const distance = Math.min(16, Math.max(7, chord * 0.85));
      const out = new THREE.Vector3(Math.sin(mid), 0, Math.cos(mid));
      const eye = new THREE.Vector3(x, y, z).addScaledVector(out, distance).add(new THREE.Vector3(0, distance * 0.85, 0));
      c.setLookAt(eye.x, eye.y, eye.z, x - out.x * 1.5, y, z - out.z * 1.5, animate);
    }
    settled.current = true;
  }, [focus, focusId, pov, povResetKey, layout, reducedMotion, portrait, camera, invalidate]);

  const inPov = pov !== null;
  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={reducedMotion ? 0 : 0.55}
      mouseButtons={
        inPov
          ? { left: ACTION.ROTATE, middle: ACTION.NONE, right: ACTION.NONE, wheel: ACTION.NONE }
          : { left: ACTION.ROTATE, middle: ACTION.DOLLY, right: ACTION.NONE, wheel: ACTION.DOLLY }
      }
      touches={
        inPov
          ? { one: ACTION.TOUCH_ROTATE, two: ACTION.NONE, three: ACTION.NONE }
          : { one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE }
      }
    />
  );
};

/** Draws one frame when the scene is shown again after the 2D map. */
const Wake: React.FC<{ paused: boolean }> = ({ paused }) => {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => {
    if (!paused) invalidate();
  }, [paused, invalidate]);
  return null;
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function useElementWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const VenueScene: React.FC<VenueSceneProps> = ({
  layout,
  zones,
  seats,
  activeZoneId,
  reducedMotion,
  onZoneSelect,
  onSeatClick,
  onContextLost,
  pov,
  povCaption,
  povResetKey,
  onResetPov,
  onExitPov,
  paused
}) => {
  const frame = useRef<HTMLDivElement>(null);
  const width = useElementWidth(frame);
  // Phones skip shadow maps; the vertex-baked darkening still gives the stands depth.
  const shadows = width === 0 || width >= 640;

  const zoneById = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones]);
  const seatsById = useMemo(() => new Map(seats.map(s => [s.id, s])), [seats]);
  const focus = activeZoneId ? layout.zones.find(z => z.zoneId === activeZoneId) ?? null : null;

  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [hoverSeat, setHoverSeat] = useState<SeatItem | null>(null);
  useEffect(() => setHoverSeat(null), [activeZoneId]);
  useEffect(() => {
    document.body.style.cursor = hoverZoneId || hoverSeat ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hoverZoneId, hoverSeat]);

  const stateOf = (zoneId: string): ZoneState => {
    if (zoneId === activeZoneId) return 'active';
    if (zoneId === hoverZoneId) return 'hover';
    return activeZoneId ? 'dimmed' : 'idle';
  };

  const stats = useMemo(() => zoneStats(seats), [seats]);
  // In POV the venue is for looking at: picking and hovering are off until the user leaves it.
  const live = pov === null;
  const noop = () => {};
  useEffect(() => {
    if (!live) {
      setHoverZoneId(null);
      setHoverSeat(null);
    }
  }, [live]);

  const infoZoneId = hoverZoneId ?? activeZoneId;
  const infoZone = infoZoneId ? zoneById.get(infoZoneId) ?? null : null;
  const freshSeat = hoverSeat ? seatsById.get(hoverSeat.id) ?? hoverSeat : null;

  const spotTarget = useMemo(() => (focus ? new THREE.Vector3(focus.center[0], 0, focus.center[2]) : null), [focus]);

  return (
    <div ref={frame} className="relative size-full">
      <Canvas
        aria-hidden="true"
        frameloop={paused ? 'never' : 'demand'}
        shadows={shadows}
        dpr={[1, width > 0 && width < 640 ? 1.5 : 1.75]}
        camera={{ fov: 38, near: 0.5, far: 400, position: [-layout.extent * 0.8, layout.extent * 1.2, layout.extent * 1.4] }}
        gl={{ antialias: true, powerPreference: 'default' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            onContextLost();
          });
        }}
        onPointerMissed={() => {
          setHoverZoneId(null);
          setHoverSeat(null);
        }}
        style={{ touchAction: 'none' }}
      >
        <color attach="background" args={[PALETTE.background]} />
        <fog attach="fog" args={[PALETTE.background, layout.extent * 2.6, layout.extent * 5.5]} />
        <Lighting layout={layout} shadows={shadows} />
        <Architecture layout={layout} shadows={shadows} />

        {layout.zones.map(geometry => {
          const zone = zoneById.get(geometry.zoneId);
          return zone ? (
            <ZoneMesh
              key={geometry.zoneId}
              geometry={geometry}
              zone={zone}
              state={stateOf(geometry.zoneId)}
              shadows={shadows}
              onSelect={live ? onZoneSelect : noop}
              onHover={live ? id => setHoverZoneId(id) : noop}
            />
          ) : null;
        })}
        <ZoneStrips layout={layout} zoneById={zoneById} stateOf={stateOf} />

        <SeatLayer
          placements={layout.seats}
          seatsById={seatsById}
          activeZoneId={activeZoneId}
          onSeatClick={live ? onSeatClick : noop}
          onZoneSelect={live ? onZoneSelect : noop}
          onHoverSeat={live ? setHoverSeat : noop}
          onHoverZone={live ? setHoverZoneId : noop}
        />
        {live && <Followspot target={spotTarget} />}
        <CameraRig layout={layout} focus={focus} pov={pov} povResetKey={povResetKey} reducedMotion={reducedMotion} />
        <Wake paused={paused} />
      </Canvas>

      {pov ? (
        <>
          <div className="pointer-events-none absolute top-3 left-3 w-[min(20rem,calc(100%-1.5rem))] rounded-xl bg-[#0f1330]/88 p-3.5 text-stage-ink ring-1 ring-stage-line backdrop-blur-md sm:top-4 sm:left-4">
            <p className="text-sm font-medium">{povCaption}</p>
            <p className="mt-1 text-xs text-stage-muted">
              Kéo để nhìn quanh. Góc nhìn ước lượng trên sơ đồ minh hoạ, không phải ảnh chụp thật.
            </p>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex justify-end gap-2 sm:inset-x-4 sm:bottom-4">
            <button
              type="button"
              onClick={onResetPov}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-[#0f1330]/88 px-3 text-sm font-medium text-stage-ink ring-1 ring-stage-line backdrop-blur-md transition-colors hover:bg-stage-raised"
            >
              <RotateCcw className="size-4" />
              Đặt lại góc nhìn
            </button>
            <button
              type="button"
              onClick={onExitPov}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-spot px-3 text-sm font-semibold text-spot-ink transition-opacity hover:opacity-90"
            >
              <LogOut className="size-4" />
              Thoát góc nhìn
            </button>
          </div>
        </>
      ) : (
        <VenueOverlay
          mode="3d"
          zone={infoZone}
          isActive={!!infoZone && infoZone.id === activeZoneId}
          seat={freshSeat}
          held={infoZone ? stats.heldByZone.get(infoZone.id) ?? 0 : 0}
          priceRange={infoZone ? stats.priceRange.get(infoZone.id) ?? null : null}
          canGoBack={!!activeZoneId}
          onBack={() => onZoneSelect(null)}
        />
      )}
    </div>
  );
};

export default VenueScene;
