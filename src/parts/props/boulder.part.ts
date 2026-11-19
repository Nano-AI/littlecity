// Boulder (D24): rocks fallen to the foot of a cliff. One big stone, usually
// with one or two smaller beside it and a wisp of grass against it.
// `boulder.size` (0–1) scales the pile.
//
// Frame: an edge slot of the ground cell at the cliff's foot (the side the
// cliff is on), world-square; the pile sits round the slot.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { rngOf } from './kit';
import { grassClump, longGrass, rock } from './wild';

export default definePart({
  prop: 'boulder',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 104729));
    const size = 0.5 + Math.min(1, Math.max(0, item.params?.size ?? 0.5)) * 0.7;
    // One ink group: the pile is one object with creases between its stones.
    b.setInk('rocks');
    const big = 0.13 * size;
    rock(b, (r('x') - 0.5) * 0.1, 0, (r('z0') - 0.5) * 0.06, big, r, 'big');
    const extra = r('n') < 0.75 ? (r('n2') < 0.4 ? 2 : 1) : 0;
    for (let i = 0; i < extra; i++) {
      const side = i === 0 ? (r('side') < 0.5 ? -1 : 1) : 0;
      const x = side * (big * 1.25 + 0.03) + (i === 1 ? (r('x2') - 0.5) * 0.12 : 0);
      rock(b, x, 0, i === 1 ? big * 1.1 : -0.02 + r('z', i) * 0.06, big * (0.42 + r('s', i) * 0.2), r, i);
    }
    if (r('grass') < 0.6) {
      b.with({ color: longGrass(r('green')), pattern: PATTERN.none, ink: 'grass' }, () => grassClump(b, (r('gx') - 0.5) * 0.3, 0, big * 0.9, 0.09, r, 'g', 3));
    }
    return { mesh: b.build() };
  },
});
