// The rowboat (L17): a small open boat, clinker-round, with two thwarts, a
// stern seat and a pair of oars shipped along the thwarts. It is tied up by
// its bow, so `rowboatBow()` says where the line makes fast.
//
// Frame: afloat. +Z is the bow, y = 0 the waterline (see hull.ts).

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { BOATS } from '@/style/boats';
import { PALETTE } from '@/style/palette';
import { drawHull, hullShape, stick, thwart, type HullSpec } from './hull';
import { boatPaint } from './paint';

export function rowboatSpec(): HullSpec {
  return {
    length: BOATS.rowLength,
    beam: BOATS.rowBeam,
    freeboard: 0.085,
    bowRise: 0.06,
    sternRise: 0.02,
    draft: 0.05,
    widest: 0.42,
    transom: 0.7,
    bowPoint: 1,
    stemRake: 0.4,
    transomRake: 0.14,
    round: 0.38,
    vee: 0.85,
    skin: 0.022,
    strake: 0.03,
    boot: 0.016,
    sole: 0.012,
    stations: 9,
  };
}

/** Where the mooring line makes fast: the stem head, in the boat's frame. */
export function rowboatBow(): Vec3 {
  return hullShape(rowboatSpec()).stemHead;
}

export default definePart({
  actor: 'rowboat',
  build(item, ctx) {
    const b = ctx.mesh();
    const paint = boatPaint(item.params?.look);
    const hull = drawHull(b, rowboatSpec(), paint);
    // Thwarts and the stern seat: one group, so three planks are one drawn thing.
    b.with({ color: paint.seat, ink: 'thwarts' }, () => {
      for (const t of [0.36, 0.62]) thwart(b, hull, t, 0.075, hull.sheer(t) - 0.026);
      thwart(b, hull, 0.085, 0.085, hull.sheer(0.085) - 0.026);
    });
    // The oars, shipped: lying on the thwarts, blades forward. One is always a little askew.
    b.with({ ink: 'oars' }, () => {
      const y = hull.sheer(0.5) - 0.014;
      for (const side of [-1, 1]) {
        const skew = (ctx.rand('oar', side) - 0.5) * 0.025;
        const aft: Vec3 = [side * 0.05 + skew, y, hull.z(0.2, y)];
        const neck: Vec3 = [side * 0.036, y + 0.004, hull.z(0.68, y)];
        const tip: Vec3 = [side * 0.026, y + 0.006, hull.z(0.84, y)];
        b.setColor(paint.spar);
        stick(b, aft, neck, 0.018);
        b.setColor(PALETTE.white);
        stick(b, neck, tip, 0.04, 0.012);
      }
    });
    return { mesh: b.build(), animated: true };
  },
});
