// How the pointer is read (design section 7, "Actions"). Owner: Interface.
// Distances are CSS pixels, times are milliseconds.

import { defineStyle } from '@/core/style';

export const INPUT = defineStyle(
  'input',
  {
    /** Mouse: press and release within this many pixels is a click; further is a drag. */
    clickSlop: 5,
    /** Touch: a tap stays within this many pixels… */
    tapSlop: 10,
    /** …and lasts at most this long. */
    tapMs: 250,
    /** Touch: holding still this long erases. */
    longPressMs: 450,
    /** Fences and walls: the outer part of a top face, on each side, that means "this edge". */
    edgeStrip: 0.25,
    /** Degrees of orbit per pixel dragged. */
    orbitYaw: 0.4,
    orbitPitch: 0.3,
    /** Zoom per wheel pixel (exponent), for a plain scroll and for a trackpad pinch. */
    wheelZoom: 0.0015,
    pinchZoom: 0.01,
    /** Held length (design section 7): a trackpad scroll of this many pixels is one step of length… */
    lengthScroll: 40,
    /** …and one wheel event this big or bigger is a mouse-wheel notch: always exactly one step. */
    wheelNotch: 50,
    /** The most ✨ markers drawn at once while the Change tool is selected. */
    maxMarkers: 240,
  },
  {
    clickSlop: [1, 20, 1],
    tapSlop: [2, 30, 1],
    tapMs: [100, 600, 10],
    longPressMs: [200, 1000, 10],
    edgeStrip: [0.05, 0.45, 0.01],
    orbitYaw: [0.1, 1, 0.05],
    orbitPitch: [0.1, 1, 0.05],
    wheelZoom: [0.0002, 0.006, 0.0001],
    pinchZoom: [0.002, 0.03, 0.001],
    lengthScroll: [10, 120, 1],
    wheelNotch: [20, 200, 1],
    maxMarkers: [20, 600, 10],
  },
);
