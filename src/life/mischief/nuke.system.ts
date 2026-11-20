// The nuke, drawn (design section 13b; the owner's notes: "first an initial
// shock ... then the mushroom cloud rises really quickly, starting as a
// fireball ... then settles into smoke and then dissipates"). Owner: Mischief.
//
// Staged on one clock (./nuke-timing.ts), on twos:
//   the drop    its own finned casing, tumbling a little as it falls, nose in the ground
//   flash       the page whites out (the interface), a white-hot core shrinks fast
//   shockwave   a bright ring races out across the ground far past the damage, a pale
//               band standing up off it, a low wall of dust (spray on water) behind it;
//               buildings shudder as it reaches them (and are damaged then, by the
//               director), trees go down pointing away
//   fireball    roiling lobes of deep red, orange and yellow-white swell on the ground
//   the rise    it lifts fast on a thick column, a skirt of dust drawn in at its foot,
//               the top rolling over into a cap that keeps turning inside out, fire
//               glowing through darkening smoke; fast for the first second or two
//   settling    the fire dies, the cloud goes dark then grey, the cap flattens and
//               spreads, the stem thins and leans downwind
//   dissipating it drifts off and thins to a wash; haze and ash linger over the crater
// The fireball lights the town round it (a warm wash that fades as it rises);
// the crater is left scorched, with a glassy rim and embers.
//
// Every lobe of the cloud shares an ink (fire with fire, smoke with smoke),
// so it is drawn as one shape with one outline, its inside in flat tones.

import { CELL_H, columnIndex, inColumnBounds, key, SEA_Y, type CellKey } from '@/core/grid';
import { compose, rotationX, rotationY, rotationZ, scaling, translation, type Mat4 } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { DAMAGE_COLORS, rgb } from '@/style/damage';
import { defineSystem, type InstanceHandle, type LifeStage, type Signals } from '../api';
import { scaresOf } from '../birds/scare';
import { mischiefOf, NUKE, type Director, type MischiefEvent } from './director';
import { ARCS, ashMesh, dustMesh, dustWallMesh, emberMesh, fireLobeMesh, firelightMesh, nukeCasingMesh, nukeCoreMesh, shockBandMesh, shockRingMesh, smokeMesh, sprayMesh } from './meshes';
import { easeOut, NUKE_TIME as T, riseHeight, waveRadius } from './nuke-timing';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
const FPS = 12;

class Pool {
  private free: InstanceHandle[] = [];
  constructor(
    private stage: LifeStage,
    private mesh: () => MeshData,
  ) {}
  take(): InstanceHandle {
    return this.free.pop() ?? this.stage.spawnMesh(this.mesh(), HIDDEN);
  }
  give(h: InstanceHandle): void {
    h.setVisible(false);
    this.free.push(h);
  }
  dispose(): void {
    for (const h of this.free) h.release();
    this.free = [];
  }
}

/** What a lobe of the cloud is drawn as: fire of a tone, smoke of a shade, a wash, dust, spray. */
type Mat = { k: 'fire'; tone: number } | { k: 'smoke'; shade: number } | { k: 'mist' } | { k: 'dust' } | { k: 'spray' };
const matKey = (m: Mat, look: number): string =>
  m.k === 'fire' ? `f${m.tone}${look}` : m.k === 'smoke' ? `s${m.shade}${look}` : `${m.k}${look}`;

interface Lobe {
  x: number;
  y: number;
  z: number;
  /** Radius, world units. */
  r: number;
  /** Squash in height (a flattened cap). */
  sy?: number;
  mat: Mat;
  look: number;
  /** Opacity for a wash. */
  alpha?: number;
}

interface Slot {
  h: InstanceHandle | null;
  key: string;
}

