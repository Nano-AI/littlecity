// R-M10's obelisk and victory column, drawn by the marble generator in place
// of the stacked blocks (not a part file: the generator calls these in the
// frame of the column's foot, +Y up, the structure's full height `h`).

import { compose, rotationY, scaling, translation } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

/** Two steps and a square pedestal; returns the pedestal's top. */
function base(b: MeshBuilder, stone: ColorInput, ped: number): number {
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'steps' }, () => {
    b.boxAt([0, 0, 0], [0.92, 0.07, 0.92], { skip: ['bottom'] });
    b.boxAt([0, 0.07, 0], [0.74, 0.07, 0.74], { skip: ['bottom'] });
  });
  b.with({ color: stone, pattern: PATTERN.marble, ink: 'pedestal' }, () => b.boxAt([0, 0.14, 0], [0.52, ped, 0.52], { skip: ['bottom', 'top'] }));
  b.with({ color: stone, pattern: PATTERN.none, ink: 'pedestal-cap' }, () => b.boxAt([0, 0.14 + ped, 0], [0.6, 0.06, 0.6], { skip: [] }));
  return 0.2 + ped;
}

/** A tapering obelisk with a gilt pyramidion. */
export function obelisk(b: MeshBuilder, stone: ColorInput, h: number): void {
  const y0 = base(b, stone, 0.32);
  const tip = 0.17, y1 = h - tip;
  const w0 = 0.17, w1 = 0.11;
  b.with({ color: stone, pattern: PATTERN.marble, ink: 'shaft' }, () =>
    b.at(rotationY(Math.PI / 4), () => b.lathe([[w0 * Math.SQRT2, y0], [w1 * Math.SQRT2, y1]], { segments: 4, smooth: false })),
  );
  b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'pyramidion' }, () =>
    b.at(rotationY(Math.PI / 4), () => b.lathe([[w1 * Math.SQRT2, y1], [0, h]], { segments: 4, smooth: false })),
  );
}

/** A fluted column with a capital, and a gilt figure with a raised wreath on top. */
export function victoryColumn(b: MeshBuilder, stone: ColorInput, h: number): void {
  const y0 = base(b, stone, 0.36);
  const fig = 0.34, cap = 0.09, y1 = h - fig - cap;
  b.with({ color: stone, pattern: PATTERN.marble, ink: 'shaft' }, () => b.lathe([[0.14, y0], [0.12, y1]], { segments: 12, smooth: false }));
  b.with({ color: stone, pattern: PATTERN.none, ink: 'capital' }, () => {
    b.lathe([[0.12, y1], [0.17, y1 + cap * 0.6]], { segments: 12 });
    b.boxAt([0, y1 + cap * 0.6, 0], [0.36, cap * 0.4, 0.36]);
  });
  // The figure: a robed body, a head, an arm up with a wreath.
  const yf = y1 + cap;
  b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'statue' }, () => {
    b.lathe([[0.075, yf], [0.06, yf + 0.12], [0.045, yf + 0.22], [0, yf + 0.24]], { segments: 8, capBottom: true });
    b.at(compose(translation(0, yf + 0.27, 0), scaling(0.045)), () => b.lathe([[0, -1], [0.8, -0.6], [1, 0], [0.8, 0.6], [0, 1]], { segments: 8 }));
    b.at(compose(translation(0.05, yf + 0.2, 0), rotationY(0)), () => b.box([-0.012, 0, -0.012], [0.012, 0.13, 0.012]));
    b.at(translation(0.05, yf + 0.34, 0), () => b.lathe([[0.04, -0.008], [0.04, 0.008]], { segments: 8 }));
  });
}
