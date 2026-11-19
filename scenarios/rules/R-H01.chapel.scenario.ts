// Fixture for R-H01 (chapel): a house of 2+ cells touching a tower 3+ tall.
// West to east: a chapel with its steeple beside it; a one-cell house by a
// tower (too small: a cottage); a house by a two-cell tower (too short); a
// chapel with the tower rising through its roof.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H01.chapel',
  seed: 5101,
  rules: houseDressing,
  build(b) {
    b.path(8, 12, 32, 12);
    b.house(10, 10, { w: 3, color: 5 });
    b.tower(13, 10, { floors: 4 });
    b.house(18, 10, { color: 2 });
    b.tower(19, 10, { floors: 4 });
    b.house(22, 10, { w: 2, color: 3 });
    b.tower(24, 10, { floors: 2 });
    b.house(27, 9, { w: 3, d: 2, color: 6 });
    b.tower(28, 9, { floors: 3 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 5, target: [20, 2, 10.5] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 5, target: [20, 2, 10.5] },
    { name: 'close', yaw: 30, pitch: 28, zoom: 9, target: [11.5, 1.8, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 10, 'chapel');
    check.role(13, 1, 10, 'steeple');
    check.hasTag(10, 1, 10, 'has-steeple');
    check.role(18, 1, 10, 'cottage');
    check.role(22, 1, 10, 'cottage');
    check.role(27, 1, 9, 'chapel');
    check.role(28, 2, 9, 'steeple');
    check.equal(check.applied('R-H01.chapel'), 2, 'chapels');
    // What the role selects: a double door, pointed windows, a rose in the far gable, a finial, no chimney.
    check.hasFeature({ type: 'door', variant: 'double', on: [10, 1, 10] });
    check.hasFeature({ type: 'window', variant: 'pointed', on: [10, 1, 10] }, 4);
    const rose = check.hasFeature({ type: 'window', variant: 'rose', on: [10, 1, 10] })[0]!;
    check.equal(rose.dir, 3, 'the rose looks west, away from the steeple');
    const finial = check.hasFeature({ type: 'finial', on: [10, 1, 10] })[0]!;
    check.equal(finial.dir, 3, 'the finial stands on the west gable');
    check.noFeature({ type: 'chimney', on: [10, 1, 10] });
    check.noFeature({ type: 'window', variant: 'pointed', on: [18, 1, 10] });
    // The tower through the roof gets its collar (J12).
    check.hasFeature({ type: 'collar', on: [27, 1, 9] });
  },
});