interface Nuke {
  id: number;
  x: number;
  y: number;
  z: number;
  t: number;
  water: boolean;
  slots: Slot[];
  core: InstanceHandle | null;
  band: InstanceHandle | null;
  /** The ring, the dust wall behind it (drawn) and the wash it settles into, arc by arc. */
  arcs: { ring: InstanceHandle | null; wall: InstanceHandle | null; mist: InstanceHandle | null; kind: string }[];
  light: InstanceHandle | null;
  /** Structures by distance, for the shudder as the ring reaches each. */
  near: { id: StructureId; d: number }[];
  nextShake: number;
  /** Ash flecks over the crater. */
  ash: { h: InstanceHandle; x: number; y: number; z: number; vy: number; spin: number }[];
  scorch: InstanceHandle | null;
  /** The ground it was drawn on (redrawn only when that changes). */
  scorchOf: unknown;
  embers: InstanceHandle[];
  frame: number;
}

interface Falling {
  h: InstanceHandle;
  point: [number, number, number];
  age: number;
  fall: number;
  seed: number;
}

interface State {
  d: Director;
  shape: ShapePlan | null;
  falling: Map<number, Falling>;
  nukes: Nuke[];
  pools: Map<string, Pool>;
  /** Structures to shudder once the town shows them hit (their edits arrive with the ring). */
  toShake: { id: StructureId; amp: number }[];
  shakes: { h: InstanceHandle | null; age: number; amp: number }[];
  off: () => void;
}

function pool(st: State, stage: LifeStage, k: string, mesh: () => MeshData): Pool {
  let p = st.pools.get(k);
  if (!p) st.pools.set(k, (p = new Pool(stage, mesh)));
  return p;
}

function meshOf(m: Mat, look: number): () => MeshData {
  switch (m.k) {
    case 'fire':
      return () => fireLobeMesh(look, m.tone);
    case 'smoke':
      return () => smokeMesh(false, look, m.shade);
    case 'mist':
      return () => smokeMesh(true, look);
    case 'dust':
      return () => dustMesh(look);
    case 'spray':
      return () => sprayMesh();
  }
}

/** Ground height (world y) under a point: the terrain's top, or the sea. */
function groundAt(shape: ShapePlan | null, x: number, z: number): { y: number; water: boolean } {
  const fx = Math.floor(x), fz = Math.floor(z);
  if (!shape || !inColumnBounds(fx, fz)) return { y: SEA_Y, water: true };
  const h = shape.terrain.height[columnIndex(fx, fz)]!;
  return h === 0 ? { y: SEA_Y, water: true } : { y: h * CELL_H, water: false };
}

/**
 * Every lobe of the cloud at `t`: the fireball, then the rising column and its cap, the dust skirt drawn
 * in at its foot, the dust wall behind the shockwave; and, after a while, all of it as thinning washes.
 */
