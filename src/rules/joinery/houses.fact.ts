// Facts the house rules share (Houses owner). Read-only views of the shape
// base, so roles and joinery rules may use them.

import { above, below, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, SIZE_X, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { columnDistance, inTerrain, solid, type ColumnDistance } from '@/resolve/facts/lib';

/** Steps to the nearest column holding a dock block (R-H07: a fish shop needs one within 6). */
export const distToDock = defineFact<ColumnDistance>('distToDock', (f) => {
  const has = new Uint8Array(SIZE_X * SIZE_Z);
  for (const [c, k] of f.kinds) if (k === 'dock') has[columnIndex(keyX(c), keyZ(c))] = 1;
  return columnDistance((x, z) => has[columnIndex(x, z)] === 1);
});

/** What a storey's floor level meets right outside one side of a cell. */
export type Outside =
  | 'blocked' //   a solid block or terrain: no facade here
  | 'ground' //    the terrain top, level with the floor
  | 'deck' //      the top of a marble, dock or pillar block
  | 'bridge' //    the deck of an arch (J26)
  | 'roof' //      the top of a house block (a door only if that roof is a terrace)
  | 'stairs' //    the head of a stairs flight climbing to this side
  | 'drop'; //     nothing at floor level

export interface HouseFacts {
  /** What the floor of `cell` meets on side `dir`. */
  outside(cell: CellKey, dir: Dir4): Outside;
  /** Empty levels below the cell outside, down to the first solid top (0 when level with it). */
  dropOutside(cell: CellKey, dir: Dir4): number;
  /** Levels a solid wall rises beside a roof cell on side `dir`, counted from the roof's own level (0 = none). */
  wallBeside(cell: CellKey, dir: Dir4): number;
}

export const houseFacts = defineFact<HouseFacts>('houseFacts', (f) => {
  const outside = (cell: CellKey, dir: Dir4): Outside => {
    const out = neighbor(cell, dir);
    if (out === NO_CELL || solid(f, out)) return 'blocked';
    const under = below(out);
    if (under === NO_CELL) return 'drop';
    if (inTerrain(f, under)) return 'ground';
    const k = f.kinds.get(under);
    if (k === 'arch') return 'bridge';
    if (k === 'marble' || k === 'dock') return 'deck';
    if (k === 'house') return 'roof';
    if (k === 'stairs' && f.world.blocks.get(under)?.rot === ((dir + 2) & 3)) return 'stairs';
    return 'drop';
  };
  const dropOutside = (cell: CellKey, dir: Dir4): number => {
    let c = neighbor(cell, dir);
    if (c === NO_CELL) return 0;
    let n = 0;
    for (c = below(c); c !== NO_CELL && !solid(f, c) && keyY(c) >= 0; c = below(c)) n++;
    return n;
  };
  const wallBeside = (cell: CellKey, dir: Dir4): number => {
    let n = 0;
    let c = neighbor(cell, dir);
    if (c === NO_CELL) return 0;
    for (c = above(c); c !== NO_CELL && solid(f, c); c = above(c)) n++;
    return n;
  };
  return { outside, dropOutside, wallBeside };
});
