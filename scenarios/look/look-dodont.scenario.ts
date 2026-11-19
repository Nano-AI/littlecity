// The art guide's "do and don't" pictures (scenarios/look/fixtures/dodont.gen.ts):
// six pairs, the right way in the front row, the wrong way behind it.
// From the left: ink groups, fine detail, palette, hand, real edges, light.
//
//   npm run shots -- look-dodont

import { scenario } from '@/scenario';
import './fixtures';
import { DODONT_SEED } from './fixtures/dodont.gen';

export default scenario({
  name: 'look-dodont',
  seed: DODONT_SEED,
  about: 'Do and don\'t pairs for the art guide.',
  build() {},
  cameras: [
    { name: 'day', yaw: 22, pitch: 36, zoom: 4.2, target: [22.9, 1.4, 23.6] },
    { name: 'night', yaw: 22, pitch: 36, zoom: 4.2, target: [22.9, 1.4, 23.6], time: 'night' },
  ],
});
