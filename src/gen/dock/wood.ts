// The woods of a dock, shared by the dock generator and the dock parts
// (src/parts/ground: ramp, pier head, bollard, piles, crane, goods), so a
// part always matches the deck it stands on.

import { mixColor, type Rgb } from '@/parts/ground/kit';
import { PALETTE, rampColor } from '@/style/palette';

export interface DockColors {
  /** Deck boards: the dock's own stain (Block.color on the wood ramp). */
  deck: Rgb;
  /** The frame under the deck, sills, crane timbers: a step darker. */
  frame: Rgb;
  /** Stilts and posts: dark, wet wood. */
  pile: Rgb;
  /** Sun-bleached boards: ramps, crates, seats. */
  pale: Rgb;
  /** Rope. */
  rope: Rgb;
}

export function dockColors(color: number): DockColors {
  const deck = mixColor(rampColor('dock', color), PALETTE.wood, 0);
  return {
    deck,
    frame: mixColor(deck, PALETTE.trunk, 0.5),
    pile: mixColor(deck, PALETTE.trunk, 0.85),
    pale: mixColor(deck, PALETTE.sand, 0.45),
    rope: mixColor(PALETTE.sand, PALETTE.dirtDark, 0.45),
  };
}