function cloudAt(n: Nuke, t: number, shape: ShapePlan | null, wind: { dirX: number; dirZ: number; strength: number }): Lobe[] {
  const out: Lobe[] = [];
  const seed = n.id;
  // The fire goes out of it over the first seconds; then it goes from dark smoke to grey.
  const fire = t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) / (T.fireOut - 1.1));
  const shade = t < T.fireOut * 0.8 ? 0 : t < T.grey ? 1 : 2;
  const thin = t < T.thinFrom ? 0 : Math.min(1, (t - T.thinFrom) / (T.gone - T.thinFrom));
  const wash = thin > 0;
  const alpha = 0.85 * (1 - thin) ** 1.2;
  // Downwind drift, growing once it has formed.
  const drift = Math.max(0, t - 3) * (0.18 + 0.25 * wind.strength);
  const lean = (f: number): [number, number] => [wind.dirX * drift * f, wind.dirZ * drift * f];
  const matFor = (fireish: boolean, i: number, toneBias = 0): Mat => {
    if (wash) return { k: 'mist' };
    if (fireish) return { k: 'fire', tone: Math.max(0, Math.min(3, (t < 0.9 ? 2 : t < 2.2 ? 1 : 0) + ((i + toneBias) % 3 === 0 ? 1 : 0) - (i % 4 === 3 ? 1 : 0))) };
    return { k: 'smoke', shade };
  };

  // The fireball / the cap.
  const R = 3.4 * easeOut(t / T.swell);
  const H = n.y + R * 0.8 + riseHeight(t);
  // From a ball (on the ground) to a torus rolling over (aloft): b = 0 ball, 1 cap.
  const b = easeOut((t - T.lift) / 1.4);
  const ring = (0.6 + 3.6 * easeOut((t - 0.8) / 4) + (t > T.fireOut ? Math.min(2.6, (t - T.fireOut) * 0.2) : 0)) * b;
  const tube = R * 0.55 * (1 - b) + (1.9 + (t > T.fireOut ? Math.min(0.8, (t - T.fireOut) * 0.06) : 0)) * b;
  const flat = 1 - 0.38 * easeOut((t - T.fireOut) / 6);
  const roll = 4.2 * easeOut(t / 4) + 0.12 * t;
  const [cx, cz] = lean(1);
  const N = 30;
  for (let i = 0; i < N; i++) {
    const u = rand(seed, 'lobe', i);
    // Ball: points on a sphere, tumbling.
    const a = i * 2.39996 + t * 0.9;
    const el = Math.acos(1 - 2 * ((i + 0.5) / N)) - Math.PI / 2;
    const ballP: [number, number, number] = [Math.cos(a) * Math.cos(el) * R * 0.6, Math.sin(el) * R * 0.55, Math.sin(a) * Math.cos(el) * R * 0.6];
    // Cap: on a torus, each turning over the tube (inside out).
    const th = (i / N) * Math.PI * 2 + seed * 0.37;
    const ph = roll + (i % 2) * Math.PI + rand(seed, 'ph', i) * 0.8;
    const rr = ring + Math.cos(ph) * tube;
    const capP: [number, number, number] = [Math.cos(th) * rr, Math.sin(ph) * tube * flat, Math.sin(th) * rr];
    const p: [number, number, number] = [ballP[0] * (1 - b) + capP[0] * b, ballP[1] * (1 - b) + capP[1] * b, ballP[2] * (1 - b) + capP[2] * b];
    // Fire glows longest through the underside and the cracks of the roll.
    const fireish = !wash && (t < 1.2 || u < fire * (Math.sin(ph) < 0 ? 1.45 : 0.85));
    const size = (R * 0.5 * (1 - b) + tube * 1.1 * b) * (0.85 + 0.3 * u) * (1 + thin * 0.6);
    // Once smoke has come over it, the fire left is smaller and sunk into the roll: it glows through the cracks.
    const sunk = fireish && t > 1.2 ? Math.min(1, (t - 1.2) / 1.2) : 0;
    const inward = 1 - 0.18 * sunk;
    out.push({ x: n.x + cx + p[0] * inward, y: H + p[1] - 0.3 * sunk * tube, z: n.z + cz + p[2] * inward, r: size * (1 - 0.28 * sunk), sy: flat, mat: matFor(fireish, i), look: i % 3, alpha });
  }
  // The dome over the cap.
  if (b > 0.2) {
    for (let i = 0; i < 13; i++) {
      const a = (i < 9 ? i / 8 : (i - 9) / 4 + 0.12) * Math.PI * 2 + seed;
      const r0 = i === 0 ? 0 : i < 9 ? ring * 0.6 : ring * 0.28;
      const fireish = !wash && (t < 1.6 || rand(seed, 'dome', i) < fire * 0.5);
      out.push({ x: n.x + cx + Math.cos(a) * r0, y: H + tube * 0.75 * flat + (i === 0 ? 0.35 : 0), z: n.z + cz + Math.sin(a) * r0, r: tube * (i === 0 ? 1.3 : 1.1) * (1 + thin * 0.6), sy: flat, mat: matFor(fireish, i, 1), look: (i + 1) % 3, alpha });
    }
  }
  // The stem: a thick column from the ground up into the cap, thinning and leaning as it settles.
  if (t > T.lift) {
    const top = H - tube * 0.7;
    const M = 18;
    const width = (1.5 - 0.65 * easeOut((t - T.fireOut) / 10)) * Math.min(1, (t - T.lift) * 2.5);
    for (let i = 0; i < M; i++) {
      const f = i / (M - 1);
      const y = n.y + 0.2 + (top - n.y - 0.2) * f;
      if (y > top) continue;
      const [lx, lz] = lean(f * f);
      const wob = Math.sin(t * 2 + i * 1.3) * 0.1;
      const fireish = !wash && f > 0.55 && rand(seed, 'stem', i) < fire * 1.2;
      out.push({ x: n.x + lx + wob, y, z: n.z + lz, r: width * (0.7 + 0.5 * (1 - f) ** 3) * (1 + thin * 0.6), mat: matFor(fireish, i, 2), look: i % 3, alpha });
    }
  }
  // The skirt: dust drawn in toward the foot of the column and up it.
  if (t > 0.5 && t < 14) {
    const S = 14;
    const s = 4.2 - 2.8 * easeOut((t - 0.5) / 4);
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2 + t * 0.25 + seed;
      const x = n.x + Math.cos(a) * s * (0.85 + 0.3 * rand(seed, 'sk', i));
      const z = n.z + Math.sin(a) * s * (0.85 + 0.3 * rand(seed, 'sk', i));
      const g = groundAt(shape, x, z);
      const lift = (1 - s / 4.2) * 2.4;
      out.push({ x, y: g.y + 0.3 + lift * (0.5 + 0.5 * rand(seed, 'skh', i)), z, r: 0.85 + 0.3 * rand(seed, 'skr', i), sy: 0.75, mat: t > 8 || wash ? { k: 'mist' } : { k: g.water ? 'spray' : 'dust' }, look: i % 3, alpha: t > 8 ? 0.6 * Math.max(0, 1 - (t - 8) / 6) : alpha });
    }
  }
  // Haze lingering low over the crater.
  if (t > 4) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + seed;
      out.push({ x: n.x + Math.cos(a) * 1.8, y: n.y + 0.5, z: n.z + Math.sin(a) * 1.8, r: 1.4, sy: 0.5, mat: { k: 'mist' }, look: i % 3, alpha: 0.35 * Math.min(1, (t - 4) / 3) * Math.max(0, 1 - (t - 20) / 30) });
    }
  }
  return out;
}

