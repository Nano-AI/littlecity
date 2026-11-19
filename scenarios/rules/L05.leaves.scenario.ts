// L05 and L35: an orchard garden among houses with flower boxes. Leaves
// and petals drop from the trees now and then; butterflies wander over the
// garden and bees work the flowers, by day.
//
//   node src/life/testing/sequence.mjs L05.leaves --warm 20000 --frames 12 --every 250 --name fall --zoom 7 --target 21,1,20

import { scenario } from '@/scenario';

export default scenario({
  name: 'L05.leaves',
  seed: 505,
  about: 'Leaves and petals falling (L05); butterflies over a garden and bees by flower boxes (L35).',
  build(b) {
    b.garden(18, 18, 23, 21);
    b.put('tree', 19, 19).put('tree', 21, 20).put('tree', 22, 18);
    b.put('tree', 16, 22).put('tree', 26, 17);
    for (let i = 0; i < 3; i++) b.house(18 + i * 2, 24, { floors: 2, color: i + 1 });
    b.path(16, 23, 26, 23);
  },
  cameras: [
    { name: 'garden', yaw: 45, pitch: 30, zoom: 5.5, target: [21, 1, 21] },
    { name: 'close', yaw: 45, pitch: 28, zoom: 9, target: [20.5, 1.2, 20] },
  ],
  expect(plan, dressing, check) {
    const trees = [...plan.structures.values()].filter((s) => s.kind === 'tree' && plan.roles.get(s.id)?.role !== 'bush').length;
    check.equal(check.actors({ type: 'leaf', rule: 'L05.leaves' }).length, trees, 'a leaf for every crowned tree');
    check.ok(check.actors({ type: 'insect', rule: 'L35.insects' }).filter((a) => a.variant === 'butterfly').length >= 1, 'butterflies over the garden');
    void dressing;
  },
});
