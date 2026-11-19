// Every pencil pattern on a sample block (scenarios/look/fixtures/swatches.gen.ts),
// in PATTERN order: front row none … marble, middle row sand … leaves, back
// row bark … planksAcross. The art guide's pattern table is cut from these.
//
//   npm run shots -- look-swatches

import { scenario } from '@/scenario';
import './fixtures';
import { SWATCH_SEED } from './fixtures/swatches.gen';

export default scenario({
  name: 'look-swatches',
  seed: SWATCH_SEED,
  about: 'One sample block per pencil pattern, for the art guide.',
  build() {},
  cameras: [
    { name: 'all', yaw: 30, pitch: 36, zoom: 2.9, target: [24, 1.5, 22.6] },
    { name: 'row1', yaw: 30, pitch: 36, zoom: 4.6, target: [24, 1.5, 24.6] },
    { name: 'row2', yaw: 30, pitch: 36, zoom: 4.6, target: [24, 1.5, 22.1] },
    { name: 'row3', yaw: 30, pitch: 36, zoom: 4.6, target: [24, 1.5, 19.6] },
    { name: 'night', yaw: 30, pitch: 36, zoom: 2.9, target: [24, 1.5, 22.6], time: 'night' },
  ],
});
