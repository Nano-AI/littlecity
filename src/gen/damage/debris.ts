// A blasted building's pieces (Mischief). Owner: Mischief. Pure.
//
// What a blast tears off a building is cut from the building's own drawn
// geometry into chunks a third of a cell across: real bits of its wall with
// a window frame in them, of its roof in its own tiles, of its door. Each
// chunk has a resting place on the rubble heap (or in the water, for a
// dock), worked out from the structure's seed alone. The generator bakes the
// chunks there; the blast animation flies the very same chunks from where
// they were to where they rest, so when they land they become the heap.

import { CELL_H, SEA_Y } from '@/core/grid';
import { hash, rand } from '@/core/rand';
import type { Mat4 } from '@/core/mat4';
import { RUIN } from '@/style/damage';
import { STONE_KINDS, TOPPLE_KINDS, type Column, type Profile } from './field';
import { backOf, bounds, centroid, clip, type Poly } from './poly';

export interface Chunk {
  /** The chunk where it was, in world space; both sides drawn. */
  polys: Poly[];
  /** Its centre where it was ... */
  from: [number, number, number];
  /** ... and where it comes to rest. */
  to: [number, number, number];
  /** The resting turn: about a level axis (axisX, 0, axisZ) by `tip`, then about up by `yaw`. */
  axisX: number;
  axisZ: number;
  tip: number;
  yaw: number;
  /** A stable number for the animation's own chance (spin, delay). */
  key: number;
  /** Falls over in one piece about a pivot (a tree, a pillar) instead of flying. */
  topple?: { pivot: [number, number, number] };
}

/** Rotation about a unit level axis (ax, 0, az) by `a`, then about +y by `yaw`; as a column-major 3×3 in a Mat4. */
export function restRotation(ax: number, az: number, a: number, yaw: number): Mat4 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  // Rodrigues for axis (ax, 0, az).
  const r = [
    t * ax * ax + c, s * az, t * ax * az,
    -s * az, c, s * ax,
    t * ax * az, -s * ax, t * az * az + c,
  ];
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  // Y rotation (column-major): [cy, 0, -sy | 0, 1, 0 | sy, 0, cy]
  const y = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const m = new Array<number>(16).fill(0);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += y[k * 3 + row]! * r[col * 3 + k]!;
      m[col * 4 + row] = v;
    }
  }
  m[15] = 1;
  return m;
}

/** The world matrix that takes a chunk from where it was to `t` of the way to its rest (t = 1: at rest). */
export function chunkMatrix(ch: Chunk, tip: number, yaw: number, at: readonly [number, number, number]): Mat4 {
  const m = restRotation(ch.axisX, ch.axisZ, tip, yaw);
  const [fx, fy, fz] = ch.from;
  if (ch.topple) {
    const [px, py, pz] = ch.topple.pivot;
    // About the pivot: x' = R (x − p) + p.
    m[12] = px - (m[0]! * px + m[4]! * py + m[8]! * pz);
    m[13] = py - (m[1]! * px + m[5]! * py + m[9]! * pz);
    m[14] = pz - (m[2]! * px + m[6]! * py + m[10]! * pz);
    return m;
  }
  // x' = R (x − from) + at
  m[12] = at[0] - (m[0]! * fx + m[4]! * fy + m[8]! * fz);
  m[13] = at[1] - (m[1]! * fx + m[5]! * fy + m[9]! * fz);
  m[14] = at[2] - (m[2]! * fx + m[6]! * fy + m[10]! * fz);
  return m;
}

export const restMatrix = (ch: Chunk): Mat4 => chunkMatrix(ch, ch.tip, ch.yaw, ch.to);