/** The scorched crater: blackened ground over the bowl, a dark glassy rim, drawn on the terrain as it now is. */
function scorchMesh(n: Nuke, shape: ShapePlan): MeshData {
  const b = new MeshBuilder({ ink: `nuke-scorch${n.id}` });
  const R = NUKE.crater + 1.4;
  const char = rgb(DAMAGE_COLORS.charDeep);
  const scorch = rgb(DAMAGE_COLORS.scorch);
  for (let z = Math.floor(n.z - R); z <= Math.ceil(n.z + R); z++) {
    for (let x = Math.floor(n.x - R); x <= Math.ceil(n.x + R); x++) {
      if (!inColumnBounds(x, z)) continue;
      const h = shape.terrain.height[columnIndex(x, z)]!;
      if (h === 0) continue;
      // Built on: the scorch shows only on open ground and floors (a block stands in the way).
      if (shape.kinds.has(key(x, h, z))) continue;
      const y = h * CELL_H + 0.05;
      // In quarters, so its edge is ragged rather than square.
      for (let q = 0; q < 4; q++) {
        const qx = x + (q & 1) * 0.5, qz = z + (q >> 1) * 0.5;
        const d = Math.hypot(qx + 0.25 - n.x, qz + 0.25 - n.z) * (0.85 + 0.3 * rand(n.id, x, z, q));
        if (d > R) continue;
        const rim = d > NUKE.crater - 0.45 && d < NUKE.crater + 0.35;
        const t = Math.min(1, d / R);
        if (rim) b.setColor('#3e3d44').setPattern(PATTERN.metal).setInk('rim');
        else b.setColor([char[0] + (scorch[0] - char[0]) * t, char[1] + (scorch[1] - char[1]) * t, char[2] + (scorch[2] - char[2]) * t]).setPattern(PATTERN.dirt).setInk('scorch');
        b.quad([qx, y, qz], [qx, y, qz + 0.5], [qx + 0.5, y, qz + 0.5], [qx + 0.5, y, qz]);
      }
    }
  }
  return b.build();
}

