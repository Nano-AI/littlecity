// Hanging lantern (D06, D20, R-A04): a lantern on a short chain under an
// arch, a gateway or a sky bridge. The glass is PATTERN.glow. The part owns
// the socket 'lamp-head'.
//
// The 'bracket' variant (D06) hangs from an iron arm on a wall instead: its
// frame is a socket on a cell face, +Z out of the wall.
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
  build(item, ctx) {
    const b = ctx.mesh();
    const size = PROP.lampLantern * 0.95;
    if (item.variant === 'bracket') {
      // On a wall: an iron arm out from the wall (0.07 behind the socket), the lantern hanging from its end.
      const reach = 0.2, y = 0.22, small = size * 0.85;
      b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'chain' }, () => {
        b.box([-0.012, y, -0.07], [0.012, y + 0.022, reach], { skip: ['n'] });
        b.box([-0.008, y - 0.13, -0.07], [0.008, y, -0.05], { skip: ['n'] });
        b.box([-0.006, y - 0.04, reach - 0.026], [0.006, y, reach - 0.014], { skip: ['top'] });
      });
      let middle = 0;
      const foot = y - 0.04 - small * 1.77;
      b.at(translation(0, foot, reach - 0.02), () => {
        middle = lantern(b, small, 'lantern');
      });
      return { mesh: b.build(), anchors: { 'lamp-head': translation(0, foot + middle, reach - 0.02) } };
    }
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