/** Cuts polygons into pieces no bigger than a chunk, on a grid offset by the structure's seed. */
function dice(polys: readonly Poly[], size: number, seed: number): Map<string, Poly[]> {
  const ox = rand(seed, 'dice-x') * size;
  const oy = rand(seed, 'dice-y') * size;
  const oz = rand(seed, 'dice-z') * size;
  const out = new Map<string, Poly[]>();
  const cutAxis = (list: Poly[], axis: 0 | 1 | 2, off: number): { piece: Poly; i: number }[] => {
    const res: { piece: Poly; i: number }[] = [];
    for (const p of list) {
      const b = bounds(p);
      const lo = b[axis]!;
      const hi = b[axis + 3]!;
      let i0 = Math.floor((lo - off + 1e-6) / size);
      const i1 = Math.max(i0, Math.floor((hi - off - 1e-6) / size));
      if (i1 < i0) i0 = i1;
      for (let i = i0; i <= i1; i++) {
        const a = [0, 0, 0];
        a[axis] = 1;
        let q: Poly | null = p;
        if (i1 > i0) {
          // keep off + i·size ≤ coord ≤ off + (i + 1)·size
          q = clip(q, -a[0]!, -a[1]!, -a[2]!, off + i * size);
          if (q) q = clip(q, a[0]!, a[1]!, a[2]!, -(off + (i + 1) * size));
        }
        if (q) res.push({ piece: q, i });
      }
    }
    return res;
  };
  for (const p of polys) {
    for (const { piece: px, i: ix } of cutAxis([p], 0, ox)) {
      for (const { piece: pz, i: iz } of cutAxis([px], 2, oz)) {
        for (const { piece, i: iy } of cutAxis([pz], 1, oy)) {
          const k = `${ix},${iy},${iz}`;
          let list = out.get(k);
          if (!list) out.set(k, (list = []));
          list.push(piece);
        }
      }
    }
  }
  return out;
}

function lowestAfter(polys: readonly Poly[], ch: Chunk): number {
  const m = restRotation(ch.axisX, ch.axisZ, ch.tip, ch.yaw);
  const [fx, fy, fz] = ch.from;
  let lo = Infinity;
  for (const p of polys) {
    for (const v of p.v) {
      const x = v[0]! - fx, y = v[1]! - fy, z = v[2]! - fz;
      const yy = m[1]! * x + m[5]! * y + m[9]! * z;
      if (yy < lo) lo = yy;
    }
  }
  return lo;
}

/** Height of a column's rubble heap above its wreck base, at a point. */
export function heapHeight(col: Column, x: number, z: number): number {
  const r = Math.hypot(x - (col.x + 0.5), z - (col.z + 0.5)) / 0.62;
  return r >= 1 ? 0 : RUIN.heap * CELL_H * (1 - r * r);
}

/**
 * The chunks a blast makes of what it took off a structure (`removed`, from
 * the structure's own intact geometry), with their resting places.
 */
