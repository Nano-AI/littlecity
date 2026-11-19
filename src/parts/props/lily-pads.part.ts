// Lily pads (D24): a few round leaves floating on sheltered water, each
// with its notch, and now and then a flower. One ink group: the pads are
// outlined against the water but not against each other where they overlap.
//
// Frame: a floor slot of the WATER cell at level 0; the pads float at SEA_Y.

import { SEA_Y } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { dab, mixColor, rngOf, vary, TONE } from './kit';

export default definePart({
  prop: 'lily-pads',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 6151));
    const y = SEA_Y + 0.006;
    const n = 2 + Math.floor(r('n') * 3);
    const up = [TONE.up, TONE.up, TONE.up] as const;
    b.setPattern(PATTERN.none).setInk('pads');
    let flowered = false;
    for (let i = 0; i < n; i++) {
      const a = (i / n + r('a', i) * 0.3) * Math.PI * 2, d = i === 0 ? 0 : 0.14 + r('d', i) * 0.14;
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
      const rad = 0.08 + r('r', i) * 0.045;
      const notch = r('notch', i) * Math.PI * 2;
      const seg = 8;
      b.setColor(vary(mixColor(PALETTE.leafDark, PALETTE.leaf, r('mix', i) * 0.6), r('c', i)));
      // A disc with one wedge left out, a hair higher for each pad so overlaps do not fight.
      const yy = y + i * 0.002;
      for (let j = 1; j < seg; j++) {
        const t0 = notch + (j / seg) * Math.PI * 2, t1 = notch + ((j + 1) / seg) * Math.PI * 2;
        const p0: Vec3 = [cx + Math.cos(t0) * rad, yy, cz + Math.sin(t0) * rad], p1: Vec3 = [cx + Math.cos(t1) * rad, yy, cz + Math.sin(t1) * rad];
        b.tri([cx, yy, cz], p1, p0, { normals: up });
      }
      if (!flowered && r('flower', i) < 0.3) {
        flowered = true;
        b.with({ color: r('fc') < 0.5 ? PALETTE.pink : PALETTE.white }, () => dab(b, cx, yy + 0.002, cz, rad * 0.55, TONE.up, 6, rad * 0.5));
        b.with({ color: PALETTE.yellow }, () => dab(b, cx, yy + rad * 0.3, cz, rad * 0.2, TONE.up, 4, rad * 0.25));
      }
    }
    return { mesh: b.build() };
  },
});
