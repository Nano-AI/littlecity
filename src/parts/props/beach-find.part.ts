// Beach finds (D24): what the tide leaves on the sand.
//
//   driftwood   a bleached, forked branch lying on the sand
//   shell       a fan shell and a couple of pebbles
//   starfish    a five-armed star, red or orange
//
// Small on purpose: these are things you notice when you zoom in. Each is
// one ink group, drawn bold enough to stay a shape rather than a speck.
//
// Frame: a floor slot on a sand cell.

import { compose, rotationY, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { mixColor, mound, rngOf, tube, vary, TONE } from './kit';
import { rock } from './wild';

export default definePart({
  prop: 'beach-find',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 31337));
    const variant = item.variant ?? 'driftwood';
    b.at(compose(translation((r('ox') - 0.5) * 0.16, 0, (r('oz') - 0.5) * 0.16), rotationY(r('turn') * Math.PI * 2)), () => {
      if (variant === 'driftwood') {
        const wood = vary(mixColor(PALETTE.stoneShade, PALETTE.wood, 0.3), r('c'));
        b.with({ color: wood, pattern: PATTERN.bark, ink: 'wood' }, () => {
          const len = 0.3 + r('len') * 0.14;
          const main: Vec3[] = [[-len / 2, 0.02, 0], [-len * 0.1, 0.035, 0.02], [len / 2, 0.03, -0.01]];
          tube(b, main, [0.034, 0.03, 0.02], { seg: 5, capStart: true, capEnd: true });
          tube(b, [[len * 0.02, 0.035, 0.015], [len * 0.2, 0.06, 0.11]], [0.022, 0.012], { seg: 4, capEnd: true });
        });
      } else if (variant === 'starfish') {
        const c = r('c') < 0.6 ? PALETTE.red : PALETTE.brick;
        b.with({ color: c, pattern: PATTERN.none, ink: 'star' }, () => {
          const arms = 5, R = 0.085, rr = 0.032;
          const pts: Vec3[] = [];
          for (let i = 0; i < arms * 2; i++) {
            const a = (i / (arms * 2)) * Math.PI * 2, rad = i % 2 === 0 ? R : rr;
            pts.push([Math.cos(a) * rad, 0.008, Math.sin(a) * rad]);
          }
          // A fan from a raised middle: the arms slope down to their tips.
          const hub: Vec3 = [0, 0.03, 0];
          for (let i = 0; i < pts.length; i++) b.tri(hub, pts[(i + 1) % pts.length]!, pts[i]!, { normals: [TONE.up, TONE.up, TONE.up] });
        });
      } else {
        b.setInk('shell');
        b.with({ color: mixColor(PALETTE.white, PALETTE.pink, 0.35), pattern: PATTERN.none }, () => {
          // A fan shell: a low ribbed mound, flat on the hinge side.
          mound(b, 0, 0, 0, 0.062, 0.03, 0.05, { seg: 7, rings: 2 });
        });
        rock(b, 0.1, 0, 0.04, 0.03, r, 'p1');
        if (r('p') < 0.6) rock(b, -0.07, 0, 0.09, 0.022, r, 'p2');
      }
    });
    return { mesh: b.build() };
  },
});
