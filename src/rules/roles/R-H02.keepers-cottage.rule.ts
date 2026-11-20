// R-H02 · tier 2 · Keeper's cottage. A house touching a lighthouse: white
// walls with red trim whatever colour it was given, and a red roof. Not one
// touching a Light far inland (a folly, R-L02: nobody keeps it).
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import { houseStructures } from '../joinery/houses.lib';
import { inland } from './R-L02.folly-tower.rule';

export default defineRule({
  id: 'R-H02.keepers-cottage',
  part: 'roles',
  tier: 2,
  priority: 9980,
  about: 'Reads: structureInfo (touches a lighthouse). Claims: the role. Tags white-walls.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    return houseStructures(ctx)
      .filter((s) => (info.get(s.id)?.touches ?? []).some((t) => t.kind === 'lighthouse' && !inland(ctx.facts.terrain, ctx.facts.structures.get(t.id)!)))
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'keepers-cottage');
    out.tag(c.structure!, 'white-walls');
  },
});
