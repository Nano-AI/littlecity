// Docks and the shoreline (Stage 2, Ground owner): the numbers behind the
// dock generator, its parts and the dock rules (R-D01–R-D04, J23, J28).
// Lengths are world units (a cell is 1 wide, 0.8 tall; the sea is at 0.4).

import { defineStyle } from '@/core/style';

export const DOCK = defineStyle(
  'dock',
  {
    /** Thickness of the deck boards. The deck's top is always exactly one cell high. */
    deckThick: 0.07,
    /** How far the deck overhangs its frame on open sides. */
    over: 0.035,
    /** How far plank ends may stick out past that, each board its own length. */
    ragged: 0.055,
    /** How far the deck tucks into a cliff or a wall beside it. */
    tuck: 0.07,
    /** Height of the frame beam under the deck's edge. */
    beam: 0.13,
    /** Stilts: radius, how far in from the deck's edge they stand, how far a foot may wander. */
    stiltRadius: 0.06,
    stiltInset: 0.035,
    stiltLean: 0.035,
    /** Corner posts rise this far above the deck (plus up to `postVary`). */
    postRise: 0.2,
    postVary: 0.08,
    /** Bracing between stilts on outer edges: thickness (0 = none), and how far along the edge a strut rakes. */
    brace: 0.036,
    braceRun: 0.5,
    /** R-D02: a pier is a straight run of at least this many cells. */
    pierCells: 3,
    /** R-D01: a quay has at least this many cells in a row along the shore; this many cells earn a crane. */
    quayCells: 4,
    craneCells: 8,
    /** R-D03: a boardwalk is at least this long. */
    boardwalkCells: 2,
    /** J23: chance that a bollard has a tyre fender hung under it. */
    fender: 0.4,
    /** J28: chance that a dock of 2+ cells has mooring piles standing off it. */
    piles: 0.7,
  },
  {
    deckThick: [0.04, 0.12, 0.005],
    over: [0, 0.08, 0.005],
    ragged: [0, 0.1, 0.005],
    tuck: [0, 0.12, 0.01],
    beam: [0.05, 0.25, 0.01],
    stiltRadius: [0.03, 0.09, 0.005],
    stiltInset: [0, 0.12, 0.005],
    stiltLean: [0, 0.08, 0.005],
    postRise: [0, 0.4, 0.01],
    postVary: [0, 0.2, 0.01],
    brace: [0, 0.06, 0.002],
    braceRun: [0.2, 1, 0.05],
    pierCells: [2, 8, 1],
    quayCells: [2, 10, 1],
    craneCells: [4, 20, 1],
    boardwalkCells: [1, 6, 1],
    fender: [0, 1, 0.05],
    piles: [0, 1, 0.05],
  },
);
