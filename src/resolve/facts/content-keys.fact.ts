// Content keys and cross-resolve memos (Polish: incremental facts). Not a
// fact file itself; the per-resolve column table is cached on the Facts
// object through `contentKeys`, defined below with defineFact.
//
// A column key is a 64-bit hash (two independent 32-bit lanes) of everything
// the shape-stage base holds in one column: its terrain height and material,
// every block in it (placed kind, colour, rot, resolved kind, block
// structure id), every floor (kind, floor structure id) and every edge piece
// whose canonical (west or north) cell lies in it (kind, run id). Per-item
// hashes are summed, so the key does not depend on map order. The world seed
// salts every column (it seeds structure personalities).
//
// A region key is the XOR of the column keys in a rectangle, read in O(1)
// from a 2D prefix table. Two regions with equal keys hold the same content,
// barring a 64-bit collision.
//
// RegionMemo keeps per-structure results across resolves: a fact computes a
// structure's entry from the columns within some reach of it, keys it by
// that rectangle's region key, and reuses the entry while the key is equal.
// The memo is pure from the outside: same content, same value.

import { columnIndex, keyX, keyZ, SIZE_X, SIZE_Z, type CellKey, type EdgeKey } from '@/core/grid';
import { defineFact, type Facts } from './api';

function mix(h: number, k: number): number {
  k = Math.imul(k | 0, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}
function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h | 0;
}

const SEED_A = 0x3c6ef372;
const SEED_B = 0x5be0cd19 | 0;

const stringCodes = new Map<string, number>();
/** A small stable code per string (kind names), the same for the life of the page. */
function code(s: string | undefined): number {
  if (s === undefined) return 0;
  let c = stringCodes.get(s);
  if (c === undefined) stringCodes.set(s, (c = stringCodes.size + 1));
  return c;
}

const W = SIZE_X + 1;

export interface ContentKeys {
  /** Writes the key of the columns x0..x1 × z0..z1 (clamped to the map) into `out`. */
  region(x0: number, z0: number, x1: number, z1: number, out: RegionKey): RegionKey;
  /** The key of a structure's bounding columns grown by `reach` on every side. */
  around(cells: readonly CellKey[], reach: number, out: RegionKey, edges?: readonly EdgeKey[]): RegionKey;
}

export interface RegionKey {
  a: number;
  b: number;
}

export function regionKey(): RegionKey {
  return { a: 0, b: 0 };
}

/** Folds a number (a tunable the value depends on) into a key. */
export function saltKey(k: RegionKey, n: number): RegionKey {
  k.a = fmix(mix(k.a, n));
  k.b = fmix(mix(k.b ^ 0x2545f491, n));
  return k;
}

export const contentKeys = defineFact<ContentKeys>('contentKeys', (f) => buildContentKeys(f));

