// R-P01 · Tree species. One small shore with a hill, and a tree in each
// situation the rule tells apart: sand by the water (palm), grass by the
// water (willow), high ground (pine), on and beside a plaza (planter tree),
// on a garden (fruit tree), five together (grove), and open ground (the
// seeded mix of round tree, cypress and bush).

import { scenario } from '@/scenario';

const MIX: readonly (readonly [number, number])[] = [[14, 12], [16, 13], [18, 12], [20, 13], [22, 12], [24, 13]];
const GROVE: readonly (readonly [number, number])[] = [[27, 16], [28, 16], [29, 16], [28, 17], [29, 17], [28, 18]];

export default scenario({
  name: 'R-P01.tree-species',
  seed: 5,
  about: 'Each tree species where R-P01 gives it: palm, willow, pine, planter tree, fruit tree, grove tree, and the seeded mix.',
  terrain(t) {
    t.flat(1);
    t.water(4, 24, 43, 43);
    t.rect(22, 21, 27, 23, 2); // grass that meets the water
    t.rect(30, 8, 34, 12, 2);
    t.rect(31, 9, 33, 11, 4); // high ground
  },
  build(b) {
    for (const [x, z] of MIX) b.put('tree', x, z);
    b.put('tree', 31, 9).put('tree', 33, 10).put('tree', 32, 11);
    b.plaza(14, 16, 15, 17).put('tree', 14, 16).put('tree', 16, 17);
    b.garden(19, 16, 20, 17).put('tree', 19, 16).put('tree', 20, 17);
    for (const [x, z] of GROVE) b.put('tree', x, z);
    b.put('tree', 14, 23).put('tree', 17, 23).put('tree', 20, 23);
    b.put('tree', 23, 23).put('tree', 26, 23);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 3.1, target: [23.5, 1, 16.5] },
    { name: 'back', yaw: 225, pitch: 35, zoom: 3.1, target: [23.5, 1, 16.5] },
    { name: 'side', yaw: 135, pitch: 30, zoom: 3.6, target: [21, 1, 18] },
  ],
  expect(plan, _dressing, check) {
    check.equal(check.applied('R-P01.tree-species'), plan.world.blocks.size, 'every tree gets a species');
    check.role(14, 1, 23, 'palm');
    check.role(20, 1, 23, 'palm');
    check.role(23, 2, 23, 'willow');
    check.role(31, 4, 9, 'pine');
    check.role(14, 1, 16, 'planter-tree'); // on the plaza
    check.role(16, 1, 17, 'planter-tree'); // beside it
    check.role(19, 1, 16, 'fruit-tree');
    for (const [x, z] of GROVE) check.role(x, 1, z, 'grove-tree');
    const mix = MIX.map(([x, z]) => plan.roles.get(check.structure(x, 1, z).id)!.role);
    check.ok(mix.every((r) => r === 'round-tree' || r === 'cypress' || r === 'bush'), `open ground grows the mix, got ${mix.join(', ')}`);
    check.ok(new Set(mix).size >= 2, 'the mix is mixed');
  },
});
