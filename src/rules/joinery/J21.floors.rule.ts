// J21 · tier 1 · Floors.
//
// Paths have rounded ends and filleted corners; a path meeting a plaza gets
// a flush kerb; a path at a door widens; on a dock planks follow the run, on
// a bridge deck cobbles. The shapes themselves are the floor generators'
// work (src/gen/floor). What a floor generator cannot see is what lies
// beside its region, so this rule tells it, one `floor-link` feature per
// floor cell side:
//
//   on a path cell     plaza / garden   another kind of floor lies there
//                      stairs           the foot or the head of a stairs flight
//                      door             a door opens onto this cell from that side
//                      deck             a deck, quay or bridge top the path is heading for
//   on a plaza or garden cell   path    a path arrives there
//
// Runs after J06, J07 and J26 (doors), J17 (carved steps) and J20 (gates).

import { below, keyY, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import type { FeatureVariant } from '@/core/vocab';
import { defineRule, type Candidate, type RuleContext } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';

const DIRS: readonly Dir4[] = [0, 1, 2, 3];

export interface FloorLink {
  cell: CellKey;
  dir: Dir4;
  structure: StructureId;
  variant: FeatureVariant<'floor-link'>;
}

export function floorLinks({ facts, plan }: RuleContext): FloorLink[] {
  const floors = facts.world.floors;
  // Doors by the cell they open onto and the side of that cell the door is on.
  const doors = new Set<number>();
  for (const f of plan.features) {
    if (f.type !== 'door' || f.cell === undefined || f.dir === undefined) continue;
    const outside = neighbor(f.cell, f.dir);
    if (outside !== NO_CELL) doors.add(outside * 4 + opposite(f.dir));
  }
  const solidBlock = (c: CellKey): boolean => {
    const k = c === NO_CELL ? undefined : facts.kinds.get(c);
    return k !== undefined && KINDS[k].solid;
  };
  const out: FloorLink[] = [];
  for (const [cell, kind] of floors) {
    const structure = facts.floorAt.get(cell);
    if (structure === undefined) continue;
    for (const d of DIRS) {
      const n = neighbor(cell, d);
      if (n === NO_CELL) continue;
      const other = floors.get(n);
      if (kind !== 'path') {
        if (other === 'path') out.push({ cell, dir: d, structure, variant: 'path' });
        continue;
      }
      if (other === 'plaza' || other === 'garden') {
        out.push({ cell, dir: d, structure, variant: other });
        continue;
      }
      if (other === 'path') continue;
      if (doors.has(cell * 4 + d)) {
        out.push({ cell, dir: d, structure, variant: 'door' });
        continue;
      }
      // The foot of a flight that climbs away from this cell, or the head of one that arrives in it.
      const under = below(n);
      const here = facts.kinds.get(n), beneath = under === NO_CELL ? undefined : facts.kinds.get(under);
      if (here === undefined && beneath === undefined) continue; // open ground beside: nothing to meet
      const foot = here === 'stairs' && facts.world.blocks.get(n)?.rot === d;
      const head = beneath === 'stairs' && facts.world.blocks.get(under)?.rot === opposite(d);
      if (foot || head) {
        out.push({ cell, dir: d, structure, variant: 'stairs' });
        continue;
      }
      // A deck ahead: an empty, floorless cell on top of a solid block, and the path is heading straight
      // for it (it comes from the opposite side, or this is where the path starts).
      if (keyY(n) > 0 && here === undefined && solidBlock(under)) {
        const behind = neighbor(cell, opposite(d));
        const pathNeighbours = DIRS.filter((e) => floors.get(neighbor(cell, e)) === 'path').length;
        if ((behind !== NO_CELL && floors.get(behind) === 'path') || pathNeighbours === 0) out.push({ cell, dir: d, structure, variant: 'deck' });
      }
    }
  }
  return out.sort((a, b) => a.cell - b.cell || a.dir - b.dir);
}

export default defineRule<FloorLink>({
  id: 'J21.floors',
  part: 'joinery',
  tier: 1,
  priority: 790,
  about: 'Reads: floors and what lies beside each cell (other floors, doors, stairs, decks). Emits: floor-link features for the floor generators.',
  find(ctx) {
    return floorLinks(ctx).map((l): Candidate<FloorLink> => ({ anchor: l.cell, key: l.dir, structure: l.structure, data: l }));
  },
  apply(c, out) {
    out.feature({ type: 'floor-link', structure: c.data.structure, cell: c.data.cell, dir: c.data.dir, variant: c.data.variant });
  },
});