function buildContentKeys(f: Facts): ContentKeys {
  const n = SIZE_X * SIZE_Z;
  const accA = new Int32Array(n);
  const accB = new Int32Array(n);
  const add = (col: number, x1: number, x2: number, x3: number, x4: number, x5: number, x6: number): void => {
    let a = mix(mix(mix(mix(mix(mix(SEED_A, x1), x2), x3), x4), x5), x6);
    let b = mix(mix(mix(mix(mix(mix(SEED_B, x6), x5), x4), x3), x2), x1);
    a = fmix(a);
    b = fmix(b);
    accA[col] = (accA[col]! + a) | 0;
    accB[col] = (accB[col]! + b) | 0;
  };
  const { world, kinds, structureAt, floorAt, edgeAt } = f;
  for (const [c, block] of world.blocks) {
    const sid = structureAt.get(c);
    add(columnIndex(keyX(c), keyZ(c)), 1, c, code(block.kind) * 64 + block.color, block.rot, code(kinds.get(c)), sid === undefined ? -1 : sid);
  }
  // Resolved kinds of cells with no placed block (none today; cheap insurance).
  if (kinds.size !== world.blocks.size) {
    for (const [c, k] of kinds) if (!world.blocks.has(c)) add(columnIndex(keyX(c), keyZ(c)), 2, c, code(k), structureAt.get(c) ?? -1, 0, 0);
  }
  for (const [c, k] of world.floors) add(columnIndex(keyX(c), keyZ(c)), 3, c, code(k), floorAt.get(c) ?? -1, 0, 0);
  for (const [e, k] of world.edges) {
    const c = e >> 1;
    add(columnIndex(keyX(c), keyZ(c)), 4, e, code(k), edgeAt.get(e) ?? -1, 0, 0);
  }
  const t = f.terrain;
  const seed = world.seed | 0;
  // Prefix XOR tables, (SIZE_X + 1) × (SIZE_Z + 1), row z + 1 and column x + 1 hold column (x, z).
  const pa = new Int32Array(W * (SIZE_Z + 1));
  const pb = new Int32Array(W * (SIZE_Z + 1));
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const col = columnIndex(x, z);
      const ha = fmix(mix(mix(mix(mix(mix(SEED_A, seed), col), t.height[col]!), t.material[col]!), accA[col]!));
      const hb = fmix(mix(mix(mix(mix(mix(SEED_B, accB[col]!), t.material[col]!), t.height[col]!), col), seed));
      const i = (z + 1) * W + x + 1;
      pa[i] = ha ^ pa[i - 1]! ^ pa[i - W]! ^ pa[i - W - 1]!;
      pb[i] = hb ^ pb[i - 1]! ^ pb[i - W]! ^ pb[i - W - 1]!;
    }
  }
  const keys: ContentKeys = {
    region(x0, z0, x1, z1, out) {
      x0 = Math.max(0, x0);
      z0 = Math.max(0, z0);
      x1 = Math.min(SIZE_X - 1, x1);
      z1 = Math.min(SIZE_Z - 1, z1);
      if (x1 < x0 || z1 < z0) {
        out.a = out.b = 0;
        return out;
      }
      const i11 = (z1 + 1) * W + x1 + 1;
      const i01 = (z1 + 1) * W + x0;
      const i10 = z0 * W + x1 + 1;
      const i00 = z0 * W + x0;
      out.a = pa[i11]! ^ pa[i01]! ^ pa[i10]! ^ pa[i00]!;
      out.b = pb[i11]! ^ pb[i01]! ^ pb[i10]! ^ pb[i00]!;
      return out;
    },
    around(cells, reach, out, edges) {
      let x0 = 99,
        z0 = 99,
        x1 = -1,
        z1 = -1;
      for (const c of cells) {
        const x = c & 63;
        const z = (c >> 6) & 63;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (z < z0) z0 = z;
        if (z > z1) z1 = z;
      }
      // An edge piece lies between its canonical (west or north) cell and the one east or south of it.
      if (edges) {
        for (const e of edges) {
          const x = (e >> 1) & 63;
          const z = (e >> 7) & 63;
          if (x < x0) x0 = x;
          if (z < z0) z0 = z;
          if (x + (e & 1 ? 0 : 1) > x1) x1 = x + (e & 1 ? 0 : 1);
          if (z + (e & 1 ? 1 : 0) > z1) z1 = z + (e & 1 ? 1 : 0);
        }
      }
      return keys.region(x0 - reach, z0 - reach, x1 + reach, z1 + reach, out);
    },
  };
  return keys;
}

interface MemoEntry<V> {
  a: number;
  b: number;
  value: V;
}

/**
 * Per-structure values kept across resolves, keyed by a region key. Call
 * `begin()` once at the start of each computation; `get` finds an entry
 * from the last two computations (so a ghost preview between two edits
 * does not flush the town's entries); `put` stores one for the next.
 */
export class RegionMemo<V> {
  private cur = new Map<number, MemoEntry<V>>();
  private prev = new Map<number, MemoEntry<V>>();
  private prev2 = new Map<number, MemoEntry<V>>();

  begin(): void {
    if (!enabled) return;
    this.prev2 = this.prev;
    this.prev = this.cur;
    this.cur = new Map();
  }

  get(id: number, k: RegionKey): V | undefined {
    if (!enabled) return undefined;
    let e = this.prev.get(id);
    if (!e || e.a !== k.a || e.b !== k.b) e = this.prev2.get(id);
    if (!e || e.a !== k.a || e.b !== k.b) return undefined;
    this.cur.set(id, e);
    return e.value;
  }

  put(id: number, k: RegionKey, value: V): void {
    if (!enabled) return;
    this.cur.set(id, { a: k.a, b: k.b, value });
  }

  /** Forgets everything (tests compare against a cold resolve). */
  clear(): void {
    this.cur = new Map();
    this.prev = new Map();
    this.prev2 = new Map();
  }
}

/** Every memo, so tests can resolve cold. */
const memos: { clear(): void }[] = [];
let enabled = true;
/** False inside withoutMemos (the engine's apply() reuse checks it too). */
export function memosOn(): boolean {
  return enabled;
}
/**
 * Runs `fn` with every cross-resolve memo switched off (nothing read, nothing
 * stored, the warm entries left as they were): a from-scratch resolve.
 */
export function withoutMemos<T>(fn: () => T): T {
  const was = enabled;
  enabled = false;
  try {
    return fn();
  } finally {
    enabled = was;
  }
}
export function registerMemo<T extends { clear(): void }>(m: T): T {
  memos.push(m);
  return m;
}
/** Clears every cross-resolve memo: the next resolve computes everything from scratch. */
export function clearResolveMemos(): void {
  for (const m of memos) m.clear();
}
