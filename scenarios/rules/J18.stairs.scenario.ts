// J18: stairs. A single flight; three side by side as one wide flight; a
// flight of seven up a marble spine with landings at its fourth and seventh
// cells and handrails where the drop is two or more; a flight against a wall
// (no rail on that side); a wide flight up two terraces of ground.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J18.stairs',
  seed: 9,
  about: 'Stair flights: single, wide, a long one with landings and handrails, one against a wall, one up terraces.',
  terrain(t) {
    t.flat(1);
    t.rect(30, 14, 36, 19, 2);
    t.rect(30, 14, 36, 18, 3);
  },
  build(b) {
    // Single, climbing north onto a marble block.
    b.put('marble', 10, 19);
    b.block('stairs', 10, 1, 20, { rot: 0 });
    // Three side by side, climbing west.
    b.fill('marble', 12, 22, 12, 24);
    for (let z = 22; z <= 24; z++) b.block('stairs', 13, 1, z, { rot: 3 });
    // Seven cells up a spine one cell wide.
    for (let i = 1; i <= 7; i++) b.stack('marble', 18, 25 - i, { floors: i });
    for (let i = 0; i < 7; i++) b.block('stairs', 18, 1 + i, 25 - i, { rot: 0 });
    // Two cells up beside a tall wall on the west.
    b.fill('marble', 23, 20, 23, 22, { floors: 3 });
    b.stack('marble', 24, 21, { floors: 1 });
    b.stack('marble', 24, 20, { floors: 2 });
    b.block('stairs', 24, 1, 22, { rot: 0 }).block('stairs', 24, 2, 21, { rot: 0 });
    // Two wide up two terraces of ground, climbing north.
    for (const x of [32, 33]) b.block('stairs', x, 1, 20, { rot: 0 }).block('stairs', x, 2, 19, { rot: 0 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 2.7, target: [22, 2, 20] },
    { name: 'west', yaw: 135, pitch: 34, zoom: 2.7, target: [22, 2, 20] },
    { name: 'spine', yaw: 315, pitch: 30, zoom: 4, target: [18, 3, 21] },
  ],
  expect(plan, _dressing, check) {
    check.sameStructure([13, 1, 22], [13, 1, 24]);
    check.sameStructure([18, 1, 25], [18, 7, 19]);
    check.sameStructure([32, 1, 20], [33, 2, 19]);
    check.differentStructures([10, 1, 20], [13, 1, 22]);
    // Landings: the fourth and seventh cells of the long flight, and nowhere else.
    check.hasFeature({ type: 'stair-landing', at: [18, 4, 22] });
    check.hasFeature({ type: 'stair-landing', at: [18, 7, 19] });
    check.equal(check.features({ type: 'stair-landing' }).length, 2, 'landings');
    // Handrails: from the second cell up, on both sides; none on the first cell.
    check.noFeature({ type: 'railing', at: [18, 1, 25] });
    check.hasFeature({ type: 'railing', variant: 'balustrade', at: [18, 2, 24], dir: 1 });
    check.hasFeature({ type: 'railing', variant: 'balustrade', at: [18, 2, 24], dir: 3 });
    check.equal(check.features({ type: 'railing', on: [18, 1, 25] }).filter((f) => plan.kinds.get(f.cell!) === 'stairs').length, 12, 'rails on the long flight');
    // Against a wall: a rail on the open side only.
    check.hasFeature({ type: 'railing', at: [24, 2, 21], dir: 1 });
    check.noFeature({ type: 'railing', at: [24, 2, 21], dir: 3 });
    // No rails on low flights, nor between flights side by side.
    check.noFeature({ type: 'railing', at: [10, 1, 20] });
    check.noFeature({ type: 'railing', at: [13, 1, 23] });
    check.noFeature({ type: 'railing', at: [32, 2, 19], dir: 1 });
  },
});
