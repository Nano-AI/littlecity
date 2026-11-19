// J07 · tier 1 · Extra doors. Any storey whose floor meets a walkable surface
// outside gets a door there: a roof terrace of this or another house, the
// top of a marble block or a dock, higher terrain beside an upper storey, a
// stair head. One door per storey and side, on the cell the seed picks.
// (Arch decks are J26's.)
import { below, keyY, neighbor } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { facades, type Facade } from '@/resolve/facts/facades.fact';
import { houseFacts } from './houses.fact';
import { featureAt, houseStructures, isTerraceTop } from './houses.lib';

export default defineRule<{ at: Facade }>({
  id: 'J07.extra-doors',
  part: 'joinery',
  tier: 1,
  priority: 930,
  about: 'Reads: facades, what each storey floor meets outside (houseFacts), roof features. Emits: door/deck features with door sockets.',
  find(ctx) {
    const all = facades(ctx.facts);
    const hf = houseFacts(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const groups = new Map<string, Facade[]>();
      for (const f of all.byStructure.get(s.id) ?? []) {
        if (f.touching || featureAt(ctx.plan, s.id, 'door', f.cell, f.dir)) continue;
        const what = hf.outside(f.cell, f.dir);
        const ok =
          what === 'deck' || what === 'stairs'
            ? true
            : what === 'ground'
              ? f.storey >= 2 // the ground storey's own ground is the main door's business
              : what === 'roof'
                ? isTerraceTop(ctx, below(neighbor(f.cell, f.dir)))
                : false;
        if (!ok) continue;
        const k = `${keyY(f.cell)}:${f.dir}`;
        const list = groups.get(k);
        if (list) list.push(f);
        else groups.set(k, [f]);
      }
      for (const list of groups.values()) {
        // The ground storey already has its main door: no second one beside it on the same side.
        const main = (ctx.plan.featuresByStructure.get(s.id) ?? []).find((f) => f.type === 'door');
        if (main && list.some((f) => keyY(f.cell) === keyY(main.cell!) && f.dir === main.dir)) continue;
        const pick = (f: Facade): number => rand(s.seed, 'extra-door', f.cell, f.dir);
        const at = [...list].sort((a, b) => pick(a) - pick(b))[0]!;
        out.push({ anchor: at.cell, structure: s.id, key: at.dir, data: { at } });
      }
    }
    return out;
  },
  apply(c, out) {
    const { at } = c.data;
    const door = out.feature({ type: 'door', structure: c.structure!, cell: at.cell, dir: at.dir, variant: 'deck' });
    out.socket({ type: 'door', owner: door, structure: c.structure!, cell: at.cell, dir: at.dir });
  },
});
