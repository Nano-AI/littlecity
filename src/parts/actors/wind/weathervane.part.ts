// A weathervane (L03): an iron rod with a ball, and an arrow that swings to
// the wind: a small head and a broad tail, so the tail is blown downwind
// and the head points into the weather. The 'cock' variant carries a
// cockerel's outline over the arrow. One ink group: it is a small thing and
// reads as a silhouette.
//
// Frame: the tip it stands on (a 'tower-top' socket), +Y up. The arrow lies
// along Z with its head at +Z; the behaviour turns the whole vane about Y.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { ball, twoSided } from '../kit';

export default definePart({
  actor: 'weathervane',
  build(item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.metal).setPattern(PATTERN.metal).setInk('vane');
    const h = 0.2;
    b.boxAt([0, -0.04, 0], [0.018, h + 0.04, 0.018], { skip: ['bottom'] });
    ball(b, 0, h + 0.012, 0, 0.022, 0.022, 0.022, 6, 3);
    const y = h - 0.045;
    // Shaft, head and tail, as flat plates seen from both sides.
    twoSided(b, [[0, y - 0.008, -0.16], [0, y - 0.008, 0.12], [0, y + 0.008, 0.12], [0, y + 0.008, -0.16]]);
    twoSided(b, [[0, y - 0.04, 0.1], [0, y, 0.19], [0, y + 0.04, 0.1]]);
    twoSided(b, [[0, y, -0.1], [0, y - 0.055, -0.2], [0, y - 0.02, -0.17], [0, y, -0.19], [0, y + 0.02, -0.17], [0, y + 0.055, -0.2]]);
    if (item.variant === 'cock') {
      b.setColor(PALETTE.yellow).setPattern(PATTERN.none);
      const t = y + 0.008;
      // Tail feathers, back, head and comb, breast: a cockerel in nine points.
      twoSided(b, [[0, t, -0.055], [0, t, 0.045], [0, t + 0.05, 0.075], [0, t + 0.1, 0.06], [0, t + 0.115, 0.03], [0, t + 0.07, 0.02], [0, t + 0.05, -0.02], [0, t + 0.1, -0.085], [0, t + 0.04, -0.08]]);
    }
    return { mesh: b.build(), animated: true };
  },
});
