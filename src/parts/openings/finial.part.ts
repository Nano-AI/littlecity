// Finial (Houses owner; R-H01). A cross on the chapel's gable, or a ball on
// a stem. Small, so it is one ink group and one bold shape.
//
// Frame: origin on the ridge at the gable end, +Y up.

import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { bead } from './lib';

export default definePart({
  feature: 'finial',
  build(item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.yellow).setInk('finial');
    // Face the cross along the ridge: its arms run across the gable end.
    const across = item.dir === 1 || item.dir === 3;
    if (item.variant === 'ball') {
      b.boxAt([0, -0.04, 0], [0.03, 0.14, 0.03], { skip: ['bottom', 'top'] });
      bead(b, 0, 0.13, 0, 0.045);
    } else {
      const t = 0.028;
      b.boxAt([0, -0.05, 0], [t, 0.3, t], { skip: ['bottom'] });
      if (across) b.box([-t / 2, 0.13, -0.075], [t / 2, 0.13 + t, 0.075]);
      else b.box([-0.075, 0.13, -t / 2], [0.075, 0.13 + t, t / 2]);
    }
    return { mesh: b.build() };
  },
});
