// J23: a mooring point on the open edge of a dock.
//   'post'  a stout wooden post wound with rope (jetties and piers)
//   'iron'  a cast-iron mushroom bollard (quays)
// With `fender` a tyre hangs on the frame below it, on a rope over the edge.
//
// Frame: the bottom centre of the dock cell's face, +Z out over the water.
// The deck is at y = CELL_H, the sea at y = SEA_Y.
//
// Socket 'mooring': on the water just off the edge, +Z out (a boat ties up here).

import { CELL_H, SEA_Y } from '@/core/grid';
import { compose, rotationX, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { dockColors } from '@/gen/dock/wood';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { DOCK } from '@/style/dock';
import { PALETTE } from '@/style/palette';
import { tube } from './kit';

/** A ring (a tyre, a coil of rope) lying flat about the Y axis: `R` to the middle of the tube, `r` the tube. */
export function ring(b: MeshBuilder, R: number, r: number, around = 8, section = 4): void {
  const profile: [number, number][] = [];
  // From the bottom, up the outside, back down the inside.
  for (let i = 0; i <= section; i++) {
    const a = -Math.PI / 2 + (i / section) * Math.PI * 2;
    profile.push([R + r * Math.cos(a), r * Math.sin(a)]);
  }
  b.lathe(profile, { segments: around });
}

export default definePart({
  feature: 'bollard',
  build(item, ctx) {
    const b = ctx.mesh();
    const wood = dockColors(ctx.structure?.color ?? 0);
    const y = CELL_H;
    const x = (ctx.rand('x') - 0.5) * 0.3;
    const z = -0.15;
    if (item.variant === 'iron') {
      b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'bollard' }, () =>
        b.at(translation(x, y, z), () =>
          b.lathe([[0.075, 0], [0.075, 0.025], [0.045, 0.04], [0.04, 0.12], [0.075, 0.145], [0.075, 0.175], [0.04, 0.2], [0, 0.2]], { segments: 10 }),
        ),
      );
    } else {
      b.at(translation(x, y, z), () => {
        // A stout round post, cut off square, with a coil of rope dropped over it.
        const lean = (ctx.rand('lean') - 0.5) * 0.03;
        b.with({ color: wood.pile, pattern: PATTERN.bark, ink: 'bollard' }, () => tube(b, [[0, 0, 0], [lean, 0.18, 0]], [0.056, 0.05], { seg: 8, capEnd: true }));
        b.with({ color: wood.rope, pattern: PATTERN.none, ink: 'coil' }, () => {
          b.at(translation(0, 0.026, 0), () => ring(b, 0.085, 0.026));
          b.at(translation(lean * 0.4, 0.074, 0), () => ring(b, 0.062, 0.022));
        });
      });
    }
    if (item.params?.fender) {
      const fy = y - DOCK.deckThick - DOCK.beam * 0.75, fz = DOCK.over + 0.012;
      const fx = x + (ctx.rand('fx') - 0.5) * 0.1;
      b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'fender' }, () =>
        b.at(compose(translation(fx, fy, fz), rotationX(Math.PI / 2)), () => ring(b, 0.07, 0.032, 10, 5)),
      );
      b.with({ color: wood.rope, pattern: PATTERN.none, ink: 'fender-rope' }, () => {
        tube(b, [[fx, y + 0.012, -0.05], [fx, y + 0.012, fz + 0.01]], 0.014, { seg: 4, capStart: true });
        tube(b, [[fx, y + 0.02, fz + 0.01], [fx, fy + 0.07, fz + 0.01]], 0.014, { seg: 4 });
      });
    }
    return { mesh: b.build(), anchors: { mooring: translation(x, SEA_Y, 0.2) } };
  },
});
