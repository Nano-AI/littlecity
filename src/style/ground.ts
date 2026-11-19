// Ground-level pieces (Stage 2, Ground owner): the numbers behind trees,
// floors, fences, walls, docks, stairs, the fountain and the stall. All
// lengths are world units (a cell is 1 wide, 0.8 tall). Read by src/gen/
// {tree,floor,fence,wall,dock,stairs,fountain,stall} and src/parts/ground.

import { defineStyle } from '@/core/style';

/** Plants. */
export const TREE = defineStyle(
  'tree',
  {
    /** Overall size of every tree. */
    scale: 1.3,
    /** How far a tree may stand from the centre of its cell. */
    jitter: 0.12,
    /** Lean of a trunk, radians either way. */
    lean: 0.07,
    /** Crown lumps beyond the core (the scalloped outline). */
    lumps: 2,
    /** How much darker-green the shaded leaf masses are (0 = tone only). */
    shadeMix: 0.22,
    /** Wind sway at the top of a crown (0–1). */
    sway: 0.9,
    /** Chance of a small companion (a bush, a tuft) at the foot of a plain tree. */
    companion: 0.55,
    /** The default mix when no other species applies: round, cypress, the rest bush. */
    mixRound: 0.5,
    mixCypress: 0.28,
    /** R-P01: a grove is this many touching trees. */
    grove: 5,
    /** R-P01: pines grow from this terrain level up. */
    pineLevel: 4,
  },
  {
    scale: [0.6, 1.8, 0.02],
    jitter: [0, 0.25, 0.01],
    lean: [0, 0.2, 0.01],
    lumps: [1, 5, 1],
    shadeMix: [0, 0.6, 0.02],
    sway: [0, 1, 0.05],
    companion: [0, 1, 0.05],
    mixRound: [0, 1, 0.02],
    mixCypress: [0, 1, 0.02],
    grove: [2, 12, 1],
    pineLevel: [1, 6, 1],
  },
);

/** Paths, plazas and gardens. */
export const FLOOR = defineStyle(
  'floor',
  {
    /** How far a path stands in from the cell edge (its width is 1 − 2 × this). */
    pathMargin: 0.15,
    /** Radius of a path's rounded end and outer corners. */
    pathRound: 0.3,
    /** Radius of the fillet in a path's inner corners. */
    pathFillet: 0.12,
    /** How far a path's edge wanders (seeded, smooth). */
    pathWobble: 0.03,
    /** Height of a path, a plaza and a garden bed above the top they lie on. */
    pathLift: 0.012,
    plazaLift: 0.03,
    gardenLift: 0.02,
    /** Chance of a clump of grass, a stone or flowers beside each closed side of a path cell. */
    verge: 0.3,
    /** The margin of a path where it widens at a door. */
    doorMargin: 0.04,
    /** Width of the kerb where a path meets a plaza. */
    kerb: 0.07,
    /** Width of a plaza's border course (J22). */
    plazaBorder: 0.14,
    /** Rounded outer corners of a plaza and of a garden. */
    plazaRound: 0.06,
    gardenRound: 0.16,
    /** Height and thickness of a park hedge. */
    hedgeHeight: 0.2,
    hedgeWidth: 0.16,
    /** R-G01: a park lawn has at least this many cells; a wheat field this many, within this many steps of a windmill. */
    parkCells: 9,
    wheatCells: 4,
    wheatReach: 2,
    /** J22: a plaza containing a square this big gets the centre motif. */
    motifSquare: 5,
  },
  {
    pathMargin: [0.05, 0.3, 0.01],
    pathRound: [0, 0.35, 0.01],
    pathFillet: [0, 0.3, 0.01],
    pathWobble: [0, 0.08, 0.005],
    pathLift: [0.004, 0.04, 0.002],
    plazaLift: [0.004, 0.06, 0.002],
    gardenLift: [0.004, 0.06, 0.002],
    verge: [0, 1, 0.05],
    doorMargin: [0, 0.15, 0.01],
    kerb: [0.03, 0.15, 0.01],
    plazaBorder: [0.05, 0.3, 0.01],
    plazaRound: [0, 0.3, 0.01],
    gardenRound: [0, 0.4, 0.01],
    hedgeHeight: [0.1, 0.4, 0.01],
    hedgeWidth: [0.08, 0.3, 0.01],
    parkCells: [4, 25, 1],
    wheatCells: [1, 12, 1],
    wheatReach: [1, 5, 1],
    motifSquare: [3, 9, 1],
  },
);
