// Guardian (D35): a stone lion or a great urn on a plinth, one of a pair at
// the head of a grand stair; and the market cross (D37) on a plinth.

import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { lump, mixColor, rngOf, vary } from './kit';

/**
 * Guardian: a couchant stone lion ('lion'), head up and looking down the
 * stair, or a fluted urn with a trailing plant ('urn'), on a moulded plinth.
 * `mirror` 1 turns the lion's head the other way (the second of a pair).
 * Frame: a floor slot, +Z the way it looks (down the stair).
 */
export const guardian = definePart({
  prop: 'guardian',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 911));
    const stone = mixColor(PALETTE.stone, PALETTE.stoneShade, 0.3);
    const ph = 0.2;
    // A size to stand beside a monumental flight.
    b.scale(1.3);
    // The plinth: a base, a die, a cap.
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'plinth' }, () => {
      b.box([-0.16, 0, -0.2], [0.16, 0.04, 0.2], { skip: ['bottom'] });
      b.box([-0.13, 0.04, -0.17], [0.13, ph - 0.03, 0.17], { skip: ['bottom', 'top'] });
      b.box([-0.155, ph - 0.03, -0.195], [0.155, ph, 0.195], { bevelTop: true });
    });
    if (item.variant === 'urn') {
      b.with({ color: stone, pattern: PATTERN.marble, ink: 'urn' }, () => {
        b.at(translation(0, ph, 0), () => b.lathe([[0.06, 0], [0.05, 0.03], [0.1, 0.1], [0.12, 0.18], [0.09, 0.26], [0.11, 0.28], [0.11, 0.3], [0.08, 0.3]], { segments: 10 }));
      });
      b.with({ color: vary(PALETTE.leafDark, r('leaf')), pattern: PATTERN.leaves, ink: 'plant', sway: 0.25 }, () => {
        lump(b, 0, ph + 0.33, 0, 0.1, 0.07, 0.1, { seg: 7, rings: 3 });
        lump(b, 0.08, ph + 0.24, 0.07, 0.05, 0.09, 0.04, { seg: 6, rings: 3 });
      });
    } else {
      const side = item.params?.mirror === 1 ? -1 : 1;
      b.with({ color: stone, pattern: PATTERN.marble, ink: 'lion' }, () => {
        // Lying along Z, looking out (+Z): haunches behind, body, chest and maned head in front.
        lump(b, 0, ph + 0.07, -0.08, 0.1, 0.08, 0.1, { seg: 8, rings: 4 }); // haunches
        lump(b, 0, ph + 0.075, 0.02, 0.085, 0.07, 0.12, { seg: 8, rings: 4 }); // body
        lump(b, 0, ph + 0.11, 0.1, 0.09, 0.1, 0.07, { seg: 8, rings: 4 }); // chest and mane
        lump(b, side * 0.01, ph + 0.2, 0.13, 0.075, 0.075, 0.07, { seg: 8, rings: 4 }); // the mane round the head
        lump(b, side * 0.015, ph + 0.19, 0.19, 0.04, 0.035, 0.04, { seg: 6, rings: 3 }); // the muzzle
        for (const x of [-0.05, 0.05]) lump(b, x, ph + 0.025, 0.16, 0.03, 0.025, 0.06, { seg: 6, rings: 3 }); // the paws
        // The tail curled round the haunch.
        lump(b, 0.09, ph + 0.03, -0.13, 0.02, 0.02, 0.05, { seg: 5, rings: 3 });
      });
    }
    return { mesh: b.build() };
  },
});

/**
 * Market cross (D37): on a plinth among the stalls, two octagonal steps, a
 * tall faceted shaft with a moulded capital, and a cross head with a gilt
 * ball. Frame: the plinth's 'statue-base' socket (the top centre of the
 * plinth). Anchor 'vend': on the ground in front of the plinth, where a
 * vendor sits on its step with a basket.
 */
export const marketCross = definePart({
  prop: 'market-cross',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 769));
    const stone = mixColor(PALETTE.stone, PALETTE.stoneShade, 0.25);
    b.rotateY(Math.PI / 8 + (r('turn') - 0.5) * 0.1);
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'steps' }, () => {
      b.lathe([[0.3, 0], [0.3, 0.07], [0.22, 0.07], [0.22, 0.14], [0.15, 0.14]], { segments: 8, smooth: false, capTop: true });
    });
    b.with({ color: stone, pattern: PATTERN.stone, ink: 'shaft' }, () => {
      b.lathe([[0.075, 0.14], [0.055, 0.95], [0.08, 0.98], [0.08, 1.02], [0.05, 1.02]], { segments: 8, smooth: false, capTop: true });
    });
    b.with({ color: stone, pattern: PATTERN.stone, ink: 'head' }, () => {
      b.box([-0.025, 1.02, -0.025], [0.025, 1.3, 0.025], { skip: ['bottom'] });
      b.box([-0.11, 1.17, -0.022], [-0.025, 1.22, 0.022], { skip: ['e'] });
      b.box([0.025, 1.17, -0.022], [0.11, 1.22, 0.022], { skip: ['w'] });
    });
    b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'ball' }, () => lump(b, 0, 1.33, 0, 0.032, 0.032, 0.032, { seg: 6, rings: 4 }));
    return { mesh: b.build(), anchors: { vend: translation(0, -0.8, 0.62) } };
  },
});
