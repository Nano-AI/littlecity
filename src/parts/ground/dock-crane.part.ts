// J23 on a quay of 8+ cells (R-D01): the harbour crane. A little plank
// wheelhouse with a tiled cap, a heavy boom rising out of it over the water
// on a king post and stay, and a crate hanging on the rope (it swings a
// little in the wind).
//
// Frame: the bottom centre of the dock cell's seaward face, +Z out over the
// water. The deck is at y = CELL_H; the house stands in the seaward half of
// the cell, leaving the way along the shore clear.
//
// Socket 'perch': the tip of the boom.

import { CELL_H } from '@/core/grid';
import { compose, rotationY, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { dockColors } from '@/gen/dock/wood';
import { PATTERN } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import { crate } from './dock-goods.part';
import { tube, vary } from './kit';

export default definePart({
  feature: 'dock-crane',
  build(_item, ctx) {
    const b = ctx.mesh();
    const wood = dockColors(ctx.structure?.color ?? 0);
    const y = CELL_H;
    const hz = -0.34; // the house's centre
    const w = 0.52, wall = 0.44;
    const roofY = y + 0.05 + wall;
    const rise = 0.3;
    // The footing and the wheelhouse.
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'footing' }, () => b.boxAt([0, y, hz], [w + 0.07, 0.05, w + 0.03], { skip: ['bottom'] }));
    b.with({ color: wood.frame, pattern: PATTERN.planks, ink: 'house' }, () => b.boxAt([0, y + 0.05, hz], [w, wall, w - 0.06], { skip: ['bottom', 'top'] }));
    // A dark doorway in one side, so it is a house and not a box.
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'door' }, () => b.boxAt([w / 2 + 0.006, y + 0.05, hz - 0.03], [0.02, 0.3, 0.17], { skip: ['bottom'] }));
    const roof = RAMPS.roof[Math.floor(ctx.rand('roof') * RAMPS.roof.length)]!;
    b.with({ color: roof, pattern: PATTERN.shingles, ink: 'roof' }, () =>
      b.at(compose(translation(0, roofY, hz), rotationY(Math.PI / 4)), () =>
        b.lathe([[(w + 0.14) * Math.SQRT1_2, 0], [0, rise]], { segments: 4, smooth: false, capBottom: true }),
      ),
    );
    // The boom: out of the roof and up over the water. The king post and its stay hold it.
    const reach = 0.56 + ctx.rand('reach') * 0.08;
    const tip: Vec3 = [0, roofY + 0.84 + ctx.rand('tip') * 0.08, reach];
    const heel: Vec3 = [0, roofY + 0.02, hz + 0.04];
    const king: Vec3 = [0, roofY + rise + 0.5, hz];
    b.with({ color: wood.pile, pattern: PATTERN.bark, ink: 'boom' }, () => {
      tube(b, [heel, tip], [0.058, 0.042], { seg: 4, capEnd: true });
      tube(b, [[0, roofY + rise - 0.06, hz], king], 0.042, { seg: 4, capEnd: true });
    });
    b.with({ color: wood.rope, pattern: PATTERN.none, ink: 'stay' }, () => tube(b, [king, [tip[0], tip[1] - 0.02, tip[2] - 0.03]], 0.014, { seg: 4 }));
    // The rope and its load. The top of the rope is fixed; the load swings.
    const drop = 0.6 + ctx.rand('drop') * 0.1;
    const loadTop = tip[1] - drop;
    const swing = (_x: number, yy: number): number => Math.max(0, Math.min(0.4, ((tip[1] - yy) / drop) * 0.4));
    b.with({ color: wood.rope, pattern: PATTERN.none, ink: 'rope', sway: swing }, () => {
      tube(b, [[0, loadTop, reach], [0, tip[1], reach]], 0.014, { seg: 4 });
      // The sling: two ropes from the hook to the crate's edges.
      tube(b, [[-0.09, loadTop - 0.1, reach], [0, loadTop, reach]], 0.012, { seg: 4 });
      tube(b, [[0.09, loadTop - 0.1, reach], [0, loadTop, reach]], 0.012, { seg: 4 });
    });
    b.with({ sway: 0.4 }, () =>
      b.at(compose(translation(0, loadTop - 0.1 - 0.22 * 0.86, reach), rotationY(0.35 + ctx.rand('turn') * 0.5)), () => crate(b, 0.22, vary(wood.pale, ctx.rand('tone')), 'load')),
    );
    return { mesh: b.build(), anchors: { perch: translation(tip[0], tip[1] + 0.04, tip[2]) } };
  },
});
