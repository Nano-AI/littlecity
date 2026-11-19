// The look of the page: ink, pencil, paper and the dusk grade. Owner: Look.
// Every value is live: the gallery sliders change them and the renderer
// reads them each frame.

import { defineStyle } from '@/core/style';

/** Ink lines, pencil hatching and paper grain. */
export const LOOK = defineStyle(
  'look',
  {
    /** Ink line width in CSS pixels at close zoom, and at the far overview. */
    inkWidth: 1.6,
    inkWidthFar: 0.95,
    /** Screen pixels per world unit at which the line reaches each width. */
    inkNearPx: 70,
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
    /** Soft shadow of the floating slab on the paper. */
    slabShadow: 0.16,
    /** Warm halo around lit windows and lamps at night. */
    halo: 0.5,
    /** Wind sway of baked geometry (trees, awnings), world units at full strength. */
    sway: 0.11,
  },
  {
    inkWidth: [0.6, 3, 0.05],
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
    slabShadow: [0, 0.4, 0.01],
    halo: [0, 1, 0.05],
    sway: [0, 0.3, 0.01],
  },
);

/**
 * The colour grade at the four anchors of the dusk cycle. `tint` multiplies
 * the whole drawing (paper included), `lift` is added after it, `ink` is the
 * line colour. Dusk and dawn are the colours at the peak of those stretches;
 * the grade eases between neighbours (src/render/grade.ts).
 */
export const GRADE = defineStyle('grade', {
  dayTint: '#ffffff',
  dayLift: '#000000',
  dayInk: '#3a2f2a',
  duskTint: '#ffcfa8',
  duskLift: '#0d0408',
  duskInk: '#4a2c33',
  nightTint: '#4a5598',
  nightLift: '#06071a',
  nightInk: '#11112c',
  dawnTint: '#e6cfe2',
  dawnLift: '#07050c',
  dawnInk: '#3b2e40',
  /** Lit windows and lamps: the pane colour and its warmer halo. */
  lamp: '#ffd96e',
  lampWarm: '#ffb45e',
  /** Stars and the lighthouse beam. */
  star: '#fff6d8',
});
