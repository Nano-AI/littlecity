// R-F01: one fountain of each sort, each standing where the rule gives it
// that role. West to east: a tiered fountain in a square (3 × 3 of plaza), a
// well in a walled courtyard, a birdbath on a garden, a small basin on open
// grass, and a second basin on a plaza too small to be a square.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';
import { FOUNTAIN } from '@/style/props';

export default scenario({
  name: 'R-F01.fountain',
  seed: 41,
  about: 'Fountain by place: tiered in a square, a well in a courtyard, a birdbath on a garden, otherwise a small basin.',
  build(b) {
    // A square, with the fountain in its middle.
    b.plaza(10, 10, 12, 12);
    b.put('fountain', 11, 11);
    // A courtyard: three by three of ground closed in by a low wall, with a house in one corner.
    b.fenceAround(16, 10, 18, 12, 'wall');
    b.house(16, 10, { floors: 1, color: 2 });
    b.put('fountain', 17, 11);
    // A garden.
    b.garden(22, 10, 24, 12);
    b.put('fountain', 23, 11);
    // Open grass, and a plaza of two by two (not a square).
    b.put('fountain', 28, 11);
    b.plaza(32, 10, 33, 11);
    b.put('fountain', 32, 10);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 35, zoom: 2.9, target: [21.5, 1, 11] },
    { name: 'back', yaw: 225, pitch: 35, zoom: 2.9, target: [21.5, 1, 11] },
    { name: 'west', yaw: 45, pitch: 35, zoom: 8, target: [14, 1, 11] },
    { name: 'east', yaw: 45, pitch: 35, zoom: 8, target: [25.5, 1, 11] },
    { name: 'west-back', yaw: 225, pitch: 30, zoom: 8, target: [14, 1, 11] },
    { name: 'east-side', yaw: 135, pitch: 30, zoom: 8, target: [25.5, 1, 11] },
  ],
  expect(plan, _dressing, check) {
    check.role(11, 1, 11, 'tiered-fountain');
    check.role(17, 1, 11, 'well');
    check.role(23, 1, 11, 'birdbath');
    check.role(28, 1, 11, 'basin');
    check.role(32, 1, 10, 'basin');
    check.equal(check.applied('R-F01.fountain'), 5, 'every fountain has a role');
    // Sockets for the water: the tiered fountain has a pool, a bowl, a jet at its tip and one where each arc leaves the bowl.
    check.equal(check.sockets({ type: 'water-jet', at: [11, 1, 11] }).length, 1 + FOUNTAIN.falls, 'jets on the tiered fountain');
    check.equal(check.sockets({ type: 'water-surface', at: [11, 1, 11] }).length, 2, 'pools on the tiered fountain');
    check.hasSocket({ type: 'water-surface', at: [17, 1, 11] });
    check.hasSocket({ type: 'perch', at: [23, 1, 11] });
    check.equal(check.sockets({ type: 'water-jet', at: [28, 1, 11] }).length, 2, 'spouts on the basin');
    check.ok(plan.sockets.some((s) => s.id === `water-jet@${key(11, 1, 11)}/top`), 'socket ids are type@cell/name');
    // The plaza and the garden are still there under their fountains.
    check.floorStructure(11, 1, 11);
    check.floorStructure(23, 1, 11);
  },
});
