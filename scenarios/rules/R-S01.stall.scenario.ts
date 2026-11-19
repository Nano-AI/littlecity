// R-S01: each sort of stall, standing where the rule gives it that role.
//
//   by the water   a pier, and a stall two steps from it: a fish stall. A
//                  second stall four steps away is out of reach: a market stall.
//   the garden     a stall on a garden floor: a flower stall.
//   the street     market stalls along a path (their counters face it), and
//                  one across the street facing back.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-S01.stall',
  seed: 43,
  about: 'Stall by place: fish within 3 of a dock, flowers on a garden, otherwise a market stall with seeded goods; counters face the street.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43); // the sea to the south
  },
  build(b) {
    // A pier, and two stalls north of it.
    for (let z = 30; z <= 32; z++) b.block('dock', 12, 0, z);
    b.put('stall', 12, 28);
    b.put('stall', 12, 26);
    // A garden with a stall on it.
    b.garden(17, 24, 19, 25);
    b.put('stall', 18, 24);
    // A street with stalls along its north side and one on its south side.
    b.path(22, 25, 32, 25);
    for (const x of [23, 25, 27, 29, 31]) b.put('stall', x, 24);
    b.put('stall', 26, 26);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 3.2, target: [21, 1, 26] },
    { name: 'back', yaw: 225, pitch: 35, zoom: 3.2, target: [21, 1, 26] },
    { name: 'street', yaw: 45, pitch: 35, zoom: 6.5, target: [27, 1, 25] },
    { name: 'shore', yaw: 45, pitch: 35, zoom: 6.5, target: [15, 1, 26.5] },
  ],
  expect(plan, _dressing, check) {
    check.role(12, 1, 28, 'fish-stall');
    check.role(12, 1, 26, 'market-stall');
    check.role(18, 1, 24, 'flower-stall');
    for (const x of [23, 25, 27, 29, 31]) {
      check.role(x, 1, 24, 'market-stall');
      check.hasTag(x, 1, 24, 'front:s');
    }
    check.role(26, 1, 26, 'market-stall');
    check.hasTag(26, 1, 26, 'front:n');
    check.equal(check.applied('R-S01.stall'), 9, 'every stall has a role');
    // Market stalls carry exactly one goods tag; the others none.
    const goods = (x: number, z: number): string[] => [...(plan.tags.get(check.structure(x, 1, z).id) ?? [])].filter((t) => t.startsWith('goods:'));
    for (const x of [23, 25, 27, 29, 31]) check.equal(goods(x, 24).length, 1, `goods on the stall at ${x}`);
    check.equal(goods(12, 28).length, 0, 'a fish stall has no goods tag');
    check.equal(goods(18, 24).length, 0, 'a flower stall has no goods tag');
  },
});
