// L33: a cat, sitting up, facing +Z, on the ground at the origin: a pear of
// a body, a round head with two ear points, a tail curled round its feet.
// The behaviour lays it down to nap (squashed low and long) by day.

import { compose, rotationX, translation } from '@/core/mat4';
import { airborne } from '@/gen/airborne';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';

const COATS = ['#3a3330', '#e0a060', '#f4efe6', '#8a8580', '#b0703a'];

export default definePart({
  actor: 'cat',
  build(item, ctx) {
    // AIRBORNE although it sits on the ground: a cat is too small to need a shade, and its breathing
    // must not make the renderer redraw the grounding picture all day.
    const b = ctx.mesh().setPattern(airborne(PATTERN.none)).setInk('cat');
    const coat = COATS[Math.abs(Math.round(item.params?.look ?? 0)) % COATS.length]!;
    b.setColor(coat);
    ball(b, 0, 0.055, -0.01, 0.045, 0.055, 0.05, 8, 4);
    ball(b, 0, 0.125, 0.012, 0.034, 0.031, 0.031, 8, 4);
    for (const side of [-1, 1]) b.at(compose(translation(side * 0.018, 0.15, 0.012), rotationX(-0.1)), () => b.lathe([[0.011, 0], [0, 0.026]], { segments: 4 }));
    // The tail, round the feet.
    ball(b, 0.035, 0.012, 0.03, 0.012, 0.01, 0.04, 5, 3);
    b.setColor(PALETTE.yellow).setInk('eyes');
    for (const side of [-1, 1]) ball(b, side * 0.012, 0.13, 0.04, 0.006, 0.005, 0.004, 4, 2);
    return { mesh: b.build(), animated: true };
  },
});
