// Carved terrain steps (J17): the short flight a path climbs a terrace by.
//
// Frame (a feature with cell + dir): origin at the bottom centre of the LOWER
// path cell's face toward the higher one, +Z out of that face (uphill), +X to
// the right. The bank is the plane z = 0; the lower ground is y = 0 and the
// upper ground y = CELL_H. The steps stand in the lower cell, against the
// bank, between two low stone cheeks, and the top tread laps a little onto
// the upper level so the grass lip of the bank is covered.

import { CELL_H } from '@/core/grid';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { FLOOR } from '@/style/ground';
import { PALETTE } from '@/style/palette';

const STEPS = 4;
/** How far the flight reaches into the lower cell. */
const RUN = 0.6;
/** How far the top tread laps onto the upper level. */
const LAP = 0.09;

export default definePart({
  feature: 'terrain-steps',
  build(_item, ctx) {
    const b = ctx.mesh();
    const half = 0.5 - FLOOR.pathMargin - 0.01;
    const tread = RUN / STEPS, rise = CELL_H / STEPS;
    // The treads: one stone mass, so the creases between them are the drawing. Each tread is a little
    // out of true (seeded), as worn steps are.
    b.with({ color: PALETTE.stone, pattern: PATTERN.stone, ink: 'steps' }, () => {
      for (let i = 0; i < STEPS; i++) {
        const z0 = -RUN + i * tread, z1 = i === STEPS - 1 ? LAP : z0 + tread;
        // The top tread sits a hair (0.004) proud of the upper path it laps onto (FLOOR.pathLift):
        // flush, the two traded pixels as the camera moved and their seam flickered (steady ink).
        const top = (i + 1) * rise + (i === STEPS - 1 ? FLOOR.pathLift + 0.004 : (ctx.rand('wear', i) - 0.5) * 0.012);
        // Only what can be seen: the top, the riser (toward −Z), and the two ends.
        b.box([-half, 0, z0], [half, top, z1], { skip: i === STEPS - 1 ? ['bottom'] : ['bottom', 's'] });
      }
    });
    // Proud nosings, all one object.
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'nosing' }, () => {
      for (let i = 0; i < STEPS - 1; i++) {
        const z0 = -RUN + i * tread;
        b.box([-half - 0.015, (i + 1) * rise - 0.02, z0 - 0.02], [half + 0.015, (i + 1) * rise + 0.008, z0 + 0.035]);
      }
    });
    // Cheeks: a low stone block either side, stepping down with the flight.
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'cheeks' }, () => {
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -half - 0.1 : half, x1 = side < 0 ? -half : half + 0.1;
        b.box([x0, 0, -RUN * 0.5], [x1, CELL_H + 0.05, LAP], { skip: ['bottom'] });
        b.box([x0, 0, -RUN - 0.03], [x1, CELL_H * 0.5 + 0.04, -RUN * 0.5], { skip: ['bottom', 's'] });
      }
    });
    return { mesh: b.build() };
  },
});
