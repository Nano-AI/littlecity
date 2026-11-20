// J19 · tier 1 · Edge railing.
//
// A walkable edge with a drop of FENCE.drop (2) levels or more, next to a
// floor, a door or a stair head, gets a railing in the style R-E01 would
// choose there. Skipped where the player placed an edge piece.
//
// Which cells: a cell a person can stand in that holds a floor, lies just
// outside a door (J06, J07, J26) or is the cell a stairs flight arrives in.
// Which sides: the neighbouring column's surface lies 2 or more levels
// below, nothing solid stands there, no stairs lead off that side, and no
// fence or wall edge piece is on it.
//
// Each railing is a `railing` feature (cell + dir) on the floor structure in
// the cell (floor generators draw their features), else on the stairs that
// arrive there, else on the door's building. `railing.from` / `railing.to`
// say how each end finishes, so that railings in a row share posts and a
// corner has exactly one (codes: src/vocab/ground-edges.vocab.ts).

import { above, below, edgeOf, keyX, keyY, keyZ, neighbor, NO_CELL, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate, type RuleContext } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { FENCE } from '@/style/edges';
import { DIRS, railVariantAt, standable, surfaceBelow, type RailVariant, type Town } from './edges-lib';

interface Rail {
  cell: CellKey;
  dir: Dir4;
  structure: StructureId;
  variant: RailVariant;
  from: number;
  to: number;
}

/** The sides of a standable cell that drop away far enough to want a railing. */
export function dropSides(t: Town, cell: CellKey): Dir4[] {
  const y = keyY(cell);
  const out: Dir4[] = [];
  for (const d of DIRS) {
    const e = edgeOf(cell, d);
    if (e !== NO_CELL && t.world.edges.has(e)) continue;
    const n = neighbor(cell, d);
    if (n === NO_CELL) continue;
    if (t.kinds.get(n) === 'stairs') continue;
    const under = below(n);
    if (under !== NO_CELL && t.kinds.get(under) === 'stairs') continue;
    const surface = surfaceBelow(t, keyX(n), keyZ(n), y);
    if (surface === 'wall' || y - surface < FENCE.drop) continue;
    out.push(d);
  }
  return out;
}

// The grid corner at each end of a cell face, in its face frame: +X runs
// west along a north face, north along an east face, east along a south
// face and south along a west face.
const FROM: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [0, 0]];
const TO: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

function findRails({ facts, plan }: RuleContext): Rail[] {
  // Where to look, and the structure that would draw a railing there.
  const places = new Map<CellKey, StructureId>();
  for (const cell of facts.world.floors.keys()) {
    const floor = facts.floorAt.get(cell);
    if (floor !== undefined) places.set(cell, floor);
  }
  // A door or a stair head rails a BUILT edge (a deck, a terrace, a block top). On bare ground beside a
  // cliff it gets nothing: one cell of fence at the top of a cliff is worse than none.
  const built = (cell: CellKey): boolean => {
    const under = below(cell);
    return under !== NO_CELL && facts.kinds.has(under);
  };
  for (const f of plan.features) {
    if (f.type !== 'door' || f.cell === undefined) continue;
    const outside = f.dir === undefined ? f.cell : neighbor(f.cell, f.dir as Dir4);
    if (outside !== NO_CELL && !places.has(outside) && built(outside)) places.set(outside, f.structure);
  }
  for (const [cell, kind] of facts.kinds) {
    if (kind !== 'stairs') continue;
    const ahead = neighbor(cell, (facts.world.blocks.get(cell)?.rot ?? 0) as Dir4);
    const head = ahead === NO_CELL ? NO_CELL : above(ahead);
    const stairs = facts.structureAt.get(cell);
    if (head !== NO_CELL && stairs !== undefined && !places.has(head) && built(head)) places.set(head, stairs);
  }

  const railed = new Set<string>();
  for (const f of plan.features) if (f.type === 'railing' && f.cell !== undefined && f.dir !== undefined) railed.add(`${f.cell}:${f.dir}`);

  const rails: Rail[] = [];
  for (const cell of [...places.keys()].sort((a, b) => a - b)) {
    // The deepest drop a cell can have is its own level (down to the water): most floors lie too low to need a look.
    if (keyY(cell) < FENCE.drop) continue;
    if (!standable(facts, cell)) continue;
    const kind = facts.kinds.get(cell);
    if (kind === 'fence' || kind === 'wall' || kind === 'stairs') continue;
    // A house draws a parapet round its own flat roof: a railing as well would be two barriers.
    const under = below(cell);
    if (under !== NO_CELL && facts.kinds.get(under) === 'house') continue;
    const sides = dropSides(facts, cell);
    if (sides.length === 0) continue;
    const variant = railVariantAt(facts, cell);
    for (const dir of sides) {
      // An earlier rule may have railed this side already (a boardwalk's rope railings, R-D03).
      if (railed.has(`${cell}:${dir}`)) continue;
      rails.push({ cell, dir, structure: places.get(cell)!, variant, from: 1, to: 1 });
    }
  }

  joinRailEnds(rails);
  return rails;
}

/**
 * Sets `from` / `to` on a set of railings so that railings in a row share posts and a corner has
 * exactly one. Going round an edge with the drop on the outside, one railing's +X end is the next
 * one's −X end: the first keeps the post. (Also used by R-M08's podium balustrade.)
 */
export function joinRailEnds(rails: { cell: CellKey; dir: Dir4; from: number; to: number }[]): void {
  type R = (typeof rails)[number];
  const corner = (r: R, at: readonly (readonly [number, number])[]): string =>
    `${keyY(r.cell)}:${keyX(r.cell) + at[r.dir]![0]}:${keyZ(r.cell) + at[r.dir]![1]}`;
  const starting = new Map<string, R[]>();
  for (const r of rails) {
    const k = corner(r, FROM);
    const list = starting.get(k);
    if (list) list.push(r);
    else starting.set(k, [r]);
  }
  for (const r of rails) {
    const next = starting.get(corner(r, TO)) ?? [];
    const straight = next.find((o) => o.dir === r.dir);
    const outer = next.find((o) => o.cell === r.cell && o.dir === turn(r.dir, 3));
    const inner = next.find((o) => o.cell !== r.cell && o.dir === turn(r.dir, 1));
    if (straight) {
      r.to = 6;
      straight.from = 0;
    } else if (outer) {
      r.to = 2;
      outer.from = 3;
    } else if (inner) {
      r.to = 4;
      inner.from = 5;
    }
  }
}

export default defineRule<Rail>({
  id: 'J19.edge-railing',
  part: 'joinery',
  tier: 1,
  priority: 810,
  about: 'Reads: floors, door features, stairs, terrain and blocks beside each. Emits: railing features on edges with a drop of 2 or more, except where an edge piece stands.',
  find(ctx) {
    return findRails(ctx).map((r): Candidate<Rail> => ({ anchor: r.cell, key: r.dir, structure: r.structure, data: r }));
  },
  apply(c, out) {
    const r = c.data;
    out.feature({ type: 'railing', structure: r.structure, cell: r.cell, dir: r.dir, variant: r.variant, params: { from: r.from, to: r.to } });
  },
});
