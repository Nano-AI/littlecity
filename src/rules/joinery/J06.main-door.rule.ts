// J06 · tier 1 · Main door. One per house (and windmill), on its ground
// storey, on the facade cell that scores highest (doorScore in houses.lib:
// street +5, plaza +4, a floor within 3 +3, open ground +1, water, cliff or
// alley −3). Ties go to the seed. The role picks the kind of door; a door
// above the ground outside gets a stoop (J08: `steps`).
import { rand } from '@/core/rand';
import { defineRule, findEach, type RuleContext } from '@/resolve/engine/api';
import { facades, type Facade } from '@/resolve/facts/facades.fact';
import { houseFacts } from './houses.fact';
import { doorScore, roleOf, STEPS_PER_LEVEL } from './houses.lib';

import type { Structure } from '@/resolve/plan';

/** Houses and windmills, by id. */
function doorStructures(ctx: RuleContext): Structure[] {
  return [...ctx.facts.structures.values()].filter((s) => s.kind === 'house' || s.kind === 'windmill').sort((a, b) => a.id - b.id);
}

export default defineRule<{ at: Facade }>({
  id: 'J06.main-door',
  part: 'joinery',
  tier: 1,
  priority: 940,
  about: 'Reads: facades of the ground storey, roles. Emits: one door feature per house and windmill, with its door socket (a shop door also owns awning-mount and sign-bracket).',
  // Reads only its facades (with their alley flags), the cells beside it and its role (RuleDef.local).
  local: 3,
  localAlso: (ctx, s) => facades(ctx.facts).alleyDigest(s),
  localReplay: false, // apply only emits what find chose
  ...findEach(doorStructures, (ctx, s) => {
    const all = facades(ctx.facts);
    const hf = houseFacts(ctx.facts);
    const out = [];
    const id = s.id;
    let ground = (all.byStructure.get(id) ?? []).filter((f) => f.storey === 1);
    // R-H05: a boathouse opens onto the water (or onto the dock it stands by).
    if (roleOf(ctx.plan, id) === 'boathouse') {
      const wet = ground.filter((f) => f.water === 1 || hf.outside(f.cell, f.dir) === 'deck');
      if (wet.length > 0) ground = wet;
    }
    // U11: a town hall opens onto its square.
    const hall = roleOf(ctx.plan, id) === 'town-hall';
    let best: Facade | null = null;
    let bestScore = -Infinity;
    for (const f of ground) {
      // The seed breaks ties (and nothing else: it is worth less than any rule point).
      const score = doorScore(f) + (hall && f.plaza === 1 ? 3 : 0) + rand(s.seed, 'main-door', f.cell, f.dir) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    if (best) out.push({ anchor: best.cell, structure: id, key: best.dir, data: { at: best } });
    return out;
  }),
  apply(c, out, ctx) {
    const { at } = c.data;
    const structure = c.structure!;
    const role = roleOf(ctx.plan, structure);
    const variant = role === 'chapel' || role === 'boathouse' || role === 'town-hall' || role === 'barn' ? 'double' : role === 'shop' ? 'shop' : 'plain';
    // A stoop spans one storey at most; a door higher than that (a mill on a tower) is reached from inside.
    const steps = at.drop === 1 && at.water !== 1 ? STEPS_PER_LEVEL : 0; // and never down into the sea
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
