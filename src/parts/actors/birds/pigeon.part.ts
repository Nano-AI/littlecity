// A pigeon (L12): plump and blue-grey, with a darker head, a green-violet
// sheen on the neck, pale folded wings with a dark bar, a dark tail and two
// red feet. One ink group: one outline round a round bird.
//
// Frame: facing +Z, feet at the origin (see kit.ts).

import { compose, rotationX, scaling, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';
import { birdColors, bodyScale } from './kit';

/** How upright the pigeon stands, radians. */
const TILT = 0.55;

export default definePart({
  actor: 'pigeon',
  build(_item, ctx) {
    const b = ctx.mesh();
    const c = birdColors();
    b.setInk('body');
    b.at(scaling(bodyScale('pigeon')), () => {
      // Tail to crown in one smooth turned shape, standing well up: a pigeon is all breast.
      b.setColor(c.pigeon);
      b.at(compose(translation(0, 0.066, -0.004), rotationX(Math.PI / 2 - TILT)), () =>
        b.lathe([[0, -0.085], [0.03, -0.07], [0.05, -0.03], [0.055, 0.008], [0.046, 0.042], [0.031, 0.062], [0.029, 0.078], [0, 0.085]], { segments: 10 }));
      // Folded wings: a paler patch each side, with the dark bar pigeons have.
      for (const side of [-1, 1]) {
        b.setColor(c.pigeonLight);
        ball(b, side * 0.036, 0.07, -0.02, 0.022, 0.034, 0.056, 6, 4);
        b.setColor(c.pigeonDark);
        ball(b, side * 0.045, 0.062, -0.046, 0.016, 0.028, 0.013, 6, 4);
      }
      const hy = 0.066 + 0.078 * Math.sin(TILT), hz = -0.004 + 0.078 * Math.cos(TILT);
      b.setColor(c.pigeonNeck);
      ball(b, 0, hy - 0.026, hz - 0.016, 0.033, 0.026, 0.031, 8, 4); // the sheen on the neck
      b.setColor(c.pigeonDark);
      ball(b, 0, hy, hz, 0.031, 0.03, 0.033, 8, 5); // head
      ball(b, 0, 0.04, -0.082, 0.027, 0.014, 0.044, 6, 4); // tail
      b.setColor(PALETTE.white);
      b.at(compose(translation(0, hy - 0.004, hz + 0.026), rotationX(Math.PI / 2 + 0.3)), () => b.lathe([[0.011, 0], [0, 0.032]], { segments: 5 })); // beak
      b.setColor(PALETTE.red);
      for (const side of [-1, 1]) b.boxAt([side * 0.018, 0, 0.004], [0.012, 0.026, 0.012], { skip: ['bottom'] }); // feet
    });
    return { mesh: b.build(), animated: true };
  },
});
