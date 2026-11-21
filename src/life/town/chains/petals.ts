// L57: the wedding's petals. Thrown by the handful (a shower over the couple
// on the doorstep, handfuls from the guests along the way, the flower
// children's trail), they flutter down and lie where they land, a pink trail
// on the cream of the paths that shows where a wedding went; then they are
// swept up (wedding.ts sends a sweeper, broom and all) or, if nobody comes,
// the wind lifts them and blows them away over the roofs.
//
// Cheap by design: petals in the air are one small instance each, pooled and
// reused (never re-meshed), redrawn on twos; petals on the ground are merged
// into one mesh per cell, rebuilt only when that cell changes. Nothing
// shrinks or fades: a petal is in the air, on the ground, swept, or blown
// away out of the town.
//
// With no stage (tests) the same bookkeeping runs and nothing is drawn.

import { CELL_H, key, type CellKey } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { airborne } from '@/gen/airborne';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { FINERY } from '@/style/town-life';
import type { InstanceHandle, LifeStage } from '../../api';
import { fxOf } from '../../fx/fx';
import { place } from '../../motion/pose';

interface Flying {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The floor it will lie on; and whether it is blowing away (it never lands). */
  floor: number;
  away: boolean;
  age: number;
  spin: number;
  yaw: number;
  colour: number;
  seed: number;
  h: InstanceHandle | null;
}

interface Lying {
  x: number;
  y: number;
  z: number;
  yaw: number;
  colour: number;
  at: number;
}

interface Patch {
  cell: CellKey;
  petals: Lying[];
  h: InstanceHandle | null;
  dirty: boolean;
}

export interface ThrowOptions {
  /** How high they go, and how far they spread round where they come down. */
  up: number;
  spread: number;
  /** The floor (world y) they come down on. */
  floor: number;
  /** Thrown toward this way (a unit vector on the ground), else all round. */
  dirX?: number;
  dirZ?: number;
  /** How far they carry toward `dir` before they spread. */
  reach?: number;
  seed: number;
}

export interface Petals {
  /** A handful: `n` petals from (x, y, z). */
  toss(x: number, y: number, z: number, n: number, o: ThrowOptions): void;
  /** Every frame: `now` life seconds, the wind on the ground (a unit direction and a strength 0–1). */
  step(dt: number, now: number, wind: { dirX: number; dirZ: number; strength: number }): void;
  /** Cells with petals lying in them, in the order they were first strewn. */
  cells(): CellKey[];
  /** The petals in a cell are swept up (a puff of dust where they lay). Returns how many. */
  sweep(cell: CellKey): number;
  /** The wind takes the petals lying in these cells (all, if none given) and blows them away. */
  blow(cells?: readonly CellKey[]): void;
  /** How many there are in the air, and on the ground. */
  readonly flying: number;
  readonly lying: number;
  /** Seconds since the oldest petal still lying came down (0 if none). */
  oldest(now: number): number;
  dispose(): void;
}

/** In the air at once at most (more are not thrown), and on the ground in one cell and in the town. */
const MAX_FLYING = 320;
const MAX_CELL = 46;
const MAX_LYING = 1400;
/** Petal size on the ground and in the air (world units): bigger than life, or they are specks from the overview. */
const SIZE = 0.062;
/** How fast a petal falls at most, and how it drifts. */
const FALL = 0.42;
const GRAVITY = 3.2;
const DRAG = 1.6;

const flyMeshes: MeshData[] = [];
function flyMesh(colour: number): MeshData {
  let m = flyMeshes[colour];
  if (!m) {
    const b = new MeshBuilder({ ink: `petal:${colour}` }).setPattern(airborne(PATTERN.none)).setInk('petal');
    b.setColor(FINERY.petals[colour % FINERY.petals.length]!);
    blade(b, 0, 0, 0, 0, SIZE);
    flyMeshes[colour] = m = b.build();
  }
  return m;
}

/** A petal lying in XZ round (x, y, z), turned by `yaw`: a rounded five-sided blade, both faces. */
function blade(b: MeshBuilder, x: number, y: number, z: number, yaw: number, size: number): void {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const w = size * 0.42, l = size * 0.5;
  const pts: [number, number, number][] = (
    [
      [0, 0.002, -l],
      [w, 0, -l * 0.25],
      [w * 0.7, 0.003, l * 0.55],
      [0, 0.006, l],
      [-w * 0.7, 0.003, l * 0.55],
      [-w, 0, -l * 0.25],
    ] as const
  ).map(([px, py, pz]) => [x + c * px + s * pz, y + py, z - s * px + c * pz]);
  b.polygon(pts);
  b.polygon([...pts].reverse());
}

