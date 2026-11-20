// R-M01: marble resting on four or more placed pillar shafts, each at least
// 2 tall, is a temple: a frieze, a pediment over each short end with a roof
// between, and steps at the foot of the pillars. Three pillars, or pillars
// one cell tall, do not make one. (Four cells on four pillars standing on the
// ground are a bandstand, R-M11: a small temple is 2 × 3 on its corners.)

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M01.temple',
  seed: 76,
  about: 'A temple of 4 × 2 on eight pillars; a 2 × 3 on four corner pillars; a slab on three pillars and one on four short pillars (terraces).',
  build(b) {
    for (const x of [9, 10, 11, 12]) for (const z of [10, 11]) b.stack('pillar', x, z, { floors: 2 }).block('marble', x, 3, z);
    for (const x of [15, 16]) for (const z of [10, 12]) b.stack('pillar', x, z, { floors: 3 });
    for (const x of [15, 16]) for (const z of [10, 11, 12]) b.block('marble', x, 4, z);
    for (const x of [19, 20, 21]) b.stack('pillar', x, 10, { floors: 2 }).block('marble', x, 3, 10); // three pillars
    for (const x of [24, 25]) for (const z of [10, 11]) b.stack('pillar', x, z, { floors: 1 }).block('marble', x, 2, z); // short pillars
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 3.2, target: [17, 2.5, 10.5] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 3.2, target: [17, 2.5, 10.5] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 3, 10, 'temple');
    const ends = check.hasFeature({ type: 'pediment', on: [10, 3, 10] }, 2);
    check.equal(ends.length, 2, 'one at each short end');
    check.equal((ends[0]!.params as { width: number }).width, 2, 'as wide as the short side');
    check.equal((ends[0]!.params as { depth: number }).depth, 2, 'each half of the roof covers half the length');
    check.equal(ends.map((e) => e.dir).sort().join(), '1,3', 'on the west and east ends');
    check.equal(check.features({ type: 'stylobate', on: [10, 3, 10] }).length, 8, 'steps under every cell');
    check.equal((check.features({ type: 'stylobate', on: [15, 4, 10] })[0]!.params as { depth: number }).depth, 3, 'down to the foot of the taller pillars');
    check.ok(!plan.tags.get(check.structure(10, 3, 10).id)?.has('top:paved'), 'roofed, so not paved');
    check.role(15, 4, 10, 'temple');
    check.role(20, 3, 10, 'terrace');
    check.role(24, 2, 10, 'terrace');
  },
});
