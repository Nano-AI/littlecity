// R-S01 · tier 1 · Stall (first match wins):
//   within 3 column steps of a dock → fish stall
//   on a garden floor               → flower stall
//   otherwise                       → market stall with a striped awning and
//                                     goods chosen by the town's seed and the cell
//
// It also pins two tags the generator needs and cannot work out for itself
// (a generator sees only its own cell and its neighbours' blocks):
//   front:<side>   the side the counter faces: the street or square beside
//                  it, else open ground, never a wall or a drop if it can be
//                  helped. Ties go to the south, then east (the sides the
//                  default view shows).
//   goods:<what>   market stalls only: fruit, bread, cheese, pots or cloth,
//                  never the same as a stall within two cells (goodsAt).

import { keyX, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { solid, standable } from '@/resolve/facts/lib';
import { STALL } from '@/style/props';
import { frontTag, goodsAt, goodsTag, type Goods, type StallRole } from './ground-props';
import { stallDistToDock } from './stall-dock-distance.fact';

export function stallRole(f: Facts, cell: CellKey): StallRole {
  if (stallDistToDock(f).at(keyX(cell), keyZ(cell)) <= STALL.dockReach) return 'fish-stall';
  if (f.world.floors.get(cell) === 'garden') return 'flower-stall';
  return 'market-stall';
}

/** How good a side is to serve from. */
function sideScore(f: Facts, cell: CellKey, d: Dir4): number {
  const n = neighbor(cell, d);
  if (n === NO_CELL || solid(f, n)) return -9;
  if (!standable(f, n)) return -4;
  let score = 1;
  const floor = f.world.floors.get(n);
  if (floor === 'path' || floor === 'plaza') score += 4;
  else if (floor === 'garden') score += 1;
  if (f.kinds.has(n)) score -= 2; // a tree, another stall, a fence: someone could squeeze past
  return score;
}

/** South first, then east, west, north. */
const PREFERENCE: readonly Dir4[] = [2, 1, 3, 0];

export function stallFront(f: Facts, cell: CellKey): Dir4 {
  let best: Dir4 = PREFERENCE[0]!;
  let bestScore = -Infinity;
  for (const d of PREFERENCE) {
    const score = sideScore(f, cell, d);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

interface StallData {
  role: StallRole;
  front: Dir4;
  goods?: Goods;
}

export default defineRule<StallData>({
  id: 'R-S01.stall',
  part: 'roles',
  tier: 1,
  priority: 3990,
  about: 'Reads: distance to the nearest dock, the floor in the cell, what stands on each side. Claims: the stall’s role. Tags its front side and a market stall’s goods.',
  find({ facts }) {
    const out: Candidate<StallData>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'stall') continue;
      const cell = s.cells[0]!;
      const role = stallRole(facts, cell);
      out.push({ anchor: cell, structure: s.id, data: { role, front: stallFront(facts, cell), goods: role === 'market-stall' ? goodsAt(facts.seed, cell) : undefined } });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, c.data.role);
    out.tag(c.structure!, frontTag(c.data.front));
    if (c.data.goods) out.tag(c.structure!, goodsTag(c.data.goods));
  },
});
