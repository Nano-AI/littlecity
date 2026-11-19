// Hanging lantern (D06, D20, R-A04): a lantern on a short chain under an
// arch, a gateway or a sky bridge. The glass is PATTERN.glow. The part owns
// the socket 'lamp-head'.
//
// Frame: the 'arch-crown' socket (the underside of the arch at the middle of
// its opening); the lantern hangs down from the origin.

import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PROP } from '@/style/dressing';
import { PALETTE } from '@/style/palette';
import { lantern } from './kit';

export default definePart({
  prop: 'hanging-lantern',
  build(_item, ctx) {
    const b = ctx.mesh();
    const size = PROP.lampLantern * 0.95;
    const chain = 0.07 + ctx.rand('chain') * 0.03;
    const height = size * 1.77;
    // The chain and its ceiling rose: one dark piece of iron.
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'chain' }, () => {
      b.box([-0.03, -0.012, -0.03], [0.03, 0, 0.03], { skip: ['top'] });
      b.box([-0.008, -chain, -0.008], [0.008, -0.012, 0.008], { skip: ['top', 'bottom'] });
    });
    let mid = 0;
    b.at(translation(0, -chain - height, 0), () => {
      mid = lantern(b, size, 'lantern');
    });
    return { mesh: b.build(), anchors: { 'lamp-head': translation(0, -chain - height + mid, 0) } };
  },
});
