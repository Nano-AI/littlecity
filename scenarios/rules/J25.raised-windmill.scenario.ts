// Fixture for J25 (raised windmill): a windmill on a tower or a house stack
// gets a timber gallery under its cap. A mill on a three-cell tower, a
// two-cell mill on a two-storey house, and a mill on the ground (no gallery).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J25.raised-windmill',
  seed: 5325,
  rules: houseDressing,
  build(b) {
    b.tower(10, 10, { floors: 3 });
    b.put('windmill', 10, 10);
    b.house(14, 10, { w: 2, d: 2, floors: 2, color: 6 });
    b.stack('windmill', 14, 10, { floors: 2 });
    b.stack('windmill', 19, 10, { floors: 2 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 28, zoom: 5.5, target: [15, 3, 10.5] },
    { name: 'back', yaw: 225, pitch: 28, zoom: 5.5, target: [15, 3, 10.5] },
    { name: 'close', yaw: 40, pitch: 22, zoom: 9, target: [14.5, 4, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    check.hasTag(10, 4, 10, 'raised');
    check.hasFeature({ type: 'gallery', at: [10, 4, 10] });
    check.hasFeature({ type: 'gallery', at: [14, 4, 10] });
    check.noFeature({ type: 'gallery', on: [19, 1, 10] });
    check.equal(check.applied('J25.raised-windmill'), 2, 'galleries');
    // The house under a mill gets a flat roof for it to stand on (J04: a piece stands on the roof).
    check.hasFeature({ type: 'roof', variant: 'flat', on: [14, 1, 10] });
  },
});
