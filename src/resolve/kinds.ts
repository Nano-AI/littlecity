// Pass 2: the resolved kind of every block (design section 8). Owner: Logic.
//
// An Auto block's kind is a pure per-cell function of terrain, occupancy and
// PLACED kinds. It never reads another Auto block's resolved kind, so there
// is no ordering and no iteration. First match wins:
//
//   K1 dock        y = 0 and the column is open water
//   K2 arch        a valid span along x or z (≤ spanMax long, both ends anchored)
//   K3 lighthouse  free run ≥ lighthouseRun, the cell above the run's top is
//                  empty, open sea (not a river) within lighthouseWater columns
//   K4 tower       free run ≥ towerRun
//   K5 house       otherwise

import { above, below, columnIndex, E, inColumnBounds, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, S, type CellKey, type Dir4 } from '@/core/grid';
import { placedInfo, type Kind } from '@/core/kinds';
import type { Terrain, World } from '@/core/world';
import { AUTO } from '@/style/auto';
import { MAT_RIVER } from '@/terrain/terrain2';
import { groundAt, isSolid } from '@/world/world';

export type AutoRule = 'K1' | 'K2' | 'K3' | 'K4' | 'K5';

export function resolveKinds(w: World, t: Terrain): Map<CellKey, Kind> {
  const kinds = new Map<CellKey, Kind>();
  for (const [cell, block] of w.blocks) kinds.set(cell, block.kind === 'auto' ? explainAuto(w, t, cell).kind : block.kind);
  return kinds;
}

/** Column candidate: placed kind auto, tower or lighthouse. */
function columnCandidate(w: World, cell: CellKey): boolean {
  const k = w.blocks.get(cell)?.kind;
  return k === 'auto' || k === 'tower' || k === 'lighthouse';
}

function isBuilding(w: World, cell: CellKey): boolean {
  if (cell === NO_CELL) return false;
  const b = w.blocks.get(cell);
  return b !== undefined && placedInfo(b.kind).building;
}

/** Free cell: a column candidate with no building block in any of its four side neighbours. */
export function isFreeCell(w: World, cell: CellKey): boolean {
  if (!columnCandidate(w, cell)) return false;
  for (let d = 0; d < 4; d++) if (isBuilding(w, neighbor(cell, d as Dir4))) return false;
  return true;
}

/** The longest unbroken vertical run of free cells containing `cell`: [bottom, top], or null if it is not free. */
export function freeRun(w: World, cell: CellKey): { bottom: CellKey; top: CellKey; length: number } | null {
  if (!isFreeCell(w, cell)) return null;
  let bottom = cell;
  for (let c = below(cell); c !== NO_CELL && isFreeCell(w, c); c = below(c)) bottom = c;
  let top = cell;
  for (let c = above(cell); c !== NO_CELL && isFreeCell(w, c); c = above(c)) top = c;
  return { bottom, top, length: keyY(top) - keyY(bottom) + 1 };
}

/** Span candidate: placed kind auto or arch, and the cell below is not solid. */
export function isSpanCandidate(w: World, t: Terrain, cell: CellKey): boolean {
  if (cell === NO_CELL) return false;
  const k = w.blocks.get(cell)?.kind;
  if (k !== 'auto' && k !== 'arch') return false;
  return !isSolid(w, t, below(cell));
}

export interface Span {
  /** The two end cells (west/north first). */
  start: CellKey;
  end: CellKey;
  length: number;
  anchoredStart: boolean;
  anchoredEnd: boolean;
  /** At most spanMax long and anchored at both ends. */
  valid: boolean;
}

/** The span of `cell` along x (dir E) or z (dir S), or null if the cell is not a span candidate. */
export function spanAlong(w: World, t: Terrain, cell: CellKey, dir: typeof E | typeof S): Span | null {
  if (!isSpanCandidate(w, t, cell)) return null;
  const back = opposite(dir);
  let start = cell;
  for (let c = neighbor(cell, back); isSpanCandidate(w, t, c); c = neighbor(c, back)) start = c;
  let end = cell;
  for (let c = neighbor(cell, dir); isSpanCandidate(w, t, c); c = neighbor(c, dir)) end = c;
  const length = dir === E ? keyX(end) - keyX(start) + 1 : keyZ(end) - keyZ(start) + 1;
  const anchoredStart = isSolid(w, t, neighbor(start, back));
  const anchoredEnd = isSolid(w, t, neighbor(end, dir));
  return { start, end, length, anchoredStart, anchoredEnd, valid: length <= AUTO.spanMax && anchoredStart && anchoredEnd };
}

function waterNear(t: Terrain, cell: CellKey, r: number): boolean {
  const x = keyX(cell);
  const z = keyZ(cell);
  // The sea, not a river: generator 2 marks river columns (MAT_RIVER), and a lighthouse inland beside one is wrong.
  const river = (cx: number, cz: number): boolean => inColumnBounds(cx, cz) && t.material[columnIndex(cx, cz)] === MAT_RIVER;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (groundAt(t, x + dx, z + dz) === 0 && !river(x + dx, z + dz)) return true;
  return false;
}

/** What an Auto block at `cell` resolves to, and which rule decided it. Reads only terrain, occupancy and placed kinds. */
export function explainAuto(w: World, t: Terrain, cell: CellKey): { kind: Kind; rule: AutoRule } {
  if (keyY(cell) === 0 && groundAt(t, keyX(cell), keyZ(cell)) === 0) return { kind: 'dock', rule: 'K1' };
  if (spanAlong(w, t, cell, E)?.valid || spanAlong(w, t, cell, S)?.valid) return { kind: 'arch', rule: 'K2' };
  const run = freeRun(w, cell);
  if (run) {
    const over = above(run.top);
    if (run.length >= AUTO.lighthouseRun && (over === NO_CELL || !w.blocks.has(over)) && waterNear(t, cell, AUTO.lighthouseWater)) {
      return { kind: 'lighthouse', rule: 'K3' };
    }
    if (run.length >= AUTO.towerRun) return { kind: 'tower', rule: 'K4' };
  }
  return { kind: 'house', rule: 'K5' };
}
