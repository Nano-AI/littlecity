// The playing field (design section 7, "Field"): colours and sizes of the
// courts, and the dials of the games played on them. Read by
// src/gen/floor/field.gen.ts, src/parts/field and src/life/field.

import { defineStyle } from '@/core/style';

/** How the courts look. */
export const COURT = defineStyle('court', {
  /** Hard court (basketball): the surface, the painted key and circle, the run-off round it. */
  hard: '#93c3c3',
  hardKey: '#efb27f',
  hardRunoff: '#7fb0b4',
  /** Clay tennis, its run-off. */
  clay: '#e49a70',
  clayRunoff: '#d88a62',
  /** Grass courts and pitches, the mown stripe, worn ground. */
  grass: '#b2d98a',
  grassStripe: '#a3cf7c',
  worn: '#d9c597',
  /** Bowling green (close-cut), its ditch and bank. */
  green: '#9fd174',
  ditch: '#cdb58b',
  /** Boules gravel, its timber edge. */
  gravel: '#e8d7b2',
  timber: '#b98656',
  /** Running track cinder. */
  track: '#da8765',
  /** Chalk lines. */
  chalk: '#fdfaf3',
  /** Skating rink ice (winter, drawn by life). */
  ice: '#dff1fb',
  /** Width of a chalk line, and how much it wanders off the straight. */
  line: 0.032,
  wobble: 0.007,
  /** How high the court's layers stand on its slab (each a hair above the last). */
  layer: 0.004,
  /** Rounding of the field's outer corners. */
  round: 0.1,
});

/** The games. Seconds, cells, world units. */
export const GAME = defineStyle(
  'game',
  {
    /** How long a game runs, seconds (a few minutes), and the pause before the next on the same court. */
    length: 150,
    lengthVary: 60,
    rest: 40,
    /** How far a player will come to a game (cells from home), and the share of free people who will. */
    reach: 18,
    join: 0.5,
    /** Seconds to wait for players to arrive before starting with whoever has. */
    gather: 45,
    /** Running speed on court, cells per second (a grown-up; children a little less). */
    run: 1.3,
    jog: 0.7,
    /** Ball radii (world units): big enough to see from the playing zoom. */
    basketball: 0.045,
    tennisBall: 0.026,
    football: 0.042,
    bowl: 0.03,
    /** Gravity for the ball, world units per second squared (cartoon slow). */
    gravity: 3.2,
    /** Spectators: the share of passers-by who stop to watch, how many at most. */
    watch: 0.5,
    watchers: 5,
    /** Weather that stops play: rain or snow above this. */
    rain: 0.5,
  },
  {
    length: [30, 400, 5],
    rest: [0, 200, 5],
    join: [0, 1, 0.05],
    run: [0.6, 2.5, 0.05],
    gravity: [1, 10, 0.1],
    basketball: [0.02, 0.1, 0.005],
  },
);
