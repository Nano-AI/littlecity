// The dusk grade (Look, Stage 1): what the time of day does to the picture.
// Pure, so it is unit-tested without a renderer.
//
// The composite shader multiplies the whole drawing, paper included, by
// `tint`, adds `lift`, and draws lines in `ink`. So night is the same
// drawing on dark blue paper, not a dimmed 3D scene: the line stays the
// darkest thing on the page and the lit windows are the brightest.

import { parseColor } from '@/gen/mesh';
import type { TimeSignal } from '@/life/api';
import { partPhases } from '@/life/signals';
import { GRADE } from '@/style/look';

export type Rgb = [number, number, number];

export interface Grade {
  /** Multiplies every colour (sRGB, 0–1 per channel). */
  tint: Rgb;
  /** Added after the tint. */
  lift: Rgb;
  /** The ink line colour. */
  ink: Rgb;
  /** Colour saturation after the tint: 1 leaves it alone. */
  sat: number;
  /** 0 by day to 1 at night: how lit the windows and lamps are. Leads the darkness a little. */
  glow: number;
  /** 0 by day to 1 in full night: stars. */
  stars: number;
}

const rgb = (hex: string): Rgb => {
  const [r, g, b] = parseColor(hex);
  return [r / 255, g / 255, b / 255];
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

interface Key {
  tint: Rgb;
  lift: Rgb;
  ink: Rgb;
  sat: number;
}
function keys(): Record<'day' | 'dusk' | 'night' | 'dawn', Key> {
  return {
    day: { tint: rgb(GRADE.dayTint), lift: rgb(GRADE.dayLift), ink: rgb(GRADE.dayInk), sat: GRADE.daySat },
    dusk: { tint: rgb(GRADE.duskTint), lift: rgb(GRADE.duskLift), ink: rgb(GRADE.duskInk), sat: GRADE.duskSat },
    night: { tint: rgb(GRADE.nightTint), lift: rgb(GRADE.nightLift), ink: rgb(GRADE.nightInk), sat: GRADE.nightSat },
    dawn: { tint: rgb(GRADE.dawnTint), lift: rgb(GRADE.dawnLift), ink: rgb(GRADE.dawnInk), sat: GRADE.dawnSat },
  };
}
const blend = (a: Key, b: Key, t: number): Key => ({
  tint: mix(a.tint, b.tint, t),
  lift: mix(a.lift, b.lift, t),
  ink: mix(a.ink, b.ink, t),
  sat: a.sat + (b.sat - a.sat) * t,
});

/** Where the peach of dusk and the pink of dawn peak inside their stretch (0–1). */
const DUSK_PEAK = 0.42;
const DAWN_PEAK = 0.6;

/** The grade for a moment of the dusk cycle. */
export function gradeAt(time: TimeSignal): Grade {
  const k = keys();
  const span = partPhases()[time.part];
  const within = Math.min(1, Math.max(0, (time.phase - span.start) / (span.end - span.start)));
  let key: Key;
  if (time.part === 'day') {
    // The last stretch of the day already leans warm, so dusk does not switch on.
    key = blend(k.day, k.dusk, 0.25 * smooth((within - 0.9) / 0.1));
  } else if (time.part === 'dusk') {
    key = within < DUSK_PEAK ? blend(k.day, k.dusk, 0.25 + 0.75 * smooth(within / DUSK_PEAK)) : blend(k.dusk, k.night, smooth((within - DUSK_PEAK) / (1 - DUSK_PEAK)));
  } else if (time.part === 'night') {
    key = k.night;
  } else {
    key = within < DAWN_PEAK ? blend(k.night, k.dawn, smooth(within / DAWN_PEAK)) : blend(k.dawn, k.day, smooth((within - DAWN_PEAK) / (1 - DAWN_PEAK)));
  }
  const dark = 1 - time.light;
  return {
    ...key,
    // Windows come on while there is still colour in the sky and go off late at dawn.
    glow: smooth((dark - 0.3) / 0.45),
    stars: smooth((dark - 0.62) / 0.33),
  };
}
