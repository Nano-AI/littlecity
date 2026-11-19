// Fixture for U10 (corners). Streets crossing, with houses in their corners:
//   a three-storey house in the corner of a crossing      a round turret on the corner, two storeys tall
//   a two-storey house in the corner of an L-bend         a turret one storey tall
//   a cottage in another corner of the crossing           nothing: one storey has no upper corner
//   a two-storey house beside a street, not on a corner   nothing

import { scenario } from '@/scenario';

export default scenario({
  name: 'U10.corners',
  seed: 1010,
  about: 'A house of two storeys or more on a street corner (a street right outside two sides that meet) gets a round corner turret on its upper storeys; cottages and houses on one street do not.',
  build(b) {
    // A crossing.
    b.path(8, 14, 20, 14);
    b.path(14, 8, 14, 13);
    b.path(14, 15, 14, 20);
    b.house(12, 12, { w: 2, d: 2, floors: 3, color: 1 });
    b.house(15, 15, { color: 6 });
    // An L-bend.
    b.path(26, 10, 34, 10);
    b.path(34, 11, 34, 18);
    b.house(32, 11, { w: 2, d: 2, floors: 2, color: 4 });
    // On one street only.
    b.house(28, 11, { floors: 2, color: 2 });
  },
  cameras: [
    { name: 'crossing', yaw: 315, pitch: 28, zoom: 6, target: [13.5, 1.6, 13.5] },
    { name: 'crossing-se', yaw: 135, pitch: 30, zoom: 5, target: [14, 1.4, 14] },
    { name: 'bend', yaw: 30, pitch: 26, zoom: 6, target: [33, 1.4, 11.5] },
    { name: 'all', yaw: 0, pitch: 40, zoom: 2.4, target: [22, 1, 14] },
  ],
  expect(plan, _dressing, check) {
    const turret = (x: number, z: number): (typeof plan.features)[number] | undefined => {
      const id = check.structure(x, 1, z).id;
      return plan.features.find((f) => f.type === 'corner-oriel' && f.structure === id);
    };
    const tall = turret(12, 12);
    check.ok(!!tall, 'the three-storey corner house has a turret');
    check.equal((tall?.params as { storeys?: number } | undefined)?.storeys, 2, 'it climbs both upper storeys');
    check.equal(tall ? tall.cell! >> 12 : 0, 2, 'it starts on storey 2');
    check.equal((turret(32, 11)?.params as { storeys?: number } | undefined)?.storeys, 1, 'the two-storey house on the bend has a turret one storey tall');
    check.ok(!turret(15, 15), 'a cottage has none');
    check.ok(!turret(28, 11), 'a house on one street has none');
  },
});
