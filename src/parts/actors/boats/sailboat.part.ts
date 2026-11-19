// The sailboat (L19): a small half-decked dinghy. A foredeck, a mast stepped
// through its after edge, an open cockpit with a thwart and a stern seat, a
// rudder hung on the transom with its tiller, and a pennant at the masthead
// that flies in the wind (per-vertex sway).
//
// The sails are NOT drawn here: they are instances of their own
// (boat-sail.part.ts) so the behaviour can swing and fill them. rig.ts says
// where they go.
//
// Frame: afloat. +Z is the bow, y = 0 the waterline (see hull.ts).

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { deck, drawHull, spar, stick, thwart } from './hull';
import { boatPaint } from './paint';
import { sailboatRig, sailboatSpec } from './rig';

export default definePart({
  actor: 'sailboat',
  build(item, ctx) {
    const b = ctx.mesh();
    const paint = boatPaint(item.params?.look);
    const rig = sailboatRig();
    const hull = drawHull(b, sailboatSpec(), paint);

    b.with({ color: paint.seat, ink: 'deck' }, () => deck(b, hull, rig.mastT - 0.035, 1));
    b.with({ color: paint.seat, ink: 'thwarts' }, () => {
      thwart(b, hull, 0.36, 0.08, hull.sheer(0.36) - 0.03);
      thwart(b, hull, 0.075, 0.1, hull.sheer(0.075) - 0.03);
    });
    b.with({ color: paint.spar, ink: 'mast' }, () => spar(b, 0, rig.mastZ, hull.spec.sole, rig.mastTop, 0.021, 0.013));

    // The rudder and its tiller: one object.
    b.with({ ink: 'rudder' }, () => {
      const s0 = hull.sheer(0);
      const z = hull.z(0, s0);
      b.setColor(paint.accent);
      b.box([-0.009, -0.07, z - 0.085], [0.009, s0 + 0.03, z - 0.004]);
      b.setColor(paint.spar);
      const swing = (ctx.rand('tiller') - 0.5) * 0.05;
      stick(b, [0, s0 + 0.026, z - 0.04], [swing, s0 + 0.05, z + 0.2], 0.018);
    });

    // The pennant: fixed at the mast, free at the fly.
    const top = rig.mastTop;
    const fly = 0.13;
    b.with({ color: item.params?.look !== undefined && Math.round(item.params.look) % 2 === 1 ? PALETTE.yellow : PALETTE.red, ink: 'pennant', sway: (_x, _y, z) => Math.min(1, Math.max(0, (rig.mastZ - z) / fly)) * 0.8 }, () => {
      for (const side of [-1, 1]) {
        const x = side * 0.003;
        const pts: Vec3[] = [[x, top - 0.005, rig.mastZ], [x, top - 0.065, rig.mastZ], [x, top - 0.035, rig.mastZ - fly]];
        const n: Vec3 = [side, 0, 0];
        b.tri(pts[0]!, side > 0 ? pts[1]! : pts[2]!, side > 0 ? pts[2]! : pts[1]!, { normals: [n, n, n] });
      }
    });
    return { mesh: b.build(), animated: true };
  },
});
