// J26 · tier 1 · Bridge doors. Where a walkable arch deck meets a house wall,
// the house gets a door at deck level. One per storey and side. (J09 leaves
// these facade cells free of windows.) Where the deck meets the house at
// roof level (a loggia hung off the top storey, a bridge landing at the
// eaves), the door stands in the roof: its cell is the one above the house.
import { above, keyY } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { facades, type Facade } from '@/resolve/facts/facades.fact';
import { houseFacts } from './houses.fact';
import { featureAt, houseStructures, isTerraceTop } from './houses.lib';

export default defineRule<{ at: Facade }>({
  id: 'J26.bridge-doors',
  part: 'joinery',
  tier: 1,
  priority: 740,
  about: 'Reads: facades, arch blocks under the cell outside. Emits: door/deck features with door sockets.',
  find(ctx) {
    const all = facades(ctx.facts);
    const hf = houseFacts(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const groups = new Map<string, Facade[]>();
      for (const f of all.byStructure.get(s.id) ?? []) {
        if (f.touching || hf.outside(f.cell, f.dir) !== 'bridge') continue;
        if (featureAt(ctx.plan, s.id, 'door', f.cell, f.dir) || featureAt(ctx.plan, s.id, 'window', f.cell, f.dir)) continue;
        const k = `${keyY(f.cell)}:${f.dir}`;
        const list = groups.get(k);
        if (list) list.push(f);
        else groups.set(k, [f]);
      }
      // At roof level there is no wall: the door stands in the roof (the generator gives it a
      // housing). This is how a loggia (R-A05) gets its door. Not onto a terrace: that is level already.
      for (const cell of s.cells) {
        const dir = hf.roofDoorAt(cell);
        if (dir === undefined || isTerraceTop(ctx, cell)) continue;
        const k = `${keyY(cell) + 1}:${dir}`;
        const at = { cell: above(cell), dir } as Facade;
        const list = groups.get(k);
        if (list) list.push(at);
        else groups.set(k, [at]);
      }
      for (const list of groups.values()) {
        const pick = (f: Facade): number => rand(s.seed, 'bridge-door', f.cell, f.dir);
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
