// LOOK FIXTURE. One scenario per sketched island, so `npm run shots --
// 'look-isle-*'` renders six different coasts, hills and coves.

import { rand } from '@/core/rand';
import { scenario, type Scenario } from '@/scenario';
import { LOOK_SEED } from './index';
import { sketchIsland } from './islands';

export function isleScenario(n: number): Scenario {
  const seed = LOOK_SEED + 16 + n;
  return scenario({
    name: `look-isle-${n}`,
    seed,
    about: `Terrain look, sketched island ${n}: beach, terraces, a hill with a cliff, a cove.`,
    terrain(t) {
      sketchIsland(t, seed);
    },
    build(b) {
      // A handful of trees, as a new island has, and nothing else.
      let planted = 0;
      for (let i = 0; i < 60 && planted < 10; i++) {
        const x = 8 + Math.floor(rand(seed, 'tx', i) * 32), z = 8 + Math.floor(rand(seed, 'tz', i) * 32);
        if (b.ground(x, z) < 1 || b.onTerrain(x, z) !== b.ground(x, z)) continue;
        b.put('tree', x, z);
        planted++;
      }
    },
    cameras: [
      { name: 'day', yaw: 45, pitch: 35, zoom: 1.25, target: [24, 1, 24] },
      { name: 'back', yaw: 225, pitch: 30, zoom: 1.25, target: [24, 1, 24] },
    ],
    expect(plan, _dressing, check) {
      const h = plan.terrain.height;
      let top = 0, land = 0;
      for (const v of h) {
        top = Math.max(top, v);
        if (v > 0) land++;
      }
      check.ok(top >= 4, `a hill of height 4 or more (got ${top})`);
      check.ok(land > 300, `a real island (${land} land columns)`);
    },
  });
}
