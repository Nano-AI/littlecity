// Shared by the fence, wall, railing and stairs rules (R-E01, R-E02, J18,
// J19, J20) and by the generators that draw their output. Not a rule file.
//
// Everything here reads only the saved world, the terrain and the resolved
// kinds, so it works on Facts (in a rule) and on a ShapePlan (in a
// generator) alike.

import {
  below,
  columnIndex,
  edgeOf,
  inColumnBounds,
  key,
  keyX,
  keyY,
  keyZ,
  neighbor,
  NO_CELL,
  opposite,
  turn,
  type CellKey,
  type Dir4,
  type EdgeKey,
} from '@/core/grid';
import { KINDS, type EdgeKind, type Kind } from '@/core/kinds';
import type { FeatureVariant, RolesOf } from '@/core/vocab';
import type { Terrain, World } from '@/core/world';
import { STAIRS } from '@/style/edges';

/** What both Facts and ShapePlan offer. */
export interface Town {
  readonly world: World;
  readonly terrain: Terrain;
  readonly kinds: ReadonlyMap<CellKey, Kind>;
}

export const DIRS: readonly Dir4[] = [0, 1, 2, 3];

export function groundAt(t: Town, x: number, z: number): number {
  return inColumnBounds(x, z) ? t.terrain.height[columnIndex(x, z)]! : 0;
}

/** Terrain, a solid block, or a building block (a windmill): something a run can end against. */
export function blocked(t: Town, cell: CellKey): boolean {
  if (cell === NO_CELL) return false;
  if (keyY(cell) < groundAt(t, keyX(cell), keyZ(cell))) return true;
  const k = t.kinds.get(cell);
  return k !== undefined && (KINDS[k].solid || KINDS[k].building);
}

/** Terrain or a solid block: something that can be stood on. */
export function firm(t: Town, cell: CellKey): boolean {
  if (cell === NO_CELL) return false;
  if (keyY(cell) < groundAt(t, keyX(cell), keyZ(cell))) return true;
  const k = t.kinds.get(cell);
  return k !== undefined && KINDS[k].solid;
}

/** A person can stand in the cell: firm underneath, nothing solid in it. */
export function standable(t: Town, cell: CellKey): boolean {
  if (cell === NO_CELL || firm(t, cell)) return false;
  const under = below(cell);
  return under !== NO_CELL && firm(t, under);
}

/**
 * Looking sideways from level `y` into column (x, z): 'wall' if something
 * solid stands there at that level, else the level of the first surface at
 * or below (0 = open water, or the seabed of an empty water column).
 */
export function surfaceBelow(t: Town, x: number, z: number, y: number): number | 'wall' {
  if (!inColumnBounds(x, z)) return 0;
  if (firm(t, key(x, y, z))) return 'wall';
  for (let s = y - 1; s >= 0; s--) if (firm(t, key(x, s, z))) return s + 1;
  return 0;
}

// ───────────────────────────────────────────────────────────── styles ──

export type FenceRole = RolesOf<'fence'>;
export type WallRole = RolesOf<'wall'>;
export type RailVariant = FeatureVariant<'railing'>;

/** R-E01, for one piece: the style a fence takes from what it stands on. */
export function fenceRoleOn(under: Kind | undefined): FenceRole {
  if (under === 'dock' || under === 'arch') return 'rope-fence';
  if (under === 'house' || under === 'tower' || under === 'lighthouse') return 'iron-railing';
  if (under === 'marble' || under === 'pillar') return 'stone-balustrade';
  return 'picket-fence';
}
/** First match wins, so a run takes the earliest style any of its pieces would. */
export const FENCE_ROLE_ORDER: readonly FenceRole[] = ['rope-fence', 'iron-railing', 'stone-balustrade', 'picket-fence'];

