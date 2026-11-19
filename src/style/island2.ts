// The second island generator's knobs (design section 6, "Terrain, second
// generation"). Read by src/terrain/terrain2.ts. Shares are weights: they need
// not add up to 100.

import { defineStyle } from '@/core/style';

export const ISLAND2 = defineStyle(
  'island2',
  {
    /** How often each character is rolled: gentle, hilly, steep, archipelago or lagoon. */
    characters: [45, 30, 15, 10] as [number, number, number, number],
    /** How often an island has no river, one, or two. */
    rivers: [20, 60, 20] as [number, number, number],
    /** Of the islands with rivers, how often a river runs right across, coast to coast (splitting the land). */
    throughShare: 0.4,
    /** Share of rivers two columns wide (the rest are one wide, two at the bends). */
    wideShare: 0.45,
    /** Chance a river that ends inland ends in a round pool. */
    poolChance: 0.55,
    /** Chance a river has a small island in it. */
    riverIslandChance: 0.3,
    /** How hard rivers wind: the largest swing of the heading from the straight line, radians. */
    meander: 0.95,
    /** Columns of river per meander, range. */
    meanderLength: [6, 10] as [number, number],
    /** Ground lower than this is cut down into a valley by a river; higher ground makes a gorge. */
    gorgeAbove: 3.5,
    /** Columns of open water kept on every side of the map. */
    border: 5,
    /** Smallest flat low ground: columns at height 1 or 2 inside flat 3 × 3 patches. */
    flatMin: 60,
    /** Fewest sand columns on the sea shore. */
    beachMin: 8,
    /** Highest ground on a steep island, range. */
    steepPeak: [8, 10] as [number, number],
    /** Rock starts this many levels below the summit of a steep island (noise decides the edge). */
    rockBelowPeak: 2,
    /** A rim this many levels above the next column over is a cliff top and goes to rock. */
    rockRimDrop: 4,
    /** Starting trees, inclusive range. */
    trees: [6, 14] as [number, number],
    /** Re-rolls (same character and rivers) before easing the rivers, and in all. */
    attempts: 30,
  },
  {
    throughShare: [0, 1, 0.05],
    wideShare: [0, 1, 0.05],
    poolChance: [0, 1, 0.05],
    riverIslandChance: [0, 1, 0.05],
    meander: [0, 1.3, 0.05],
    gorgeAbove: [1.5, 8, 0.5],
    rockBelowPeak: [1, 6, 1],
    rockRimDrop: [2, 6, 1],
  },
);
