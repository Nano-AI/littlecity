// J08 · tier 1 · Stoop and trail. A door above the ground outside gets steps
// (the door rules set `door.steps` from the drop, STEPS_PER_LEVEL per
// storey; this file's fixture checks it). A main door 2–3 cells from a floor
// and not next to one gets a worn dirt trail to it: one 'trail' feature per
// bare ground cell between the door and the floor. Trails are walkable.
import { columnIndex, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { step } from '@/resolve/facts/lib';
import { houseStructures } from './houses.lib';

export default defineRule<{ cells: CellKey[]; dir: Dir4 }>({
  id: 'J08.stoop-trail',
  part: 'joinery',
  tier: 1,
  priority: 920,
  about: 'Reads: main door features, facades (distance to floors), the ground between. Emits: trail features. Claims: the centre floor slot of each trail cell.',
  find(ctx) {
    const all = facades(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      const door = (ctx.plan.featuresByStructure.get(s.id) ?? []).find((f) => f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1);
      if (!door || door.cell === undefined || door.dir === undefined) continue;
      const fc = all.at(door.cell, door.dir);
      if (!fc || fc.drop !== 0) continue;
      const reach = Math.min(fc.street ?? 9, fc.plaza ?? 9, fc.garden ?? 9);
      if (reach < 2 || reach > 3) continue;
      // Every cell between must be bare ground at the door's level.
      const cells: CellKey[] = [];
      for (let k = 1; k < reach; k++) {
        const c = step(door.cell, door.dir, k);
        const bare =
          c >= 0 &&
          keyY(c) === ctx.facts.terrain.height[columnIndex(keyX(c), keyZ(c))] &&
          !ctx.facts.kinds.has(c) &&
          !ctx.facts.world.floors.has(c);
        if (!bare) break;
        cells.push(c);
      }
      if (cells.length === reach - 1) out.push({ anchor: door.cell, structure: s.id, data: { cells, dir: door.dir } });
    }
    return out;
  },
  claims: (c) => c.data.cells.map((cell) => slot.floor(cell, 'c')),
  apply(c, out) {
    for (const cell of c.data.cells) out.feature({ type: 'trail', structure: c.structure!, cell, dir: c.data.dir });
  },
});