export const RAIL_OF: Record<FenceRole, RailVariant> = {
  'picket-fence': 'picket',
  'rope-fence': 'rope',
  'iron-railing': 'iron',
  'stone-balustrade': 'balustrade',
};
export const ROLE_OF_RAIL: Record<RailVariant, FenceRole> = {
  picket: 'picket-fence',
  rope: 'rope-fence',
  iron: 'iron-railing',
  balustrade: 'stone-balustrade',
};

/** The style of a railing guarding the edge of a cell. */
export function railVariantAt(t: Town, cell: CellKey): RailVariant {
  const under = below(cell);
  return RAIL_OF[fenceRoleOn(under === NO_CELL ? undefined : t.kinds.get(under))];
}

// ─────────────────────────────────────────────────── runs: cell pieces ──

/**
 * One arm of a cell piece, from the centre of its cell toward a side:
 *   run    to a neighbouring cell piece of its kind
 *   edge   to an edge piece of its kind standing on that side of the cell
 *   butt   into a structure or a cliff on that side (no post there)
 *   stub   toward open ground, ending in a post short of the cell's edge
 */
export interface Arm {
  dir: Dir4;
  kind: 'run' | 'edge' | 'butt' | 'stub';
}

/** The arms that join a cell piece to its own run. */
export function joinedArms(t: Town, cell: CellKey, kind: EdgeKind): Arm[] {
  const out: Arm[] = [];
  for (const d of DIRS) {
    const n = neighbor(cell, d);
    if (n !== NO_CELL && t.kinds.get(n) === kind) out.push({ dir: d, kind: 'run' });
    else {
      const e = edgeOf(cell, d);
      if (e !== NO_CELL && t.world.edges.get(e) === kind) out.push({ dir: d, kind: 'edge' });
    }
  }
  return out;
}

/**
 * All the arms of a cell piece. A piece joined on two or more sides is just
 * that. A piece joined on one side carries on to the far side of its cell:
 * into a structure if one stands there, else to a post. A lone piece is a
 * short run across its cell, east to west unless only north and south are
 * built up.
 *
 * With `passage` (the piece is a gate, J20) the run crosses the passage and
 * nothing is added on open sides: the gate posts end it.
 */
export function cellArms(t: Town, cell: CellKey, kind: EdgeKind, passage?: Dir4): Arm[] {
  const joined = joinedArms(t, cell, kind);
  const isBlocked = (d: Dir4): boolean => blocked(t, neighbor(cell, d));
  if (passage !== undefined) {
    const out: Arm[] = [];
    for (const d of [turn(passage, 1), turn(passage, 3)]) {
      const j = joined.find((a) => a.dir === d);
      if (j) out.push(j);
      else if (isBlocked(d)) out.push({ dir: d, kind: 'butt' });
    }
    return out.sort((a, b) => a.dir - b.dir);
  }
  if (joined.length >= 2) return joined;
  const fill = (d: Dir4): Arm => ({ dir: d, kind: isBlocked(d) ? 'butt' : 'stub' });
  if (joined.length === 1) return [joined[0]!, fill(opposite(joined[0]!.dir))].sort((a, b) => a.dir - b.dir);
  const ns = (isBlocked(0) ? 1 : 0) + (isBlocked(2) ? 1 : 0);
  const ew = (isBlocked(1) ? 1 : 0) + (isBlocked(3) ? 1 : 0);
  return ns > ew ? [fill(0), fill(2)] : [fill(1), fill(3)];
}

// ─────────────────────────────────────────────────── runs: edge pieces ──

export interface EdgeLine {
  /** Level. */
  y: number;
  /** The axis it runs along. */
  axis: 'x' | 'z';
  /** Its two ends as grid corners: end 0 (north or west), end 1 (south or east). */
  ends: readonly [readonly [number, number], readonly [number, number]];
}

export function edgeLine(e: EdgeKey): EdgeLine {
  const cell = e >> 1;
  const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
  return e & 1
    ? { y, axis: 'x', ends: [[x, z + 1], [x + 1, z + 1]] }
    : { y, axis: 'z', ends: [[x + 1, z], [x + 1, z + 1]] };
}

