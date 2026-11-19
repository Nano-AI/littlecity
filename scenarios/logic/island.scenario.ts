// A generated island with its starting trees and nothing else: what a new
// game looks like. Follows the real generator, so it moves when that changes.

import { scenario } from '@/scenario';
import { checkTerrain } from '@/terrain/terrain';

export default scenario({
  name: 'logic-island',
  seed: 1,
  terrain: 'generated',
  terrainGen: 1, // pinned: this island must not move when generator 2 is tuned
  startingTrees: true,
  about: 'A new island for seed 1: beach, hill, cliff, cove, terraces and 6–14 starting trees.',
  build() {},
  cameras: [
    { name: 'overview', yaw: 45, pitch: 40, zoom: 1.1, target: [24, 1, 24] },
    { name: 'low', yaw: 160, pitch: 22, zoom: 1.6, target: [24, 2, 24] },
  ],
  expect(plan, _dressing, check) {
    const problems = checkTerrain(plan.terrain.height).problems;
    check.ok(problems.length === 0, `every required feature (${problems.join(', ')})`);
    const trees = plan.world.blocks.size;
    check.ok(trees >= 6 && trees <= 14, `6–14 starting trees, got ${trees}`);
  },
});
