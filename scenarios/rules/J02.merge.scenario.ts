// Fixture for J02 (merge): cells of one structure share no interior walls;
// eaves and wall surfaces run continuously. J02 has no rule file: it is how
// the house generator draws (src/gen/house/house.test.ts checks that there
// are no doubled faces and one ink group across a merged wall). Here: the
// same footprints built block by block in different orders give one
// building each: a long house, an L, a 3 × 3 block, a two-storey slab.
import { scenario } from '@/scenario';

export default scenario({
  name: 'J02.merge',
  seed: 5302,
  build(b) {
    b.house(10, 10, { w: 5, color: 4 });
    b.house(17, 9, { w: 3, color: 2 });
    b.house(17, 10, { d: 2, color: 2 });
    b.house(22, 9, { w: 3, d: 3, color: 0 });
    for (let x = 30; x >= 27; x--) b.house(x, 10, { floors: 2, color: 3 }); // built east to west, one column at a time
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 5, target: [20, 1.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 5, target: [20, 1.5, 10.5] },
    { name: 'close', yaw: 45, pitch: 30, zoom: 10, target: [12.5, 1.5, 10.5] },
  ],
  expect(plan, _dressing, check) {
    check.sameStructure([10, 1, 10], [14, 1, 10]);
    check.sameStructure([17, 1, 9], [17, 1, 11]);
    check.sameStructure([22, 1, 9], [24, 1, 11]);
    check.sameStructure([27, 1, 10], [30, 2, 10]);
    check.equal([...plan.structures.values()].filter((s) => s.kind === 'house').length, 4, 'houses');
    // One building: one main door, one roof per region, and windows only on outside walls.
    check.equal(check.features({ type: 'door', on: [10, 1, 10] }).length, 1, 'doors on the long house');
    check.equal(check.features({ type: 'roof', on: [10, 1, 10] }).length, 1, 'roofs on the long house');
    check.equal(check.features({ type: 'roof', on: [22, 1, 9] }).length, 1, 'roofs on the 3 × 3 block');
    check.hasFeature({ type: 'roof', variant: 'hip', on: [22, 1, 9] });
    // The middle cell of the 3 × 3 block has no outside wall, so nothing is attached to it.
    check.noFeature({ type: 'window', at: [23, 1, 10] });
  },
});
