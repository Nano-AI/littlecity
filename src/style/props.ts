// The fountain and the market stall (Stage 2, Ground owner). All lengths are
// world units (a cell is 1 wide, 0.8 tall). Read by src/gen/fountain,
// src/gen/stall and the rules R-F01 and R-S01.

import { defineStyle } from '@/core/style';

export const FOUNTAIN = defineStyle(
  'fountain',
  {
    /** Tiered fountain: outer radius of the big basin and of the upper bowl. */
    basinRadius: 0.44,
    bowlRadius: 0.26,
    /** Height of the big basin's rim, of the upper bowl's rim, and of the finial's tip. */
    basinHeight: 0.24,
    bowlHeight: 0.56,
    height: 0.77,
    /** Water spills from the upper bowl at this many points round its lip (0 = a dry fountain). */
    falls: 5,
    /** Small basin: radius of the octagon and height of its pier. */
    smallRadius: 0.36,
    pierHeight: 0.44,
    /** Well: radius of the stone ring, height of its coping and of the roof's ridge. */
    wellRadius: 0.27,
    wellHeight: 0.34,
    wellRoof: 0.88,
    /** Birdbath: radius of the dish and height of its rim. */
    dishRadius: 0.21,
    dishHeight: 0.47,
    /** R-F01: a fountain with plaza of one square on this many sides counts as standing in it. */
    squareSides: 3,
  },
  {
    basinRadius: [0.3, 0.48, 0.01],
    bowlRadius: [0.15, 0.35, 0.01],
    basinHeight: [0.12, 0.4, 0.01],
    bowlHeight: [0.4, 0.75, 0.01],
    height: [0.6, 1, 0.01],
    falls: [0, 8, 1],
    smallRadius: [0.2, 0.46, 0.01],
    pierHeight: [0.3, 0.7, 0.01],
    wellRadius: [0.18, 0.36, 0.01],
    wellHeight: [0.2, 0.5, 0.01],
    wellRoof: [0.7, 1.1, 0.01],
    dishRadius: [0.12, 0.3, 0.01],
    dishHeight: [0.3, 0.7, 0.01],
    squareSides: [1, 4, 1],
  },
);

export const STALL = defineStyle(
  'stall',
  {
    /**
     * Half the width of the awning. 0.4375 is seven 0.125 stripes, so on a
     * stall that stands square the valance's scallops fall one to a stripe.
     */
    halfWidth: 0.4375,
    /** The awning: where its ridge, front eave and back eave are (z is toward the customer), and how high. */
    ridgeZ: -0.09,
    ridgeY: 0.9,
    frontZ: 0.3,
    frontY: 0.67,
    backZ: -0.43,
    backY: 0.71,
    /** How far the cloth sags between its posts, and how far the scalloped valance hangs. */
    sag: 0.025,
    valance: 0.085,
    /** Wind sway of the valance's free edge (0–1), and of the eave between its posts. */
    sway: 0.6,
    eaveSway: 0.16,
    /** Height of the counter top. */
    counter: 0.375,
    /** How far a stall may be turned off the grid, radians either way. */
    askew: 0.035,
    /** R-S01: a stall this many column steps from a dock, or nearer, sells fish. */
    dockReach: 3,
  },
  {
    halfWidth: [0.3, 0.46, 0.0125],
    ridgeZ: [-0.3, 0.2, 0.01],
    ridgeY: [0.7, 1.1, 0.01],
    frontZ: [0.1, 0.45, 0.01],
    frontY: [0.5, 0.9, 0.01],
    backZ: [-0.46, -0.2, 0.01],
    backY: [0.5, 0.9, 0.01],
    sag: [0, 0.08, 0.005],
    valance: [0, 0.16, 0.005],
    sway: [0, 1, 0.05],
    eaveSway: [0, 0.5, 0.02],
    counter: [0.25, 0.5, 0.005],
    askew: [0, 0.15, 0.005],
    dockReach: [1, 8, 1],
  },
);
