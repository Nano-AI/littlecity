// Windmill sails (Houses owner; R-W01, turned by L03). Four sails on a hub:
// each a timber stock with a lattice frame and its cloth on the trailing
// side. One sail is one ink group (stock, lattice and cloth read by colour),
// so the wheel is four clean shapes even when it is small on screen.
//
// Frame: the 'mill-hub' socket: +Z along the windshaft, out of the cap. The
// wheel lies in the XY plane and turns about Z. It is drawn at rest a little
// off the upright cross, the way a miller parks it.

import { compose, rotationZ, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { WINDMILL } from '@/style/houses';
import { PALETTE } from '@/style/palette';

export default definePart({
  actor: 'windmill-sails',
  build(item, ctx) {
    const b = ctx.mesh();
    const L = item.params?.size ?? WINDMILL.sail;
    const rest = Math.PI / 4 + (ctx.rand('rest') - 0.5) * 0.5;
    const w = Math.min(0.26, 0.27 * L), y0 = 0.2 * L, t = 0.014;
    for (let k = 0; k < 4; k++) {
      b.at(compose(rotationZ(rest + (k * Math.PI) / 2), translation(0, 0, 0.02)), () => {
        b.setInk(`sail${k}`);
        // The cloth, seen from both sides.
        b.with({ color: PALETTE.white, pattern: PATTERN.cloth }, () => {
          b.quad([0.02, y0, 0.004], [0.02 + w, y0, 0.004], [0.02 + w, L - 0.02, 0.004], [0.02, L - 0.02, 0.004]);
          b.quad([0.02 + w, y0, -0.004], [0.02, y0, -0.004], [0.02, L - 0.02, -0.004], [0.02 + w, L - 0.02, -0.004]);
        });
        b.with({ color: PALETTE.wood }, () => {
          // The stock, the outer rail and the sail bars.
          b.box([-0.02, 0, -t], [0.02, L, t]);
          b.box([0.02 + w - 0.016, y0, -t], [0.02 + w, L - 0.02, t]);
          const bars = 5;
          for (let i = 0; i < bars; i++) {
            const y = y0 + ((L - 0.02 - y0) * i) / (bars - 1);
            b.box([0.02, y - 0.009, -t * 0.8], [0.02 + w - 0.016, y + 0.009, t * 0.8], { skip: ['e', 'w'] });
          }
        });
      });
    }
    // The hub: an iron boss on the end of the windshaft.
    b.with({ color: PALETTE.metal, ink: 'hub' }, () => b.box([-0.05, -0.05, -0.02], [0.05, 0.05, 0.05]));
    return { mesh: b.build(), animated: true };
  },
});
