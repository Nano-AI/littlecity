// U04 · tier 2 · Back yards.
//
// A leftover patch of up to DRESSING.yardMax cells that touches houses and
// no street or square is the backs of those houses. Each cell belongs to
// the house it lies against; a low picket fence divides one house's yard
// from the next; and every cell holds one back-of-house thing, in a fixed
// rotation so neighbours differ: a vegetable patch, a washing pole, a shed
// with its back to the far boundary, a woodpile against the house wall. One
// shed to a patch at most.
//
// Which patches are back yards is the landUse fact's decision.
//
// Stability: seeded by the patch's own cells.
//
// Reads: landUse.backYards, clearways. Claims: the floor slot of each thing
// (dividing fences stand on the cell line and claim nothing).

import { neighbor, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { landUse } from './land-use.fact';
import { claimsOf, emit, placer, plotOf, sidesWith, type Placed } from './plots';

const RULE = 'U04.back-yards';
const ROTATION = ['veg', 'wash', 'shed', 'wood', 'veg', 'wash', 'wood'] as const;

export default defineRule<Placed[]>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 960,
  about: 'Reads: landUse (back yards: small leftovers behind houses, off every street), clearways. Claims: the floor slot of each shed, patch, pole and woodpile.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<Placed[]>[] = [];
    for (const yard of landUse(facts).backYards) {
      const plot = plotOf(facts, yard.cells, seed);
      const anchor = yard.cells[0]!;
      const p = placer((c, pos) => clear.free(c, pos));
      const look = (k: string, c: CellKey): number => hash(seed, RULE, k, c) % 1000;
      // Whose yard each cell is: the house it lies against (the lowest side wins); else its neighbour's.
      const owner = new Map<CellKey, number>();
      const houseSide = new Map<CellKey, Dir4>();
      for (const c of yard.cells) {
        for (const d of DIRS) {
          const n = neighbor(c, d);
          if (plot.beyond(c, d) === 'wall' && facts.kinds.get(n) === 'house') {
            owner.set(c, facts.structureAt.get(n)!);
            houseSide.set(c, d);
            break;
          }
        }
      }
      for (let pass = 0; pass < 6; pass++) {
        for (const c of yard.cells) {
          if (owner.has(c)) continue;
          const from = DIRS.map((d) => neighbor(c, d)).find((n) => plot.has(n) && owner.has(n));
          if (from !== undefined) owner.set(c, owner.get(from)!);
        }
      }
      // A fence between two yards (drawn once, by the cell on its west or north side).
      for (const c of yard.cells) {
        for (const d of [1, 2] as Dir4[]) {
          const n = neighbor(c, d);
          if (plot.beyond(c, d) === 'in' && owner.get(c) !== owner.get(n)) {
            p.put({ type: 'garden-fence', variant: 'picket', cell: c, pos: edgePos(d), face: opposite(d), claim: false, params: { from: 1, to: 1, look: look('fence', c) + d } });
          }
        }
      }
      const start = hash(seed, RULE, 'rotation', anchor);
      let sheds = 0;
      yard.cells.forEach((c, i) => {
        const wall = houseSide.get(c);
        // The far boundary: a closed side that is not this cell's own house.
        const far = DIRS.find((d) => d !== wall && plot.beyond(c, d) !== 'in' && plot.beyond(c, d) !== 'street');
        for (let k = 0; k < ROTATION.length; k++) {
          const thing = ROTATION[(start + i + k) % ROTATION.length]!;
          let ok: boolean;
          if (thing === 'shed') {
            ok = sheds === 0 && far !== undefined && p.put({ type: 'shed', cell: c, pos: edgePos(far), face: opposite(far), params: { look: look('shed', c) } });
            if (ok) sheds++;
          } else if (thing === 'wood') {
            ok = wall !== undefined && p.put({ type: 'woodpile', cell: c, pos: edgePos(wall), face: opposite(wall), params: { look: look('wood', c) } });
          } else if (thing === 'veg') {
            ok = p.put({ type: 'veg-patch', cell: c, pos: 'c', face: 2, params: { look: look('veg', c) } });
          } else {
            // The line runs across the yard: along the house wall.
            const across = wall === undefined ? sidesWith(plot, c, 'in')[0] ?? 1 : ((wall + 1) % 4) as Dir4;
            ok = p.put({ type: 'washing-pole', cell: c, pos: 'c', face: ((across + 1) % 4) as Dir4, params: { look: look('wash', c) } });
          }
          if (ok) break;
        }
      });
      if (p.items.length) out.push({ anchor, data: p.items });
    }
    return out;
  },
  claims: (c) => claimsOf(c.data),
  apply: (c, out) => emit(out, c.data),
});
