// The look of the page: ink, pencil, paper and the dusk grade. Owner: Look.
// Every value is live: the gallery sliders change them and the renderer
// reads them each frame.

import { defineStyle } from '@/core/style';

/** Ink lines, pencil hatching and paper grain. */
export const LOOK = defineStyle(
  'look',
  {
    /**
     * Ink line width in CSS pixels. Up close an outline (one thing in front of another) is `inkWidth`
     * and the lines inside a shape (seams, creases) are `inkWidthInner`; at the far overview every
     * line is `inkWidthFar`.
     */
    inkWidth: 1.5,
    inkWidthInner: 0.85,
    inkWidthFar: 0.95,
    /** Screen pixels per world unit at which the line reaches each width. */
    inkNearPx: 110,
    inkFarPx: 18,
    /** How strongly each kind of edge is inked (0–1). Silhouettes are depth jumps. */
    inkSilhouette: 1,
    inkSeam: 0.95,
    inkCrease: 0.8,
    /** Seams and creases fade to this share of their strength at the far overview. */
    inkDetailFar: 0.6,
    /** Depth jump (world units, after removing the surface's own slope) that counts as an edge. */
    inkDepth: 0.07,
    /** Static pen wobble: line position, weight variation and ink density variation. */
    wobble: 1,
    /** Re-roll the wobble twice a second (line boil). 0 or 1. Off by default. */
    boil: 0,
    /** Pencil hatching in shade: strength, and stroke spacing in CSS pixels. */
    hatch: 0.55,
    hatchSpacing: 5.5,
    /** Pencil pattern marks (ticks, courses, shingles): overall strength. */
    pencil: 1,
    /** Paper grain strength. */
    paper: 1,
    /** Grounding: the contact tone, cover shade and short cast shadow that sit pieces on the ground. 0 is off. */
    ground: 0.85,
    /** How much of its blue the sea keeps under a warm dusk tint (0 lets it go grey, 1 keeps its hue). */
    seaKeep: 1.1,
    /** Soft shadow of the floating slab on the paper. */
    slabShadow: 0.16,
    /** Warm halo around lit windows and lamps at night. */
    halo: 0.5,
    /** Wind sway of baked geometry (trees, awnings), world units at full strength. */
    sway: 0.11,
  },
  {
    inkWidth: [0.6, 3, 0.05],
    inkWidthInner: [0.4, 3, 0.05],
    inkWidthFar: [0.4, 2, 0.05],
    inkSilhouette: [0, 1, 0.05],
    inkSeam: [0, 1, 0.05],
    inkCrease: [0, 1, 0.05],
    inkDetailFar: [0, 1, 0.05],
    inkDepth: [0.01, 0.3, 0.01],
    wobble: [0, 2, 0.05],
    boil: [0, 1, 1],
    hatch: [0, 1, 0.05],
    hatchSpacing: [3, 12, 0.5],
    pencil: [0, 1.5, 0.05],
    paper: [0, 2, 0.05],
    ground: [0, 1.5, 0.05],
    seaKeep: [0, 2, 0.05],
    slabShadow: [0, 0.4, 0.01],
    halo: [0, 1, 0.05],
    sway: [0, 0.3, 0.01],
  },
);

/**
 * The colour grade at the four anchors of the dusk cycle (src/render/grade.ts applies it). Per part:
 *
 *   Tint      multiplies faces turned to the light, and the bare paper
 *   Shade     multiplies faces turned away from it (dusk: warm light, cool violet shade)
 *   Lift      is added afterwards
 *   Ink       is the line colour
 *   Chroma    saturation of the drawing BEFORE the tint: above 1 pushes materials apart in hue, so
 *             a strong tint does not turn stone, path and sand into one colour
 *   Contrast  a curve on brightness before the tint: above 1 keeps pale things (stone, white trim)
 *             up and lets mid-tones (grass) drop, so monuments stand off the ground at night
 *   Sat       saturation after the tint
 *   Sea       multiplies the sea alone (night: a step darker than the land)
 *   Slope, Cast   the cast shade: how steeply the light falls (lower is longer), how dark it is
 *
 * Dusk and dawn are the values at the peak of those stretches; the grade eases between neighbours.
 */
export const GRADE = defineStyle(
  'grade',
  {
    dayTint: '#ffffff',
    dayShade: '#ffffff',
    dayLift: '#000000',
    dayInk: '#3a2f2a',
    dayChroma: 1,
    dayContrast: 1,
    daySat: 1,
    daySea: 1,
    daySlope: 1.25,
    dayCast: 0.55,
    duskTint: '#ffe6cc',
    duskShade: '#dcc6e2',
    duskLift: '#0c0409',
    duskInk: '#4a2c33',
    duskChroma: 1.3,
    duskContrast: 1.35,
    duskSat: 1,
    duskSea: 1,
    duskSlope: 0.6,
    duskCast: 0.7,
    nightTint: '#626cab',
    nightShade: '#4a5390',
    nightLift: '#080a1c',
    nightInk: '#11112c',
    nightChroma: 1,
    nightContrast: 2.6,
    /** Night is a little greyer as well as darker: colours rest, lit windows sing. */
    nightSat: 0.72,
    nightSea: 0.74,
    nightSlope: 1.45,
    nightCast: 0.35,
    dawnTint: '#f0dcea',
    dawnShade: '#cfc4e6',
    dawnLift: '#07050c',
    dawnInk: '#3b2e40',
    dawnChroma: 1.15,
    dawnContrast: 1.25,
    dawnSat: 0.94,
    dawnSea: 0.95,
    dawnSlope: 0.65,
    dawnCast: 0.6,
    /** Lit windows and lamps: the pane colour and its warmer halo. */
    lamp: '#ffd96e',
    lampWarm: '#ffb45e',
    /** Stars and the lighthouse beam. */
    star: '#fff6d8',
  },
  Object.fromEntries(
    ['day', 'dusk', 'night', 'dawn'].flatMap((part) => [
      [`${part}Chroma`, [0, 2, 0.01]],
      [`${part}Contrast`, [0.5, 4, 0.05]],
      [`${part}Sat`, [0, 1.5, 0.01]],
      [`${part}Sea`, [0.3, 1.2, 0.01]],
      [`${part}Slope`, [0.3, 3, 0.05]],
      [`${part}Cast`, [0, 1, 0.05]],
    ]),
  ),
);
