// PROOF OF LOOK, at island scale: a sketched island (beach, terraces, a hill
// with a cliff, a cove) with a small town on it, seen from all four orbit
// quarters by day, and at dusk, night and dawn.
//
//   npm run shots -- look-island

import { rand } from '@/core/rand';
import { scenario, TerrainBuilder } from '@/scenario';
import { LOOK_SEED } from './fixtures';
import { sketchIsland } from './fixtures/islands';

const SEED = LOOK_SEED + 2;
/** Where the sketch put the hill and the cove, for the cameras. */
const sketch = sketchIsland(new TerrainBuilder(SEED), SEED);

export default scenario({
  name: 'look-island',
  seed: SEED,
  about: 'Proof of look at island scale: terrain, sea and a small town, four sides and four times of day.',
  terrain(t) {
    sketchIsland(t, SEED);
  },
  build(b) {
    const [cx, cz] = sketch.centre;
    const flat = (x: number, z: number): boolean => b.ground(x, z) >= 1 && b.onTerrain(x, z) === b.ground(x, z);
    const level = (x: number, z: number, w: number, d: number): boolean => {
      const g = b.ground(x, z);
      for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) if (b.ground(x + dx, z + dz) !== g || !flat(x + dx, z + dz)) return false;
      return g >= 1;
    };
    // A little town round the middle: houses on whatever flat lots it finds, a marble landmark, trees.
    let houses = 0;
    for (let i = 0; i < 200 && houses < 16; i++) {
      const x = cx - 8 + Math.floor(rand(SEED, 'hx', i) * 16), z = cz - 8 + Math.floor(rand(SEED, 'hz', i) * 16);
      if (!level(x - 1, z - 1, 3, 3)) continue;
      b.house(x, z, { floors: 1 + Math.floor(rand(SEED, 'hf', i) * 3), color: Math.floor(rand(SEED, 'hc', i) * 8) });
      houses++;
    }
    for (let i = 0; i < 40; i++) {
      const x = cx - 3 + Math.floor(rand(SEED, 'mx', i) * 6), z = cz - 3 + Math.floor(rand(SEED, 'mz', i) * 6);
      if (!level(x, z, 2, 2)) continue;
      b.fill('marble', x, z, x + 1, z + 1, { floors: 2 });
      b.stack('pillar', x, z, { floors: 2 });
      b.put('tree', x + 1, z + 1);
      break;
    }
    let trees = 0;
    for (let i = 0; i < 400 && trees < 46; i++) {
      const x = 7 + Math.floor(rand(SEED, 'tx', i) * 34), z = 7 + Math.floor(rand(SEED, 'tz', i) * 34);
      if (!flat(x, z)) continue;
      b.put('tree', x, z);
      trees++;
    }
  },
  cameras: [
    { name: 'sw', yaw: 45, pitch: 35, zoom: 1.3, target: [24, 1, 24] },
    { name: 'se', yaw: 135, pitch: 35, zoom: 1.3, target: [24, 1, 24] },
    { name: 'ne', yaw: 225, pitch: 35, zoom: 1.3, target: [24, 1, 24] },
    { name: 'nw', yaw: 315, pitch: 35, zoom: 1.3, target: [24, 1, 24] },
    { name: 'town', yaw: 45, pitch: 32, zoom: 3.2, target: [24, 1.5, 24] },
    { name: 'hill', yaw: 20, pitch: 26, zoom: 3.4, target: [sketch.hill[0], 2.5, sketch.hill[1]] },
    { name: 'cove', yaw: 70, pitch: 30, zoom: 3.6, target: [sketch.cove[0], 1, sketch.cove[1]] },
    { name: 'steep', yaw: 45, pitch: 70, zoom: 2, target: [24, 1, 24] },
    { name: 'dusk', yaw: 45, pitch: 35, zoom: 1.3, target: [24, 1, 24], time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 35, zoom: 1.3, target: [24, 1, 24], time: 'night' },
    { name: 'night-town', yaw: 45, pitch: 32, zoom: 3.2, target: [24, 1.5, 24], time: 'night' },
    { name: 'dawn', yaw: 135, pitch: 35, zoom: 1.3, target: [24, 1, 24], time: 'dawn' },
  ],
  expect(plan, _dressing, check) {
    let top = 0;
    for (const v of plan.terrain.height) top = Math.max(top, v);
    check.ok(top >= 4, `a hill of height 4 or more (got ${top})`);
    check.ok(plan.world.blocks.size > 40, 'a town was built');
  },
});
