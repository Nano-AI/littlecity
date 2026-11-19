// Balcony (Houses owner; R-H10 townhouses, R-H12 cliff houses). A small slab
// on two brackets with a railing: iron (thin, dark, one ink group so it
// reads as a grille and not as a smudge) or timber.
//
// Frame: the wall plane of an upper storey, floor at y = 0. The 'perch'
// socket is the middle of the top rail.

import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { personaOf } from './lib';

export default definePart({
  feature: 'balcony',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    const timber = item.variant === 'timber';
    const w = 0.62, out = 0.2, floor = 0.06, rail = 0.27;
    const x0 = -w / 2, x1 = w / 2;
    b.with({ color: timber ? PALETTE.wood : p.trim, pattern: timber ? PATTERN.planks : PATTERN.none, ink: 'slab' }, () => {
      b.box([x0, floor - 0.035, 0], [x1, floor, out], { skip: ['n'] });
      // Brackets: two wedges under the slab.
      for (const x of [x0 + 0.08, x1 - 0.08]) {
        b.quad([x - 0.02, floor - 0.035, out - 0.03], [x - 0.02, floor - 0.15, 0], [x + 0.02, floor - 0.15, 0], [x + 0.02, floor - 0.035, out - 0.03]);
        b.tri([x + 0.02, floor - 0.035, 0], [x + 0.02, floor - 0.035, out - 0.03], [x + 0.02, floor - 0.15, 0]);
        b.tri([x - 0.02, floor - 0.035, 0], [x - 0.02, floor - 0.15, 0], [x - 0.02, floor - 0.035, out - 0.03]);
      }
    });
    const t = timber ? 0.03 : 0.018;
    b.with({ color: timber ? PALETTE.wood : PALETTE.metal, pattern: timber ? PATTERN.none : PATTERN.metal, ink: 'rail' }, () => {
      // Top rail round three sides, then the uprights.
      b.box([x0, floor + rail - t, out - t], [x1, floor + rail, out]);
      b.box([x0, floor + rail - t, 0], [x0 + t, floor + rail, out - t], { skip: ['n', 's'] });
      b.box([x1 - t, floor + rail - t, 0], [x1, floor + rail, out - t], { skip: ['n', 's'] });
      const n = timber ? 4 : 6;
      for (let i = 0; i <= n; i++) {
        const x = x0 + t / 2 + ((w - t) * i) / n;
        b.box([x - t / 2, floor, out - t], [x + t / 2, floor + rail - t, out], { skip: ['top', 'bottom'] });
      }
      for (const x of [x0, x1 - t]) b.box([x, floor, out * 0.45 - t / 2], [x + t, floor + rail - t, out * 0.45 + t / 2], { skip: ['top', 'bottom'] });
    });
    return { mesh: b.build(), anchors: { perch: translation(0, floor + rail, out - t / 2) } };
  },
});
