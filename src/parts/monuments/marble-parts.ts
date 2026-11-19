// Things built onto a marble mass by its role rules, each drawn in the
// standard feature frame (origin at the bottom centre of a cell face, +Z out
// of the wall, +X to the viewer's right, +Y up) unless it says otherwise.

import { CELL_H, SEA_Y } from '@/core/grid';
import { translation, type Mat4Like } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { ball, TAU } from './kit';

type Vec3 = [number, number, number];
const H = CELL_H;

/** A statue's pedestal (R-M06), in place of a whole block. Origin: the centre of the cell's floor. */
export function pedestal(b: MeshBuilder, stone: ColorInput): void {
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'base' }, () => {
    b.boxAt([0, 0, 0], [0.92, 0.09, 0.92], { skip: ['bottom'] });
    b.boxAt([0, 0.09, 0], [0.8, 0.06, 0.8], { skip: ['bottom'] });
  });
  b.with({ color: stone, pattern: PATTERN.marble, ink: 'mass' }, () => b.boxAt([0, 0.15, 0], [0.66, H - 0.15 - 0.16, 0.66], { skip: ['bottom', 'top'] }));
  b.with({ color: stone, pattern: PATTERN.none, ink: 'cornice' }, () => {
    b.boxAt([0, H - 0.16, 0], [0.74, 0.05, 0.74], { skip: ['top'] });
    b.boxAt([0, H - 0.11, 0], [0.84, 0.11, 0.84]);
  });
}

/**
 * A pediment and the half of the roof behind it (R-M01). Origin: on the wall
 * face at the level of the top; the gable is `width` cells wide, centred
 * `offset` cells to the right, and the roof runs `depth` cells back.
 */
export function pediment(b: MeshBuilder, stone: ColorInput, roof: ColorInput, width: number, offset: number, depth: number): void {
  const cx = offset, hw = width / 2 + 0.06;
  const rise = Math.min(0.66, 0.16 + 0.2 * width);
  const zf = 0.07, zb = -depth, t = 0.055;
  b.with({ color: stone, pattern: PATTERN.marble, ink: 'pediment' }, () => {
    b.tri([cx - hw + 0.04, 0, 0], [cx + hw - 0.04, 0, 0], [cx, rise - 0.03, 0]);
    // The raking cornice: the roof's front edge.
    b.setPattern(PATTERN.none);
    b.quad([cx - hw, -t, zf], [cx, rise - t, zf], [cx, rise, zf], [cx - hw, 0, zf]);
    b.quad([cx, rise - t, zf], [cx + hw, -t, zf], [cx + hw, 0, zf], [cx, rise, zf]);
    // The eaves' ends, so the roof has thickness seen from the side.
    b.quad([cx - hw, -t, zb], [cx - hw, -t, zf], [cx - hw, 0, zf], [cx - hw, 0, zb]);
    b.quad([cx + hw, -t, zf], [cx + hw, -t, zb], [cx + hw, 0, zb], [cx + hw, 0, zf]);
  });
  b.with({ color: roof, pattern: PATTERN.shingles, ink: 'temple-roof' }, () => {
    b.quad([cx - hw, 0, zf], [cx, rise, zf], [cx, rise, zb], [cx - hw, 0, zb]);
    b.quad([cx + hw, 0, zb], [cx, rise, zb], [cx, rise, zf], [cx + hw, 0, zf]);
  });
  b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'acroterion' }, () => ball(b, cx, rise + 0.045, zf - 0.04, 0.05, 0.06, 8));
}

/** A bollard on the quay's edge and a mooring ring on its face (R-M05). Origin: on the face at the level of the top. */
export function bollard(b: MeshBuilder): Record<string, Mat4Like> {
  b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'bollard' }, () =>
    b.at(translation(0, 0, -0.16), () =>
      b.lathe([[0.075, 0], [0.075, 0.03], [0.05, 0.06], [0.05, 0.15], [0.09, 0.18], [0.09, 0.22], [0.04, 0.26], [0, 0.26]], { segments: 10 }),
    ),
  );
  // The ring: a flat annulus hanging against the wall.
  b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'ring' }, () => {
    const n = 8, r0 = 0.04, r1 = 0.072, y = -0.3, z = 0.012;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      const p = (r: number, a: number): Vec3 => [r * Math.cos(a), y + r * Math.sin(a), z];
      b.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1));
    }
  });
  return { mooring: translation(0, -0.32, 0.06) };
}

/**
 * A narrow stair down a quay face to the water (R-M05). Origin: the bottom
 * centre of the cell face; `cellY` is the cell's level. It runs along the
 * wall, from the quay's top at the viewer's right down to the sea at the left.
 */
export function quayStair(b: MeshBuilder, cellY: number): void {
  const top = H, foot = SEA_Y + 0.07 - cellY * H, under = SEA_Y - 0.25 - cellY * H;
  const drop = top - foot;
  const n = Math.max(2, Math.ceil(drop / 0.15));
  const out = 0.3, run = 0.76 / n;
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'stair' }, () => {
    for (let i = 0; i < n - 1; i++) {
      const x1 = 0.5 - i * run, x0 = x1 - run;
      b.box([x0, under, 0], [x1, top - ((i + 1) * drop) / n, out], { skip: ['bottom', 'n'] });
    }
    // The last step is the landing at the waterline.
    b.box([-0.5, under, 0], [0.5 - (n - 1) * run, foot, out], { skip: ['bottom', 'n'] });
  });
}
