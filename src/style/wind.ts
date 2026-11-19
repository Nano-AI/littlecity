// The wind (design section 13). Owner: Look. Read by src/life/signals.ts.

import { defineStyle } from '@/core/style';

export const WIND = defineStyle(
  'wind',
  {
    /** Base strength: the mean, and how far it breathes either side. */
    base: 0.28,
    breath: 0.12,
    /** How far the direction wanders from the prevailing bearing, in radians. */
    wander: 0.7,
    /** Seconds between gusts (each is jittered by up to a third of this). */
    gustEvery: 11,
    /** How fast a gust front crosses the map, in columns per second. */
    gustSpeed: 9,
    /** Peak strength a gust adds. */
    gustPeak: 0.6,
    /** Length of the sharp leading edge and of the tail behind the front, in columns. */
    gustLead: 2.5,
    gustTail: 10,
  },
  {
    base: [0, 1, 0.01],
    breath: [0, 0.5, 0.01],
    wander: [0, 3.14, 0.05],
    gustEvery: [3, 40, 0.5],
    gustSpeed: [2, 30, 0.5],
    gustPeak: [0, 1, 0.05],
    gustLead: [0.5, 8, 0.5],
    gustTail: [2, 30, 0.5],
  },
);
