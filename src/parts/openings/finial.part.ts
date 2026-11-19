// Finial (Houses owner; R-H01). A cross on the chapel's gable, or a ball on
// a stem. Small, so it is one ink group and one bold shape.
//
// Frame: origin on the ridge at the gable end, +Y up.

import { compose, rotationY, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { bead } from './lib';

export default definePart({
  feature: 'finial',
  build(item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.yellow).setInk('finial');
    // Face the cross along the ridge: its arms run across the gable end.
    const across = item.dir === 1 || item.dir === 3;
    if (item.variant === 'vane') {
      // A weathervane: a rod, a ball, and an arrow that has swung a little off the ridge line.
      b.with({ color: PALETTE.metal, pattern: PATTERN.metal }, () => {
        b.boxAt([0, -0.04, 0], [0.022, 0.4, 0.022], { skip: ['bottom'] });
        bead(b, 0, 0.2, 0, 0.035);
        b.at(compose(translation(0, 0.3, 0), rotationY((across ? 0 : Math.PI / 2) + 0.5 + ctx.rand('swing'))), () => {
          b.box([-0.14, -0.01, -0.008], [0.12, 0.012, 0.008]);
          // head and tail, flat plates seen from both sides
          for (const z of [0.009, -0.009]) {
            const s = z > 0 ? 1 : -1;
            const head: [number, number, number][] = [[0.12, -0.045, z], [0.2, 0.001, z], [0.12, 0.047, z]];
            const tail: [number, number, number][] = [[-0.2, -0.05, z], [-0.1, 0.001, z], [-0.2, 0.052, z]];
            b.polygon(s > 0 ? head : [...head].reverse());
            b.polygon(s > 0 ? tail : [...tail].reverse());
          }
        });
      });
    } else if (item.variant === 'ball') {
      b.boxAt([0, -0.04, 0], [0.03, 0.14, 0.03], { skip: ['bottom', 'top'] });
      bead(b, 0, 0.13, 0, 0.045);
    } else {
      // A stone cross on a small gablet block.
      const t = 0.042;
      b.with({ color: PALETTE.stoneShade }, () => {
        b.boxAt([0, -0.06, 0], [0.1, 0.1, 0.1], { skip: ['bottom'] });
        b.boxAt([0, 0.04, 0], [t, 0.3, t], { skip: ['bottom'] });
        if (across) b.box([-t / 2, 0.2, -0.1], [t / 2, 0.2 + t, 0.1]);
        else b.box([-0.1, 0.2, -t / 2], [0.1, 0.2 + t, t / 2]);
      });
    }
    return { mesh: b.build() };
  },
});
