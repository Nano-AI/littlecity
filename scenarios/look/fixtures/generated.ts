// LOOK FIXTURE. One scenario per seed of the REAL island generator
// (src/terrain), each with its starting trees and nothing else, seen from
// the four orbit quarters and at dusk and night. This is where the terrain
// mesh is judged against real islands.
//
//   npm run shots -- 'look-generated*'

import { scenario, type Scenario } from '@/scenario';
import { LOOK_SEED } from './index';

export function generatedScenario(n: number): Scenario {
  return scenario({
    name: n === 1 ? 'look-generated' : `look-generated-${n}`,
    seed: LOOK_SEED + 2 + n,
    about: `The generated island for look seed ${n}, with its starting trees, from four sides.`,
    terrain: 'generated',
    terrainGen: 1, // pinned: this island must not move when generator 2 is tuned
    startingTrees: true,
    build() {},
    cameras: [
      { name: 'sw', yaw: 45, pitch: 35, zoom: 1.25, target: [24, 1, 24] },
      { name: 'se', yaw: 135, pitch: 35, zoom: 1.25, target: [24, 1, 24] },
      { name: 'ne', yaw: 225, pitch: 35, zoom: 1.25, target: [24, 1, 24] },
      { name: 'nw', yaw: 315, pitch: 35, zoom: 1.25, target: [24, 1, 24] },
      { name: 'close', yaw: 60, pitch: 28, zoom: 3.2, target: [24, 2, 24] },
      { name: 'dusk', yaw: 45, pitch: 35, zoom: 1.25, target: [24, 1, 24], time: 'dusk' },
      { name: 'night', yaw: 225, pitch: 35, zoom: 1.25, target: [24, 1, 24], time: 'night' },
    ],
  });
}
