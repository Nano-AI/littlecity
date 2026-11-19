// Garden fence (U03): the low white picket fence of a front garden, one
// piece per side of the garden cell, standing on the cell line. It is drawn
// with the Ground owner's fence kit, a little lower than a placed fence, so
// derived fences and placed ones are one family.
//
//   picket   a plain run
//   gate     a run with a gateway in the middle: two taller posts and a
//            leaf standing ajar into the garden
//
// `from` / `to` say how the −X and +X ends finish: 0 no post (the piece
// round the corner draws it), 1 a post, 2 the run goes on into the house
// wall behind it.
//
// Frame: an edge slot of the garden cell on the side the fence stands, +Z
// into the garden (anchor `face`), +X along the fence. The cell line is at
// z = −(0.5 − SLOT_INSET).

import { frame, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { drawPost, drawSpan } from '@/parts/ground/edge-draw';
import { PROP } from '@/style/dressing';
import { FENCE } from '@/style/edges';
import { rngOf } from './kit';

const STYLE = 'picket-fence' as const;

export default definePart({
  prop: 'garden-fence',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 3571));
    const scale = PROP.fenceHeight / FENCE.height;
    const from = item.params?.from ?? 1, to = item.params?.to ?? 1;
    const x0 = -0.5 - (from === 2 ? 0.1 : 0), x1 = 0.5 + (to === 2 ? 0.1 : 0);
    const line = -(0.5 - SLOT_INSET);
    b.setInk('fence');
    // One span: local x runs from 0 at `a` to its length at `c`; posts are given in cell coordinates.
    const span = (a: number, c: number, posts: number[], clear: number[], k: string): void => {
      b.at(translation(a, 0, line), () =>
        drawSpan(b, STYLE, { length: c - a, scale, posts: posts.map((p) => p - a), clear: clear.map((p) => p - a), phase: a + 0.5, r: (...p) => r(k, ...p) }),
      );
    };
    const ends: number[] = [];
    if (from === 1) ends.push(x0);
    if (to === 1) ends.push(x1);
    if (item.variant === 'gate') {
      const half = PROP.gateHalf;
      // Two runs either side of the gateway, and the gate posts between them.
      span(x0, -half, ends.filter((e) => e < 0), [-half], 'l');
      span(half, x1, ends.filter((e) => e > 0), [half], 'r');
      for (const side of [-1, 1]) {
        b.at(translation(side * half, 0, line), () => drawPost(b, STYLE, 0, 0, { r: (...p) => r('gp', side, ...p), scale, tall: 0.07 }));
      }
      // The leaf hangs on one post and stands open into the garden (+Z).
      const left = r('hinge') < 0.5;
      const open = 0.45 + r('open') * 0.5;
      const dx = (left ? 1 : -1) * Math.cos(open), dz = Math.sin(open);
      const hx = (left ? -1 : 1) * (half - FENCE.post / 2 - 0.005);
      const leaf = 2 * half - FENCE.post - 0.04;
      b.at(frame([hx, 0.025, line], [dx, 0, dz], [0, 1, 0], [-dz, 0, dx]), () =>
        drawSpan(b, STYLE, { length: leaf, scale: scale * 0.92, phase: 0.03, r: (...p) => r('leaf', ...p) }),
      );
    } else {
      span(x0, x1, ends, [], 's');
    }
    return { mesh: b.build() };
  },
});
