// Fixture for R-H03 (mill house): a house touching a windmill. One beside a
// mill, one a cell away (a cottage), and a house with a mill on its roof
// (that mill is raised; the house under it is not a mill house).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H03.mill-house',
  seed: 5103,
  rules: houseDressing,
  build(b) {
    b.stack('windmill', 12, 12, { floors: 2 });
    b.house(13, 12, { w: 2, color: 6 });
    b.house(17, 12, { color: 2 });
    b.house(21, 12, { w: 2, color: 3 });
    b.put('windmill', 21, 12);
    b.garden(9, 13, 14, 15);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 6, target: [16, 2, 12.5] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 6, target: [16, 2, 12.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(13, 1, 12, 'mill-house');
    check.role(17, 1, 12, 'cottage');
    check.role(21, 1, 12, 'cottage');
    check.equal(check.applied('R-H03.mill-house'), 1, 'mill houses');
    // No window looks into the mill's wall.
    check.noFeature({ type: 'window', at: [13, 1, 12], dir: 3 });
  },
});
