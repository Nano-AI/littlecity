// A ring on the water (L06): round a stilt, a pillar, a floating hull. A
// thin band of foam, broken into a few strokes like a ring sketched quickly.
//
// It carries the SEA's ink id and faces straight up, so no pen line is drawn
// round it: it is a mark on the water, not a thing lying on it.
//
// HOW IT FADES. There is no transparency in this drawing. The band is a low
// ridge: its crest stands one unit above its two edges. The behaviour scales
// that height to a hair and floats the ring so the crest is just above the
// sea; as the ring ages it is sunk, the sea closes over the edges first, and
// the stroke thins to nothing.
//
// Frame: lying round the origin, radius 1 to the crest, crest at y = 1 and
// edges at y = 0. The behaviour scales it (x and z: the radius, y: the
// ridge) and places it. Variants differ in how the ring is broken.

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { seaInk } from '../kit';

/** Half the band's width, as a fraction of the ring's radius. */
export const RING_BAND = 0.09;

export default definePart({
  actor: 'water-ring',
  build(item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.foam).setInkId(seaInk());
    const up: Vec3 = [0, 1, 0];
    const hull = item.variant === 'hull';
    const strokes = hull ? 4 : 3;
    const turn = ctx.rand('turn') * Math.PI * 2;
    const each = (Math.PI * 2) / strokes;
    const steps = hull ? 5 : 6;
    for (let k = 0; k < strokes; k++) {
      const gap = each * (0.14 + 0.2 * ctx.rand('gap', k));
      const a0 = turn + k * each + gap / 2, a1 = turn + (k + 1) * each - gap / 2;
      for (let i = 0; i < steps; i++) {
        const p = a0 + ((a1 - a0) * i) / steps, q = a0 + ((a1 - a0) * (i + 1)) / steps;
        // Each stroke tapers to its ends, like a brush lifted off the paper.
        const wp = RING_BAND * Math.sin((Math.PI * (i + 0.15)) / (steps + 0.3)) ** 0.6, wq = RING_BAND * Math.sin((Math.PI * (i + 1.15)) / (steps + 0.3)) ** 0.6;
        const at = (ang: number, r: number, y: number): Vec3 => [Math.cos(ang) * r, y, -Math.sin(ang) * r];
        // Inner slope and outer slope of the ridge; both face up.
        b.quad(at(p, 1 - wp, 0), at(p, 1, 1), at(q, 1, 1), at(q, 1 - wq, 0), { normals: [up, up, up, up] });
        b.quad(at(p, 1, 1), at(p, 1 + wp, 0), at(q, 1 + wq, 0), at(q, 1, 1), { normals: [up, up, up, up] });
      }
    }
    return { mesh: b.build(), animated: true };
  },
});
