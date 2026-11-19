// Birds (catalogue L11–L13, L16). Every number the bird rules, parts and
// behaviours read. Lengths are world units (a cell is 1 wide, 0.8 tall),
// times are seconds, speeds world units a second.

import { defineStyle } from '@/core/style';

export const BIRDS = defineStyle(
  'birds',
  {
    // ── L11 gulls ──
    /** count = clamp(1 + waterfront dock cells ÷ gullPerDock, 1, gullMax). */
    gullPerDock: 4,
    gullMax: 8,
    /** Body length nose to tail, and the length of one wing. */
    gullSize: 0.36,
    gullWing: 0.36,
    /** How far from its home dock cell a gull looks for water to circle over and for a perch. */
    gullReach: 6,
    /** Radius of the circle: the least, and how much more a gull may take. */
    gullRadius: 1.9,
    gullRadiusMore: 1.8,
    gullSpeed: 1.5,
    /** Height above the sea, and above whatever stands under its circle. */
    gullHeight: 1.5,
    gullHeightMore: 1.1,
    gullClear: 0.45,
    /** Seconds on the wing between visits to its perch, and seconds sitting there (each ± a half). */
    gullAloft: 26,
    gullSit: 11,
    /** Seconds to spiral down to the perch and to climb away from it. */
    gullLand: 3.4,
    gullRise: 2.2,

    // ── L12 pigeons ──
    /** flock = clamp(plaza cells ÷ pigeonPerCells, 0, pigeonMax). */
    pigeonPerCells: 3,
    pigeonMax: 12,
    pigeonSize: 0.25,
    pigeonWing: 0.21,
    /** How far from its own spot a pigeon wanders on foot. */
    pigeonRoam: 1.3,
    pigeonWalk: 0.32,
    /** Seconds from the burst until the flock is down again. */
    pigeonSettle: 5,
    /** Height above the square and radius of the wheel the scattered flock flies. */
    pigeonHeight: 1.7,
    pigeonWheel: 1.9,
    pigeonSpeed: 2.9,

    // ── L13 swifts ──
    /** Swifts come once a tower or lighthouse is this tall, or the streets this long. */
    swiftTower: 5,
    swiftStreets: 20,
    /** count = clamp(street length ÷ swiftPerStreet, swiftMin, swiftMax). */
    swiftPerStreet: 8,
    swiftMin: 3,
    swiftMax: 9,
    /** They share out over this many of the tallest structures. */
    swiftRoosts: 3,
    swiftSize: 0.18,
    swiftWing: 0.24,
    swiftSpeed: 3.6,
    /** How much faster at dusk. */
    swiftDusk: 1.35,
    /** Length and width of one figure-eight. */
    swiftLoop: 2.9,
    swiftLoopWide: 1.25,
    /** The share of the swifts that are out by day, at dawn and at night (all of them at dusk). */
    swiftDay: 0.6,
    swiftDawn: 0.8,
    swiftNight: 0.25,

    // ── L16 scatter ──
    /** A landing block puts up every bird within this many cells. */
    scareRadius: 3,
    /** A person walking by puts up pigeons this close. */
    personRadius: 1.1,
    /** Pigeons of the same flock this much further away follow a moment later. */
    scareFollow: 4,
  },
  {
    gullPerDock: [1, 12, 1],
    gullMax: [0, 16, 1],
    gullSize: [0.15, 0.6, 0.01],
    gullWing: [0.1, 0.6, 0.01],
    gullReach: [2, 12, 0.5],
    gullRadius: [1, 5, 0.1],
    gullRadiusMore: [0, 5, 0.1],
    gullSpeed: [0.3, 4, 0.1],
    gullHeight: [0.5, 4, 0.1],
    gullHeightMore: [0, 3, 0.1],
    gullClear: [0, 2, 0.05],
    gullAloft: [4, 90, 1],
    gullSit: [2, 60, 1],
    gullLand: [1, 8, 0.1],
    gullRise: [0.5, 6, 0.1],
    pigeonPerCells: [1, 12, 1],
    pigeonMax: [0, 24, 1],
    pigeonSize: [0.1, 0.4, 0.01],
    pigeonWing: [0.08, 0.4, 0.01],
    pigeonRoam: [0.3, 4, 0.1],
    pigeonWalk: [0.1, 1, 0.02],
    pigeonSettle: [2, 12, 0.5],
    pigeonHeight: [0.6, 4, 0.1],
    pigeonWheel: [0.8, 4, 0.1],
    pigeonSpeed: [1, 6, 0.1],
    swiftTower: [2, 12, 1],
    swiftStreets: [4, 60, 1],
    swiftPerStreet: [2, 20, 1],
    swiftMin: [0, 9, 1],
    swiftMax: [0, 16, 1],
    swiftRoosts: [1, 6, 1],
    swiftSize: [0.08, 0.4, 0.01],
    swiftWing: [0.1, 0.5, 0.01],
    swiftSpeed: [1, 8, 0.1],
    swiftDusk: [1, 2, 0.05],
    swiftLoop: [1.5, 6, 0.1],
    swiftLoopWide: [0.6, 3, 0.05],
    swiftDay: [0, 1, 0.05],
    swiftDawn: [0, 1, 0.05],
    swiftNight: [0, 1, 0.05],
    scareRadius: [0, 8, 0.5],
    personRadius: [0, 4, 0.1],
    scareFollow: [0, 8, 0.5],
  },
);
