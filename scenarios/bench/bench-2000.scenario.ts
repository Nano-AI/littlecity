// The synthetic reference town for `npm run bench`: about 2,000 blocks on
// flat ground, a deterministic mix of houses, towers, marble, trees, paths
// and fences (design section 14).

import { rand, randInt } from '@/core/rand';
import { scenario } from '@/scenario';

const SEED = 2000;

export default scenario({
  name: 'bench-2000',
  seed: SEED,
  about: 'Synthetic 2,000-block town for the benchmark.',
  build(b) {
    // City blocks of 4 × 4 columns separated by streets, over the whole flat ground.
    for (let gz = 0; gz < 8; gz++) {
      for (let gx = 0; gx < 8; gx++) {
        const x0 = 4 + gx * 5;
        const z0 = 4 + gz * 5;
        b.path(x0, z0 + 4, x0 + 4, z0 + 4);
        b.path(x0 + 4, z0, x0 + 4, z0 + 3);
        const r = rand(SEED, 'lot', gx, gz);
        if (r < 0.1) {
          b.plaza(x0, z0, x0 + 3, z0 + 3);
          b.put('fountain', x0 + 1, z0 + 1);
        } else if (r < 0.2) {
          b.garden(x0, z0, x0 + 3, z0 + 3);
          b.fenceAround(x0, z0, x0 + 3, z0 + 3);
          for (let i = 0; i < 4; i++) b.put('tree', x0 + (i % 2) * 2, z0 + (i >> 1) * 2);
        } else if (r < 0.3) {
          b.fill('marble', x0, z0, x0 + 3, z0 + 3, { floors: 2 });
          b.tower(x0 + 1, z0 + 1, { floors: 4 });
        } else {
          // Four lots of 2 × 2 columns, each a house of 1–4 storeys; some get a tower or Auto stack.
          for (let lot = 0; lot < 4; lot++) {
            const lx = x0 + (lot % 2) * 2;
            const lz = z0 + (lot >> 1) * 2;
            const floors = randInt(1, 4, SEED, 'floors', gx, gz, lot);
            b.house(lx, lz, { floors, w: 2, d: 2, color: randInt(0, 7, SEED, 'color', gx, gz, lot) });
            if (rand(SEED, 'top', gx, gz, lot) < 0.2) b.auto(lx, lz, { floors: 3 });
          }
        }
      }
    }
  },
  cameras: [{ name: 'overview', yaw: 45, pitch: 35, zoom: 1.3, target: [24, 1, 24] }],
  expect(plan, _dressing, check) {
    const n = plan.world.blocks.size;
    check.ok(n >= 1800 && n <= 2400, `about 2,000 blocks, got ${n}`);
  },
});
