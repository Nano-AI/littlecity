// The windmill's cap (Houses owner; split out for L03 by the life-depth
// owner): the boat-shaped hood, the ball on its crown and the windshaft
// stub the sails sit on. Drawn by the windmill generator when it stays
// still, or by the 'mill-cap' actor part (src/parts/actors/mechanisms) when
// life turns it to the wind. The white curb ring under it stays baked.
//
// Frame: the "neck": the top of the tower's body on its axis, +Y up, +Z the
// way the cap faces (out through the windshaft).

import { compose, rotationX, scaling, translation, type Mat4 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { PALETTE, RAMPS } from '@/style/palette';
import type { MeshBuilder } from '../mesh';
import { PATTERN } from '../mesh';

/** The roof colour of a mill's cap, by the mill's seed. */
export const capRoof = (seed: number): string => RAMPS.roof[rand(seed, 'cap') < 0.7 ? 0 : 4]!;

/** Draws the cap in the neck frame (see the header). */
export function millCap(b: MeshBuilder, neck: number, roof: string): void {
  b.with({ color: roof, pattern: PATTERN.shingles, ink: 'cap' }, () => {
    // Longer front to back than side to side, like an upturned boat.
    b.at(compose(translation(0, 0.035, -0.03), scaling(1, 1, 1.22)), () =>
      b.lathe([[neck + 0.05, 0], [neck + 0.02, 0.13], [neck * 0.72, 0.25], [neck * 0.34, 0.33], [0, 0.36]], { segments: 14 }));
  });
  // A ball on the crown.
  b.with({ color: PALETTE.white, ink: 'crown' }, () => b.at(translation(0, 0.4, -0.03), () => b.lathe([[0, -0.045], [0.032, -0.032], [0.045, 0], [0.032, 0.032], [0, 0.045]], { segments: 8 })));
  // The windshaft: a stub out of the cap's face for the sails to sit on.
  b.with({ color: PALETTE.wood, ink: 'shaft' }, () =>
    b.at(compose(translation(0, 0.17, neck + 0.02), rotationX(Math.PI / 2 - 0.1)), () => b.lathe([[0.045, 0], [0.04, 0.16]], { segments: 8, capTop: true })));
}

/** The hub (the 'mill-hub' socket: +Z along the windshaft, tipped up a little) in the neck frame. */
export const hubInNeck = (neck: number): Mat4 => compose(translation(0, 0.17, 0), translation(0, 0, neck + 0.02), rotationX(-0.1), translation(0, 0, 0.17));
