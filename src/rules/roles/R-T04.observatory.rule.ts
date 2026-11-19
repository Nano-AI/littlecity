// R-T04 · Observatory. A tower at least 4 tall standing on the highest
// terrain level of the island (a real hill: above the lowest land), with no
// water within 4 columns: a dome with an observing slit (J13). The telescope
// and the turning dome are L29's, on the cap's 'telescope' socket.

import { columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { distToWater } from '@/resolve/facts/distance.fact';

export default defineRule({
  id: 'R-T04.observatory',
  part: 'roles',
  tier: 3,
  priority: 8960,
  about: 'Reads: towers of height 4+ with no role, terrain heights, distToWater. Emits: role observatory.',
  find({ plan, facts }) {
    let highest = 0, lowest = Infinity;
    for (const h of plan.terrain.height) {
      if (h > highest) highest = h;
      if (h > 0 && h < lowest) lowest = h;
    }
    if (highest <= lowest) return [];
    const water = distToWater(facts);
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'tower' || s.cells.length < 4) continue;
      const x = keyX(s.cells[0]!), z = keyZ(s.cells[0]!);
      if (keyY(s.cells[0]!) !== highest || plan.terrain.height[columnIndex(x, z)] !== highest) continue;
      if (water.at(x, z) <= 4) continue;
      out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out) {
    out.role(c.structure!, 'observatory');
  },
});
