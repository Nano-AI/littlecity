// Tuft (D24 wild ground): long grass where nobody mows.
//
//   grass     two to four clumps of long grass
//   flowers   the same with wildflowers standing in it: one colour per
//             patch, the odd stray of another
//
// `tuft.density` (0–1) sets how many clumps. Everything is one ink group and
// flat-toned, so a tuft is a soft shape on the lawn, not a scribble.
//
// Frame: a floor slot; the clumps scatter a little round the origin.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { flowerColors, rngOf } from './kit';
import { grassClump, longGrass, wildflower } from './wild';

export default definePart({
  prop: 'tuft',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 7919));
    const density = Math.min(1, Math.max(0, item.params?.density ?? 0.5));
    const clumps = 1 + Math.round(density * 2);
    const green = longGrass(r('green'));
    b.setColor(green).setPattern(PATTERN.none).setInk('tuft');
    const spots: [number, number][] = [];
    for (let i = 0; i < clumps; i++) {
      const a = r('a', i) * Math.PI * 2, d = i === 0 ? 0 : 0.1 + r('d', i) * 0.1;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      spots.push([x, z]);
      grassClump(b, x, 0, z, 0.13 + r('h', i) * 0.06, r, i, 3);
    }
    if (item.variant === 'flowers') {
      const colors = flowerColors();
      const main = colors[Math.floor(r('main') * colors.length)]!;
      const n = 3 + Math.round(density * 2);
      for (let i = 0; i < n; i++) {
        const [sx, sz] = spots[i % spots.length]!;
        const a = (i / n + r('fa', i) * 0.2) * Math.PI * 2, d = 0.05 + r('fd', i) * 0.07;
        const color = r('stray', i) < 0.18 ? colors[Math.floor(r('other', i) * colors.length)]! : main;
        wildflower(b, sx + Math.cos(a) * d, 0, sz + Math.sin(a) * d, 0.1 + r('fh', i) * 0.06, color, green);
      }
    }
    return { mesh: b.build() };
  },
});
