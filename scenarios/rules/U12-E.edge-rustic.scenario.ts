// Fixture for U12-E (centre and edge, the edge half). A short street in one
// corner of the island and a hamlet far out from it:
//   a cottage beside the street                          a town house: not rustic
//   cottages and a two-storey house far from any floor   rustic: thatch, timber, rough stone or boards
//   a three-storey house out there too                   not rustic: too tall for a farmhouse
//   a cottage nine steps from the street                 not rustic: still within reach of the town

import { scenario } from '@/scenario';

export default scenario({
  name: 'U12-E.edge-rustic',
  seed: 1213,
  about: 'Plain houses of one or two storeys more than ten column steps from every floor are rustic (thatch, timber framing, rough stone, boards); houses near a floor, and tall ones, are not.',
  build(b) {
    b.path(5, 6, 12, 6);
    b.house(8, 7, { color: 2 });
    b.house(12, 14, { color: 5 });
    // The hamlet.
    b.house(26, 26, { color: 0 });
    b.house(29, 25, { w: 2, color: 3 });
    b.house(32, 27, { floors: 2, color: 6 });
    b.house(27, 30, { w: 2, d: 2, color: 4 });
    b.house(31, 31, { color: 7 });
    b.house(35, 30, { floors: 3, color: 1 });
  },
  cameras: [
    { name: 'hamlet', yaw: 45, pitch: 32, zoom: 4.5, target: [30, 1.2, 28] },
    { name: 'hamlet-back', yaw: 225, pitch: 32, zoom: 4.5, target: [30, 1.2, 28] },
    { name: 'close', yaw: 20, pitch: 24, zoom: 8, target: [28.5, 1.2, 26] },
    { name: 'town', yaw: 45, pitch: 32, zoom: 5, target: [9, 1, 9] },
  ],
  expect(plan, _dressing, check) {
    const rustic = (x: number, z: number): boolean => plan.tags.get(check.structure(x, 1, z).id)?.has('rustic') ?? false;
    check.ok(!rustic(8, 7), 'a cottage on the street is not rustic');
    check.ok(!rustic(12, 14), 'a cottage within ten steps of the street is not rustic');
    for (const [x, z] of [[26, 26], [29, 25], [32, 27], [27, 30], [31, 31]] as const) check.ok(rustic(x, z), `the farmhouse at ${x}, ${z} is rustic`);
    check.ok(!rustic(35, 30), 'a three-storey house is not');
    check.equal(check.applied('U12-E.edge-rustic'), 5, 'five rustic houses');
  },
});
