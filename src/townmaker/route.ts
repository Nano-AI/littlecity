// Streets between districts. A cheapest-path search over the columns of
// the island from a district's way in to the nearest street already laid:
// a street may climb or drop one terrace level between neighbours (the
// carved steps rule J17 then draws the steps and links them for walkers),
// never two; it keeps off buildings, gardens and the margins a district
// keeps clear, and prefers to join existing streets rather than run beside
// them.

import { columnIndex, type Dir4, inBounds, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { AUTO } from '@/style/auto';
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
  /** Bridge water (default true). */
  cross?: boolean;
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
  /** How a column was reached from prev[]: 1 a climb up a cliff of two levels (buildClimb), 2 a bridge, 3 a boardwalk (buildCrossing). */
  const climbed = new Uint8Array(N);
  /** A column a climb may stand stairs or a landing on: free, flat ground nobody uses. */
  const climbable = (x: number, z: number): boolean => canPave(g, x, z) && !onNetwork(g, x, z);
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
        climbed[j] = 0;
        heap.push(j, next);
      }
    }
    // A cliff of r levels (2 to 6): r + 1 columns on, up a flight of stairs on stepped marble.
    for (const [dx, dz] of D4) {
      for (let r = 2; r <= MAX_CLIMB; r++) {
        const ex = x + (r + 1) * dx, ez = z + (r + 1) * dz;
        const end = g.h(ex, ez);
        const down = end === here - r;
        const up = end === here + r;
        if (!(down || up) || !canPave(g, ex, ez, opts.allow, opts.relaxed)) continue;
        // The columns between stand at the low level, free.
        const low = Math.min(here, end);
        let ok = true;
        for (let k = 1; k <= r && ok; k++) ok = g.h(x + k * dx, z + k * dz) === low && climbable(x + k * dx, z + k * dz);
        if (!ok) continue;
        const j = columnIndex(ex, ez);
        const next = c + 5 + 2 * r;
        if (next < cost[j]!) {
          cost[j] = next;
          prev[j] = i;
          climbed[j] = 1;
          heap.push(j, next);
        }
      }
    }
    // Across water: a straight run of open water to land of the same height on the far side.
    // Up to 6 wide it is a bridge of arches (a valid span over water: a stone bridge); between
    // two beaches it may be longer, a boardwalk of docks.
    if (opts.cross !== false) {
      for (const [dx, dz] of D4) {
        let k = 1;
        while (k <= MAX_DOCKWALK && crossable(g, x + dx * k, z + dz * k)) k++;
        const n = k - 1;
        if (n < 1) continue;
        const ex = x + dx * k, ez = z + dz * k;
        if (g.h(ex, ez) !== here || !canPave(g, ex, ez, opts.allow, opts.relaxed)) continue;
        const kind = n <= AUTO.spanMax ? 2 : here === 1 ? 3 : 0;
        if (!kind) continue;
        const j = columnIndex(ex, ez);
        const next = c + 4 + n * (kind === 2 ? 1.5 : 2);
        if (next < cost[j]!) {
          cost[j] = next;
          prev[j] = i;
          climbed[j] = kind;
          heap.push(j, next);
        }
      }
    }
  }
  if (goal < 0) return null;
  const chain: number[] = [];
  for (let i = goal; i !== -1; i = prev[i]!) chain.push(i);
  chain.reverse();
  const xz = (i: number): [number, number] => [i % SIZE_X, Math.floor(i / SIZE_X)];
  for (let k = 0; k < chain.length; k++) {
    if (k > 0 && climbed[chain[k]!] === 1) buildClimb(g, xz(chain[k - 1]!), xz(chain[k]!));
    if (k > 0 && climbed[chain[k]!]! >= 2) buildCrossing(g, xz(chain[k - 1]!), xz(chain[k]!), climbed[chain[k]!] === 3);
    if (k < chain.length - 1) pave(g, ...xz(chain[k]!));
  }
  return chain.slice(0, -1).map(xz);
}

/**
 * Up a cliff of two levels between two columns three apart in a line: the
 * high end H, then L1 (a marble landing with stairs on it climbing to H),
 * L2 (stairs climbing onto the landing), and the low end, all three at the
 * foot of the cliff. Both ends get a path.
 */
function buildClimb(g: Grower, a: readonly [number, number], b: readonly [number, number]): void {
  const [hi, lo] = g.h(a[0], a[1]) > g.h(b[0], b[1]) ? [a, b] : [b, a];
  const dx = Math.sign(lo[0] - hi[0]), dz = Math.sign(lo[1] - hi[1]);
  const y = g.h(lo[0], lo[1]);
  const r = g.h(hi[0], hi[1]) - y;
  const toHigh = D4.findIndex(([x, z]) => x === -dx && z === -dz) as Dir4;
  // Column k from the top (1 … r): marble r − k high, stairs on it climbing toward the top.
  const cols: [number, number][] = [];
  for (let k = 1; k <= r; k++) cols.push([hi[0] + k * dx, hi[1] + k * dz]);
  const color = g.colorFor('marble', cols.map(([x, z]) => [x, y, z] as const), 'landing');
  for (let k = 1; k <= r; k++) {
    const [x, z] = cols[k - 1]!;
    for (let m = 0; m < r - k; m++) g.put('marble', x, y + m, z, color);
  }
  for (let k = r; k >= 1; k--) {
    const [x, z] = cols[k - 1]!;
    g.put('stairs', x, y + r - k, z, 0, toHigh);
    g.mark(x, z, CLAIM.built);
  }
  pave(g, hi[0], hi[1]);
  pave(g, lo[0], lo[1]);
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

/** The longest boardwalk of docks a street will take between two beaches. */
const MAX_DOCKWALK = 12;
/** The highest cliff a street climbs by stairs. */
const MAX_CLIMB = 6;

/** Open water a crossing may pass over: nothing at sea level in it, no claim on it. */
function crossable(g: Grower, x: number, z: number): boolean {
  if (!inColumnBounds(x, z) || g.h(x, z) !== 0 || g.world.blocks.has(key(x, 0, z))) return false;
  return !g.claimed(x, z, CLAIM.built | CLAIM.keep);
}

/**
 * A crossing from bank `a` to bank `b` (same height, open water between, in
 * a line). A bridge: arches at the banks' top level, one per water column
 * (anchored on the banks: a valid span; with water below, R-A01 makes it a
 * stone bridge), a path along the deck. A boardwalk: docks at sea level and
 * a path on them. Paths on both banks.
 */
function buildCrossing(g: Grower, a: readonly [number, number], b: readonly [number, number], docks: boolean): void {
  const dx = Math.sign(b[0] - a[0]), dz = Math.sign(b[1] - a[1]);
  const n = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) - 1;
  const top = g.h(a[0], a[1]);
  pave(g, a[0], a[1]);
  for (let k = 1; k <= n; k++) {
    const x = a[0] + dx * k, z = a[1] + dz * k;
    if (docks) g.put('dock', x, 0, z, 0);
    else g.put('arch', x, top - 1, z, 0);
    g.mark(x, z, CLAIM.built);
  }
  for (let k = 1; k <= n; k++) g.floor('path', a[0] + dx * k, a[1] + dz * k, docks ? 1 : top);
  pave(g, b[0], b[1]);
}
