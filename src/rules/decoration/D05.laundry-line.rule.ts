// D05 · tier 1 · Laundry lines.
//
// Two DIFFERENT house structures whose facades face each other across a gap
// of 1 to 3 cells of empty air, with an ordinary window in at least one of
// the two facade cells: a line with 3 to 6 garments from wall to wall, for a
// good share of such pairs (DRESSING.laundry). (The catalogue asks for a
// window on both sides; J09 leaves half the windows off an alley wall, which
// made lines rare exactly where they belong. Someone leans out of one window
// and the far end is a hook on the wall opposite.)
//
// Where: over a drop only: the line is a full storey or more above anything a
// person can stand on or climb, so it never crosses a lane, a path's walking
// line or the top of a stair at head height. (The catalogue also allows a
// ground-level line between two cottages a cell apart; that hangs across the
// lane at head height and read wrong, so it is left out.) Never over a plaza
// (bunting belongs there, D04), never through a tree.
// At most DRESSING.laundryPerThree lines in any three cells along a lane.
//
// Stability: a pair's chance roll is seeded by its own cell and side only.
//
// The line hangs between two 'line-anchor' sockets this rule declares, one
// on each cell face, so it does not depend on where a window's sill is.
//
// Reads: facades, window sockets and the features that own them.
// Claims: the air between the two cell faces (shared with bunting, D04).

import { keyX, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { standable } from '@/resolve/facts/lib';
import { occupancy, TERRAIN } from '@/resolve/facts/occupancy.fact';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { DRESSING } from '@/style/dressing';
import { lucky, WORKING_ROLES } from './lib';

/** Windows a line can be hung from: the ordinary ones (not a shopfront, a bay, a round or a slit). */
export const PLAIN_WINDOWS: ReadonlySet<string> = new Set(['square', 'tall', 'arched', 'shuttered']);

interface Line {
  /** The facade cell on the far side. */
  to: CellKey;
  /** The side of the anchor cell the line leaves from (east or south). */
  dir: Dir4;
}

/** The air between two facing cell faces: one line (laundry or bunting) may cross it. */
export const airSlot = (from: CellKey, dir: Dir4): string => slot.custom('air', from, dir);

const RULE = 'D05.laundry-line';
const LEVEL = 1 << 12;

export default defineRule<Line>({
  id: RULE,
  part: 'decoration',
  tier: 1,
  priority: 950,
  about: 'Reads: facades of houses, window sockets, the air between two facing windows. Claims: the line between the two sockets.',
  find({ facts, seed }) {
    const all = facades(facts);
    const occ = occupancy(facts);
    const features = new Map(facts.shape.features.map((f) => [f.id, f]));
    // The plain window of each facade cell and side.
    const windows = new Set<number>();
    for (const s of socketsOfType(facts, 'window')) {
      if (s.dir === undefined || s.owner === undefined) continue;
      if (!PLAIN_WINDOWS.has(features.get(s.owner)?.variant ?? '')) continue;
      windows.add(s.cell * 4 + s.dir);
    }
    const out: Candidate<Line>[] = [];
    const maxGap = Math.min(3, DRESSING.laundryGapMax);
    for (const fc of all.list) {
      // Each pair once: from its west or north side.
      if (fc.kind !== 'house' || (fc.dir !== 1 && fc.dir !== 2)) continue;
      // Step out across the gap: empty air, then the other house.
      let c: CellKey = fc.cell;
      let gap = 0;
      let other: CellKey = NO_CELL;
      const between: CellKey[] = [];
      for (let k = 1; k <= maxGap + 1; k++) {
        c = neighbor(c, fc.dir);
        if (c === NO_CELL || occ.flags[c]! & TERRAIN) break;
        if (occ.kind[c]) {
          if (occ.kindAt(c) === 'house' && occ.structure[c] !== fc.structure) other = c;
          break;
        }
        between.push(c);
        gap = k;
      }
      if (other === NO_CELL || gap < 1 || gap > maxGap) continue;
      // No washing strung from a working building (a warehouse, a barn, a smithy).
      const roleOf = (c: CellKey): string => facts.shape.roles.get(occ.structure[c]!)?.role ?? '';
      if (WORKING_ROLES.has(roleOf(fc.cell)) || WORKING_ROLES.has(roleOf(other))) continue;
      const back = ((fc.dir + 2) % 4) as Dir4;
      if (!windows.has(fc.cell * 4 + fc.dir) && !windows.has(other * 4 + back)) continue;
      // What is under the line: nothing walkable at its own level, and no stair climbing up to it.
      if (between.some((b) => standable(facts, b) || (b >= LEVEL && occ.kindAt(b - LEVEL) === 'stairs'))) continue;
      let blocked = false;
      for (const b of between) {
        // A tree's crown just below, or a plaza anywhere under the line.
        if (b >= LEVEL && occ.kindAt(b - LEVEL) === 'tree') blocked = true;
        for (let d = b; d >= 0 && !(occ.flags[d]! & TERRAIN); d -= LEVEL) {
          if (occ.floor[d] === 2) blocked = true;
          if (occ.kind[d]) break;
        }
      }
      if (blocked || !lucky(seed, RULE, fc.cell, fc.dir, DRESSING.laundry)) continue;
      out.push({ anchor: fc.cell, structure: fc.structure, key: fc.dir, data: { to: other, dir: fc.dir } });
    }
    return out;
  },
  claims: (c) => [airSlot(c.anchor, c.data.dir)],
  apply(c, out, ctx) {
    // No more than a couple of lines in any three cells of one lane, whatever the storey. The lane
    // runs across the line; the lines already hung on it are this rule's props whose anchor cell
    // lies in the same row of cells.
    const max = Math.max(1, Math.round(DRESSING.laundryPerThree));
    const dir = c.data.dir;
    const x = keyX(c.anchor), z = keyZ(c.anchor);
    const here = dir === 1 ? z : x;
    const prefix = `${RULE}@`, suffix = `:${dir}`;
    const hung: number[] = [];
    for (const p of ctx.dressing?.props ?? []) {
      if (p.rule !== RULE || !p.id.endsWith(suffix)) continue;
      const cell = Number(p.id.slice(prefix.length, p.id.length - suffix.length));
      if ((dir === 1 ? keyX(cell) : keyZ(cell)) === (dir === 1 ? x : z)) hung.push(dir === 1 ? keyZ(cell) : keyX(cell));
    }
    for (const start of [here - 2, here - 1, here]) {
      if (hung.filter((t) => t >= start && t <= start + 2).length >= max) return;
    }
    const from = out.socket({ type: 'line-anchor', cell: c.anchor, dir, structure: c.structure });
    const to = out.socket({ type: 'line-anchor', cell: c.data.to, dir: ((dir + 2) % 4) as Dir4, structure: ctx.plan.structureAt.get(c.data.to) });
    const line = out.prop({
      type: 'laundry-line',
      at: { from, to },
      params: { garments: 3 + Math.floor(ctx.rand('n') * 4), look: Math.floor(ctx.rand('look') * 10000) },
    });
    out.socket({ type: 'perch', owner: line, cell: c.anchor, structure: c.structure });
  },
});
