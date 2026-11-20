// J30 · tier 2 · Trade fronts. What a working building's walls show of its
// trade, placed once its main door (J06) and roof (J04) are known:
//
//   barn (R-H18)   big boarded doors swung open either side of the main
//                  door ('barn-doors' on the door's cell and side), and a
//                  hayloft door with a hoist beam in the gable end farthest
//                  from that door ('hayloft').
//   watermill      the wheel's timber frame and bearing on the river side
//   (R-H16)        ('mill-race', owning the 'wheel-hub' socket the water
//                  wheel turns on); J09 leaves that wall cell without a window.
//
// Priority 930: after J06 (940) and J04 (960).

import { keyX, keyZ, neighbor, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { roofRegions } from '@/resolve/facts/roofs.fact';
import type { Feature } from '@/resolve/plan';
import { millSide } from '../roles/R-H16.watermill.rule';
import { houseStructures, roleOf, roofOf } from './houses.lib';

interface Front {
  type: 'barn-doors' | 'hayloft' | 'mill-race';
  cell: number;
  dir: Dir4;
}

export default defineRule<Front>({
  id: 'J30.trade-fronts',
  part: 'joinery',
  tier: 2,
  priority: 930,
  about: 'Reads: house roles (barn, watermill), main doors, roofs, facades over river water. Emits: barn-doors and a hayloft on a barn; a mill-race (socket wheel-hub) on a watermill.',
  find(ctx) {
    const out = [];
    for (const s of houseStructures(ctx)) {
      const role = roleOf(ctx.plan, s.id);
      if (role === 'watermill') {
        const side = millSide(s, ctx.facts);
        if (side) out.push({ anchor: side.cell, structure: s.id, key: 'race', data: { type: 'mill-race' as const, cell: side.cell, dir: side.dir } });
        continue;
      }
      if (role !== 'barn') continue;
      const feats = ctx.plan.featuresByStructure.get(s.id) ?? [];
      const door = feats.find((f): f is Feature & { cell: number; dir: number } => f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1 && f.cell !== undefined && f.dir !== undefined);
      if (door) out.push({ anchor: door.cell, structure: s.id, key: 'doors', data: { type: 'barn-doors' as const, cell: door.cell, dir: door.dir as Dir4 } });
      // The hayloft: in the gable end of the main roof that lies farther from the door.
      for (const region of roofRegions(ctx.facts).byStructure.get(s.id) ?? []) {
        const roof = roofOf(ctx.plan, region);
        if (!roof || roof.variant !== 'gable') continue;
        const ridge = (roof.params as { ridge?: 'x' | 'z' } | undefined)?.ridge ?? (region.width >= region.depth ? 'x' : 'z');
        const ends: Dir4[] = ridge === 'x' ? [3, 1] : [0, 2];
        let best: { cell: number; dir: Dir4; far: number } | null = null;
        for (const dir of ends) {
          const edge = region.cells.filter((k) => !region.cells.includes(neighbor(k, dir)));
          if (edge.length === 0) continue;
          const cell = edge[Math.floor((edge.length - 1) / 2)]!;
          const far = door ? Math.abs(keyX(cell) - keyX(door.cell)) + Math.abs(keyZ(cell) - keyZ(door.cell)) : dir;
          if (!best || far > best.far) best = { cell, dir, far };
        }
        if (best) out.push({ anchor: best.cell, structure: s.id, key: `loft${region.index}`, data: { type: 'hayloft' as const, cell: best.cell, dir: best.dir } });
        break;
      }
    }
    return out;
  },
  apply(c, out) {
    const f = out.feature({ type: c.data.type, structure: c.structure!, cell: c.data.cell, dir: c.data.dir });
    if (c.data.type === 'mill-race') out.socket({ type: 'wheel-hub', owner: f, structure: c.structure, cell: c.data.cell, dir: c.data.dir });
  },
});