function patchMesh(p: Patch, k: number, ink: number | null): MeshData {
  const b = new MeshBuilder({ ink: `petals:${p.cell}` }).setPattern(PATTERN.none).setInk('petals');
  // Lying on a path, a square or the grass, they share its ink: no pen line round each petal (at this
  // size a ring of ink is all that would show), only the pink on the ground.
  if (ink !== null) b.setInkId(ink);
  for (const q of p.petals) {
    b.setColor(FINERY.petals[q.colour % FINERY.petals.length]!);
    blade(b, q.x, q.y, q.z, q.yaw, SIZE * k);
  }
  return b.build();
}

/**
 * How much bigger to draw small things in the air (petals, doves) from how far off the camera is: 1 close
 * in (zoom 6 and more), up to `most` from the whole-island view. Read from the app's view, as the people
 * system reads it for loads; 1 where there is none (tests, shots without the app).
 */
export function farScale(most: number): number {
  const z = (globalThis as { __lc?: { view?: { getCamera?(): { zoom: number } } } }).__lc?.view?.getCamera?.().zoom;
  if (z === undefined) return 1;
  return 1 + (most - 1) * Math.max(0, Math.min(1, (6 - z) / (6 - 1.6)));
}

const HIDE: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
const m4: Mat4 = new Array<number>(16).fill(0);

