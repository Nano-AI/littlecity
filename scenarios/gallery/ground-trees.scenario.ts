// Gallery: every tree species (R-P01), each standing where the rule gives it
// that species, so the real rule and the real generator are what is shown.
//
//   back row      the seeded mix: round trees, cypresses and bushes
//   the hill      pines (terrain level 4)
//   middle row    planter trees on and beside a plaza, fruit trees on a
//                 garden, a grove of six with undergrowth
//   the shore     palms on the sand, willows where grass meets the water

import { scenario } from '@/scenario';

export default scenario({
  name: 'ground-trees',
  seed: 31,
  about: 'Every tree species side by side: the seeded mix, pines on a hill, planter trees, fruit trees, a grove, palms and willows.',
  terrain(t) {
    t.flat(1);
    t.water(4, 29, 43, 43); // the sea to the south: row 28 is beach
    t.rect(27, 25, 33, 28, 2); // a grass bank that meets the water
    t.rect(34, 12, 39, 18, 2);
    t.rect(35, 13, 38, 17, 3);
    t.rect(35, 13, 38, 16, 4); // the pine hill
  },
  build(b) {
    // The seeded mix.
    for (let i = 0; i < 9; i++) b.put('tree', 15 + i * 2, 15 + (i % 2));
    // Pines.
    b.put('tree', 35, 13).put('tree', 37, 14).put('tree', 36, 16).put('tree', 38, 15);
    // Planter trees.
    b.plaza(15, 20, 17, 22);
    b.put('tree', 15, 20).put('tree', 17, 22).put('tree', 18, 21);
    // Fruit trees on a garden.
    b.garden(20, 20, 23, 22);
    b.put('tree', 20, 20).put('tree', 22, 21).put('tree', 23, 22).put('tree', 21, 22);
    // A grove.
    for (const [x, z] of [[26, 20], [27, 20], [28, 20], [26, 21], [27, 21], [28, 22], [27, 22]] as const) b.put('tree', x, z);
    // Palms on the beach, willows on the bank.
    b.put('tree', 15, 28).put('tree', 17, 28).put('tree', 20, 28).put('tree', 22, 28).put('tree', 24, 28);
    b.put('tree', 28, 28).put('tree', 30, 28).put('tree', 32, 28);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 2.6, target: [25, 1, 21] },
    { name: 'back', yaw: 225, pitch: 35, zoom: 2.6, target: [25, 1, 21] },
    { name: 'mix', yaw: 45, pitch: 35, zoom: 5.5, target: [22, 1, 16] },
    { name: 'shore', yaw: 135, pitch: 32, zoom: 5, target: [24, 1, 27] },
    { name: 'green', yaw: 315, pitch: 38, zoom: 5, target: [22, 1, 21] },
    { name: 'pines', yaw: 45, pitch: 30, zoom: 6, target: [36.5, 4, 15] },
  ],
  expect(plan, _dressing, check) {
    check.role(35, 4, 13, 'pine');
    check.role(15, 1, 20, 'planter-tree');
    check.role(18, 1, 21, 'planter-tree');
    check.role(22, 1, 21, 'fruit-tree');
    check.role(27, 1, 21, 'grove-tree');
    check.role(17, 1, 28, 'palm');
    check.role(30, 2, 28, 'willow');
    const mix = new Set<string>();
    for (let i = 0; i < 9; i++) mix.add(plan.roles.get(check.structure(15 + i * 2, 1, 15 + (i % 2)).id)!.role);
    check.ok([...mix].every((r) => r === 'round-tree' || r === 'cypress' || r === 'bush'), 'open ground grows the seeded mix');
    check.ok(mix.size >= 2, 'the mix is mixed');
  },
});
