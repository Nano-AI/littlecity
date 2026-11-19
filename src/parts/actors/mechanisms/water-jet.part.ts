// L29: fountain water that plays. At a 'water-jet' socket (origin where the
// water leaves, +Y the way it sets off). While this part exists the fountain
// generator leaves its falling water out (src/gen/fountain/draw.ts).
//
//   arc   spilling from a lip or a spout: out along +Y by `reach`, down
//         along −Z (the socket's up is +Z for a level spout) by `drop`
//   up    the jet on a tiered fountain's finial: up along +Y, a small crown
//   bead  a drop of water the behaviour sends down the stream (spawned)
//
// The stream is foam-pale water; the behaviour moves beads along it and
// breathes its length, so it reads as running, not as a glass rod.

import type { Vec3 } from '@/core/mat4';
import { airborne } from '@/gen/airborne';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { lump, mixColor, tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';

/** Water in the air, as the fountain generator draws it. */
export const JET_WHITE = mixColor(PALETTE.foam, PALETTE.shallow, 0.45);

/** A point on an arc stream, t from 0 at the lip to 1 in the pool: out along +Y, falling along −Z. */
export function arcPoint(t: number, reach: number, drop: number): Vec3 {
  return [0, reach * Math.sqrt(t), -drop * t * t];
}

/** A point on an upward jet, t from 0 at the nozzle to 1 back down on the finial's shoulder. */
export function upPoint(t: number, height: number, side: number): Vec3 {
  return [side * 0.05 * t, height * 4 * t * (1 - t), 0];
}

export default definePart({
  actor: 'water-jet',
  build(item, ctx) {
    const b = ctx.mesh();
    b.setColor(JET_WHITE).setPattern(PATTERN.foam).setInk('water');
    if (item.variant === 'bead') {
      b.setPattern(airborne(PATTERN.foam));
      lump(b, 0, 0, 0, 0.03, 0.036, 0.03, { seg: 6, rings: 3 });
      return { mesh: b.build(), animated: true };
    }
    if (item.variant === 'up') {
      const h = item.params?.drop ?? 0.16;
      // A thin column and a little crown of water bowing over to each side.
      tube(b, [[0, 0, 0], [0, h * 0.6, 0], [0, h, 0]], [0.016, 0.013, 0.008], { seg: 5 });
      for (const side of [-1, 1]) {
        const pts: Vec3[] = [0.5, 0.65, 0.8, 0.95].map((t) => upPoint(t, h, side));
        tube(b, pts, [0.01, 0.012, 0.013, 0.012], { seg: 4 });
      }
      return { mesh: b.build(), animated: true };
    }
    const reach = item.params?.reach ?? 0.09;
    const drop = item.params?.drop ?? 0.3;
    const pts = [0, 0.15, 0.4, 0.7, 1].map((t) => arcPoint(t, reach, drop));
    tube(b, pts, [0.02, 0.023, 0.026, 0.03, 0.034], { seg: 5 });
    return { mesh: b.build(), animated: true };
  },
});