export function debrisOf(removed: readonly Poly[], prof: Profile): Chunk[] {
  const seed = prof.s.seed;
  const out: Chunk[] = [];
  const stone = STONE_KINDS.has(prof.s.kind);
  // A tree or a pillar blown down falls over in one piece, toward open ground.
  if (TOPPLE_KINDS.has(prof.s.kind) && removed.length > 0) {
    const col = [...prof.columns.values()][0]!;
    if (col.stage === 3) return [toppleOf(removed, col, prof)];
  }
  const size = RUIN.chunk * (stone ? 1.15 : 1);
  for (const [k, polys] of dice(removed, size, seed)) {
    const from = centroid({ v: polys.flatMap((p) => p.v), pattern: 0, ink: 0 });
    const col = prof.columnNear(from[0], from[2]);
    if (!col) continue;
    const key = hash(seed, 'chunk', k);
    const r = (n: string): number => rand(key, n);
    const ch: Chunk = { polys: [], from, to: from, axisX: 1, axisZ: 0, tip: 0, yaw: 0, key };
    const phi = r('axis') * Math.PI * 2;
    ch.axisX = Math.cos(phi);
    ch.axisZ = Math.sin(phi);
    ch.yaw = (r('yaw') - 0.5) * Math.PI * 1.6;
    // Thin pieces of wall and roof come to lie more or less flat.
    ch.tip = (0.55 + 0.45 * r('tip')) * (Math.PI / 2) * (r('side') < 0.5 ? -1 : 1);
    let tx: number, tz: number, ground: number;
    if (prof.s.kind === 'dock') {
      // Planks drop into the water and float there.
      tx = col.x + 0.5 + (r('tx') - 0.5) * 1.5;
      tz = col.z + 0.5 + (r('tz') - 0.5) * 1.5;
      ground = SEA_Y - 0.03;
      ch.tip = (r('tip') - 0.5) * 0.4;
    } else if (col.stage >= 3) {
      // Onto the heap, spilling onto open ground beside it.
      const spill = (dx: number, dz: number): number =>
        prof.openGround(col.x + dx, col.z + dz, col.wreckBase) === null ? -0.02 : RUIN.spill;
      const x0 = col.x - spill(-1, 0);
      const x1 = col.x + 1 + spill(1, 0);
      const z0 = col.z - spill(0, -1);
      const z1 = col.z + 1 + spill(0, 1);
      const tri = (a: string, b: string): number => (r(a) + r(b)) / 2;
      tx = x0 + (x1 - x0) * tri('tx', 'tx2');
      tz = z0 + (z1 - z0) * tri('tz', 'tz2');
      ground = col.wreckBase + heapHeight(col, tx, tz);
    } else {
      // A bite off the top falls to the foot of the wall on its own side.
      let dx = from[0] - (col.x + 0.5);
      let dz = from[2] - (col.z + 0.5);
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const side = Math.abs(dx) > Math.abs(dz) ? ([Math.sign(dx), 0] as const) : ([0, Math.sign(dz)] as const);
      const g = prof.openGround(col.x + side[0], col.z + side[1], col.base);
      if (g !== null) {
        const out1 = 0.62 + r('far') * 0.32;
        tx = col.x + 0.5 + side[0] * out1 + (side[0] === 0 ? (r('tx') - 0.5) * 0.9 : 0);
        tz = col.z + 0.5 + side[1] * out1 + (side[1] === 0 ? (r('tz') - 0.5) * 0.9 : 0);
        ground = g;
      } else {
        // No open ground there: it lands inside, on the top storey's floor.
        tx = col.x + 0.2 + r('tx') * 0.6;
        tz = col.z + 0.2 + r('tz') * 0.6;
        ground = Math.max(col.base, col.top - CELL_H);
      }
    }
    const dark = polys.length ? [polys[0]!.v[0]![6]! * 0.8, polys[0]!.v[0]![7]! * 0.8, polys[0]!.v[0]![8]! * 0.8] : null;
    ch.polys = [...polys, ...polys.map((p) => backOf(p, 0.018, dark))];
    const lo = lowestAfter(ch.polys, ch);
    ch.to = [tx, ground - lo - 0.025, tz];
    out.push(ch);
  }
  out.sort((a, b) => a.key - b.key);
  return out;
}

function toppleOf(removed: readonly Poly[], col: Column, prof: Profile): Chunk {
  const seed = prof.s.seed;
  const sides = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
  const start = Math.floor(rand(seed, 'topple') * 4);
  let dir: readonly [number, number] = sides[start]!;
  for (let i = 0; i < 4; i++) {
    const d = sides[(start + i) % 4]!;
    if (prof.openGround(col.x + d[0], col.z + d[1], col.wreckBase) !== null) {
      dir = d;
      break;
    }
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of removed) for (const v of p.v) {
    lo = Math.min(lo, v[1]!);
    hi = Math.max(hi, v[1]!);
  }
  const pivot: [number, number, number] = [col.x + 0.5 + dir[0] * 0.12, lo, col.z + 0.5 + dir[1] * 0.12];
  // Tip over about the level axis across the fall, until it lies on the ground.
  const ax = -dir[1];
  const az = dir[0];
  const height = Math.max(0.2, hi - lo);
  const above = Math.max(0, lo - col.wreckBase);
  const tip = -(Math.PI / 2 - Math.atan2(above, height * 0.7)) * 0.97;
  const dark = removed.length ? [removed[0]!.v[0]![6]! * 0.8, removed[0]!.v[0]![7]! * 0.8, removed[0]!.v[0]![8]! * 0.8] : null;
  return {
    polys: [...removed, ...removed.map((p) => backOf(p, 0.012, dark))],
    from: pivot,
    to: pivot,
    axisX: ax,
    axisZ: az,
    tip,
    yaw: 0,
    key: hash(seed, 'topple'),
    topple: { pivot },
  };
}
