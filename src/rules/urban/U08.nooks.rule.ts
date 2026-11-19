// U08 · tier 2 · Nooks.
//
// The odd empty corner beside a stair, at the foot of grand steps or under
// a deck is never empty in a real town: something is kept there. A nook is
// an empty cell someone could stand in (bare ground or plaza paving, not a
// path) that
//
//   lies beside a stairs block or a cell of grand steps, or under a deck
//   (a solid block one or two levels overhead: a bridge, a house on posts),
//   and is shut in on two sides or more (solid blocks or terrain beside it;
//   the deck overhead counts as one).
//
// It never takes the foot or the head of a flight, a doorway or any other
// walking line. What it holds is chosen from a fixed pattern over the map,
// so two nooks side by side never hold the same thing: stacked crates,
// barrels, a crate with a cat asleep on it, a handcart, a wall fountain
// (against a wall), a kiosk (in the open air, facing a street or square).
//
// Stability: a nook depends on its own cell and the four beside it.
//
// Reads: occupancy, broad-steps features, landUse, clearways. Claims: the
// centre slot of the cell and the slot the thing stands on.

import { DIR4, key, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, SIZE_X, SIZE_Y, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS, standable } from '@/resolve/facts/lib';
import { occupancy, SOLID, TERRAIN } from '@/resolve/facts/occupancy.fact';
import { DRESSING } from '@/style/dressing';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { lucky } from '../decoration/lib';
import { landUse } from './land-use.fact';
import { emit, type Placed } from './plots';

const RULE = 'U08.nooks';
type Thing = 'crates' | 'barrels' | 'cat' | 'cart' | 'fountain' | 'kiosk';
/** Arranged so that entries 3 apart and 7 apart always differ: neighbours along x and z never match. */
const PATTERN_OF_THINGS: readonly Thing[] = ['crates', 'cat', 'cart', 'barrels', 'fountain', 'kiosk', 'crates', 'cart', 'barrels', 'cat'];

export default defineRule<Placed>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 920,
  about: 'Reads: occupancy (stairs, solid sides, blocks overhead), broad-steps features, landUse, clearways. Claims: the centre slot of the nook cell and the slot its thing stands on.',
  find({ facts, seed, plan }) {
    const occ = occupancy(facts);
    const clear = clearways(facts);
    const uses = landUse(facts);
    const steps = new Set<CellKey>();
    for (const f of plan.features) if (f.type === 'broad-steps' && f.cell !== undefined) steps.add(f.cell);
    // Every empty cell beside a stair or steps, or under a block.
    const maybe = new Set<CellKey>();
    for (const [c, k] of facts.kinds) {
      if (k === 'stairs' || steps.has(c)) for (const d of DIRS) maybe.add(neighbor(c, d));
      if (occ.flags[c]! & SOLID) for (const dy of [1, 2]) if (keyY(c) - dy >= 1) maybe.add(c - dy * (1 << 12));
    }
    const base = hash(seed, RULE, 'pattern');
    const out: Candidate<Placed>[] = [];
    for (const c of [...maybe].sort((a, b) => a - b)) {
      if (c === NO_CELL || c < 0 || facts.kinds.has(c) || !standable(facts, c)) continue;
      if (facts.world.floors.get(c) === 'path' || facts.world.floors.get(c) === 'garden' || uses.byCell.has(c)) continue;
      if (!clear.free(c, 'c') || clear.doorFronts.has(c) || clear.stairEnds.has(c)) continue;
      const x = keyX(c), y = keyY(c), z = keyZ(c);
      if (x < 1 || z < 1 || x > SIZE_X - 2 || z > SIZE_Z - 2) continue;
      // A stairs block shuts a side in as a wall does (it is not a solid block, so ask for it by name).
      const isStair = (n: CellKey): boolean => occ.kindAt(n) === 'stairs' || steps.has(n);
      const solidSides = DIRS.filter((d) => (occ.flags[neighbor(c, d)]! & SOLID) !== 0 || isStair(neighbor(c, d)));
      const stairSide = DIRS.some((d) => isStair(neighbor(c, d)));
      let covered = false;
      for (const dy of [1, 2]) if (y + dy < SIZE_Y && occ.flags[key(x, y + dy, z)]! & SOLID) covered = true;
      if (!stairSide && !covered) continue;
      if (solidSides.length + (covered ? 1 : 0) < 2) continue;
      if (!lucky(seed, RULE, c, 'nook', DRESSING.nook)) continue;
      // A wall to stand a fountain against: a solid side that is a block, not a stair and not a bank.
      const wall = solidSides.find((d) => {
        const n = neighbor(c, d);
        return occ.kindAt(n) !== undefined && occ.kindAt(n) !== 'stairs' && !(occ.flags[n]! & TERRAIN);
      });
      // A street or square to face a kiosk at.
      const front = DIRS.find((d) => {
        const n = key(x + DIR4[d]![0], y, z + DIR4[d]![1]);
        const f = facts.world.floors.get(n);
        return !facts.kinds.has(n) && (f === 'path' || f === 'plaza');
      });
      const start = (base + x * 3 + z * 7) % PATTERN_OF_THINGS.length;
      const look = hash(seed, RULE, 'look', c) % 1000;
      let item: Placed | null = null;
      for (let i = 0; i < PATTERN_OF_THINGS.length && !item; i++) {
        const thing = PATTERN_OF_THINGS[(start + i) % PATTERN_OF_THINGS.length]!;
        if (thing === 'fountain') {
          if (wall !== undefined && clear.free(c, edgePos(wall))) item = { type: 'wall-fountain', cell: c, pos: edgePos(wall), face: opposite(wall) };
        } else if (thing === 'kiosk') {
          if (front !== undefined && !covered) item = { type: 'kiosk', cell: c, pos: 'c', face: front as Dir4, params: { color: look % 4 } };
        } else if (thing === 'cart') {
          if (!covered || solidSides.length < 3) item = { type: 'cart', cell: c, pos: 'c', params: { look } };
        } else item = { type: 'goods-stack', variant: thing, cell: c, pos: 'c', params: { look } };
      }
      if (item) out.push({ anchor: c, data: item });
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, 'c'), slot.floor(c.anchor, c.data.pos)],
  apply: (c, out) => emit(out, [c.data]),
});
