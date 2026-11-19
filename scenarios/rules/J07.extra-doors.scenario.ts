// Fixture for J07 (extra doors): any storey whose floor meets a walkable
// surface outside gets a door there. West to east: a two-storey house beside
// a marble block (a door onto the block's top); a house with its own roof
// terrace reached by stairs (a door from the taller part onto the terrace);
// a house against a terrace of higher ground (a door at the upper storey);
// a house at a stair head.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J07.extra-doors',
  seed: 5307,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 20, 1);
    t.rect(23, 4, 27, 9, 2); // higher ground behind the third house
  },
  build(b) {
    b.put('marble', 10, 10);
    b.house(11, 10, { floors: 2, color: 2 });

    b.house(15, 10, { w: 2, d: 2, color: 4 });
    b.house(17, 10, { d: 2, floors: 2, color: 4 });
    b.put('stairs', 15, 12, { rot: 0 });
    b.floor('plaza', 15, 10, 16, 11);

    b.house(24, 10, { w: 2, floors: 2, color: 6 });

    b.house(31, 10, { floors: 2, color: 0 });
    b.put('stairs', 30, 10, { rot: 1 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 5, target: [20, 1.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 5, target: [20, 1.5, 10.5] },
    { name: 'nw', yaw: 315, pitch: 40, zoom: 6.5, target: [16, 2, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    // Onto the marble block's top: storey 2, west side.
    check.hasFeature({ type: 'door', variant: 'deck', at: [11, 2, 10], dir: 3 });
    // Onto its own terrace: the taller part's west wall, at the terrace's level.
    const terrace = check.hasFeature({ type: 'door', variant: 'deck', on: [17, 2, 10], dir: 3 });
    check.equal(terrace.length, 1, 'one door onto the terrace, not one per cell');
    check.hasFeature({ type: 'roof', variant: 'flat', on: [15, 1, 10] });
    // Onto the higher ground behind: storey 2, north side, one door for the two cells.
    check.equal(check.hasFeature({ type: 'door', variant: 'deck', on: [24, 2, 10], dir: 0 }).length, 1, 'doors onto the higher ground');
    // At the stair head: storey 2, west side.
    check.hasFeature({ type: 'door', variant: 'deck', at: [31, 2, 10], dir: 3 });
    // No window where a door went, and every extra door has a threshold socket.
    check.noFeature({ type: 'window', at: [11, 2, 10], dir: 3 });
    check.equal(check.applied('J07.extra-doors'), 4, 'extra doors');
    check.hasSocket({ type: 'door', rule: 'J07.extra-doors' }, 4);
  },
});
