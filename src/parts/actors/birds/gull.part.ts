// A gull (L11): white, with a grey back, dark wing tips folded over the
// tail, and a yellow beak. The whole body is one ink group, so it is one
// clean white shape with one outline; the grey and the beak read by colour.
// Its wings are separate ('bird-wing/gull'): hidden when it sits, the grey
// back is what shows then.
//
// Frame: facing +Z, feet at the origin (see kit.ts).

import { compose, rotationX, scaling, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';
import { birdColors, bodyScale } from './kit';

/** How far the gull carries its head above level, radians. */
const TILT = 0.26;

export default definePart({
  actor: 'gull',
  build(_item, ctx) {
    const b = ctx.mesh();
    const c = birdColors();
    b.setInk('body');
    b.at(scaling(bodyScale('gull')), () => {
      // Tail to crown in one smooth turned shape, head carried a little high: no line between body and head.
      b.setColor(PALETTE.white);
      b.at(compose(translation(0, 0.06, -0.005), rotationX(Math.PI / 2 - TILT)), () =>
        b.lathe([[0, -0.118], [0.03, -0.1], [0.049, -0.055], [0.054, -0.005], [0.047, 0.04], [0.034, 0.07], [0.037, 0.094], [0.035, 0.114], [0.02, 0.13], [0, 0.136]], { segments: 10 }));
      // The grey back, a touch proud of the body so it shows from above and from the side.
      b.setColor(c.gullGrey);
      ball(b, 0, 0.074, -0.04, 0.047, 0.036, 0.075, 8, 5);
      // Folded wing tips over the tail.
      b.setColor(c.gullTip);
      ball(b, 0, 0.052, -0.125, 0.024, 0.016, 0.05, 6, 4);
      // The beak: a cone pointing forward and a little down.
      b.setColor(PALETTE.yellow);
      b.at(compose(translation(0, 0.06 + 0.118 * Math.sin(TILT), -0.005 + 0.118 * Math.cos(TILT)), rotationX(Math.PI / 2 + 0.2)), () => b.lathe([[0.017, 0], [0, 0.06]], { segments: 6 }));
    });
    return { mesh: b.build(), animated: true };
  },
});
