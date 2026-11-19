// Fixture for R-H04 (stilt house): every lowest cell stands over water.
// One on a dock, one on generated stilts a cell above the sea, and one with
// a foot on the shore (a cottage: not every lowest cell is over water).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H04.stilt-house',
  seed: 5104,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 14, 1);
  },
  build(b) {
    // On a dock: two dock cells with a house on them, a third as its landing.
    for (let x = 10; x <= 13; x++) b.block('dock', x, 0, 15);
    b.block('dock', 11, 0, 16).block('dock', 12, 0, 16);
    b.block('house', 11, 1, 16, { color: 4 }).block('house', 12, 1, 16, { color: 4 });
    // On stilts: nothing under it but the sea.
    b.block('house', 18, 1, 17, { color: 2 }).block('house', 18, 2, 17, { color: 2 });
    // Half on the shore.
    b.block('house', 24, 1, 14, { color: 6 }).block('house', 24, 1, 15, { color: 6 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 6, target: [17, 1.5, 15.5] },
    { name: 'sea', yaw: 135, pitch: 30, zoom: 6, target: [17, 1.5, 15.5] },
    { name: 'close', yaw: 60, pitch: 26, zoom: 10, target: [11.5, 1.2, 16.2] },
  ],
  expect(_plan, _dressing, check) {
    check.role(11, 1, 16, 'stilt-house');
    check.hasTag(11, 1, 16, 'plank-walls');
    check.hasTag(11, 1, 16, 'over-water');
    check.role(18, 1, 17, 'stilt-house');
    check.role(24, 1, 14, 'cottage');
    check.equal(check.applied('R-H04.stilt-house'), 2, 'stilt houses');
    // A ladder down to the water on a water side, and somewhere to fish from.
    check.hasFeature({ type: 'ladder', on: [11, 1, 16] });
    check.hasFeature({ type: 'ladder', on: [18, 1, 17] });
    check.hasSocket({ type: 'fishing-spot' }, 2);
    // A stove pipe, not a brick stack.
    check.hasFeature({ type: 'chimney', variant: 'pipe', on: [11, 1, 16] });
    check.noFeature({ type: 'chimney', variant: 'plain', on: [18, 1, 17] });
    // The door of the one on the dock opens onto the dock.
    const door = check.hasFeature({ type: 'door', on: [11, 1, 16] })[0]!;
    check.equal(door.dir, 0, 'the door faces the dock on the north side');
  },
});
