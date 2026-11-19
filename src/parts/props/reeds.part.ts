// Reeds (D24): a stand of reeds in sheltered water, at the foot of the bank.
// Tall blades in two greens with a few brown bulrush heads; they sway from
// the waterline up.
//
// Frame: an edge slot of the WATER cell at level 0 (its floor is the sea
// bed's nominal y = 0), +Z out toward open water. The reeds stand in the
// water at SEA_Y and crowd toward the bank behind them.

import { SEA_Y } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { blade, mixColor, rngOf, tube, vary } from './kit';

export default definePart({
  prop: 'reeds',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 2741));
    const y = SEA_Y - 0.02;
    const light = vary(mixColor(PALETTE.leaf, PALETTE.yellow, 0.18), r('c1'));
    const dark = vary(PALETTE.leafDark, r('c2'));
    const n = 5 + Math.floor(r('n') * 2);
    const heads: Vec3[] = [];
    b.setPattern(PATTERN.none).setInk('reeds');
    for (let i = 0; i < n; i++) {
      // Spread along the bank (x), a little out into the water (z).
      const x = (i / (n - 1) - 0.5) * 0.56 + (r('x', i) - 0.5) * 0.07;
      const z = -0.07 + r('z', i) * 0.15;
      const h = 0.34 + r('h', i) * 0.2;
      const lean = (r('l', i) - 0.5) * 0.14;
      const top: Vec3 = [x + lean, y + h, z + (r('lz', i) - 0.5) * 0.06];
      b.setColor(i % 3 === 0 ? dark : light);
      b.setSway((_px, py) => Math.min(1, Math.max(0, (py - y) / 0.45)) * 0.6);
      blade(b, [[x, y, z], [x + lean * 0.4, y + h * 0.55, z], top], [0.04, 0.034, 0.006], [0, 0.2, 1]);
      if (i % 2 === 1 && heads.length < 2) heads.push([x + lean, y + h + 0.02, z + 0.02]);
    }
    // Bulrush heads: brown cigars on their own stems.
    b.setColor(PALETTE.trunk);
    for (const hd of heads) tube(b, [[hd[0], hd[1] - 0.05, hd[2]], [hd[0], hd[1] + 0.05, hd[2]]], 0.026, { seg: 5, capStart: true, capEnd: true });
    b.setSway(0);
    return { mesh: b.build() };
  },
});
