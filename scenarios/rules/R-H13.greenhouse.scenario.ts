// Fixture for R-H13 (greenhouse): one storey, a footprint of at most two
// cells, garden floor right outside on three or more sides. A one-cell and a
// two-cell greenhouse in their gardens; a house with garden on two sides
// only (a cottage); a two-storey house in a garden (a cottage).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H13.greenhouse',
  seed: 5113,
  rules: houseDressing,
  build(b) {
    b.garden(9, 9, 11, 11);
    b.house(10, 10, { color: 3 });
    b.garden(14, 9, 17, 11);
    b.house(15, 10, { w: 2, color: 5 });
    b.garden(21, 10, 22, 11);
    b.house(21, 10, { color: 2 });
    b.garden(25, 9, 27, 11);
    b.house(26, 10, { floors: 2, color: 6 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 6, target: [18, 1.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 6, target: [18, 1.5, 10.5] },
    { name: 'close', yaw: 40, pitch: 28, zoom: 12, target: [15.8, 1.4, 10.6] },
    { name: 'night', yaw: 45, pitch: 32, zoom: 6, target: [18, 1.5, 10.5], time: 'night' },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 10, 'greenhouse');
    check.hasTag(10, 1, 10, 'glass-walls');
    check.role(15, 1, 10, 'greenhouse');
    check.role(21, 1, 10, 'cottage');
    check.role(26, 1, 10, 'cottage');
    check.equal(check.applied('R-H13.greenhouse'), 2, 'greenhouses');
    // All glass: no separate windows, no chimney; still a door and a roof.
    check.noFeature({ type: 'window', on: [10, 1, 10] });
    check.noFeature({ type: 'chimney', on: [15, 1, 10] });
    check.hasFeature({ type: 'door', on: [10, 1, 10] });
    check.hasFeature({ type: 'roof', variant: 'gable', on: [15, 1, 10] });
  },
});
