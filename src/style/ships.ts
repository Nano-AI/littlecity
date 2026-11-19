// The big ships (catalogue L38–L42): sizes, speeds and the rhythm of a visit.
// Lengths are world units (a cell is 1 wide), times are game seconds (a day
// and night is 8 minutes), angles radians. Read by the berth fact, the rules,
// the parts and the harbour system, so they agree by construction.

import { defineStyle } from '@/core/style';

export const SHIPS = defineStyle(
  'ships',
  {
    // ── what a port needs (L38–L40) ──
    /** Galleon: a berth this long, in a port of this many dock cells in all. */
    galleonBerth: 8,
    galleonPort: 12,
    /** Cog: the same. */
    cogBerth: 5,
    cogPort: 6,
    /** Galley: a berth this long and a lighthouse. */
    galleyBerth: 6,
    /** Open water beside a berth, in columns out from the quay face, for its whole length plus one each end. */
    berthWater: 3,
    /** L41: the two docks of a barge's run are at least this far apart by water. */
    bargeReach: 10,

    // ── the hulls: half-breadth used for keeping clear (the drawn beam is in rig.ts) ──
    galleonBeam: 1.5,
    cogBeam: 1.5,
    galleyBeam: 0.95,
    bargeBeam: 1.05,
    /** How far a ship's side lies off the quay face when it is moored. */
    alongside: 0.14,

    // ── under way ──
    /** Columns a second at full sail; a galley under oars; a barge poled. */
    sailSpeed: 1.05,
    rowSpeed: 0.85,
    poleSpeed: 0.4,
    /** Full speed is lost over this many columns before the berth (sails come in on the way). */
    slowing: 7,
    /** How many columns from the edge of the map a ship appears and is gone. */
    edgeIn: 1.4,
    /** Seconds a ship takes to come up over the edge of the map (and to go down over it). */
    rise: 5,
    /** How far a ship heels with its sails full in a fresh breeze. */
    heel: 0.07,
    /** How fast a hull swings round to its course (per second). */
    turn: 0.9,

    // ── a visit ──
    /** Seconds from the berth existing to the first ship appearing on the horizon. */
    firstCall: 18,
    /** Seconds between one ship leaving and the next call (galleon, cog, galley), at least … at most. */
    galleonGapMin: 160,
    galleonGapMax: 280,
    cogGapMin: 70,
    cogGapMax: 140,
    galleyGapMin: 120,
    galleyGapMax: 220,
    /** Seconds at the berth. */
    galleonStay: 75,
    cogStay: 45,
    galleyStay: 50,
    /** Seconds between one sail coming in or going up and the next. */
    sailEvery: 1.4,
    /** Seconds a sail takes to furl or to set. */
    sailTime: 2.2,
    /** Seconds the mooring lines take to warp the ship in the last stretch alongside. */
    warp: 5,
    /** How far out it lies before the lines take it in, in columns. */
    warpGap: 0.38,
    /** Crates and barrels the crew land on each visit, at most. */
    goodsMax: 6,
    /** Seconds the goods stay on the quay after the ship has gone, before they are carted off. */
    goodsLinger: 40,

    // ── L42 passing sails ──
    /** Seconds between tall ships crossing the horizon, at least … at most. */
    passGapMin: 90,
    passGapMax: 200,
    /** Columns a second. */
    passSpeed: 0.75,
  },
  {
    galleonBerth: [5, 12, 1],
    galleonPort: [6, 30, 1],
    cogBerth: [3, 10, 1],
    cogPort: [3, 20, 1],
    galleyBerth: [4, 10, 1],
    berthWater: [2, 5, 1],
    bargeReach: [4, 30, 1],
    galleonBeam: [1, 2, 0.05],
    cogBeam: [1, 2, 0.05],
    galleyBeam: [0.6, 1.4, 0.05],
    bargeBeam: [0.6, 1.4, 0.05],
    alongside: [0.02, 0.4, 0.01],
    sailSpeed: [0.3, 3, 0.05],
    rowSpeed: [0.3, 3, 0.05],
    poleSpeed: [0.1, 1.5, 0.05],
    slowing: [2, 15, 0.5],
    edgeIn: [0.5, 4, 0.1],
    rise: [1, 12, 0.5],
    heel: [0, 0.2, 0.005],
    turn: [0.2, 3, 0.05],
    firstCall: [2, 120, 1],
    galleonGapMin: [10, 600, 5],
    galleonGapMax: [10, 900, 5],
    cogGapMin: [10, 600, 5],
    cogGapMax: [10, 900, 5],
    galleyGapMin: [10, 600, 5],
    galleyGapMax: [10, 900, 5],
    galleonStay: [10, 300, 5],
    cogStay: [10, 300, 5],
    galleyStay: [10, 300, 5],
    sailEvery: [0.2, 5, 0.1],
    sailTime: [0.3, 6, 0.1],
    warp: [1, 15, 0.5],
    warpGap: [0, 1, 0.02],
    goodsMax: [0, 12, 1],
    goodsLinger: [0, 300, 5],
    passGapMin: [10, 600, 5],
    passGapMax: [10, 900, 5],
    passSpeed: [0.2, 3, 0.05],
  },
);
