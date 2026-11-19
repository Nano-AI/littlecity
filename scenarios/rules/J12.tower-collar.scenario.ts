// Fixture for J12 (tower through roof): a tower rising out of a house roof
// gets a collar where they meet, and the roof wraps round it. West to east:
// a tower through the middle of a 3 × 3 hip roof; through one end of a gable
// roof; through the corner of an L; and a tower on a one-cell house (no roof
// left round it, so no collar).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J12.tower-collar',
  seed: 5312,
  rules: houseDressing,
  build(b) {
    b.house(9, 9, { w: 3, d: 3, color: 6 });
    b.tower(10, 10, { floors: 3 });
    b.house(14, 10, { w: 3, color: 2 });
    b.tower(16, 10, { floors: 4 });
    b.house(19, 9, { w: 3, color: 4 });
    b.house(19, 10, { d: 2, color: 4 });
    b.tower(19, 9, { floors: 3 });
    b.house(24, 10, { color: 0 });
    b.tower(24, 10, { floors: 3 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 5.5, target: [17, 2.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 5.5, target: [17, 2.5, 10.5] },
    { name: 'close', yaw: 45, pitch: 40, zoom: 11, target: [10.5, 2.4, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    // The collar belongs to the house, at the tower's lowest cell.
    check.hasFeature({ type: 'collar', at: [10, 2, 10], on: [9, 1, 9] });
    check.hasFeature({ type: 'collar', at: [16, 2, 10], on: [14, 1, 10] });
    check.hasFeature({ type: 'collar', at: [19, 2, 9], on: [19, 1, 10] });
    check.noFeature({ type: 'collar', on: [24, 1, 10] });
    check.equal(check.applied('J12.tower-collar'), 3, 'collars');
    // The roof still exists round the tower.
    check.hasFeature({ type: 'roof', variant: 'hip', on: [9, 1, 9] });
    check.hasFeature({ type: 'roof', variant: 'gable', on: [14, 1, 10] });
    // And nothing is planted on the pierced cell.
    check.noFeature({ type: 'chimney', at: [10, 1, 10] });
  },
});
