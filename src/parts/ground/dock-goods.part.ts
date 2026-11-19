// J23 on a quay (R-D01): goods waiting on the deck, stacked along the side
// the feature names (the shore side).
//   'crates'   two crates and a third on top, askew
//   'barrels'  two barrels and a crate
//
// Frame: the bottom centre of the dock cell's face on that side, +Z out of
// the dock. The deck is at y = CELL_H; the stack stands just inside the edge.

import { CELL_H } from '@/core/grid';
import { compose, rotationY, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { dockColors } from '@/gen/dock/wood';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { mixColor, vary, type Rgb } from './kit';

/** A slatted crate standing on the builder's origin: a box with a darker lid rim. */
export function crate(b: MeshBuilder, size: number, color: Rgb, ink: string): void {
  const rim = mixColor(color, PALETTE.trunk, 0.45);
  b.with({ color, pattern: PATTERN.planks, ink }, () => b.boxAt([0, 0, 0], [size, size * 0.86, size], { skip: ['bottom'] }));
  // Battens at the top and bottom of each side: colour bands on the crate's own surface, a little proud.
  b.with({ color: rim, pattern: PATTERN.none, ink }, () => {
    b.boxAt([0, size * 0.86 - 0.04, 0], [size + 0.025, 0.04, size + 0.025], { skip: ['top', 'bottom'] });
    b.boxAt([0, 0, 0], [size + 0.025, 0.04, size + 0.025], { skip: ['bottom'] });
  });
}

/** A barrel standing on the builder's origin: staves with two dark hoops. */
export function barrel(b: MeshBuilder, r: number, h: number, color: Rgb, ink: string): void {
  const bulge = r * 1.2;
  const stave = (y0: number, r0: number, y1: number, r1: number, c: Rgb | string): void => {
    b.with({ color: c, pattern: PATTERN.none, ink }, () => b.lathe([[r0, y0], [r1, y1]], { segments: 10 }));
  };
  const at = (t: number): number => r + (bulge - r) * Math.sin(t * Math.PI);
  const cuts = [0, 0.2, 0.3, 0.7, 0.8, 1];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i]!, t1 = cuts[i + 1]!;
    stave(t0 * h, at(t0), t1 * h, at(t1), i % 2 === 1 ? PALETTE.metal : color);
  }
  b.with({ color: mixColor(color, PALETTE.trunk, 0.3), pattern: PATTERN.none, ink }, () => b.lathe([[r, h], [r * 0.9, h - 0.015], [0, h - 0.015]], { segments: 10 }));
}

export default definePart({
  feature: 'dock-goods',
  build(item, ctx) {
    const b = ctx.mesh();
    const wood = dockColors(ctx.structure?.color ?? 0);
    const y = CELL_H;
    const tone = (k: string): Rgb => vary(wood.pale, ctx.rand(k), 1.2);
    const put = (x: number, yy: number, z: number, turn: number, fn: () => void): void => {
      b.at(compose(translation(x, y + yy, z), rotationY(turn)), fn);
    };
    const j = (k: string, amount: number): number => (ctx.rand(k) - 0.5) * 2 * amount;
    if (item.variant === 'barrels') {
      put(-0.2 + j('ax', 0.03), 0, -0.22, 0, () => barrel(b, 0.09, 0.27, tone('a'), 'a'));
      put(0.02 + j('bx', 0.03), 0, -0.2, 0, () => barrel(b, 0.085, 0.25, tone('b'), 'b'));
      put(0.26, 0, -0.22, j('ct', 0.3), () => crate(b, 0.2, tone('c'), 'c'));
    } else {
      put(-0.19, 0, -0.22, j('at', 0.12), () => crate(b, 0.24, tone('a'), 'a'));
      put(0.1, 0, -0.21, j('bt', 0.12), () => crate(b, 0.22, tone('b'), 'b'));
      put(-0.06 + j('cx', 0.04), 0.24 * 0.86, -0.22, 0.3 + j('ct', 0.3), () => crate(b, 0.19, tone('c'), 'c'));
      // A sack slumped against the pile.
      b.with({ color: mixColor(PALETTE.sand, PALETTE.dirt, 0.4), pattern: PATTERN.cloth, ink: 'sack' }, () =>
        b.at(translation(0.33, y, -0.19), () => b.lathe([[0.075, 0], [0.085, 0.07], [0.06, 0.14], [0.03, 0.17], [0, 0.17]], { segments: 8 })),
      );
    }
    return { mesh: b.build() };
  },
});
