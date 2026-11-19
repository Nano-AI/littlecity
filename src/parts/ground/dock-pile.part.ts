// J28: mooring piles standing in the water off a dock: a tall one with a
// white-painted top and a shorter one leaning against it, lashed together
// with rope. Gulls like them.
//
// Frame: the bottom centre of the dock cell's face, +Z out over the water.
// The sea is at y = SEA_Y; the piles run on down under it.
//
// Socket 'perch': the top of the tall pile.

import { CELL_H, SEA_Y } from '@/core/grid';
import { translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { dockColors } from '@/gen/dock/wood';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { tube } from './kit';

export default definePart({
  feature: 'dock-pile',
  build(_item, ctx) {
    const b = ctx.mesh();
    const wood = dockColors(ctx.structure?.color ?? 0);
    const x = (ctx.rand('x') - 0.5) * 0.2;
    const z = 0.5 + ctx.rand('z') * 0.14;
    const foot = SEA_Y - 0.3;
    const top = CELL_H + 0.2 + ctx.rand('h') * 0.12;
    const lean = (ctx.rand('lean') - 0.5) * 0.08;
    const side = ctx.rand('side') < 0.5 ? -1 : 1;
    // The short one starts a hand's width off and leans in to meet the tall one.
    const sx = x + side * 0.16, sTop = CELL_H - 0.06 + ctx.rand('h2') * 0.1;
    const tall: Vec3[] = [[x + lean, foot, z], [x, top - 0.09, z]];
    b.with({ color: wood.pile, pattern: PATTERN.bark, ink: 'piles' }, () => {
      tube(b, tall, 0.07, { seg: 8 });
      tube(b, [[sx + side * 0.06, foot, z + 0.03], [x + side * 0.115, sTop, z + 0.01]], 0.058, { seg: 7, capEnd: true });
    });
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'piles' }, () => tube(b, [[x, top - 0.09, z], [x, top, z]], 0.07, { seg: 8, capEnd: true }));
    // The lashing: turns of rope round the tall pile where the short one leans on it.
    const ry = sTop - 0.2;
    b.with({ color: wood.rope, pattern: PATTERN.none, ink: 'lashing' }, () =>
      b.at(translation(x, 0, z), () => b.lathe([[0.072, ry], [0.094, ry + 0.012], [0.094, ry + 0.075], [0.072, ry + 0.087]], { segments: 8 })),
    );
    return { mesh: b.build(), anchors: { perch: translation(x, top, z) } };
  },
});
