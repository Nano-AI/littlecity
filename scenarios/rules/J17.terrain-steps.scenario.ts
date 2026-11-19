// J17 · Terrain steps. A path that climbs three terraces: wherever it passes
// from a path cell to one exactly one terrain level higher, carved stone
// steps join them. A path that meets a two-level cliff gets none, and
// neither does a path that only runs along the foot of a bank.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'J17.terrain-steps',
  seed: 12,
  about: 'A path up three terraces by carved steps, from all four directions; no steps at a two-level cliff or along the foot of a bank.',
  terrain(t) {
    t.flat(1);
    t.rect(14, 10, 26, 20, 2);
    t.rect(17, 12, 23, 18, 3);
    t.rect(19, 14, 21, 16, 4);
    t.rect(30, 12, 34, 16, 3); // a two-level cliff
  },
  build(b) {
    b.path([20, 24], [20, 15]); // up from the south: three flights
    b.path([21, 15], [28, 15]); // down to the east: three flights
    b.path([19, 15], [11, 15]); // down to the west
    b.path([20, 14], [20, 7]); // down to the north
    b.path([29, 15], [29, 19]); // to the foot of the cliff, and along it
    b.path(31, 14, 33, 14); // a path on top of the cliff
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 2.8, target: [21, 2, 15] },
    { name: 'back', yaw: 225, pitch: 35, zoom: 2.8, target: [21, 2, 15] },
    { name: 'close', yaw: 135, pitch: 30, zoom: 5.5, target: [20, 2, 19] },
  ],
  expect(plan, _dressing, check) {
    check.equal(check.applied('J17.terrain-steps'), 12, 'three flights on each of the four ways up');
    // On the lower cell, pointing uphill.
    check.hasFeature({ type: 'terrain-steps', at: [20, 1, 21], dir: 0 });
    check.hasFeature({ type: 'terrain-steps', at: [20, 2, 19], dir: 0 });
    check.hasFeature({ type: 'terrain-steps', at: [20, 3, 17], dir: 0 });
    check.hasFeature({ type: 'terrain-steps', at: [27, 1, 15], dir: 3 });
    check.hasFeature({ type: 'terrain-steps', at: [13, 1, 15], dir: 1 });
    check.hasFeature({ type: 'terrain-steps', at: [20, 1, 9], dir: 2 });
    // None at the cliff: its top is two levels above the path at its foot.
    check.noFeature({ type: 'terrain-steps', at: [29, 1, 15] });
    check.noFeature({ type: 'terrain-steps', at: [29, 1, 16] });
    // The whole climb is one path region, and the steps belong to it.
    const path = check.floorStructure(20, 1, 24).id;
    check.equal(check.floorStructure(20, 4, 15).id, path, 'the top of the climb is the same path as its foot');
    check.ok(check.features({ type: 'terrain-steps' }).every((f) => f.structure === path), 'steps are features of the path they join');
    // They take the lower cell's edge slot on that side.
    check.equal(plan.claims.get(`floor:${key(20, 1, 21)}:n`), 'J17.terrain-steps', 'the slot under the steps');
  },
});
