// The island generator's knobs (design section 6). Owner: Logic.

import { defineStyle } from '@/core/style';

export const ISLAND = defineStyle(
  'island',
  {
    /** Columns of open water kept on every side of the map. */
    border: 5,
    /** How ragged the coastline is. */
    coastNoise: 0.4,
    /** The hill's centre is at least this many columns from the coast (or as far as the island allows). */
    hillInland: 7,
    /** Hill radius range, in columns. */
    hillRadius: [6, 9] as [number, number],
    /** How much steeper the hill's cliff side is than its gentle side. */
    cliffSteepness: 2.4,
    /** Terrace noise above this turns height 1 into height 2. */
    terraceAbove: 0.6,
    /** Starting trees, inclusive range. */
    trees: [6, 14] as [number, number],
    /** Re-rolls before giving up and returning the first attempt. */
    attempts: 40,
  },
  { coastNoise: [0, 1, 0.01], cliffSteepness: [0, 4, 0.1], terraceAbove: [0.3, 0.9, 0.01], hillInland: [3, 10, 1] },
);
