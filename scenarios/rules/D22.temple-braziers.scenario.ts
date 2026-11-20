// Fixture for D22 (temple braziers):
//   a temple of 4 × 2 pillars, its ends east and west    two braziers at the foot of its east end
//   a temple of 2 × 3 on corner pillars, ends N and S    two at the foot of its south end
//   three pillars under marble (not a temple)            none

import { scenario } from '@/scenario';

export default scenario({
  name: 'D22.temple-braziers',
  seed: 2222,
  about: 'Two braziers stand at the foot of the front of every temple (its south or east end); marble on pillars that is not a temple gets none.',
  build(b) {
    for (const x of [9, 10, 11, 12]) for (const z of [10, 11]) b.stack('pillar', x, z, { floors: 2 }).block('marble', x, 3, z);
    for (const x of [18, 19]) for (const z of [10, 12]) b.stack('pillar', x, z, { floors: 3 });
    for (const x of [18, 19]) for (const z of [10, 11, 12]) b.block('marble', x, 4, z);
    for (const x of [26, 27, 28]) b.stack('pillar', x, 10, { floors: 2 }).block('marble', x, 3, 10);
  },
  cameras: [
    { name: 'temple', yaw: 60, pitch: 24, zoom: 5, target: [11, 1.5, 11] },
    { name: 'small', yaw: 20, pitch: 24, zoom: 6, target: [18.5, 1.5, 11.5] },
    { name: 'night', yaw: 60, pitch: 24, zoom: 5, target: [11, 1.5, 11], time: 'night' },
  ],
  expect(_plan, dressing, check) {
    const braziers = dressing.props.filter((p) => p.type === 'brazier');
    const at = (p: (typeof braziers)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    check.equal(braziers.filter((p) => at(p)[0] === 13).length, 2, 'two at the east end of the long temple');
    check.equal(braziers.filter((p) => at(p)[1] === 13 && at(p)[0] >= 18 && at(p)[0] <= 19).length, 2, 'two at the south end of the small one');
    check.equal(braziers.filter((p) => at(p)[0] >= 25).length, 0, 'none for three pillars');
  },
});
