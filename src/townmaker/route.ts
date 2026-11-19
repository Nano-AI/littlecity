// Streets between districts. A cheapest-path search over the columns of
// the island from a district's way in to the nearest street already laid:
// a street may climb or drop one terrace level between neighbours (the
// carved steps rule J17 then draws the steps and links them for walkers),
// never two; it keeps off buildings, gardens and the margins a district
// keeps clear, and prefers to join existing streets rather than run beside
// them.

import { columnIndex, inBounds, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { CLAIM, type Grower } from './grower';
import { D4 } from './site';

const N = SIZE_X * SIZE_Z;

/** A street lies on the terrain top of this column (or a plaza does). */
export function onNetwork(g: Grower, x: number, z: number): boolean {
  if (!inColumnBounds(x, z)) return false;
  const f = g.world.floors.get(key(x, g.h(x, z), z));
  return f === 'path' || f === 'plaza';
}

/** A new street may be laid on this column. */
export function canPave(g: Grower, x: number, z: number, allow?: ReadonlySet<number>, relaxed = false): boolean {
  if (!inColumnBounds(x, z) || g.h(x, z) === 0) return false;
  const i = columnIndex(x, z);
  if (allow?.has(i) || onNetwork(g, x, z)) return true;
  if ((g.claim[i]! & (relaxed ? CLAIM.keep : CLAIM.built | CLAIM.keep)) !== 0) return false;
  if (g.groundTaken(x, z)) return false;
  const f = g.world.floors.get(key(x, g.h(x, z), z));
  return f === undefined || f === 'path' || f === 'plaza';
}

class Heap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    const a = this.items, q = this.prio;
    a.push(item);
    q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (q[parent]! <= q[i]!) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      [q[parent], q[i]] = [q[i]!, q[parent]!];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items, q = this.prio;
    const top = a[0]!;
    const lastA = a.pop()!, lastQ = q.pop()!;
    if (a.length > 0) {
      a[0] = lastA;
      q[0] = lastQ;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && q[l]! < q[m]!) m = l;
        if (r < a.length && q[r]! < q[m]!) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        [q[m], q[i]] = [q[i]!, q[m]!];
        i = m;
      }
    }
    return top;
  }
}

export interface RouteOptions {
  /** Columns the street may use even though a district claims them (its own way in). */
  allow?: ReadonlySet<number>;
  /** The columns that count as arrived (already joined to the square). Default: any street. */
  reached?: (x: number, z: number) => boolean;
  /** Give up past this cost. */
  maxCost?: number;
  /** Also cross ground a district claimed but left empty (a last resort: a district that cannot be reached otherwise). */
  relaxed?: boolean;
}

/**
 * Lays a street from `from` (a column that is or may be paved) to the
 * nearest column already on the network. Returns the columns laid, or null
 * when there is no way (nothing is laid then).
 */
export function route(g: Grower, from: readonly [number, number], opts: RouteOptions = {}): [number, number][] | null {
  const [fx, fz] = from;
  if (!canPave(g, fx, fz, opts.allow, opts.relaxed)) return null;
  const arrived = (x: number, z: number): boolean => onNetwork(g, x, z) && (!opts.reached || opts.reached(x, z));
  if (arrived(fx, fz)) return [];
  const cost = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const heap = new Heap();
  const start = columnIndex(fx, fz);
  cost[start] = 0;
  heap.push(start, 0);
  const maxCost = opts.maxCost ?? 250;
  let goal = -1;
  while (heap.size) {
    const i = heap.pop();
    const c = cost[i]!;
    if (c > maxCost) break;
    const x = i % SIZE_X, z = Math.floor(i / SIZE_X);
    if (i !== start && arrived(x, z)) {
      goal = i;
      break;
    }
    const here = g.h(x, z);
    for (const [dx, dz] of D4) {
      const nx = x + dx, nz = z + dz;
      if (!canPave(g, nx, nz, opts.allow, opts.relaxed)) continue;
      const dh = Math.abs(g.h(nx, nz) - here);
      if (dh > 1) continue;
      const j = columnIndex(nx, nz);
      let step = 1;
      if (dh === 1) step += 1.5;
      if (onNetwork(g, nx, nz)) step = 0.3;
      // Prefer not to run alongside an existing street (a second street one cell over).
      else
        for (const [ax, az] of D4) {
          if ((ax === -dx && az === -dz) || !onNetwork(g, nx + ax, nz + az)) continue;
          step += 0.6;
          break;
        }
      const next = c + step;
      if (next < cost[j]!) {
        cost[j] = next;
        prev[j] = i;
        heap.push(j, next);
      }
    }
  }
  if (goal < 0) return null;
  const cells: [number, number][] = [];
  for (let i = prev[goal]!; i !== -1; i = prev[i]!) cells.push([i % SIZE_X, Math.floor(i / SIZE_X)]);
  cells.reverse();
  for (const [x, z] of cells) pave(g, x, z);
  return cells;
}

/** A path on the terrain top of a column, and the street claim. */
export function pave(g: Grower, x: number, z: number): boolean {
  if (!inColumnBounds(x, z) || g.h(x, z) === 0) return false;
  const y = g.h(x, z);
  const f = g.world.floors.get(key(x, y, z));
  if (f === 'plaza' || f === 'path') {
    g.mark(x, z, CLAIM.street);
    return true;
  }
  if (f !== undefined) return false;
  if (!g.floor('path', x, z, y)) return false;
  g.mark(x, z, CLAIM.street);
  return true;
}

/**
 * Every street cell (path or plaza, at any level: decks and bridges too) a
 * person can walk to from `roots` along streets: side by side at one level,
 * one level up or down between two cells on the terrain (carved steps, J17),
 * or through a flight of stairs.
 */
export function joinedStreets(g: Grower, roots: readonly CellKey[]): Set<CellKey> {
  const isStreet = (c: CellKey): boolean => {
    const f = g.world.floors.get(c);
    return f === 'path' || f === 'plaza' || g.world.blocks.get(c)?.kind === 'stairs';
  };
  const onTerrain = (c: CellKey): boolean => keyY(c) === g.h(keyX(c), keyZ(c));
  const seen = new Set<CellKey>();
  const queue: CellKey[] = [];
  for (const r of roots) {
    if (isStreet(r) && !seen.has(r)) {
      seen.add(r);
      queue.push(r);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    for (const [dx, dz] of D4) {
      for (const dy of [0, 1, -1]) {
        if (!inBounds(x + dx, y + dy, z + dz)) continue;
        const n = key(x + dx, y + dy, z + dz);
        if (seen.has(n) || !isStreet(n)) continue;
        if (dy !== 0) {
          const stairs = g.world.blocks.get(c)?.kind === 'stairs' || g.world.blocks.get(n)?.kind === 'stairs';
          if (!stairs && !(onTerrain(c) && onTerrain(n))) continue;
        }
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}
