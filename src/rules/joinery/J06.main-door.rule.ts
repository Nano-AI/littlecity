// J06 · tier 1 · Main door. One per house (and windmill), on its ground
// storey, on the facade cell that scores highest (doorScore in houses.lib:
// street +5, plaza +4, a floor within 3 +3, open ground +1, water, cliff or
// alley −3). Ties go to the seed. The role picks the kind of door; a door
// above the ground outside gets a stoop (J08: `steps`).
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { facades, type Facade } from '@/resolve/facts/facades.fact';
import { houseFacts } from './houses.fact';
import { doorScore, roleOf, STEPS_PER_LEVEL } from './houses.lib';

export default defineRule<{ at: Facade }>({
  id: 'J06.main-door',
  part: 'joinery',
  tier: 1,
  priority: 940,
  about: 'Reads: facades of the ground storey, roles. Emits: one door feature per house and windmill, with its door socket (a shop door also owns awning-mount and sign-bracket).',
  find(ctx) {
    const all = facades(ctx.facts);
    const hf = houseFacts(ctx.facts);
    const out = [];
    const ids = [...ctx.facts.structures.keys()].sort((a, b) => a - b);
    for (const id of ids) {
      const s = ctx.facts.structures.get(id)!;
      if (s.kind !== 'house' && s.kind !== 'windmill') continue;
      let ground = (all.byStructure.get(id) ?? []).filter((f) => f.storey === 1);
      // R-H05: a boathouse opens onto the water (or onto the dock it stands by).
      if (roleOf(ctx.plan, id) === 'boathouse') {
        const wet = ground.filter((f) => f.water === 1 || hf.outside(f.cell, f.dir) === 'deck');
        if (wet.length > 0) ground = wet;
      }
      let best: Facade | null = null;
      let bestScore = -Infinity;
      for (const f of ground) {
        // The seed breaks ties (and nothing else: it is worth less than any rule point).
        const score = doorScore(f) + rand(s.seed, 'main-door', f.cell, f.dir) * 0.5;
        if (score > bestScore) {
          bestScore = score;
          best = f;
        }
      }
      if (best) out.push({ anchor: best.cell, structure: id, key: best.dir, data: { at: best } });
    }
    return out;
  },
  apply(c, out, ctx) {
    const { at } = c.data;
    const structure = c.structure!;
    const role = roleOf(ctx.plan, structure);
    const variant = role === 'chapel' || role === 'boathouse' ? 'double' : role === 'shop' ? 'shop' : 'plain';
    // A stoop spans one storey at most; a door higher than that (a mill on a tower) is reached from inside.
    const steps = at.drop === 1 ? STEPS_PER_LEVEL : 0;
    const door = out.feature({
      type: 'door',
      structure,
      cell: at.cell,
      dir: at.dir,
      variant,
      params: { main: 1, ...(steps > 0 ? { steps } : {}) },
    });
    out.socket({ type: 'door', owner: door, structure, cell: at.cell, dir: at.dir });
    if (variant === 'shop') out.socket({ type: 'awning-mount', owner: door, structure, cell: at.cell, dir: at.dir });
    // A shop and an inn hang a sign by the door (D07).
    if (variant === 'shop' || role === 'inn') out.socket({ type: 'sign-bracket', owner: door, structure, cell: at.cell, dir: at.dir });
    // R-H09: a manor's door stands in a portico.
    if (role === 'manor' && steps === 0) out.feature({ type: 'portico', structure, cell: at.cell, dir: at.dir });
  },
});
