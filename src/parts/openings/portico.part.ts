// Portico (Houses owner; R-H09). A manor's doorway: two small columns on a
// stone step carrying a little pediment over the door.
//
// Frame: the wall plane at the door, the storey's floor at y = 0, +Z out.

import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { personaOf } from './lib';

export default definePart({
  feature: 'portico',
  build(_item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    const hw = 0.3, out = 0.33, base = 0.055, head = 0.6, beam = 0.07, peak = 0.14;
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'step' }, () => b.box([-hw - 0.04, 0, 0], [hw + 0.04, base, out + 0.05], { skip: ['bottom', 'n'] }));
    b.with({ color: p.trim, ink: 'portico' }, () => {
      for (const x of [-hw + 0.045, hw - 0.045]) {
        b.at(translation(x, 0, out - 0.045), () => {
          b.boxAt([0, base, 0], [0.085, 0.03, 0.085], { skip: ['bottom'] });
          b.lathe([[0.034, base + 0.03], [0.03, head - 0.03]], { segments: 8 });
          b.boxAt([0, head - 0.03, 0], [0.085, 0.03, 0.085]);
        });
      }
      // The beam on the columns, and the pediment on the beam.
      b.box([-hw, head, 0], [hw, head + beam, out], { skip: ['n'] });
      const y = head + beam;
      b.tri([-hw - 0.02, y, out + 0.02], [hw + 0.02, y, out + 0.02], [0, y + peak, out + 0.02]);
    });
    b.with({ color: p.roofColor, pattern: PATTERN.shingles, ink: 'portico-roof' }, () => {
      const y = head + beam, e = hw + 0.02, z = out + 0.02;
      b.quad([e, y, z], [e, y, 0], [0, y + peak, 0], [0, y + peak, z]);
      b.quad([-e, y, 0], [-e, y, z], [0, y + peak, z], [0, y + peak, 0]);
    });
    return { mesh: b.build() };
  },
});
