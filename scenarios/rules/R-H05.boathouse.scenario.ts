// Fixture for R-H05 (boathouse): ground storey at level 1 or below looking
// straight onto water, or touching a dock. West to east: a house on the
// shore (boathouse, doors to the sea); a house beside a dock (boathouse,
// doors to the dock); a house one cell back from the shore (cottage); a
// house on a terrace above the shore (level 2: cottage).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H05.boathouse',
  seed: 5105,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 14, 1);
    t.rect(26, 4, 43, 14, 2);
  },
  build(b) {
    b.house(10, 14, { w: 2, color: 4 });
    b.block('dock', 16, 0, 15).block('dock', 16, 0, 16);
    b.house(15, 14, { color: 2 });
    b.block('dock', 14, 0, 15);
    b.house(20, 13, { color: 6 });
    b.house(28, 14, { color: 0 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 5.5, target: [18, 1.5, 14] },
    { name: 'sea', yaw: 135, pitch: 30, zoom: 5.5, target: [18, 1.5, 14] },
    { name: 'close', yaw: 130, pitch: 26, zoom: 10, target: [11, 1.3, 14.5] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 1, 14, 'boathouse');
    check.hasTag(10, 1, 14, 'plank-walls');
    check.role(15, 1, 14, 'boathouse');
    check.role(20, 1, 13, 'cottage');
    check.ok(plan.roles.get(check.structure(28, 2, 14).id)?.role !== 'boathouse', 'the house on the terrace is above the water, not on it');
    check.equal(check.applied('R-H05.boathouse'), 2, 'boathouses');
    // Wide double doors on the water side.
    const door = check.hasFeature({ type: 'door', variant: 'double', on: [10, 1, 14] })[0]!;
    check.equal(door.dir, 2, 'the boat doors face the sea to the south');
    check.hasFeature({ type: 'door', variant: 'double', on: [15, 1, 14], dir: 2 });
  },
});
