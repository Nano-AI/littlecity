// R-W01 · tier 1 · Windmill. Always: a tapered body with a cap on the top
// block and four sails on the cap's hub. The cap looks toward the most open
// side (south or east on a tie, where the default view sees the sails). On
// top of a tower or a house stack it is 'raised' (J25 adds its gallery).
import { below, keyY, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';

/** Tie order: the sides the default camera sees first. */
const PREFER: readonly Dir4[] = [2, 1, 3, 0];

export default defineRule({
  id: 'R-W01.windmill',
  part: 'roles',
  tier: 1,
  priority: 7990,
  about: 'Reads: windmill structures, facades of the top cell. Emits: role, a cap/mill-cap feature owning the mill-hub socket, the raised tag.',
  find: (ctx) =>
    [...ctx.facts.structures.values()]
      .filter((s) => s.kind === 'windmill' && s.cells.length > 0)
      .sort((a, b) => a.id - b.id)
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id })),
  apply(c, out, ctx) {
    const structure = c.structure!;
    const s = ctx.facts.structures.get(structure)!;
    out.role(structure, 'windmill');
    const top = [...s.cells].sort((a, b) => keyY(b) - keyY(a))[0]!;
    const all = facades(ctx.facts);
    // How open a side is: nothing within reach is best, then the farther the better.
    const open = (d: Dir4): number => {
      const f = all.at(top, d);
      if (!f) return -1;
      if (f.faces === 'structure' || f.faces === 'cliff') return f.dist;
      return 4;
    };
    const dir = [...PREFER].sort((a, b) => open(b) - open(a))[0]!;
    const cap = out.feature({ type: 'cap', structure, cell: top, dir, variant: 'mill-cap' });
    out.socket({ type: 'mill-hub', owner: cap, structure, cell: top, dir });
    const under = below(s.cells[0]!);
    const kind = under === NO_CELL ? undefined : ctx.facts.kinds.get(under);
    if (kind === 'tower' || kind === 'house') out.tag(structure, 'raised');
  },
});