/** Ry(yaw) · Rx(tilt) · S at (x, y, z): a tumbling petal. */
function tumble(x: number, y: number, z: number, yaw: number, tilt: number, out: Mat4, k = 1): Mat4 {
  const c = Math.cos(yaw), sn = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
  // Ry(yaw) · Rx(tilt) · S(k)
  out[0] = c * k; out[1] = 0; out[2] = -sn * k; out[3] = 0;
  out[4] = sn * st * k; out[5] = ct * k; out[6] = c * st * k; out[7] = 0;
  out[8] = sn * ct * k; out[9] = -st * k; out[10] = c * ct * k; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

/** `inkOf`: the ink of the ground in a cell (its path, square or grass), so petals lying there draw no outline. */
export function createPetals(stage: LifeStage | null, inkOf?: (cell: CellKey) => number | null): Petals {
  const flying: Flying[] = [];
  const idle: InstanceHandle[][] = [];
  const patches = new Map<CellKey, Patch>();
  let lying = 0;
  let clock = 0;
  let tick = -1;
  let ground = 1;

  const handleFor = (colour: number, x: number, y: number, z: number): InstanceHandle | null => {
    if (!stage) return null;
    const h = idle[colour]?.pop() ?? stage.spawnMesh(flyMesh(colour), HIDE);
    h.setMatrix(place(x, y, z, 0, 1, 1, 1, m4));
    h.setVisible(true);
    return h;
  };
  const retire = (f: Flying): void => {
    if (!f.h) return;
    f.h.setVisible(false);
    (idle[f.colour] ??= []).push(f.h);
    f.h = null;
  };

  const lay = (f: Flying, now: number): void => {
    const cell = key(Math.floor(f.x), Math.max(0, Math.round(f.floor / CELL_H)), Math.floor(f.z));
    let p = patches.get(cell);
    if (!p) patches.set(cell, (p = { cell, petals: [], h: null, dirty: true }));
    if (p.petals.length >= MAX_CELL || lying >= MAX_LYING) {
      // Too many here already: it lands on the others (no more is drawn).
      return;
    }
    p.petals.push({ x: f.x, y: f.floor + 0.012 + (p.petals.length % 3) * 0.002, z: f.z, yaw: f.yaw, colour: f.colour, at: now });
    p.dirty = true;
    lying++;
  };

  const redraw = (p: Patch): void => {
    p.dirty = false;
    p.h?.release();
    p.h = null;
    if (!stage || p.petals.length === 0) return;
    p.h = stage.spawnMesh(patchMesh(p, ground, inkOf?.(p.cell) ?? null), place(0, 0, 0));
  };

  const take = (p: Patch): Lying[] => {
    const out = p.petals;
    lying -= out.length;
    p.petals = [];
    p.h?.release();
    p.h = null;
    patches.delete(p.cell);
    return out;
  };

  const petals: Petals = {
    toss(x, y, z, n, o) {
      const k = Math.min(n, MAX_FLYING - flying.length);
      for (let i = 0; i < k; i++) {
        const r = (w: string): number => rand(o.seed, 'petal', w, i);
        const a = r('a') * Math.PI * 2;
        const out = o.spread * Math.sqrt(r('r'));
        const reach = o.reach ?? 0;
        // Velocity to rise `up` (under GRAVITY) and come down about `out` from the line of the throw.
        const up = o.up * (0.6 + r('up') * 0.5);
        const vy = Math.sqrt(2 * GRAVITY * up);
        const t = vy / GRAVITY + 0.8;
        const tx = (o.dirX ?? 0) * reach + Math.cos(a) * out, tz = (o.dirZ ?? 0) * reach + Math.sin(a) * out;
        const colour = Math.floor(r('c') * FINERY.petals.length);
        const px = x + (r('jx') - 0.5) * 0.06, pz = z + (r('jz') - 0.5) * 0.06;
        flying.push({
          x: px,
          y,
          z: pz,
          vx: tx / t,
          vy,
          vz: tz / t,
          floor: o.floor,
          away: false,
          age: -r('delay') * 0.25,
          spin: 4 + r('spin') * 6,
          yaw: r('yaw') * Math.PI * 2,
          colour,
          seed: o.seed * 31 + i,
          h: handleFor(colour, px, y, pz),
        });
      }
    },
    step(dt, now, wind) {
      clock = now;
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]!;
        f.age += dt;
        if (f.age < 0) continue;
        if (f.away) {
          // Carried off on the wind, up over the roofs and out of the town.
          f.vx += (wind.dirX * (1.2 + wind.strength) - f.vx) * dt * 0.8;
          f.vz += (wind.dirZ * (1.2 + wind.strength) - f.vz) * dt * 0.8;
          f.vy += (0.7 - f.vy) * dt;
        } else {
          f.vy = Math.max(-FALL, f.vy - GRAVITY * dt);
          // Air catches it once it falls: it drifts and sways.
          if (f.vy < 0) {
            const k = Math.exp(-DRAG * dt);
            f.vx = f.vx * k + wind.dirX * wind.strength * 0.25 * dt + Math.sin(f.age * 3 + f.seed) * 0.35 * dt;
            f.vz = f.vz * k + wind.dirZ * wind.strength * 0.25 * dt + Math.cos(f.age * 2.6 + f.seed) * 0.35 * dt;
          }
        }
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.z += f.vz * dt;
        if (!f.away && f.y <= f.floor + 0.01 && f.vy < 0) {
          lay(f, now);
          retire(f);
          flying.splice(i, 1);
          continue;
        }
        if (f.away && (f.y > f.floor + 7 || f.age > 14)) {
          retire(f);
          flying.splice(i, 1);
        }
      }
      // Drawn on twos (fifteen a second), like the people.
      const t = Math.floor(now * 15);
      if (t !== tick) {
        tick = t;
        const k = farScale(2.6);
        for (const f of flying) {
          if (!f.h) continue;
          const a = Math.max(0, f.age);
          f.h.setMatrix(tumble(f.x, f.y, f.z, f.yaw + a * f.spin * 0.3, Math.sin(a * f.spin) * 1.1, m4, k));
        }
        // On the ground, drawn in three sizes as the camera draws back (redrawn when that changes).
        const size = k < 1.4 ? 1 : k < 2 ? 1.45 : 1.9;
        if (size !== ground) {
          ground = size;
          for (const p of patches.values()) p.dirty = true;
        }
        for (const p of patches.values()) if (p.dirty) redraw(p);
      }
    },
    cells: () => [...patches.keys()],
    sweep(cell) {
      const p = patches.get(cell);
      if (!p) return 0;
      const gone = take(p);
      if (stage) {
        for (let i = 0; i < gone.length; i += 6) {
          const q = gone[i]!;
          fxOf(stage).play({ actor: 'puff', variant: 'dust' }, 0.45, (t, m) => place(q.x, q.y + 0.03 + t * 0.1, q.z, 0, 0.25 + t * 0.4, 0.25 + t * 0.4, 0.25 + t * 0.4, m), { delay: (i / 6) * 0.05 });
        }
      }
      return gone.length;
    },
    blow(cells) {
      const list = cells ?? [...patches.keys()];
      for (const cell of list) {
        const p = patches.get(cell);
        if (!p) continue;
        for (const q of take(p)) {
          if (flying.length >= MAX_FLYING) break;
          const r = rand(q.at * 1000, q.x, q.z);
          flying.push({ x: q.x, y: q.y + 0.02, z: q.z, vx: 0, vy: 0.4 + r * 0.6, vz: 0, floor: q.y, away: true, age: -r * 2.5, spin: 5 + r * 5, yaw: q.yaw, colour: q.colour, seed: Math.floor(r * 1000), h: handleFor(q.colour, q.x, q.y + 0.02, q.z) });
        }
      }
    },
    get flying() {
      return flying.length;
    },
    get lying() {
      return lying;
    },
    oldest(now) {
      let first = Infinity;
      for (const p of patches.values()) for (const q of p.petals) first = Math.min(first, q.at);
      return first === Infinity ? 0 : now - first;
    },
    dispose() {
      for (const f of flying) f.h?.release();
      flying.length = 0;
      for (const hs of idle) for (const h of hs ?? []) h.release();
      idle.length = 0;
      for (const p of patches.values()) p.h?.release();
      patches.clear();
      lying = 0;
      void clock;
    },
  };
  return petals;
}
