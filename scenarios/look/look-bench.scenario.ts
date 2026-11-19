// The 2,000-block benchmark town drawn with the look fixtures instead of
// placeholder boxes: detailed houses, marble, trees. This is the renderer's
// stress test until the real generators exist.
//
//   npm run bench -- look-bench
//   npm run shots -- look-bench

import { scenario } from '@/scenario';
import bench from '../bench/bench-2000.scenario';
import { LOOK_SEED } from './fixtures';

export default scenario({
  name: 'look-bench',
  seed: LOOK_SEED + 4,
  about: 'The benchmark town with fixture geometry: about 2,000 blocks of real detail.',
  build: bench.build,
  cameras: [
    { name: 'overview', yaw: 45, pitch: 35, zoom: 1.3, target: [24, 1, 24] },
    { name: 'street', yaw: 45, pitch: 30, zoom: 5, target: [24, 2, 24] },
    { name: 'night', yaw: 135, pitch: 32, zoom: 2.4, target: [24, 2, 24], time: 'night' },
  ],
  expect(plan, _dressing, check) {
    check.ok(plan.world.blocks.size >= 1800, 'about 2,000 blocks');
  },
});
