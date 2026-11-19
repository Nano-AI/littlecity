// D25 · tier 2 · Mill yard. Round the foot of a windmill standing on the
// ground, the miller's things, each on a different side of it:
//
//   a ladder     leaning on the mill's body
//   flour sacks  in a corner by the wall (R-H99's 'role-prop/sacks')
//   a hand cart  a little way out (R-H99's 'role-prop/cart')
//
// Never in front of the mill's door, never on a path's walking line. A mill
// raised on a tower (J25) has no yard at its foot.
//
// Stability: depends on the windmill's foot and the four cells beside it;
// which side gets which thing is seeded by the foot cell.
//
// Reads: windmill structures, terrain, clearways. Claims: the slot of each.

import { DIR4, key, keyX, keyY, keyZ, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS } from '@/resolve/facts/lib';
import { emit, type Placed } from '../urban/plots';
import { clearways, cornersOn, edgePos } from './clearways.fact';
import { heightAt } from './lib';

const RULE = 'D25.mill-yard';

export default defineRule<Placed>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 750,
  about: 'Reads: windmills on the ground, the cells beside their foot, clearways. Claims: the slot of the ladder, the sacks and the cart.',
  find({ facts, seed }) {
    const clear = clearways(facts);
    const out: Candidate<Placed>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'windmill') continue;
      let foot = s.cells[0]!;
      for (const c of s.cells) if (keyY(c) < keyY(foot)) foot = c;
      if (keyY(foot) !== heightAt(facts, keyX(foot), keyZ(foot))) continue;
      // The sides of the foot with a free cell beside it, in a seeded order.
      const sides: { cell: CellKey; d: Dir4 }[] = [];
      for (const d of DIRS) {
        const x = keyX(foot) + DIR4[d]![0], z = keyZ(foot) + DIR4[d]![1];
        if (heightAt(facts, x, z) !== keyY(foot)) continue;
        const cell = key(x, keyY(foot), z);
        if (facts.kinds.has(cell) || clear.doorFronts.has(cell) || facts.world.floors.get(cell) === 'path') continue;
        sides.push({ cell, d });
      }
      sides.sort((a, b) => hash(seed, RULE, foot, a.d) - hash(seed, RULE, foot, b.d));
      const look = (k: string): number => hash(seed, RULE, k, foot) % 1000;
      const things: ((side: { cell: CellKey; d: Dir4 }) => Placed | null)[] = [
        ({ cell, d }) => {
          const pos = edgePos(opposite(d));
          return clear.free(cell, pos) ? { type: 'ladder', cell, pos, face: d, params: { look: look('l'), back: 0.27 } } : null;
        },
        ({ cell, d }) => {
          const pos = cornersOn(opposite(d))[hash(seed, RULE, 'corner', foot) % 2]!;
          return clear.free(cell, pos) ? { type: 'role-prop', variant: 'sacks', cell, pos, face: d } : null;
        },
        ({ cell, d }) => (clear.free(cell, 'c') ? { type: 'role-prop', variant: 'cart', cell, pos: 'c', face: d } : null),
      ];
      sides.forEach((side, i) => {
        const p = i < things.length ? things[i]!(side) : null;
        if (p) out.push({ anchor: side.cell, structure: s.id, key: `mill${s.id}-${i}`, data: p });
      });
    }
    return out;
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos)],
  apply: (c, out) => emit(out, [c.data]),
});
