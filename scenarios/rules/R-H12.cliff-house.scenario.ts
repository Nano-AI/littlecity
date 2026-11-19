// Fixture for R-H12 (cliff house): a side of the house abuts terrain rising
// 2+ levels above its floor. Two houses at the foot of a two-level cliff
// (one of two storeys, one of three) and one at the foot of a one-level bank
// (a cottage).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H12.cliff-house',
  seed: 5112,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 24, 1);
    t.rect(4, 4, 22, 11, 3);
    t.rect(23, 4, 43, 11, 2);
  },
  build(b) {
    b.house(10, 12, { floors: 2, color: 6 });
    b.house(14, 12, { w: 2, floors: 3, color: 2 });
    b.house(27, 12, { floors: 2, color: 4 });
    b.path(8, 14, 30, 14);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 5.5, target: [18, 2.5, 12] },
    { name: 'se', yaw: 135, pitch: 30, zoom: 5.5, target: [18, 2.5, 12] },
    { name: 'close', yaw: 50, pitch: 26, zoom: 9, target: [14.5, 2.5, 12.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 12, 'cliff-house');
    check.hasTag(10, 1, 12, 'stone-ground');
    check.role(14, 1, 12, 'cliff-house');
    check.role(27, 1, 12, 'cottage');
    check.equal(check.applied('R-H12.cliff-house'), 2, 'cliff houses');
    // No windows on the cliff side where the cliff covers the wall (storeys 1 and 2).
    check.noFeature({ type: 'window', at: [10, 1, 12], dir: 0 });
    check.noFeature({ type: 'window', at: [10, 2, 12], dir: 0 });
    // One timber balcony on the top storey, on the side away from the cliff.
    const balcony = check.hasFeature({ type: 'balcony', variant: 'timber', on: [14, 1, 12] });
    check.equal(balcony.length, 1, 'balconies on the three-storey cliff house');
    check.equal(balcony[0]!.dir, 2, 'it faces away from the cliff');
    check.equal(balcony[0]!.cell! >> 12, 3, 'on the top storey');
    // Against the cliff: no base trim on that side (J24).
    check.hasFeature({ type: 'foundation', variant: 'cliff', on: [10, 1, 12], dir: 0 });
  },
});
