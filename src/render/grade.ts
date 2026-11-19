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
  /** Multiplies faces turned to the light, and the bare paper (sRGB, 0–1 per channel). */
  tint: Rgb;
  /** Multiplies faces turned away from the light. */
  shade: Rgb;
  /** Saturation before the tint (keeps materials apart in hue under a strong tint). */
  chroma: number;
  /** A curve on brightness before the tint: above 1 keeps pale things up and drops mid-tones. */
  contrast: number;
  /** Multiplies the sea alone. */
  sea: number;
  /** Added after the tint. */
  lift: Rgb;
  /** The ink line colour. */
  ink: Rgb;
  /** Colour saturation after the tint: 1 leaves it alone. */
  sat: number;
  /** Cast shadows: how steeply the light falls (the tangent of its height), and how dark they are. */
  slope: number;
  cast: number;
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
  shade: Rgb;
  chroma: number;
  contrast: number;
  sea: number;
  lift: Rgb;
  ink: Rgb;
  sat: number;
  slope: number;
  cast: number;
}
function keys(): Record<'day' | 'dusk' | 'night' | 'dawn', Key> {
  return {
    day: { tint: rgb(GRADE.dayTint), shade: rgb(GRADE.dayShade), chroma: GRADE.dayChroma, contrast: GRADE.dayContrast, sea: GRADE.daySea, lift: rgb(GRADE.dayLift), ink: rgb(GRADE.dayInk), sat: GRADE.daySat, slope: GRADE.daySlope, cast: GRADE.dayCast },
    dusk: { tint: rgb(GRADE.duskTint), shade: rgb(GRADE.duskShade), chroma: GRADE.duskChroma, contrast: GRADE.duskContrast, sea: GRADE.duskSea, lift: rgb(GRADE.duskLift), ink: rgb(GRADE.duskInk), sat: GRADE.duskSat, slope: GRADE.duskSlope, cast: GRADE.duskCast },
    night: { tint: rgb(GRADE.nightTint), shade: rgb(GRADE.nightShade), chroma: GRADE.nightChroma, contrast: GRADE.nightContrast, sea: GRADE.nightSea, lift: rgb(GRADE.nightLift), ink: rgb(GRADE.nightInk), sat: GRADE.nightSat, slope: GRADE.nightSlope, cast: GRADE.nightCast },
    dawn: { tint: rgb(GRADE.dawnTint), shade: rgb(GRADE.dawnShade), chroma: GRADE.dawnChroma, contrast: GRADE.dawnContrast, sea: GRADE.dawnSea, lift: rgb(GRADE.dawnLift), ink: rgb(GRADE.dawnInk), sat: GRADE.dawnSat, slope: GRADE.dawnSlope, cast: GRADE.dawnCast },
  };
}
const blend = (a: Key, b: Key, t: number): Key => ({
  tint: mix(a.tint, b.tint, t),
  shade: mix(a.shade, b.shade, t),
  chroma: a.chroma + (b.chroma - a.chroma) * t,
  contrast: a.contrast + (b.contrast - a.contrast) * t,
  sea: a.sea + (b.sea - a.sea) * t,
  lift: mix(a.lift, b.lift, t),
  ink: mix(a.ink, b.ink, t),
  sat: a.sat + (b.sat - a.sat) * t,
  slope: a.slope + (b.slope - a.slope) * t,
  cast: a.cast + (b.cast - a.cast) * t,
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

const lum = (c: Rgb): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/**
 * What the grade does to one colour of the drawing (sRGB in, sRGB out). `facing` is the cosine
 * between the surface and the light: 1 for the paper and for faces square to the light. This is the
 * composite shader's arithmetic (shaders/composite.ts), kept here so it can be tested and reasoned
 * about without a GPU; change both together.
 */
export function gradeColor(c: Rgb, g: Grade, facing = 1): Rgb {
  let l = lum(c);
  let out: Rgb = [l + (c[0] - l) * g.chroma, l + (c[1] - l) * g.chroma, l + (c[2] - l) * g.chroma];
  const k = Math.max(lum(out), 1e-3) ** (g.contrast - 1);
  const lit = smooth((facing + 0.15) / 0.5);
  const tint = mix(g.shade, g.tint, lit);
  out = [out[0] * k * tint[0], out[1] * k * tint[1], out[2] * k * tint[2]];
  l = lum(out);
  return [l + (out[0] - l) * g.sat + g.lift[0], l + (out[1] - l) * g.sat + g.lift[1], l + (out[2] - l) * g.sat + g.lift[2]];
}
