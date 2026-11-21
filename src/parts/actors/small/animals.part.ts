// Animals that walk about (life depth): a sheep on the open meadow (L34,
// the same drawing as the paddock's standing grazer, so the two kinds of
// sheep are one breed) and a chicken by a vegetable patch (L34).
//
// Frames: on the ground, facing +Z (heading), centred on the animal.

import { compose, rotationY } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { soft } from '@/gen/soft';
import { grazer } from '@/parts/props/park.part';
import type { PropOf } from '@/resolve/plan';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';

export const sheep = definePart({
  actor: 'sheep',
  build(item, ctx) {
    // The grazer is drawn facing +X; turned a quarter so it heads along +Z.
    const prop = { ...item, type: 'grazer', variant: 'sheep', params: { turn: 0, look: item.params?.look ?? 0 } } as unknown as PropOf<'grazer'>;
    const body = grazer.build(prop, ctx).mesh;
    const b = ctx.mesh();
    b.add(body, compose(rotationY(-Math.PI / 2)));
    return { mesh: b.build(), animated: true };
  },
});

const HENS = [PALETTE.white, '#c98a52', '#8a5a3a'];

export default definePart({
  actor: 'chicken',
  build(item, ctx) {
    const b = ctx.mesh().setPattern(PATTERN.none);
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    soft(b, { ink: 'body' }, (s) => {
      s.b.setColor(HENS[look % HENS.length]!);
      s.ball(0, 0.065, -0.01, 0.042, 0.04, 0.055, 9, 5);
      s.ball(0, 0.105, 0.04, 0.024, 0.026, 0.024, 8, 4);
    });
    b.setColor(PALETTE.red).setInk('comb');
    ball(b, 0, 0.133, 0.042, 0.008, 0.011, 0.014, 4, 2);
    b.setColor(PALETTE.yellow).setInk('beak');
    ball(b, 0, 0.103, 0.066, 0.007, 0.006, 0.011, 4, 2);
    b.setColor(PALETTE.metal).setInk('legs');
    for (const x of [-0.016, 0.016]) b.boxAt([x, 0, 0], [0.006, 0.03, 0.006], { skip: ['bottom', 'top'] });
    return { mesh: b.build(), animated: true };
  },
});
