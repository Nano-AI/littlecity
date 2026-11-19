// R-D02: the end of a pier. A plank seat for whoever fishes there, with a
// red bucket beside it, and the place a lamp or a flag stands.
//
// Frame: the bottom centre of the end cell's seaward face, +Z out to sea,
// +X to the right when looking back at the pier from the water. The deck is
// at y = CELL_H.
//
// Sockets (the rule declares them, this part places them):
//   'pier-end'      on the deck in the right-hand corner; +Z out to sea
//   'fishing-spot'  the top of the seat; +Z out to sea (the way the sitter faces)

import { CELL_H } from '@/core/grid';
import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { dockColors } from '@/gen/dock/wood';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

const SEAT_X = -0.19, SEAT_Z = -0.2, SEAT_H = 0.15;

export default definePart({
  feature: 'pier-head',
  build(_item, ctx) {
    const b = ctx.mesh();
    const wood = dockColors(ctx.structure?.color ?? 0);
    const y = CELL_H;
    // The seat: a board on two blocks, set a hair askew.
    b.at(translation(SEAT_X, y, SEAT_Z), () => {
      b.rotateY((ctx.rand('seat') - 0.5) * 0.16);
      b.with({ color: wood.pale, pattern: PATTERN.none, ink: 'seat' }, () => {
        b.boxAt([0, SEAT_H - 0.04, 0], [0.34, 0.04, 0.17]);
        b.boxAt([-0.11, 0, 0], [0.045, SEAT_H - 0.04, 0.13], { skip: ['bottom', 'top'] });
        b.boxAt([0.11, 0, 0], [0.045, SEAT_H - 0.04, 0.13], { skip: ['bottom', 'top'] });
      });
    });
    // The bucket: red enamel, a glint of water in it.
    const bx = 0.07 + ctx.rand('bx') * 0.04, bz = -0.16 - ctx.rand('bz') * 0.06;
    b.at(translation(bx, y, bz), () => {
      b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'bucket' }, () => b.lathe([[0.045, 0], [0.06, 0.1]], { segments: 8 }));
      b.with({ color: PALETTE.shallow, pattern: PATTERN.none, ink: 'bucket' }, () => b.lathe([[0.06, 0.1], [0.05, 0.085], [0, 0.085]], { segments: 8 }));
    });
    return {
      mesh: b.build(),
      anchors: {
        'pier-end': translation(0.31, y, -0.2),
        'fishing-spot': translation(SEAT_X, y + SEAT_H, SEAT_Z),
      },
    };
  },
});
