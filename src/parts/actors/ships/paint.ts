// What a big ship is painted (L38–L41). One seeded `look` picks a livery
// from the palette: a dark wooden hull, its upper works in a strong colour
// with a contrasting wale and rail, sails cream with (sometimes) an emblem,
// flags in the livery's colours, and a figurehead. Two visits are rarely the
// same ship.

import { rand } from '@/core/rand';
import type { ColorInput } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import type { ShipColors } from './hull';

export interface ShipPaint extends ShipColors {
  /** Gun ports, the castle's door. */
  port: ColorInput;
  /** Window frames, the carved trim of the stern. */
  trim: ColorInput;
  spar: ColorInput;
  rope: ColorInput;
  /** The flags' colours: field, charge. */
  flag: readonly [ColorInput, ColorInput];
  /** Sails: the cloth, and the emblem or stripe colour; and which emblem (0 none, 1 cross, 2 stripes, 3 a band). */
  cloth: ColorInput;
  emblem: ColorInput;
  mark: number;
  /** 0 a gilt lion, 1 a white lady, 2 a red dragon, 3 a blue bird. */
  figurehead: number;
}

/** Liveries: [upper works, wale and rail]. */
function liveries(): readonly (readonly [string, string])[] {
  return [
    [RAMPS.roof[0]!, PALETTE.yellow],
    [RAMPS.roof[1]!, PALETTE.yellow],
    [RAMPS.roof[3]!, PALETTE.yellow],
    [PALETTE.redDark, PALETTE.white],
    [RAMPS.roof[1]!, PALETTE.white],
    [RAMPS.roof[4]!, PALETTE.yellow],
  ];
}

export function shipPaint(look: number | undefined, kind = 'galleon'): ShipPaint {
  const l = Math.abs(Math.round(look ?? 0));
  const r = (what: string): number => rand(l, 'ship-paint', kind, what);
  const all = liveries();
  const [upper, wale] = all[l % all.length]!;
  const marks = kind === 'cog' || kind === 'galley' ? [2, 2, 3, 0] : [1, 0, 1, 3];
  const emblems = [PALETTE.red, RAMPS.roof[1]!, PALETTE.redDark, RAMPS.roof[0]!];
  return {
    bottom: PALETTE.redDark,
    boot: RAMPS.wood[7]!,
    hull: r('wood') < 0.5 ? RAMPS.wood[3]! : RAMPS.wood[7]!,
    upper,
    wale,
    rail: wale === PALETTE.white ? RAMPS.wood[5]! : PALETTE.yellow,
    deck: RAMPS.wood[5]!,
    bulkhead: wale === PALETTE.white ? PALETTE.white : RAMPS.wall[5]!,
    port: PALETTE.metal,
    trim: wale,
    spar: RAMPS.wood[1]!,
    rope: RAMPS.wood[7]!,
    flag: [upper, wale === PALETTE.white ? PALETTE.white : PALETTE.yellow],
    cloth: PALETTE.white,
    emblem: emblems[Math.floor(r('emblem') * emblems.length)]!,
    mark: marks[Math.floor(r('mark') * marks.length)]!,
    figurehead: Math.floor(r('figurehead') * 4),
  };
}
