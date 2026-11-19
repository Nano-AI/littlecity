// Shared helpers for the core facts (not a fact file itself). Everything
// here reads only the Facts base (world, terrain, kinds, structures).

import {
  columnIndex,
  edgeOf,
  inColumnBounds,
  key,
  keyX,
  keyY,
  keyZ,
  neighbor,
  NO_CELL,
  SIZE_X,
  SIZE_Z,
  type CellKey,
  type Dir4,
} from '@/core/grid';
import { KINDS } from '@/core/kinds';
import { MAT } from '@/core/world';
import type { Facts } from './api';

export const DIRS: readonly Dir4[] = [0, 1, 2, 3];

/** Terrain height of a column; 0 outside the map. */
export function ground(f: Facts, x: number, z: number): number {
  return inColumnBounds(x, z) ? f.terrain.height[columnIndex(x, z)]! : 0;
}

export function inTerrain(f: Facts, cell: CellKey): boolean {
  return cell !== NO_CELL && keyY(cell) < f.terrain.height[columnIndex(keyX(cell), keyZ(cell))]!;
}

/** Terrain, or a block whose resolved kind is solid. */
export function solid(f: Facts, cell: CellKey): boolean {
  if (cell === NO_CELL) return false;
  if (inTerrain(f, cell)) return true;
  const k = f.kinds.get(cell);
  return k !== undefined && KINDS[k].solid;
}

/** A block that is a structure in its own right for "facing" purposes: solid, or a building (windmill). */
export function bulky(f: Facts, cell: CellKey): boolean {
  const k = f.kinds.get(cell);
  return k !== undefined && (KINDS[k].solid || KINDS[k].building);
}

/** On a walkable top (terrain top of a land column, or the top of a solid block). */
export function onWalkableTop(f: Facts, cell: CellKey): boolean {
  if (cell === NO_CELL) return false;
  const y = keyY(cell);
  const h = f.terrain.height[columnIndex(keyX(cell), keyZ(cell))]!;
  if (y < h) return false;
  if (y === h) return h > 0;
  const under = cell - (1 << 12);
  const k = f.kinds.get(under);
  return k !== undefined && KINDS[k].solid;
}

/** A person can stand here: on a walkable top, and no solid block in the cell. */
export function standable(f: Facts, cell: CellKey): boolean {
  return onWalkableTop(f, cell) && !solid(f, cell);
}

/** The cell lying on the terrain top of a land column (y = height), or NO_CELL for water or off the map. */
export function groundCell(f: Facts, x: number, z: number): CellKey {
  if (!inColumnBounds(x, z)) return NO_CELL;
  const h = f.terrain.height[columnIndex(x, z)]!;
  return h > 0 && h < 32 ? key(x, h, z) : NO_CELL;
}

/** The column is open water: terrain height 0 and no block at sea level. */
export function openWater(f: Facts, x: number, z: number): boolean {
  if (!inColumnBounds(x, z)) return false;
  return f.terrain.height[columnIndex(x, z)] === 0 && !f.kinds.has(key(x, 0, z));
}

export function isGrass(f: Facts, x: number, z: number): boolean {
  return inColumnBounds(x, z) && f.terrain.height[columnIndex(x, z)]! > 0 && f.terrain.material[columnIndex(x, z)] === MAT.grass;
}

/** The edge piece on side `d` of a cell, if any. */
export function edgeBetween(f: Facts, cell: CellKey, d: Dir4): 'fence' | 'wall' | undefined {
  const e = edgeOf(cell, d);
  return e === NO_CELL ? undefined : f.world.edges.get(e);
}

/** The cell `steps` cells away in direction `d` at the same level, or NO_CELL. */
export function step(cell: CellKey, d: Dir4, steps: number): CellKey {
  let c = cell;
  for (let i = 0; i < steps && c !== NO_CELL; i++) c = neighbor(c, d);
  return c;
}

/** Bounding box of a set of cells (columns and levels, inclusive). */
export interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y0: number;
  y1: number;
}
export function boxOf(cells: readonly CellKey[]): Box {
  const b: Box = { x0: 99, z0: 99, x1: -1, z1: -1, y0: 99, y1: -1 };
  for (const c of cells) {
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    if (x < b.x0) b.x0 = x;
    if (x > b.x1) b.x1 = x;
    if (z < b.z0) b.z0 = z;
    if (z > b.z1) b.z1 = z;
    if (y < b.y0) b.y0 = y;
    if (y > b.y1) b.y1 = y;
  }
  return b;
}

/** The largest k such that a k × k square of `cells` lies at one level. */
export function largestSquare(cells: readonly CellKey[]): number {
  const byLevel = new Map<number, Set<number>>();
  for (const c of cells) {
    let s = byLevel.get(keyY(c));
    if (!s) byLevel.set(keyY(c), (s = new Set()));
    s.add(columnIndex(keyX(c), keyZ(c)));
  }
  let best = 0;
  for (const cols of byLevel.values()) {
    const dp = new Uint8Array(SIZE_X * SIZE_Z);
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        const i = columnIndex(x, z);
        if (!cols.has(i)) continue;
        const v = x > 0 && z > 0 ? 1 + Math.min(dp[i - 1]!, dp[i - SIZE_X]!, dp[i - 1 - SIZE_X]!) : 1;
        dp[i] = v;
        if (v > best) best = v;
      }
    }
  }
  return best;
}

/** Cells of a region with a side neighbour (same level) outside the region. */
export function edgeCellsOf(cells: readonly CellKey[]): CellKey[] {
  const set = new Set(cells);
  return cells.filter((c) => DIRS.some((d) => !set.has(neighbor(c, d))));
}

/** A per-column distance field (4-connected steps). NONE where no source is reachable. */
export interface ColumnDistance {
  readonly grid: Uint16Array;
  /** Steps from column (x, z) to the nearest source column; NONE off the map or with no source. */
  at(x: number, z: number): number;
}
export const NONE = 0xffff;

export function columnDistance(isSource: (x: number, z: number) => boolean): ColumnDistance {
  const grid = new Uint16Array(SIZE_X * SIZE_Z).fill(NONE);
  const queue: number[] = [];
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      if (isSource(x, z)) {
        grid[columnIndex(x, z)] = 0;
        queue.push(columnIndex(x, z));
      }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % SIZE_X;
    const z = (i / SIZE_X) | 0;
    const d = grid[i]! + 1;
    const visit = (j: number): void => {
      if (grid[j]! > d) {
        grid[j] = d;
        queue.push(j);
      }
    };
    if (x > 0) visit(i - 1);
    if (x < SIZE_X - 1) visit(i + 1);
    if (z > 0) visit(i - SIZE_X);
    if (z < SIZE_Z - 1) visit(i + SIZE_X);
  }
  return { grid, at: (x, z) => (inColumnBounds(x, z) ? grid[columnIndex(x, z)]! : NONE) };
}

/** Groups items into a Map of lists. */
export function pushTo<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}
