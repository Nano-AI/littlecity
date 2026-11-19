// Flower box (Houses owner; dressed onto windows by D09). A wooden trough on
// the sill with a row of flower heads over a little green.
//
// Frame: the 'window' socket: the front of the sill, +Z out.

import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { bead } from './lib';

const FLOWERS = [PALETTE.red, PALETTE.pink, PALETTE.yellow, PALETTE.white, PALETTE.magic] as const;

export default definePart({
  prop: 'flower-box',
  build(item, ctx) {
    const b = ctx.mesh();
    const first = item.params?.flowers ?? Math.floor(ctx.rand('flowers') * FLOWERS.length);
    const w = 0.3;
    b.with({ color: PALETTE.wood, ink: 'box' }, () => b.box([-w / 2, -0.065, -0.005], [w / 2, -0.005, 0.07], { skip: ['n'] }));
    // The green is one mass and the flowers another: two outlines, not nine.
    b.with({ color: PALETTE.leafDark, ink: 'green', sway: 0.15 }, () => b.box([-w / 2 + 0.015, -0.005, 0.005], [w / 2 - 0.015, 0.022, 0.06], { skip: ['bottom'] }));
    b.with({ ink: 'flowers', sway: 0.2 }, () => {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.045 + (i * (w - 0.09)) / (n - 1) + (ctx.rand('x', i) - 0.5) * 0.015;
        const big = 0.03 + ctx.rand('r', i) * 0.008;
        b.with({ color: FLOWERS[(first + (i % 2) * 2) % FLOWERS.length]! }, () => bead(b, x, 0.035 + ctx.rand('y', i) * 0.012, 0.035, big));
      }
    });
    return { mesh: b.build() };
  },
});
