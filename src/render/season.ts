// What the season and the weather do to the page (design section 13a), worked out once a frame from
// the two signals. Pure, so it is unit-tested without a renderer.
//
//   seasonFrame   the numbers the surface shader's season code reads (shaders/season.ts), and
//                 whether any of it is on (summer under a clear sky: off, and the picture is
//                 exactly what it always was)
//   seasonGrade   the grade, adjusted: cooler in winter, warmer in autumn, greyer and softer under
//                 cloud and rain, a flash of lightning
//   paperOf       the colour of the paper the island floats on

import { parseColor } from '@/gen/mesh';
import type { SeasonSignal, WeatherSignal } from '@/life/season';
import { PALETTE } from '@/style/palette';
import { SEASON_LOOK } from '@/style/season';
import type { Grade, Rgb } from './grade';

export interface SeasonFrame {
  /** False in summer under a clear sky: nothing seasonal is drawn at all. */
  on: boolean;
  /** Weights of spring, summer, autumn and winter. */
  season: [number, number, number, number];
  /** Trees: turn, bare, blossom, and the cold. */
  trees: [number, number, number, number];
  /** Settled snow, thaw, falling snow, ice on still water. */
  snow: [number, number, number, number];
  /** Wet, falling rain, cloud, frost on grass. */
  wet: [number, number, number, number];
  fog: number;
  flash: number;
}

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export function seasonFrame(season: SeasonSignal, weather: WeatherSignal): SeasonFrame {
  const w = season.weights;
  const ice = w.winter * smooth((season.cold - 0.6) / 0.3);
  const frost = w.winter * SEASON_LOOK.frostMix * (1 - 0.5 * weather.cover);
  const f: SeasonFrame = {
    on: false,
    season: [w.spring, w.summer, w.autumn, w.winter],
    trees: [season.turn, season.bare, season.blossom, season.cold],
    snow: [weather.cover, weather.thaw, weather.snow, ice],
    wet: [weather.wet, weather.rain, weather.cloud, frost],
    fog: weather.fog,
    flash: weather.flash,
  };
  f.on = w.summer < 1 || season.turn > 0 || season.bare > 0 || season.blossom > 0 || [...f.snow, ...f.wet, f.fog, f.flash].some((v) => v > 0);
  return f;
}

const scale = (a: Rgb, k: Rgb | number): Rgb => (typeof k === 'number' ? [a[0] * k, a[1] * k, a[2] * k] : [a[0] * k[0], a[1] * k[1], a[2] * k[2]]);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** The grade with the season and the weather in it. The same object back when nothing is on. */
export function seasonGrade(g: Grade, f: SeasonFrame): Grade {
  if (!f.on) return g;
  const [spring, , autumn, winter] = f.season;
  const [wet, rain, cloud] = f.wet;
  // Winter light is cool and a little paler; autumn's is warm; spring's a touch brighter in colour.
  let tint = scale(g.tint, lerp3([1, 1, 1], [0.965, 0.985, 1.03], winter));
  tint = scale(tint, lerp3([1, 1, 1], [1.025, 1.0, 0.945], autumn));
  // Under cloud and rain the page is greyer and the light flatter.
  tint = scale(tint, 1 - 0.07 * cloud - 0.06 * rain);
  const shade = scale(g.shade, lerp3([1, 1, 1], [0.96, 0.98, 1.04], winter));
  const sat = g.sat * (1 + 0.05 * spring - 0.1 * winter - 0.28 * cloud);
  const chroma = g.chroma * (1 + 0.07 * autumn);
  const cast = g.cast * (1 - 0.75 * cloud);
  const lift = lerp3(g.lift, [g.lift[0] + 0.035, g.lift[1] + 0.035, g.lift[2] + 0.045], cloud * 0.6 + wet * 0.1);
  // Lightning: the whole page jumps toward white for a moment.
  const flash = f.flash;
  return {
    ...g,
    tint: lerp3(tint, [1.25, 1.25, 1.32], flash * 0.6),
    shade: lerp3(shade, [1.1, 1.1, 1.2], flash * 0.6),
    lift: lerp3(lift, [0.12, 0.12, 0.16], flash),
    sat,
    chroma,
    cast,
  };
}

/** The paper (sRGB, 0 to 1): cooler and paler in winter, warmer in autumn, grey under a heavy sky. */
export function paperOf(f: SeasonFrame): Rgb {
  const rgb = (hex: string): Rgb => {
    const [r, g, b] = parseColor(hex);
    return [r / 255, g / 255, b / 255];
  };
  let p = rgb(PALETTE.paper);
  if (!f.on) return p;
  const [, , autumn, winter] = f.season;
  p = lerp3(p, rgb(SEASON_LOOK.paperAutumn), autumn);
  p = lerp3(p, rgb(SEASON_LOOK.paperWinter), winter);
  return lerp3(p, rgb(SEASON_LOOK.paperGrey), Math.min(1, f.wet[2] * 0.6 + f.wet[1] * 0.4));
}
