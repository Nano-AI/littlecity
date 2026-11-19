// The shape of the ground (design section 6, "Look"). Owner: Look. Read by
// src/gen/terrain. All lengths are world units (a cell is 1 wide, 0.8 tall).

import { defineStyle } from '@/core/style';

export const TERRAIN = defineStyle(
  'terrain',
  {
    /** Corner radius of terrace outlines. 0.5 turns a one-cell step into an S-curve. */
    radius: 0.5,
    /** Each corner's radius is smaller than `radius` by up to this much (seeded). */
    radiusVary: 0.1,
    /** Radius where something stands on the corner cell, so nothing overhangs a rounded edge. */
    radiusBuilt: 0.1,
    /** How far outline points wander from the grid (seeded, smooth). */
    wobble: 0.045,
    /** How far each terrace above the first leans toward PALETTE.grassHigh (0 keeps one green everywhere). */
    levelTint: 0.34,
    /** Height of the grass lip that caps an earth bank or a cliff. */
    turf: 0.12,
    /** How far it overhangs. */
    turfOut: 0.025,
    /** How far the foot of a bank stands out from its top: beach, earth, rock. */
    beachRun: 0.3,
    earthRun: 0.06,
    rockRun: 0.0,
    /** The same at the waterline, where every shore gets a foot. */
    shoreRun: 0.1,
    /** The floating slab: corner radius, the sea's thickness, and the earth under it. */
    slabRadius: 3,
    seaDepth: 0.52,
    earthDepth: 0.95,
  },
  {
    radius: [0.1, 0.5, 0.01],
    radiusVary: [0, 0.3, 0.01],
    radiusBuilt: [0.02, 0.5, 0.01],
    wobble: [0, 0.12, 0.005],
    levelTint: [0, 1, 0.02],
    turf: [0, 0.3, 0.01],
    turfOut: [0, 0.08, 0.005],
    beachRun: [0, 0.45, 0.01],
    earthRun: [0, 0.2, 0.01],
    rockRun: [0, 0.2, 0.01],
    shoreRun: [0, 0.3, 0.01],
    slabRadius: [0.5, 4, 0.1],
    seaDepth: [0.1, 1.5, 0.02],
    earthDepth: [0.2, 2, 0.05],
  },
);
