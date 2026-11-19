// Small moving things (life depth): a falling leaf or petal (L05) and an
// insect (L35). All AIRBORNE (src/gen/airborne.ts): no shade on the ground,
// and flying them never redraws the grounding picture.
//
// Frames: centred on the origin. A leaf is a little curled blade lying in
// XZ; a butterfly's two wings are separate ink groups either side of +Z (its
// heading), hinged on the Z axis, so the behaviour flaps them by squashing X;
// a bee is a fat dot with a blur of wing.

import { scaling } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { airborne } from '@/gen/airborne';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { ball, twoSided } from '../kit';

const BUTTERFLIES = [PALETTE.yellow, PALETTE.white, PALETTE.pink, '#f2a65a'];
const LEAVES = [PALETTE.leafDark, PALETTE.leaf, '#c9b458', '#d98a4e'];

function blade(b: MeshBuilder, w: number, l: number): void {
  twoSided(b, [[0, 0.004, -l], [w, 0, -l * 0.2], [w * 0.6, 0.006, l * 0.5], [0, 0.012, l], [-w * 0.6, 0.006, l * 0.5], [-w, 0, -l * 0.2]]);
}

export const leafPart = definePart({
  actor: 'leaf',
  build(item, ctx) {
    const b = ctx.mesh().setPattern(airborne(PATTERN.none)).setInk('leaf');
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    if (item.variant === 'petal') {
      b.setColor(look % 2 ? PALETTE.pink : PALETTE.white);
      blade(b, 0.028, 0.026);
    } else {
      b.setColor(LEAVES[look % LEAVES.length]!);
      blade(b, 0.03, 0.05);
    }
    return { mesh: b.build(), animated: true };
  },
});

export default definePart({
  actor: 'insect',
  build(item, ctx) {
    const b = ctx.mesh().setPattern(airborne(PATTERN.none));
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    if (item.variant === 'bee') {
      b.setColor(PALETTE.yellow).setInk('body');
      ball(b, 0, 0, 0, 0.022, 0.02, 0.03, 6, 3);
      b.setColor(PALETTE.white).setInk('wings');
      twoSided(b, [[0, 0.016, 0], [0.03, 0.03, -0.012], [0.028, 0.034, 0.01]]);
      twoSided(b, [[0, 0.016, 0], [-0.028, 0.034, 0.01], [-0.03, 0.03, -0.012]]);
      return { mesh: b.build(), animated: true };
    }
    b.setColor(BUTTERFLIES[look % BUTTERFLIES.length]!);
    // Drawn a little larger than life, or it is a speck at the playing distance.
    b.push(scaling(1.6));
    for (const side of [1, -1]) {
      b.setInk(side > 0 ? 'right' : 'left');
      // A fore wing and a smaller hind wing, as one outline.
      twoSided(b, [[0, 0, 0.012], [side * 0.03, 0, 0.045], [side * 0.058, 0, 0.022], [side * 0.05, 0, -0.008], [side * 0.03, 0, -0.04], [side * 0.008, 0, -0.03]]);
    }
    b.setColor(PALETTE.ink).setInk('body');
    ball(b, 0, 0, 0, 0.006, 0.006, 0.03, 4, 2);
    b.pop();
    return { mesh: b.build(), animated: true };
  },
});
