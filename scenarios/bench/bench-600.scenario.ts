// A synthetic 600-block town for the phone benchmark (tools/phone-bench.mjs):
// bench-2000's mix of houses, towers, marble, gardens and squares, on a
// quarter of the ground.

import { rand, randInt } from '@/core/rand';
import { scenario } from '@/scenario';

const SEED = 600;

export default scenario({
  name: 'bench-600',
  seed: SEED,
  about: 'Synthetic 600-block town for the phone benchmark.',
  build(b) {
    for (let gz = 0; gz < 5; gz++) {
      for (let gx = 0; gx < 5; gx++) {
        const x0 = 12 + gx * 5;
        const z0 = 12 + gz * 5;
        b.path(x0, z0 + 4, x0 + 4, z0 + 4);
        b.path(x0 + 4, z0, x0 + 4, z0 + 3);
        const r = rand(SEED, 'lot', gx, gz);
        if (r < 0.12) {
          b.plaza(x0, z0, x0 + 3, z0 + 3);
          b.put('fountain', x0 + 1, z0 + 1);
        } else if (r < 0.24) {
          b.garden(x0, z0, x0 + 3, z0 + 3);
          b.fenceAround(x0, z0, x0 + 3, z0 + 3);
          for (let i = 0; i < 4; i++) b.put('tree', x0 + (i % 2) * 2, z0 + (i >> 1) * 2);
        } else if (r < 0.32) {
          b.fill('marble', x0, z0, x0 + 3, z0 + 3, { floors: 2 });
          b.tower(x0 + 1, z0 + 1, { floors: 4 });
        } else {
          for (let lot = 0; lot < 4; lot++) {
            const lx = x0 + (lot % 2) * 2;
            const lz = z0 + (lot >> 1) * 2;
            const floors = randInt(1, 4, SEED, 'floors', gx, gz, lot);
            b.house(lx, lz, { floors, w: 2, d: 2, color: randInt(0, 7, SEED, 'color', gx, gz, lot) });
          }
        }
      }
    }
  },
  cameras: [{ name: 'overview', yaw: 45, pitch: 35, zoom: 1.6, target: [24, 1, 24] }],
  expect(plan, _dressing, check) {
    const n = plan.world.blocks.size;
    check.ok(n >= 450 && n <= 750, `about 600 blocks, got ${n}`);
  },
});
