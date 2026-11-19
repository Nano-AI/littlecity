// Boats and the water round them (Stage 3, Animation owner): the numbers
// behind the hull meshes (src/parts/actors/boats), the boat rules (L17, L19,
// L06) and their behaviours (src/life/boats, src/life/water). Lengths are
// world units (a cell is 1 wide, 0.8 tall; the sea is at 0.4), times are
// seconds, angles radians.

import { defineStyle } from '@/core/style';

export const BOATS = defineStyle(
  'boats',
  {
    // ── the three hulls: length overall, beam, mast height above the waterline ──
    rowLength: 0.62,
    rowBeam: 0.27,
    sailLength: 0.95,
    sailBeam: 0.35,
    mast: 1.02,
    fishLength: 1.1,
    fishBeam: 0.44,

    // ── afloat: every boat ──
    /** How far a hull rises and falls, and how far it rolls and pitches, in still air. */
    bob: 0.012,
    roll: 0.045,
    pitch: 0.025,
    /** Seconds for one rise and fall of a rowboat; bigger boats are slower by the square root of their length. */
    bobPeriod: 2.3,
    /** Seconds between the rings a floating hull leaves, and how long each lasts. */
    wakeEvery: 2.8,
    wakeLife: 1.8,

    // ── L17 moored rowboats ──
    /** One rowboat per this many dock cells (and never more than one per mooring). */
    rowPerCells: 3,
    /** A pier or quay shorter than this has none. */
    rowMinCells: 2,
    /** Length of the mooring line, from the mooring to the bow. */
    line: 0.34,
    /** How hard the wind pushes a moored boat, how stiff the line is, and how fast the motion dies. */
    drift: 0.55,
    lineSpring: 26,
    damping: 2.2,
    /** The boat keeps this far off the dock face it is tied to, and this near its own mooring sideways. */
    clear: 0.26,
    swing: 0.42,

    // ── L19 sailboats ──
    /** 1 + lighthouses, never more than this. */
    sailMax: 3,
    /** The lane stays this many columns from land, docks and anything standing in the sea. */
    laneClear: 3,
    /** Columns a boat's middle keeps from the edge of the map. */
    laneEdge: 0.7,
    /** A there-and-back lane is used only if the clear stretch is at least this long, in columns. */
    laneMin: 12,
    /** Columns a second in a fresh breeze on a reach; close to the wind a boat makes `beatSpeed` of that. */
    speed: 1.15,
    beatSpeed: 0.45,
    /** Never slower than this, so a boat is never becalmed in view. */
    speedMin: 0.22,
    /** How fast a hull swings round to follow its lane (per second). */
    turn: 1.6,
    /** How far the hull heels away from the wind at full strength. */
    heel: 0.2,
    /** The boom swings out this far close-hauled and this far on a run. */
    boomIn: 0.2,
    boomOut: 1.25,
    /** Seconds a sail takes to go slack, cross the boat and fill on the other side. */
    tack: 0.55,
    /** The wind must cross the stern or the bow by this much (sine of the angle) before the sail changes sides. */
    tackDead: 0.12,
  },
  {
    rowLength: [0.4, 0.9, 0.01],
    rowBeam: [0.18, 0.4, 0.01],
    sailLength: [0.7, 1.3, 0.01],
    sailBeam: [0.25, 0.5, 0.01],
    mast: [0.7, 1.5, 0.01],
    fishLength: [0.8, 1.5, 0.01],
    fishBeam: [0.3, 0.6, 0.01],
    bob: [0, 0.05, 0.001],
    roll: [0, 0.2, 0.005],
    pitch: [0, 0.1, 0.005],
    bobPeriod: [0.8, 6, 0.1],
    wakeEvery: [0.5, 8, 0.1],
    wakeLife: [0.5, 5, 0.1],
    rowPerCells: [1, 8, 1],
    rowMinCells: [1, 6, 1],
    line: [0.15, 0.8, 0.01],
    drift: [0, 2, 0.05],
    lineSpring: [4, 30, 1],
    damping: [0.5, 6, 0.1],
    clear: [0.15, 0.5, 0.01],
    swing: [0.1, 0.8, 0.01],
    sailMax: [0, 6, 1],
    laneClear: [2, 5, 0.25],
    laneEdge: [0.4, 2, 0.05],
    laneMin: [4, 40, 1],
    speed: [0.2, 4, 0.05],
    beatSpeed: [0.1, 1, 0.05],
    speedMin: [0, 1, 0.02],
    turn: [0.3, 6, 0.1],
    heel: [0, 0.5, 0.01],
    boomIn: [0, 0.6, 0.01],
    boomOut: [0.6, 1.5, 0.01],
    tack: [0.1, 2, 0.05],
    tackDead: [0, 0.5, 0.01],
  },
);
