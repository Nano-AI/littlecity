// Fixture for R-H15 (cottage): the default role. Twelve small houses on a
// green, every wall colour, one and two storeys: each a cottage with a gable
// roof, about seven in ten with a chimney, each with its own personality.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

const SPOTS: readonly (readonly [number, number, number, number])[] = [
  [10, 10, 1, 1], [12, 10, 1, 2], [14, 10, 2, 1], [17, 10, 1, 1], [19, 10, 1, 2], [21, 10, 2, 1],
  [10, 13, 1, 2], [12, 13, 2, 1], [15, 13, 1, 1], [17, 13, 1, 2], [19, 13, 1, 1], [21, 13, 2, 2],
];

export default scenario({
  name: 'R-H15.cottage',
  seed: 5115,
  rules: houseDressing,
  build(b) {
    SPOTS.forEach(([x, z, w, floors], i) => b.house(x, z, { w, floors, color: i % 8 }));
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 5.5, target: [16.5, 1.5, 12] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 5.5, target: [16.5, 1.5, 12] },
    { name: 'se', yaw: 135, pitch: 32, zoom: 5.5, target: [16.5, 1.5, 12] },
    { name: 'close', yaw: 40, pitch: 28, zoom: 11, target: [11.5, 1.5, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    let chimneys = 0;
    for (const [x, z] of SPOTS) {
      check.role(x, 1, z, 'cottage');
      check.hasFeature({ type: 'roof', variant: 'gable', on: [x, 1, z] });
      check.hasFeature({ type: 'door', on: [x, 1, z] });
      chimneys += check.features({ type: 'chimney', on: [x, 1, z] }).length;
    }
    check.equal(check.applied('R-H15.cottage'), SPOTS.length, 'cottages');
    check.ok(chimneys >= 5 && chimneys < SPOTS.length, `about seven in ten cottages have a chimney (${chimneys} of ${SPOTS.length})`);
  },
});
