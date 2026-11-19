// The real terrain generator's island for this seed, drawn with the look
// fixtures. Until Logic's generator lands this is the stub disc; afterwards
// it shows how the terrain mesh handles real islands.
//
//   npm run shots -- look-generated

import { scenario } from '@/scenario';
import { LOOK_SEED } from './fixtures';

export default scenario({
  name: 'look-generated',
  seed: LOOK_SEED + 3,
  about: 'The generated island for one seed, with its starting trees.',
  terrain: 'generated',
  startingTrees: true,
  build() {},
  cameras: [
    { name: 'day', yaw: 45, pitch: 35, zoom: 1.25, target: [24, 1, 24] },
    { name: 'dusk', yaw: 135, pitch: 30, zoom: 1.6, target: [24, 1, 24], time: 'dusk' },
    { name: 'night', yaw: 225, pitch: 35, zoom: 1.25, target: [24, 1, 24], time: 'night' },
  ],
});
