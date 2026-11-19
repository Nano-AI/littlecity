// Fences, walls, railings and stairs (Stage 2, Ground owner). All lengths
// are world units (a cell is 1 wide, 0.8 tall). Read by src/gen/{fence,wall,
// stairs}, src/parts/ground/{runs,edge-draw,railing.part} and the rules
// R-E01, R-E02, J18, J19, J20.

import { defineStyle } from '@/core/style';

/** Fences and railings in their four styles (R-E01). */
export const FENCE = defineStyle(
  'fence',
  {
    /** Height of a picket, and how much each differs from the next (seeded). */
    height: 0.36,
    uneven: 0.025,
    /** Pickets: width, and how many to a cell. */
    picket: 0.09,
    perCell: 5,
    /** Posts: width and height. Gate posts are this much taller. */
    post: 0.1,
    postHeight: 0.44,
    gatePost: 0.08,
    /** A post in this share of cases leans a little. */
    leanChance: 0.3,
    lean: 0.05,
    /** Half the width of a gate's opening (a path is 0.7 wide). */
    gateHalf: 0.36,
    /** How far a free end of a cell piece stops short of the cell's edge. */
    endInset: 0.08,
    /** How far a run goes into the structure it ends against. */
    butt: 0.1,
    /** Edge railings (J19) stand this far inside the edge of the drop. */
    railInset: 0.07,
    /** J19, J18: a railing guards a drop of at least this many levels. */
    drop: 2,
    /** How far a rope sags between two posts. */
    sag: 0.07,
  },
  {
    height: [0.2, 0.6, 0.01],
    uneven: [0, 0.08, 0.005],
    picket: [0.04, 0.12, 0.005],
    perCell: [3, 8, 1],
    post: [0.06, 0.16, 0.01],
    postHeight: [0.3, 0.7, 0.01],
    gatePost: [0, 0.3, 0.01],
    leanChance: [0, 1, 0.05],
    lean: [0, 0.15, 0.005],
    gateHalf: [0.25, 0.45, 0.01],
    endInset: [0, 0.2, 0.01],
    butt: [0, 0.2, 0.01],
    railInset: [0, 0.15, 0.01],
    drop: [1, 4, 1],
    sag: [0, 0.15, 0.005],
  },
);

/** Walls in their three styles (R-E02). */
export const WALL = defineStyle(
  'wall',
  {
    /** The low wall: thickness, height, coping. */
    thick: 0.26,
    height: 0.3,
    coping: 0.05,
    /** Its piers at corners and ends: width and height. */
    pier: 0.36,
    pierHeight: 0.5,
    /** The garden wall is a little higher and has no blocks on top. */
    gardenHeight: 0.36,
    /** The curtain wall: thickness of the body and of the wall-walk on top, and the parapet's height. */
    curtainThick: 0.3,
    curtainWalk: 0.44,
    parapet: 0.17,
    /** Its corner turrets: width, and how far they rise above the wall. */
    turret: 0.52,
    turretRise: 0.2,
    /** The arched opening: half its width, and the height its arch springs from, in a low wall and in a curtain wall. */
    archHalf: 0.3,
    archSpring: 0.36,
    curtainSpring: 0.26,
    /** R-E02: the chance that a garden wall carries creepers. */
    creepers: 0.4,
  },
  {
    thick: [0.15, 0.4, 0.01],
    height: [0.2, 0.6, 0.01],
    coping: [0.02, 0.1, 0.005],
    pier: [0.25, 0.5, 0.01],
    pierHeight: [0.3, 0.9, 0.01],
    gardenHeight: [0.2, 0.6, 0.01],
    curtainThick: [0.2, 0.45, 0.01],
    curtainWalk: [0.3, 0.6, 0.01],
    parapet: [0.08, 0.3, 0.01],
    turret: [0.4, 0.7, 0.01],
    turretRise: [0, 0.5, 0.01],
    archHalf: [0.2, 0.36, 0.01],
    archSpring: [0.2, 0.5, 0.01],
    curtainSpring: [0.15, 0.4, 0.01],
    creepers: [0, 1, 0.05],
  },
);

/** Stairs (J18). */
export const STAIRS = defineStyle(
  'stairs',
  {
    /** Steps in one cell. */
    steps: 4,
    /** How far an open side stands in from the cell edge, and the width of the cheek wall on it. */
    inset: 0.05,
    cheek: 0.09,
    /** How far the cheek wall stands above the line of the step noses. */
    cheekRise: 0.06,
    /** The tread slab: thickness and how far it stands proud of the riser. */
    nosing: 0.03,
    proud: 0.02,
    /** How far the treads run into a wall or a bank beside the flight (a house wall stands 0.07 inside its cell). */
    into: 0.075,
    /** Treads differ in height by up to this much either way, and this share of them is worn a tone darker. */
    uneven: 0.01,
    worn: 0.17,
    /** A landing every this many cells of a flight, and its depth. */
    landingEvery: 3,
    landing: 0.4,
    /** Newel posts: width, and height above the cheek wall. */
    newel: 0.14,
    newelRise: 0.14,
    /** Handrails are this share of a fence's height. */
    rail: 0.8,
  },
  {
    steps: [3, 6, 1],
    inset: [0, 0.15, 0.01],
    cheek: [0.05, 0.16, 0.01],
    cheekRise: [0, 0.2, 0.01],
    nosing: [0.01, 0.06, 0.005],
    proud: [0, 0.03, 0.002],
    into: [0, 0.12, 0.005],
    uneven: [0, 0.03, 0.002],
    worn: [0, 0.5, 0.01],
    landingEvery: [2, 6, 1],
    landing: [0.25, 0.55, 0.01],
    newel: [0.08, 0.2, 0.01],
    newelRise: [0, 0.3, 0.01],
    rail: [0.5, 1.2, 0.05],
  },
);
