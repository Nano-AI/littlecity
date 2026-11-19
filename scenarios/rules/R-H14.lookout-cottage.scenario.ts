// Fixture for R-H14 (lookout cottage): a house on the island's highest
// terrain level with no other structure within 3 cells gets a weathervane.
// One alone on the summit; a pair on a second summit of the same height
// (each has the other within 3: cottages); one lower down (a cottage).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H14.lookout-cottage',
  seed: 5114,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 24, 1);
    t.disc(12, 12, 5, 2);
    t.disc(12, 12, 3, 3);
    t.disc(12, 12, 1.5, 4);
    t.disc(28, 12, 5, 2);
    t.disc(28, 12, 3.5, 3);
    t.disc(28, 12, 2.5, 4);
  },
  build(b) {
    b.house(12, 12, { color: 2 });
    b.house(27, 12, { color: 4 });
    b.house(29, 12, { color: 6 });
    b.house(20, 18, { color: 0 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 4.2, target: [20, 3, 13] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 4.2, target: [20, 3, 13] },
    { name: 'close', yaw: 40, pitch: 24, zoom: 10, target: [12.5, 4.8, 12.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(12, 4, 12, 'lookout-cottage');
    check.hasTag(12, 4, 12, 'weathervane');
    check.role(27, 4, 12, 'cottage');
    check.role(29, 4, 12, 'cottage');
    check.role(20, 1, 18, 'cottage');
    check.equal(check.applied('R-H14.lookout-cottage'), 1, 'lookout cottages');
    check.hasFeature({ type: 'finial', variant: 'vane', on: [12, 4, 12] });
    check.noFeature({ type: 'finial', on: [27, 4, 12] });
  },
});
