// What a boat is painted (Animation owner). One seeded `look` picks a scheme
// from the palette: white or pastel topsides, a stronger sheer strake, red
// bottom paint showing as a boot stripe, wood inside.

import type { ColorInput } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import type { HullColors } from './hull';

export interface BoatPaint extends HullColors {
  /** The strong colour of this boat: strake, pennant, a sail panel. */
  accent: ColorInput;
  /** Thwarts, decks, oars. */
  seat: ColorInput;
  spar: ColorInput;
}

/** [topsides, strake] by look. Light topsides against the blue sea; the strake carries the colour. */
function schemes(): readonly (readonly [string, string])[] {
  return [
    [PALETTE.white, RAMPS.roof[0]!],
    [PALETTE.white, RAMPS.roof[1]!],
    [RAMPS.wall[0]!, PALETTE.white],
    [PALETTE.white, RAMPS.roof[3]!],
    [RAMPS.wall[2]!, PALETTE.redDark],
    [RAMPS.roof[1]!, PALETTE.white],
    [RAMPS.wall[3]!, PALETTE.white],
    [PALETTE.white, RAMPS.roof[2]!],
  ];
}

export const BOAT_LOOKS = 8;

export function boatPaint(look: number | undefined): BoatPaint {
  const all = schemes();
  const [topsides, strake] = all[Math.abs(Math.round(look ?? 0)) % all.length]!;
  return {
    bottom: PALETTE.redDark,
    topsides,
    strake,
    rail: RAMPS.wood[5]!,
    inside: PALETTE.wood,
    sole: RAMPS.wood[3]!,
    accent: strake === PALETTE.white ? topsides : strake,
    seat: RAMPS.wood[5]!,
    spar: RAMPS.wood[1]!,
  };
}
