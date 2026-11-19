// R-T01: the steeple. A tower paired with a chapel is square, with an open
// belfry and a bell on its top storey and a spire above. Three ways to get
// one: beside a house of two or more cells, rising from a house roof, and
// handed the role by a chapel rule (here a stand-in for R-H01).

import { neighbor, NO_CELL, type Dir4 } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import type { StructureId } from '@/resolve/plan';
import { scenario } from '@/scenario';

/** Stands in for R-H01 in this scenario only: a one-cell house of palette colour 7 beside a tower is a chapel. */
const pairing = defineRule<{ tower: StructureId }>({
  id: 'X-T01.stand-in-chapel',
  part: 'roles',
  tier: 1,
  priority: 9995,
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'house' || s.color !== 7) continue;
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const n = neighbor(s.cells[0]!, d);
        if (n !== NO_CELL && plan.kinds.get(n) === 'tower') out.push({ anchor: s.cells[0]!, structure: s.id, data: { tower: plan.structureAt.get(n)! } });
      }
    }
    return out;
  },
  claims: (c) => [slot.role(c.data.tower)],
  apply(c, out) {
    out.role(c.structure!, 'chapel');
    out.role(c.data.tower, 'steeple');
  },
});

export default scenario({
  name: 'R-T01.steeple',
  seed: 44,
  about: 'Steeples: beside a two-cell house, on a house roof, paired by a chapel rule; a watchtower for comparison.',
  rules: [pairing],
  build(b) {
    b.path(8, 14, 26, 14);
    b.house(10, 12, { w: 2, color: 5 }).tower(12, 12, { floors: 4, color: 0 }); // beside the nave
    b.house(16, 12, { w: 2, d: 2, floors: 2, color: 2 }); // rising from the roof
    for (let y = 3; y <= 5; y++) b.block('tower', 16, y, 12, { color: 5 });
    b.house(21, 12, { color: 7 }).tower(22, 12, { floors: 3, color: 3 }); // paired by the stand-in rule
    b.tower(25, 12, { floors: 4, color: 4 }); // nothing beside it: a watchtower
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 3.6, target: [17.5, 3, 12.5] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3.6, target: [17.5, 3, 12.5] },
    { name: 'close', yaw: 30, pitch: 24, zoom: 7.5, target: [12.5, 3.8, 12] },
    { name: 'far', yaw: 135, pitch: 38, zoom: 2.2, target: [17.5, 2, 13] },
  ],
  expect(_plan, _dressing, check) {
    check.role(12, 1, 12, 'steeple');
    check.hasTag(12, 1, 12, 'body:square');
    check.hasFeature({ type: 'belfry', at: [12, 4, 12] });
    check.hasSocket({ type: 'bell', at: [12, 4, 12] });
    check.hasFeature({ type: 'cap', variant: 'spire', at: [12, 4, 12] });
    check.noFeature({ type: 'window', at: [12, 4, 12] });
    check.role(16, 3, 12, 'steeple');
    check.role(22, 1, 12, 'steeple');
    check.role(21, 1, 12, 'chapel');
    check.hasFeature({ type: 'belfry', at: [22, 3, 12] });
    check.role(25, 1, 12, 'watchtower');
    check.noFeature({ type: 'belfry', on: [25, 1, 12] });
  },
});
