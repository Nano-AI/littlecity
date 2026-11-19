// Lamps (D01, D02, D20, R-D02). Four of one family, all cast iron with a
// four-sided glowing lantern under a pyramid cap:
//
//   post       the street lamp: a stepped foot, a slim post with the
//              lamplighter's ladder bar, the lantern on top
//   four-arm   the centre of a big square: a taller post carrying a ring of
//              four lanterns on scrolled arms round a fifth
//   bridge     short, standing on a parapet
//   pier       a timber post with an iron bracket, a hanging lantern and a
//              lifebuoy: the harbour's lamp
//
// The glass is PATTERN.glow: unshaded by day, lit at dusk. The part owns the
// socket 'lamp-head' (the light itself).
//
// Frame: a floor slot or a socket top; the lamp stands on the origin.

import { compose, rotationX, rotationY, rotationZ, translation, type Mat4 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PROP } from '@/style/dressing';
import { PALETTE } from '@/style/palette';
import { lantern, tube } from './kit';

/** The stepped cast-iron foot and the post up to `top`. One ink group: one outline. */
function ironPost(b: MeshBuilder, top: number, r: number, foot = 0.115): void {
  b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'post' }, () => {
    b.boxAt([0, 0, 0], [foot, 0.045, foot], { skip: ['bottom'] });
    b.lathe([[foot * 0.42, 0.045], [r * 1.45, 0.15], [r, 0.2], [r * 0.8, top]], { segments: 6 });
  });
}

export default definePart({
  prop: 'lamp',
  build(item, ctx) {
    const b = ctx.mesh();
    const variant = item.variant ?? 'post';
    const lean = (ctx.rand('lean') - 0.5) * 0.03;
    let head: Mat4 = translation(0, 0.7, 0);
    const back = item.params?.back ?? 0;
    b.at(compose(translation(0, 0, -back), rotationZ(lean), rotationY((ctx.rand('turn') - 0.5) * 0.3)), () => {
      if (variant === 'four-arm') {
        const h = PROP.fourArmHeight * (0.98 + ctx.rand('h') * 0.04);
        const reach = PROP.fourArmReach, armY = h - 0.33;
        b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'post' }, () => {
          b.boxAt([0, 0, 0], [0.2, 0.05, 0.2], { skip: ['bottom'] });
          b.boxAt([0, 0.05, 0], [0.13, 0.07, 0.13], { skip: ['bottom'] });
          b.lathe([[0.05, 0.12], [0.034, 0.3], [0.03, h - 0.2]], { segments: 6 });
          // The arms: a bar out to each lantern with a scroll brace under it.
          for (let k = 0; k < 4; k++) {
            b.at(rotationY((k * Math.PI) / 2), () => {
              b.box([0.015, armY, -0.014], [reach + 0.02, armY + 0.024, 0.014], { skip: ['w'] });
              tube(b, [[0.02, armY - 0.14, 0], [reach - 0.03, armY + 0.005, 0]], 0.012, { seg: 3 });
            });
          }
        });
        for (let k = 0; k < 4; k++) {
          b.at(compose(rotationY((k * Math.PI) / 2), translation(reach, armY + 0.024, 0)), () => lantern(b, PROP.lampLantern * 0.8, `l${k}`));
        }
        let mid = 0;
        b.at(translation(0, h - 0.2, 0), () => {
          mid = lantern(b, PROP.lampLantern * 1.05, 'top');
        });
        head = translation(0, h - 0.2 + mid, 0);
      } else if (variant === 'pier') {
        const h = 0.9;
        b.with({ color: PALETTE.wood, pattern: PATTERN.bark, ink: 'post' }, () => b.boxAt([0, 0, 0], [0.075, h, 0.075], { skip: ['bottom'] }));
        b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'bracket' }, () => {
          b.box([-0.012, h - 0.09, 0], [0.012, h - 0.066, 0.2]);
          tube(b, [[0, h - 0.24, 0.03], [0, h - 0.085, 0.16]], 0.012, { seg: 3 });
          b.box([-0.006, h - 0.13, 0.164], [0.006, h - 0.09, 0.176]);
        });
        let mid = 0;
        const size = PROP.lampLantern * 0.85;
        const top = h - 0.13 - size * 1.77;
        b.at(translation(0, top, 0.17), () => {
          mid = lantern(b, size, 'lantern');
        });
        head = translation(0, top + mid, 0.17);
        // A lifebuoy on the side of the post, red and white by quarters.
        b.at(compose(translation(-0.04, 0.47, 0), rotationZ(Math.PI / 2), rotationY(Math.PI / 4)), () => {
          const ring: [number, number][] = [[0.062, -0.022], [0.098, -0.022], [0.098, 0.022], [0.062, 0.022], [0.062, -0.022]];
          for (let q = 0; q < 4; q++) {
            b.with({ color: q % 2 ? PALETTE.white : PALETTE.red, pattern: PATTERN.none, ink: 'buoy' }, () =>
              b.lathe(ring, { segments: 2, start: (q * Math.PI) / 2, sweep: Math.PI / 2 }),
            );
          }
        });
      } else {
        const bridge = variant === 'bridge';
        const h = (bridge ? PROP.bridgeLampHeight : PROP.lampHeight) * (0.97 + ctx.rand('h') * 0.06);
        const size = PROP.lampLantern * (bridge ? 0.9 : 1);
        const top = h - size * 1.77;
        ironPost(b, top, PROP.lampPost, bridge ? 0.09 : 0.115);
        if (!bridge) {
          // The ladder bar, just under the lantern.
          b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'post' }, () =>
            b.at(compose(translation(0, top - 0.07, 0), rotationX(0)), () => b.box([-0.085, -0.01, -0.01], [0.085, 0.01, 0.01])),
          );
        }
        let mid = 0;
        b.at(translation(0, top, 0), () => {
          mid = lantern(b, size, 'lantern');
        });
        head = translation(0, top + mid, 0);
      }
    });
    return { mesh: b.build(), anchors: { 'lamp-head': compose(translation(0, 0, -back), head) } };
  },
});