function onEvent(st: State, stage: LifeStage, signals: Signals, e: MischiefEvent): void {
  if (e.type === 'drop' && e.bomb.nuke) {
    st.falling.set(e.bomb.id, { h: stage.spawnMesh(nukeCasingMesh(), HIDDEN), point: [...e.bomb.point], age: 0, fall: e.bomb.fall, seed: e.bomb.id });
  } else if (e.type === 'blast' && e.nuke) {
    const f = st.falling.get(e.bomb);
    if (f) {
      f.h.release();
      st.falling.delete(e.bomb);
    }
    const [x, y, z] = e.blast.point;
    // Every bird on the island takes off.
    scaresOf(stage).add(key(Math.floor(x), Math.max(0, Math.floor(y / CELL_H)), Math.floor(z)), 99, false, signals.time.seconds);
    const near: { id: StructureId; d: number }[] = [];
    const seen = new Set<StructureId>();
    for (const h of e.blast.hit) {
      const sid = st.shape?.structureAt.get(h.cell);
      if (sid === undefined || seen.has(sid)) continue;
      seen.add(sid);
      const c = h.cell as CellKey;
      near.push({ id: sid, d: Math.hypot((c & 63) + 0.5 - x, ((c >> 6) & 63) + 0.5 - z) });
    }
    near.sort((a, b) => a.d - b.d);
    st.nukes.push({ id: e.bomb, x, y, z, t: 0, water: e.blast.water, slots: [], core: null, band: null, arcs: [], light: null, near, nextShake: 0, ash: [], scorch: null, scorchOf: null, embers: [], frame: -1 });
  }
}

