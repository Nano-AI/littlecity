// Small birds and the town's characters (L14, L15): a sparrow, a white
// dove, a crow, an owl, a stork (on its nest), a duck and a duckling. One
// part, simple round shapes in the style of the pigeon: one outline round
// each bird. Wings are part of the body (folded); in flight the behaviour
// squashes the bird across to beat them. AIRBORNE (no shade smear).
//
// Frame: facing +Z, feet (or the waterline, for the ducks) at the origin.

import { compose, rotationX, scaling, translation } from '@/core/mat4';
import { airborne } from '@/gen/airborne';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';

type Look = { body: string; head: string; wing: string; beak: string; size: number; upright: number };

const LOOKS: Record<string, Look> = {
  sparrow: { body: '#b08a62', head: '#7a5a40', wing: '#8a6a4a', beak: '#4a3a30', size: 0.6, upright: 0.35 },
  dove: { body: PALETTE.white, head: PALETTE.white, wing: '#e8e2d6', beak: '#e7a07a', size: 0.85, upright: 0.45 },
  crow: { body: '#2f2c33', head: '#25222a', wing: '#3a3640', beak: '#25222a', size: 1.05, upright: 0.45 },
  owl: { body: '#9a7a58', head: '#9a7a58', wing: '#7a5e44', beak: PALETTE.yellow, size: 1.1, upright: 1.2 },
  duck: { body: '#b89a72', head: '#3f7a5a', wing: '#8a6e50', beak: PALETTE.yellow, size: 1.2, upright: 0 },
  duckling: { body: '#f0d36a', head: '#f0d36a', wing: '#e0c25a', beak: '#e09a4a', size: 0.55, upright: 0 },
};

function bird(b: MeshBuilder, k: Look): void {
  b.at(scaling(k.size), () => {
    b.setColor(k.body);
    b.at(compose(translation(0, 0.06, 0), rotationX(Math.PI / 2 - k.upright)), () =>
      b.lathe([[0, -0.07], [0.03, -0.055], [0.046, -0.02], [0.047, 0.012], [0.035, 0.045], [0, 0.06]], { segments: 9 }));
    b.setColor(k.wing);
    for (const side of [-1, 1]) ball(b, side * 0.034, 0.066, -0.018, 0.018, 0.03, 0.048, 6, 3);
    const hy = 0.06 + 0.07 * Math.sin(k.upright) + 0.012, hz = 0.07 * Math.cos(k.upright) - 0.004;
    b.setColor(k.head);
    ball(b, 0, hy, hz, 0.03, 0.029, 0.03, 8, 4);
    b.setColor(k.beak);
    b.at(compose(translation(0, hy - 0.004, hz + 0.024), rotationX(Math.PI / 2 + 0.2)), () => b.lathe([[0.009, 0], [0, 0.026]], { segments: 5 }));
  });
}

export default definePart({
  actor: 'small-bird',
  build(item, ctx) {
    const b = ctx.mesh().setPattern(airborne(PATTERN.none)).setInk('bird');
    const v = item.variant ?? 'sparrow';
    if (v === 'stork') {
      // A white stork on a ragged nest of sticks: long red legs folded under, a long red bill.
      b.setColor(PALETTE.wood).setInk('nest');
      b.lathe([[0.2, 0], [0.24, 0.05], [0.22, 0.08], [0.12, 0.07], [0, 0.06]], { segments: 10, smooth: false });
      b.setInk('bird').setColor(PALETTE.white);
      ball(b, 0, 0.2, 0, 0.07, 0.07, 0.12, 8, 5);
      b.setColor(PALETTE.ink);
      for (const side of [-1, 1]) ball(b, side * 0.05, 0.2, -0.05, 0.025, 0.04, 0.08, 6, 3);
      b.setColor(PALETTE.white);
      b.boxAt([0, 0.24, 0.07], [0.03, 0.14, 0.03], { skip: ['bottom'] });
      ball(b, 0, 0.4, 0.08, 0.035, 0.035, 0.04, 8, 4);
      b.setColor(PALETTE.red);
      b.at(compose(translation(0, 0.395, 0.11), rotationX(Math.PI / 2 + 0.25)), () => b.lathe([[0.012, 0], [0, 0.13]], { segments: 5 }));
      b.boxAt([0, 0.07, 0.02], [0.018, 0.1, 0.018], { skip: ['bottom'] });
      return { mesh: b.build(), animated: true };
    }
    bird(b, LOOKS[v] ?? LOOKS.sparrow!);
    if (v === 'owl') {
      // Two big round eyes.
      b.setColor(PALETTE.yellow).setInk('eyes');
      for (const side of [-1, 1]) ball(b, side * 0.013, 0.147, 0.055, 0.011, 0.011, 0.006, 6, 3);
    }
    return { mesh: b.build(), animated: true };
  },
});
