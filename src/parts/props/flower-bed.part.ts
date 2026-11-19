// Flower bed (U01, U03): turned earth with flowers in it.
//
//   border   a long narrow bed beside a walk or along a fence: a row of
//            posies with something taller at one end
//   round    a round bed: a ring of posies round a small shrub
//
// One colour of flower per bed (`flower-bed.flowers`, an index into the
// flower colours), with the odd neighbour of another.
//
// Frame: a floor slot, SQUARE TO THE WORLD (anchor `face` south), because
// the plants are drawn in flat tones. A border bed runs along world x
// (`flower-bed.along` 0) or z (1) through the origin.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { bush, flowerColors, posy, rngOf, roundedRect, vary } from './kit';

export default definePart({
  prop: 'flower-bed',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 4409));
    const colors = flowerColors();
    const main = colors[(((item.params?.flowers ?? 0) % colors.length) + colors.length) % colors.length]!;
    const other = colors[Math.floor(r('other') * colors.length)]!;
    const earth = vary(PALETTE.dirtDark, r('earth'));
    const top = 0.028;
    if (item.variant === 'round') {
      const rad = 0.2 + r('rad') * 0.03;
      const ring: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ring.push([Math.cos(a) * rad * (0.94 + r('w', i) * 0.12), Math.sin(a) * rad * (0.94 + r('w', i) * 0.12)]);
      }
      b.with({ color: earth, pattern: PATTERN.dirt, ink: 'earth' }, () => b.extrude(ring, 0, top, { cap: 'top', smooth: true }));
      b.setInk('plants');
      bush(b, 0, top, 0, 0.085, r, 'mid', PALETTE.bush, 0.2);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n + r('a', i) * 0.08) * Math.PI * 2;
        posy(b, Math.cos(a) * rad * 0.62, top, Math.sin(a) * rad * 0.62, 0.05 + r('s', i) * 0.012, r('o', i) < 0.2 ? other : main, r, i, 'plants', 3);
      }
    } else {
      const alongZ = item.params?.along === 1;
      const len = 0.33, wid = 0.1;
      const outline = roundedRect(-len, -wid, len, wid, 0.07).map(([x, z]): [number, number] => (alongZ ? [z, x] : [x, z]));
      b.with({ color: earth, pattern: PATTERN.dirt, ink: 'earth' }, () => b.extrude(outline, 0, top, { cap: 'top', smooth: true }));
      b.setInk('plants');
      const n = 4;
      const tallEnd = r('tall') < 0.5 ? 0 : n - 1;
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - 0.5) * (len * 2 - 0.14) + (r('t', i) - 0.5) * 0.03;
        const w = (r('w', i) - 0.5) * 0.04;
        const [x, z] = alongZ ? [w, t] : [t, w];
        if (i === tallEnd) bush(b, x, top, z, 0.075, r, i, PALETTE.bush, 0.2);
        else posy(b, x, top, z, 0.056 + r('s', i) * 0.014, r('o', i) < 0.2 ? other : main, r, i, 'plants', 3);
      }
    }
    return { mesh: b.build() };
  },
});