export default defineSystem<State>({
  id: 'mischief.nuke',
  order: 13,
  create(ctx) {
    const d = mischiefOf(ctx.stage);
    const st: State = { d, shape: null, falling: new Map(), nukes: [], pools: new Map(), toShake: [], shakes: [], off: () => {} };
    st.off = d.on((e) => onEvent(st, ctx.stage, ctx.signals, e));
    return st;
  },
  sync(st, next, _prev, ctx) {
    st.shape = next.shape;
    // Buildings the ring has reached shudder once they are redrawn with their damage.
    for (const s of st.toShake) if (next.shape.structures.has(s.id)) st.shakes.push({ h: ctx.stage.liftStructure(s.id), age: 0, amp: s.amp });
    st.toShake = [];
    // The scorched crater, once the ground has gone down (and again if the land changes under it).
    for (const n of st.nukes) {
      if (n.water || n.t < 0.3 || n.scorchOf === next.shape.terrain) continue;
      n.scorchOf = next.shape.terrain;
      n.scorch?.release();
      n.scorch = ctx.stage.spawnMesh(scorchMesh(n, next.shape), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }
  },
  update(st, dt, signals, ctx) {
    const stage = ctx.stage;
    // ── the casing falling ──────────────────────────────────────────────
    for (const [id, f] of st.falling) {
      const bomb = st.d.bombs.find((b) => b.id === id);
      if (!bomb) {
        // Taken back by undo before it went off.
        f.h.release();
        st.falling.delete(id);
        continue;
      }
      f.age = bomb.age;
      const [x, y, z] = f.point;
      const u = Math.min(1, f.age / f.fall);
      // Nose down, wobbling a little in the air; then stuck in the ground at a slant.
      const wob = u < 1 ? Math.sin(f.age * 7) * 0.12 : 0.18;
      const m = compose(translation(x, y + 11 * (1 - u * u) - (u >= 1 ? 0.12 : 0), z), rotationY(rand(f.seed, 'yaw') * 6), rotationZ(wob), rotationX(u < 1 ? Math.cos(f.age * 5) * 0.08 : 0.1), [1.8, 0, 0, 0, 0, 1.8, 0, 0, 0, 0, 1.8, 0, 0, 0, 0, 1]);
      f.h.setMatrix(m);
      f.h.setVisible(true);
    }

    // ── each nuke's show ────────────────────────────────────────────────
    for (let ni = st.nukes.length - 1; ni >= 0; ni--) {
      const n = st.nukes[ni]!;
      n.t += dt;
      const t = n.t;
      if (t > T.gone + 2 && n.ash.length === 0 && n.embers.length === 0) {
        for (const s of n.slots) if (s.h) st.pools.get(s.key)?.give(s.h);
        n.core?.release();
        n.band?.release();
        for (const a of n.arcs) for (const h of [a.ring, a.wall, a.mist]) h?.release();
        n.light?.release();
        // The scorch stays (the crater is there until the player fills it).
        st.nukes.splice(ni, 1);
        continue;
      }
      // The ring reaches buildings in order of distance: each shudders as it passes.
      const r = waveRadius(t);
      while (n.nextShake < n.near.length && n.near[n.nextShake]!.d <= r) {
        const s = n.near[n.nextShake++]!;
        if (n.nextShake <= 60) st.toShake.push({ id: s.id, amp: Math.max(0.02, 0.09 - s.d * 0.003) });
      }
      // Smooth things (the flash, the ring) every frame; the cloud on twos.
      // The core: white-hot, shrinking fast.
      if (t < 0.35) {
        n.core ??= stage.spawnMesh(nukeCoreMesh(), HIDDEN);
        const s = 2.6 * (1 - t / 0.35) ** 1.5 + 0.3;
        n.core.setMatrix([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, n.x, n.y + s * 0.5, n.z, 1]);
        n.core.setParams(1);
        n.core.setVisible(true);
      } else if (n.core) {
        n.core.release();
        n.core = null;
      }
      // The shockwave: a bright ring racing out across the ground, a pale band standing off it, and close
      // behind, a low wall of dust (spray over the sea) that rises fast, then settles into a thinning wash.
      // Drawn in arcs, so what would hang off the edge of the island is left out.
      const g0 = groundAt(st.shape, n.x, n.z).y;
      if (t < T.waveTime + 0.35) {
        n.band ??= stage.spawnMesh(shockBandMesh(), HIDDEN);
        const rr = Math.max(0.2, r);
        n.band.setMatrix([rr, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, rr, 0, n.x, g0, n.z, 1]);
        n.band.setParams(0.55 * Math.max(0, 1 - t / (T.waveTime + 0.35)));
        n.band.setVisible(true);
      } else if (n.band) {
        n.band.release();
        n.band = null;
      }
      const wr = Math.max(0.3, waveRadius(t - 0.05) * 0.97);
      const up = Math.min(1, t * 5) * (t < 1.4 ? 1 : Math.max(0.4, 1 - (t - 1.4) / 2));
      for (let k = 0; k < ARCS; k++) {
        const arc = (n.arcs[k] ??= { ring: null, wall: null, mist: null, kind: '' });
        const a0 = (k / ARCS) * Math.PI * 2, am = a0 + Math.PI / ARCS;
        const mx = n.x + Math.cos(am) * wr, mz = n.z + Math.sin(am) * wr;
        const a1 = a0 + (Math.PI * 2) / ARCS;
        const inside = (a: number): boolean => inColumnBounds(Math.floor(n.x + Math.cos(a) * wr), Math.floor(n.z + Math.sin(a) * wr));
        const on = inside(a0) && inside(a1) && inColumnBounds(Math.floor(mx), Math.floor(mz));
        const ground = groundAt(st.shape, mx, mz);
        const place = (h: InstanceHandle, rad: number, y: number, sy: number): void => {
          h.setMatrix(compose(translation(n.x, y, n.z), rotationY(-a0), scaling(rad, sy, rad)));
          h.setVisible(true);
        };
        // The ring.
        const ringOn = t < T.waveTime + 0.15 && inColumnBounds(Math.floor(n.x + Math.cos(am) * r), Math.floor(n.z + Math.sin(am) * r));
        if (ringOn) {
          arc.ring ??= stage.spawnMesh(shockRingMesh(), HIDDEN);
          place(arc.ring, Math.max(0.2, r), groundAt(st.shape, n.x + Math.cos(am) * r, n.z + Math.sin(am) * r).y + 0.06, 1);
          arc.ring.setParams(1);
        } else if (arc.ring) {
          arc.ring.release();
          arc.ring = null;
        }
        // The wall, drawn while it is up; dust on land, spray on the sea.
        const kind = ground.water ? 'spray' : 'dust';
        const wallOn = on && t > 0.03 && t < 1.8;
        if (wallOn && arc.kind !== kind && arc.wall) {
          pool(st, stage, `wall-${arc.kind}${k % 3}`, () => dustWallMesh(arc.kind as 'dust', k)).give(arc.wall);
          arc.wall = null;
        }
        if (wallOn) {
          arc.wall ??= pool(st, stage, `wall-${kind}${k % 3}`, () => dustWallMesh(kind, k)).take();
          arc.kind = kind;
          place(arc.wall, wr, ground.y, up * (ground.water ? 1.8 : 1.3));
        } else if (arc.wall) {
          pool(st, stage, `wall-${arc.kind}${k % 3}`, () => dustWallMesh(arc.kind as 'dust', k)).give(arc.wall);
          arc.wall = null;
        }
        // Then the wash it settles into.
        const mistOn = on && t > 1.2 && t < 9;
        if (mistOn) {
          arc.mist ??= pool(st, stage, `wall-mist${k % 3}`, () => dustWallMesh('mist', k)).take();
          place(arc.mist, wr, ground.y, 1.6 + (t - 1.2) * 0.25);
          arc.mist.setParams(0.7 * Math.max(0, 1 - (t - 1.8) / 7.2));
        } else if (arc.mist) {
          pool(st, stage, `wall-mist${k % 3}`, () => dustWallMesh('mist', k)).give(arc.mist);
          arc.mist = null;
        }
      }
      // The fireball's light on the town: strong at once, fading as it rises and dies.
      const dark = 1 - signals.time.light;
      const glow = t < 0.12 ? 1 : Math.max(0, 1 - (t - 0.12) / 5) ** 1.5;
      if (glow > 0.01) {
        n.light ??= stage.spawnMesh(firelightMesh(), HIDDEN);
        const lr = 9 + 5 * Math.min(1, t);
        n.light.setMatrix([lr, 0, 0, 0, 0, lr * 0.7, 0, 0, 0, 0, lr, 0, n.x, n.y + riseHeight(t) * 0.6, n.z, 1]);
        n.light.setParams((0.12 + 0.5 * dark) * glow);
        n.light.setVisible(true);
      } else if (n.light) {
        n.light.release();
        n.light = null;
      }
      // Ash falling over the crater for a while, then embers dying in the scorch.
      if (t > 3 && t < 34 && n.ash.length < 26) {
        const i = n.ash.length;
        n.ash.push({ h: pool(st, stage, 'ash', ashMesh).take(), x: n.x + (rand(n.id, 'ax', i) - 0.5) * 8, y: n.y + 5 + rand(n.id, 'ay', i) * 4, z: n.z + (rand(n.id, 'az', i) - 0.5) * 8, vy: 0.25 + rand(n.id, 'av', i) * 0.2, spin: rand(n.id, 'as', i) * 6 });
      }
      for (let k = n.ash.length - 1; k >= 0; k--) {
        const a = n.ash[k]!;
        const w = signals.wind(a.x, a.z);
        a.y -= a.vy * dt;
        a.x += w.dirX * w.strength * dt * 0.4 + Math.sin(t * 2 + k) * dt * 0.15;
        a.z += w.dirZ * w.strength * dt * 0.4;
        const ground = groundAt(st.shape, a.x, a.z).y;
        if (a.y <= ground + 0.02) {
          if (t < 30) {
            a.y = n.y + 6 + rand(n.id, 'ay', k, Math.floor(t)) * 3;
            a.x = n.x + (rand(n.id, 'ax', k, Math.floor(t)) - 0.5) * 8;
            a.z = n.z + (rand(n.id, 'az', k, Math.floor(t)) - 0.5) * 8;
          } else {
            pool(st, stage, 'ash', ashMesh).give(a.h);
            n.ash.splice(k, 1);
            continue;
          }
        }
        a.h.setMatrix(compose(translation(a.x, a.y, a.z), rotationY(a.spin + t * 2), [0.05, 0, 0, 0, 0, 0.05, 0, 0, 0, 0, 0.05, 0, 0, 0, 0, 1]));
        a.h.setVisible(true);
      }
      if (t > 1 && n.embers.length === 0 && !n.water) {
        for (let i = 0; i < 9; i++) {
          const h = pool(st, stage, 'ember', emberMesh).take();
          const a = rand(n.id, 'ea', i) * Math.PI * 2, rr = rand(n.id, 'er', i) * NUKE.crater;
          const x = n.x + Math.cos(a) * rr, z = n.z + Math.sin(a) * rr;
          h.setMatrix(compose(translation(x, groundAt(st.shape, x, z).y + 0.06, z), rotationY(a)));
          h.setVisible(true);
          n.embers.push(h);
        }
      }
      if (n.embers.length > 0) {
        const fade = Math.max(0, 1 - (t - 1) / 60);
        n.embers.forEach((h, i) => h.setParams(fade * (0.7 + 0.3 * Math.sin(t * 3 + i))));
        if (fade <= 0) {
          for (const h of n.embers) pool(st, stage, 'ember', emberMesh).give(h);
          n.embers = [];
        }
      }

      // The cloud, on twos.
      const frame = Math.floor(t * FPS);
      if (frame === n.frame) continue;
      n.frame = frame;
      const lobes = t < T.gone ? cloudAt(n, t, st.shape, signals.wind(n.x, n.z)) : [];
      while (n.slots.length < lobes.length) n.slots.push({ h: null, key: '' });
      n.slots.forEach((slot, i) => {
        const l = lobes[i];
        if (!l || (l.alpha !== undefined && l.alpha <= 0.01)) {
          if (slot.h) {
            st.pools.get(slot.key)!.give(slot.h);
            slot.h = null;
            slot.key = '';
          }
          return;
        }
        const k = matKey(l.mat, l.look);
        if (slot.key !== k) {
          if (slot.h) st.pools.get(slot.key)!.give(slot.h);
          slot.h = pool(st, stage, k, meshOf(l.mat, l.look)).take();
          slot.key = k;
        }
        const s = l.r * 2;
        slot.h!.setMatrix([s, 0, 0, 0, 0, s * (l.sy ?? 1) * 0.9, 0, 0, 0, 0, s, 0, l.x, l.y, l.z, 1]);
        if (l.mat.k === 'mist') slot.h!.setParams(l.alpha ?? 0.7);
        else if (l.mat.k === 'fire') slot.h!.setParams(1);
        slot.h!.setVisible(true);
      });
    }

    // Shudders.
    let kept = 0;
    for (const s of st.shakes) {
      s.age += dt;
      if (!s.h || s.age > 0.6) {
        s.h?.release();
        continue;
      }
      st.shakes[kept++] = s;
      const k = s.amp * (1 - s.age / 0.6) * Math.sin(s.age * 50);
      const b = s.h.base;
      const m = Array.from(b);
      m[12] = b[12]! + k;
      m[14] = b[14]! + k * 0.6;
      s.h.setMatrix(m);
    }
    st.shakes.length = kept;
    void hash;
  },
  dispose(st) {
    st.off();
    for (const f of st.falling.values()) f.h.release();
    for (const n of st.nukes) {
      for (const s of n.slots) s.h?.release();
      for (const h of [n.core, n.band, ...n.arcs.flatMap((a) => [a.ring, a.wall, a.mist]), n.light, n.scorch, ...n.embers, ...n.ash.map((a) => a.h)]) h?.release();
    }
    for (const s of st.shakes) s.h?.release();
    for (const p of st.pools.values()) p.dispose();
  },
});
