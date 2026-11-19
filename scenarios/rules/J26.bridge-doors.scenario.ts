// Fixture for J26 (bridge doors): where a walkable arch deck meets a house
// wall, the house gets a door at deck level. Two three-storey houses joined
// by a bridge whose deck is the floor of their third storey, and a house a
// bridge runs alongside (one door, not one per arch cell).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J26.bridge-doors',
  seed: 5326,
  rules: houseDressing,
  build(b) {
    b.house(10, 10, { floors: 3, color: 2 });
    b.house(14, 10, { floors: 3, color: 4 });
    for (let x = 11; x <= 13; x++) b.block('arch', x, 2, 10);

    b.house(20, 10, { w: 3, floors: 2, color: 6 });
    b.put('marble', 19, 11).put('marble', 23, 11);
    for (let x = 20; x <= 22; x++) b.block('arch', x, 1, 11);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 5.5, target: [16, 2.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 5.5, target: [16, 2.5, 10.5] },
    { name: 'close', yaw: 60, pitch: 26, zoom: 10, target: [12, 3, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    check.kind(12, 2, 10, 'arch');
    // The deck is the top of the arch cells at level 2, so the doors are at level 3.
    check.hasFeature({ type: 'door', variant: 'deck', at: [10, 3, 10], dir: 1, rule: 'J26.bridge-doors' });
    check.hasFeature({ type: 'door', variant: 'deck', at: [14, 3, 10], dir: 3, rule: 'J26.bridge-doors' });
    check.noFeature({ type: 'window', at: [10, 3, 10], dir: 1 });
    check.hasSocket({ type: 'door', rule: 'J26.bridge-doors' }, 3);
    // Alongside: three arch cells along the south wall, one door.
    check.kind(21, 1, 11, 'arch');
    check.equal(check.features({ type: 'door', rule: 'J26.bridge-doors', on: [20, 1, 10] }).length, 1, 'doors onto the bridge alongside');
    check.equal(check.applied('J26.bridge-doors'), 3, 'bridge doors');
  },
});