/** The (up to four) edge keys meeting at a grid corner at one level. */
export function edgesAtCorner(cx: number, cz: number, y: number): EdgeKey[] {
  const out: EdgeKey[] = [];
  const add = (x: number, z: number, side: 0 | 1): void => {
    if (inColumnBounds(x, z)) out.push(key(x, y, z) * 2 + side);
  };
  add(cx - 1, cz - 1, 0); // the E side of the cell to the north-west: runs north from the corner
  add(cx - 1, cz, 0); //     … south from the corner
  add(cx - 1, cz - 1, 1); // the S side of the cell to the north-west: runs west from the corner
  add(cx, cz - 1, 1); //     … east from the corner
  return out;
}

/** The two cells either side of the line an edge piece would follow beyond one of its ends. */
export function cellsBeyond(e: EdgeKey, end: 0 | 1): [CellKey, CellKey] {
  const line = edgeLine(e);
  const [px, pz] = line.ends[end];
  const at = (x: number, z: number): CellKey => (inColumnBounds(x, z) ? key(x, line.y, z) : NO_CELL);
  if (line.axis === 'z') {
    const zc = end === 0 ? pz - 1 : pz;
    return [at(px - 1, zc), at(px, zc)];
  }
  const xc = end === 0 ? px - 1 : px;
  return [at(xc, pz - 1), at(xc, pz)];
}

/** True if no other edge piece of the kind meets this end of the edge piece. */
export function edgeEndIsFree(t: Town, e: EdgeKey, end: 0 | 1, kind: EdgeKind): boolean {
  const line = edgeLine(e);
  const [px, pz] = line.ends[end];
  return !edgesAtCorner(px, pz, line.y).some((o) => o !== e && t.world.edges.get(o) === kind);
}

// ────────────────────────────────────────────────────────────── stairs ──

/**
 * How far up its flight each stairs cell of a structure is: 0 for the
 * lowest row, 1 for the row that continues it one up and one forward, and
 * so on. Cells side by side share a number (the highest any of them would
 * get), so a wide flight has its landings in a line.
 */
export function flightSteps(t: Town, cells: readonly CellKey[]): Map<CellKey, number> {
  const out = new Map<CellKey, number>();
  if (cells.length === 0) return out;
  const set = new Set(cells);
  const rot = (t.world.blocks.get(cells[0]!)?.rot ?? 0) as Dir4;
  const sides = [turn(rot, 1), turn(rot, 3)];
  // Rows: cells side by side.
  const rowOf = new Map<CellKey, CellKey[]>();
  for (const c of cells) {
    if (rowOf.has(c)) continue;
    const row = [c];
    rowOf.set(c, row);
    for (let i = 0; i < row.length; i++) {
      for (const d of sides) {
        const n = neighbor(row[i]!, d);
        if (n !== NO_CELL && set.has(n) && !rowOf.has(n)) {
          rowOf.set(n, row);
          row.push(n);
        }
      }
    }
  }
  const before = (c: CellKey): CellKey => {
    const back = neighbor(c, opposite(rot));
    const p = back === NO_CELL ? NO_CELL : below(back);
    return p !== NO_CELL && set.has(p) ? p : NO_CELL;
  };
  const stepOf = new Map<CellKey[], number>();
  const visit = (row: CellKey[]): number => {
    const hit = stepOf.get(row);
    if (hit !== undefined) return hit;
    stepOf.set(row, 0); // rows only ever continue upward, so this is never read back
    let k = 0;
    for (const c of row) {
      const p = before(c);
      if (p !== NO_CELL) k = Math.max(k, visit(rowOf.get(p)!) + 1);
    }
    stepOf.set(row, k);
    return k;
  };
  for (const c of cells) out.set(c, visit(rowOf.get(c)!));
  return out;
}

/** A flight has a landing at the foot of every STAIRS.landingEvery-th cell. */
export function isLanding(step: number): boolean {
  return step > 0 && step % Math.max(1, Math.round(STAIRS.landingEvery)) === 0;
}
