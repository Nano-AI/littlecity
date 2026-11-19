// J28: the short plank ramp where a dock steps onto a beach. A handful of
// sun-bleached boards laid from the deck out over the sand, each its own
// length and a little askew, thinning toward the far end.
//
// Frame: the bottom centre of the dock cell's face on the land side, +Z
// toward the land. The deck and the beach are both at y = CELL_H.

import { CELL_H } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { dockColors } from '@/gen/dock/wood';
import { PATTERN } from '@/gen/mesh';
import { vary } from './kit';

const BOARDS = 5;
const WIDTH = 0.86;

export default definePart({
  feature: 'ramp',
  build(item, ctx) {
    const b = ctx.mesh();
    const wood = dockColors(ctx.structure?.color ?? 0);
    const y = CELL_H;
    const w = WIDTH / BOARDS;
    b.setPattern(PATTERN.none).setInk('ramp');
    for (let i = 0; i < BOARDS; i++) {
      const x0 = -WIDTH / 2 + i * w + 0.012, x1 = -WIDTH / 2 + (i + 1) * w - 0.012;
      const z0 = -0.08 - ctx.rand('near', i) * 0.03;
      const z1 = 0.36 + ctx.rand('far', i) * 0.2;
      // Each board lies a touch askew and stands a little proud of the deck at the near end.
      const skew = (ctx.rand('skew', i) - 0.5) * 0.03;
      const h0 = 0.034, h1 = 0.02;
      const a: Vec3 = [x0, y + h0, z0], bb: Vec3 = [x1, y + h0, z0], c: Vec3 = [x1 + skew, y + h1, z1], d: Vec3 = [x0 + skew, y + h1, z1];
      const a0: Vec3 = [x0, y, z0], b0: Vec3 = [x1, y, z0], c0: Vec3 = [x1 + skew, y, z1], d0: Vec3 = [x0 + skew, y, z1];
      b.setColor(vary(wood.pale, ctx.rand('tone', i), 0.9));
      b.quad(d, c, bb, a); // top
      b.quad(d0, c0, c, d); // far end
      b.quad(b0, a0, a, bb); // near end, on the deck
      b.quad(a0, d0, d, a); // −x side
      b.quad(c0, b0, bb, c); // +x side
    }
    return { mesh: b.build() };
  },
});
