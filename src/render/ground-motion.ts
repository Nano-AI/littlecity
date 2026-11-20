// The ground moving under the player's hand (shaping the land). When an edit
// raises or digs a few columns, the chunks are rebuilt at once with the new
// ground; this adds, for a moment, a copy of the moved columns that moves:
//
//   raised  the new column, pushed up past its height and settling back
//           (squash and overshoot, like a placed block landing);
//   dug     the old column sinking a level; a column dug down to the water
//           sinks under the surface, so the water closes over it. Columns
//           farther from the old water start a moment later, so a dug
//           channel fills from the water end.
//
// The copy lives in the view's dynamic pool on a slot of its own, and is
// gone when it comes to rest. Nothing else is drawn differently.

import { CELL_H, columnIndex, inColumnBounds, SIZE_X, SIZE_Z } from '@/core/grid';
import type { MeshData } from '@/gen/mesh';
import type { ShapePlan } from '@/resolve/plan';
import type { VertexPool } from './pool';
import type { SlotTable } from './slots';

/** Seconds a column takes to settle. */
const RAISE_TIME = 0.34;
const DIG_TIME = 0.42;
/** Extra delay per column of distance from the old water, for a dug channel filling. */
const FLOW_DELAY = 0.045;
/** More columns than this changing at once is a different island, not an edit: no motion. */
const MOST = 160;

interface Motion {
  key: string;
  slot: number;
  dy: 1 | -1;
  start: number;
  time: number;
}

export interface GroundMotion {
  /** A new town was set: works out what moved and starts its motion. `now` is the view's clock, in seconds. */
  changed(prev: ShapePlan | null, next: ShapePlan, now: number): void;
  /** Once a frame. */
  tick(now: number): void;
  /** Columns that moved in the last edit (for tests and the bench). */
  readonly last: readonly number[];
  clear(): void;
}

/** Height offset (in levels) of a raised column at t (0..1): it pops up past its place and settles. */
export function raiseOffset(t: number): number {
  if (t >= 1) return 0;
  if (t < 0.35) {
    const u = t / 0.35;
    return -0.5 + 0.72 * (1 - (1 - u) * (1 - u)); // up from inside the ground to 0.22 over
  }
  const u = (t - 0.35) / 0.65;
  return 0.22 * Math.cos(u * Math.PI * 1.5) * (1 - u);
}

/** Height offset (in levels) of a dug column at t (0..1): it sinks one level, a little faster at the end. */
export function digOffset(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return -1;
  return -(t * t * (3 - 2 * t));
}

export function createGroundMotion(pool: VertexPool, slots: SlotTable, build: (cols: number[], plan: ShapePlan) => MeshData): GroundMotion {
  let motions: Motion[] = [];
  let n = 0;
  let last: number[] = [];
  const m = new Float32Array(16);

  const stop = (mo: Motion): void => {
    pool.remove(mo.key);
    slots.release(mo.slot);
  };
  const pose = (mo: Motion, now: number): boolean => {
    const t = Math.max(0, (now - mo.start) / mo.time);
    const off = mo.dy > 0 ? raiseOffset(Math.min(1, t)) : digOffset(Math.min(1, t));
    m.fill(0);
    m[0] = m[5] = m[10] = m[15] = 1;
    m[13] = off * CELL_H;
    slots.setMatrix(mo.slot, m);
    return t < 1;
  };
  const add = (cols: number[], plan: ShapePlan, dy: 1 | -1, start: number): void => {
    const mesh = build(cols, plan);
    if (mesh.position.length === 0) return;
    const slot = slots.alloc(true);
    const mo: Motion = { key: `ground:${n++}`, slot, dy, start, time: dy > 0 ? RAISE_TIME : DIG_TIME };
    pose(mo, start);
    pool.put(mo.key, 0, mesh, slot);
    motions.push(mo);
  };

  return {
    changed(prev, next, now) {
      last = [];
      if (!prev || prev.terrain === next.terrain) return;
      const a = prev.terrain.height, b = next.terrain.height;
      const up: number[] = [], down: number[] = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] === b[i]) continue;
        (b[i]! > a[i]! ? up : down).push(i);
        if (up.length + down.length > MOST) return;
      }
      last = [...up, ...down];
      if (up.length) add(up, next, 1, now);
      if (!down.length) return;
      // Dug columns start in order of their distance from the water that was there before.
      const dist = new Map<number, number>();
      const queue: number[] = [];
      const dug = new Set(down);
      for (const i of down) {
        const x = i % SIZE_X, z = (i / SIZE_X) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (!inColumnBounds(x + dx, z + dz)) continue;
          const j = columnIndex(x + dx, z + dz);
          if (!dug.has(j) && a[j] === 0 && b[i] === 0) {
            dist.set(i, 0);
            queue.push(i);
            break;
          }
        }
      }
      for (let k = 0; k < queue.length; k++) {
        const i = queue[k]!;
        const x = i % SIZE_X, z = (i / SIZE_X) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (x + dx < 0 || z + dz < 0 || x + dx >= SIZE_X || z + dz >= SIZE_Z) continue;
          const j = columnIndex(x + dx, z + dz);
          if (dug.has(j) && !dist.has(j)) {
            dist.set(j, dist.get(i)! + 1);
            queue.push(j);
          }
        }
      }
      const byDelay = new Map<number, number[]>();
      for (const i of down) {
        const d = dist.get(i) ?? 0;
        const list = byDelay.get(d);
        if (list) list.push(i);
        else byDelay.set(d, [i]);
      }
      for (const [d, cols] of byDelay) add(cols, prev, -1, now + d * FLOW_DELAY);
    },
    tick(now) {
      if (motions.length === 0) return;
      const keep: Motion[] = [];
      for (const mo of motions) {
        if (pose(mo, now)) keep.push(mo);
        else stop(mo);
      }
      motions = keep;
    },
    get last() {
      return last;
    },
    clear() {
      for (const mo of motions) stop(mo);
      motions = [];
    },
  };
}
