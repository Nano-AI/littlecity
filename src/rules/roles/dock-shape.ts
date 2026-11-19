// Shared by the dock rules (R-D01–R-D04, J23, J28) and the dock generator:
// what lies on each side of a dock cell, and what shape a dock is. Not a
// rule file. Everything here reads only terrain, resolved kinds and the
// structure's own cells, which is exactly what a generator may read.

import { above, columnIndex, DIR4, inColumnBounds, key, keyX, keyZ, neighbor, NO_CELL, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS, type Kind } from '@/core/kinds';
import { MAT, type Terrain } from '@/core/world';
import type { CellPos } from '@/resolve/plan';

export interface DockBase {
  terrain: Terrain;
  kinds: ReadonlyMap<CellKey, Kind>;
}

export const DIRS: readonly Dir4[] = [0, 1, 2, 3];
/** The floor slot on side `d` of a cell. */
export const SIDE_POS: readonly CellPos[] = ['n', 'e', 's', 'w'];

/**
 * What a dock cell has on one side:
 *   dock   another dock cell (the same structure: touching docks merge)
 *   open   water
 *   land   ground at deck level (terrain height 1): you can step off
 *   cliff  higher ground: a wall
 *   solid  a solid block standing in the water (a pier of an arch, a stilt house)
 */
export type DockSide = 'dock' | 'open' | 'land' | 'cliff' | 'solid';

export function dockSide(f: DockBase, cell: CellKey, d: Dir4): DockSide {
  const x = keyX(cell) + DIR4[d]![0], z = keyZ(cell) + DIR4[d]![1];
  if (!inColumnBounds(x, z)) return 'open';
  const h = f.terrain.height[columnIndex(x, z)]!;
  if (h >= 2) return 'cliff';
  if (h === 1) return 'land';
  const k = f.kinds.get(neighbor(cell, d));
  if (k === 'dock') return 'dock';
  return k !== undefined && KINDS[k].solid ? 'solid' : 'open';
}

export const isShore = (s: DockSide): boolean => s === 'land' || s === 'cliff';

/** The land column on side `d` is a beach: sand at deck level. */
export function beachOn(f: DockBase, cell: CellKey, d: Dir4): boolean {
  const x = keyX(cell) + DIR4[d]![0], z = keyZ(cell) + DIR4[d]![1];
  if (!inColumnBounds(x, z)) return false;
  const i = columnIndex(x, z);
  return f.terrain.height[i] === 1 && f.terrain.material[i] === MAT.sand;
}

/** Something stands on the deck of this dock cell. */
export function deckTaken(f: DockBase, cell: CellKey): boolean {
  const up = above(cell);
  return up !== NO_CELL && f.kinds.has(up);
}

/** A column of open water: no land and no block at sea level. */
export function freeWater(f: DockBase, x: number, z: number): boolean {
  if (!inColumnBounds(x, z)) return false;
  if (f.terrain.height[columnIndex(x, z)] !== 0) return false;
  return !f.kinds.has(key(x, 0, z));
}

export interface DockLine {
  axis: 'x' | 'z';
  /** In order along the axis (west to east, or north to south). */
  cells: CellKey[];
  /** The direction past the first cell, and what lies there; the same for the last cell. */
  back: Dir4;
  fwd: Dir4;
  backSide: DockSide;
  fwdSide: DockSide;
}

/** A dock that is one straight, one-cell-wide run of 2 or more cells; null for any other shape. */
export function dockLine(f: DockBase, cells: readonly CellKey[]): DockLine | null {
  if (cells.length < 2) return null;
  const x0 = keyX(cells[0]!), z0 = keyZ(cells[0]!);
  const alongX = cells.every((c) => keyZ(c) === z0);
  const alongZ = cells.every((c) => keyX(c) === x0);
  if (!alongX && !alongZ) return null;
  const sorted = [...cells].sort((a, b) => (alongX ? keyX(a) - keyX(b) : keyZ(a) - keyZ(b)));
  const back: Dir4 = alongX ? 3 : 0, fwd: Dir4 = alongX ? 1 : 2;
  return {
    axis: alongX ? 'x' : 'z',
    cells: sorted,
    back,
    fwd,
    backSide: dockSide(f, sorted[0]!, back),
    fwdSide: dockSide(f, sorted[sorted.length - 1]!, fwd),
  };
}

export interface Pier {
  /** From the land end out to sea. */
  cells: CellKey[];
  /** The way it leads: out to sea. */
  seaward: Dir4;
}

/**
 * R-D02: a straight run of `min`+ cells leading away from land: one end
 * touches the shore, the other stands in open water, and nothing but the
 * landward cell touches the shore.
 */
export function pierOf(f: DockBase, cells: readonly CellKey[], min: number): Pier | null {
  const line = dockLine(f, cells);
  if (!line || line.cells.length < min) return null;
  const fromBack = isShore(line.backSide) && line.fwdSide === 'open';
  const fromFwd = isShore(line.fwdSide) && line.backSide === 'open';
  if (fromBack === fromFwd) return null;
  const ordered = fromBack ? line.cells : [...line.cells].reverse();
  const seaward = fromBack ? line.fwd : line.back;
  const sides: Dir4[] = [turn(seaward, 1), turn(seaward, 3)];
  for (let i = 1; i < ordered.length; i++) {
    if (sides.some((d) => dockSide(f, ordered[i]!, d) !== 'open')) return null;
  }
  return { cells: ordered, seaward };
}

/** R-D03: a straight run of `min`+ cells with level land at both ends. */
export function boardwalkOf(f: DockBase, cells: readonly CellKey[], min: number): DockLine | null {
  const line = dockLine(f, cells);
  if (!line || line.cells.length < min) return null;
  return line.backSide === 'land' && line.fwdSide === 'land' ? line : null;
}

export interface Quay {
  /** The side the shore is on. */
  landward: Dir4;
  /** The longest row of cells along the shore, in order. */
  cells: CellKey[];
}

/** R-D01: `min`+ dock cells in a row, each with the shore on the same side. */
export function quayOf(f: DockBase, cells: readonly CellKey[], min: number): Quay | null {
  let best: Quay | null = null;
  const mine = new Set(cells);
  for (const d of DIRS) {
    const along: Dir4 = turn(d, 1);
    const ashore = new Set(cells.filter((c) => isShore(dockSide(f, c, d))));
    for (const c of [...ashore].sort((a, b) => a - b)) {
      // Start of a row: no shore cell behind it.
      const behind = neighbor(c, opposite(along));
      if (behind !== NO_CELL && ashore.has(behind)) continue;
      const row: CellKey[] = [];
      for (let n = c; n !== NO_CELL && ashore.has(n) && mine.has(n); n = neighbor(n, along)) row.push(n);
      if (row.length >= min && (!best || row.length > best.cells.length)) {
        best = { landward: d, cells: row.sort((a, b) => a - b) };
      }
    }
  }
  return best;
}
