// Scenes of town life (L63 and up): the beach day and the small seasonal
// events, and the shared cadence that spreads them over a town. Owner: the
// living town. Every number here is in life seconds or cells.

import { defineStyle } from '@/core/style';

/** The shared cadence (src/life/town/scenes.ts): how many big scenes at once, how far apart they start. */
export const SCENES = defineStyle(
  'scenes',
  {
    /** Big scenes (the wedding, a beach day, a fair...) going on at once in a town, at most. */
    most: 2,
    /** Seconds between the starts of any two big scenes, at least (so they do not all begin together). */
    gap: 40,
    /** Seconds between two notes in the corner (no nagging), at least. */
    noteGap: 100,
  },
  { most: [1, 6, 1], gap: [0, 300, 5], noteGap: [0, 600, 10] },
);

/** L63: a beach day in summer. */
export const BEACH = defineStyle(
  'beach',
  {
    /** Seconds after the town is first seen (in summer, fair, by day) that the first beach day may start, at least, and up to `firstSpread` more. */
    first: 15,
    firstSpread: 20,
    /** Seconds from the end of one beach day at a beach to the next there, at least, and up to `everySpread` more. */
    every: 60,
    everySpread: 60,
    /** Seconds the families stay once they are set up, at least, and up to `staySpread` more. */
    stay: 150,
    staySpread: 60,
    /** With the time of day running: seconds of day that must be left to start one, and the seconds left at which they pack up. */
    needs: 140,
    packAt: 30,
    /** Pitches (parasols) on one beach at most, and the share of the town's people who may be on the beaches at once. */
    pitches: 7,
    share: 0.3,
    /** Grid steps from home to the beach, at most. */
    reach: 40,
    /** Seconds over which the families are called (they come in ones and twos). */
    call: 30,
    /** Rain that sends everybody running home with towels over their heads; and the most cloud for a beach day to start. */
    rain: 0.15,
    cloud: 0.8,
    /** Summer's weight in the season for a beach day to start. */
    summer: 0.5,
    /** Seconds a sandcastle stands after its builder has gone, at least (and up to as long again), before the sea takes it; rain that washes it down sooner. */
    castle: 240,
    castleRain: 0.3,
    /** Seconds a swimmer is out (there and back), and how far out they go (cells). */
    swim: 22,
    swimOut: 2.2,
    /** Seconds of one thing (lying, reading, paddling...) before somebody changes to another, at least, and up to as long again. */
    act: 22,
  },
  {
    first: [0, 300, 1], firstSpread: [0, 120, 1], every: [0, 900, 5], everySpread: [0, 600, 5], stay: [20, 900, 5], staySpread: [0, 600, 5],
    needs: [0, 270, 5], packAt: [0, 120, 1], pitches: [1, 12, 1], share: [0.05, 1, 0.05], reach: [6, 80, 1], call: [0, 120, 1],
    rain: [0, 1, 0.01], cloud: [0, 1, 0.05], summer: [0, 1, 0.05], castle: [10, 900, 10], castleRain: [0, 1, 0.05], swim: [6, 60, 1], swimOut: [0.5, 5, 0.1], act: [4, 120, 1],
  },
);

/** L63: the colours of the beach (parasols, chairs, towels, bathing costumes). */
export const BEACH_COLOURS = {
  /** Parasols and deckchairs: striped with white. */
  canvas: ['#e56b58', '#5b86d6', '#f2b53a', '#3fa58a', '#e47ab0', '#8a6fd1'] as readonly string[],
  /** Towels: bright, laid flat on the sand. */
  towels: ['#f08a5d', '#68b5e8', '#f4d35e', '#b8e07a', '#f497c0', '#fdfaf3'] as readonly string[],
  /** Bathing costumes: strong colours with white bands. */
  costumes: ['#d9473c', '#2f5ea8', '#1f7a6a', '#c43f7f', '#2b2f4a', '#e08a2e'] as readonly string[],
  /** Sun hats. */
  hats: ['#f4e2a8', '#fdfaf3', '#f6c9a0', '#e9d48c'] as readonly string[],
  hatBands: ['#e56b58', '#5b86d6', '#3fa58a', '#2b2f4a'] as readonly string[],
  /** The sandcastle: damp sand, darker than the beach. */
  castle: '#dcc283',
  castleDark: '#cfb06e',
  flag: '#e56b58',
  ball: ['#e5503f', '#fdfaf3', '#3d7fd6', '#f6c63e'] as readonly string[],
  pail: ['#e5503f', '#3d7fd6', '#f6c63e', '#3fa58a'] as readonly string[],
  book: ['#b0413e', '#2f5ea8', '#3c7a4e'] as readonly string[],
};

/** L64: a snow day. */
export const SNOW_DAY = defineStyle(
  'snow-day',
  {
    /** Settled snow for a snow day to start, and below which a snowman starts to melt. */
    cover: 0.5,
    melt: 0.3,
    /** Seconds after snow has settled that the first may start (and up to `firstSpread` more); from the end of one to the next. */
    first: 15,
    firstSpread: 20,
    every: 150,
    everySpread: 90,
    /** Players at most, and how far from home (grid steps) they come. */
    players: 8,
    reach: 30,
    /** Seconds: gathering at most, building the snowman, the snowball fight. */
    gather: 40,
    build: 34,
    fight: 40,
    /** Seconds between throws from a side, and a snowball's flight. */
    throwEvery: 0.8,
    flight: 0.85,
    /** Seconds a snowman stands melting before it is gone. */
    melting: 40,
  },
  {
    cover: [0, 1, 0.05], melt: [0, 1, 0.05], first: [0, 300, 1], firstSpread: [0, 120, 1], every: [0, 900, 5], everySpread: [0, 600, 5],
    players: [3, 16, 1], reach: [6, 60, 1], gather: [5, 120, 1], build: [5, 120, 1], fight: [5, 120, 1], throwEvery: [0.2, 5, 0.1], flight: [0.3, 3, 0.05], melting: [5, 300, 5],
  },
);

export const SNOW_COLOURS = {
  snow: '#fbfdff',
  carrot: '#f08a3a',
  scarves: ['#d9473c', '#2f5ea8', '#3fa58a', '#e3b04b'] as readonly string[],
};

/** L65: a harvest supper on the square. */
export const SUPPER = defineStyle(
  'supper',
  {
    /** Autumn's weight in the season for a supper. */
    autumn: 0.5,
    /** With the time of day running: it starts with this many seconds of day left, so it goes on into dusk under the lanterns. */
    startLeft: 110,
    /** With the time held: seconds after the town is seen for the first, and from the end of one to the next. */
    first: 40,
    every: 300,
    everySpread: 120,
    /** Table cells (each seats four), and the share of the town at table at most. */
    tables: 4,
    share: 0.4,
    reach: 32,
    /** Seconds: to set up at most, at table, the toast (from sitting down). */
    setup: 60,
    supper: 75,
    toast: 40,
  },
  { autumn: [0, 1, 0.05], startLeft: [20, 270, 5], first: [0, 300, 1], every: [30, 1800, 10], everySpread: [0, 600, 10], tables: [2, 6, 1], share: [0.05, 1, 0.05], reach: [6, 60, 1], setup: [10, 200, 5], supper: [10, 300, 5], toast: [5, 200, 5] },
);

export const SUPPER_COLOURS = {
  cloth: '#fbf8f2',
  runner: '#d9873a',
  lanterns: ['#ffcf6b', '#f08a5d', '#ffe39a', '#e56b58'] as readonly string[],
};

/** L66: a picnic on the grass in spring. */
export const PICNIC = defineStyle(
  'picnic',
  {
    /** Spring's weight in the season for a picnic (and in summer too where the town has no beach). */
    spring: 0.5,
    /** Seconds after the town is seen for the first, and from the end of one to the next. */
    first: 30,
    every: 120,
    everySpread: 100,
    /** Blankets at most, and how far from home (grid steps). */
    blankets: 4,
    reach: 30,
    /** Seconds on the grass once the blanket is down (and up to `staySpread` more). */
    stay: 110,
    staySpread: 50,
  },
  { spring: [0, 1, 0.05], first: [0, 300, 1], every: [0, 900, 5], everySpread: [0, 600, 5], blankets: [1, 8, 1], reach: [6, 60, 1], stay: [10, 600, 5], staySpread: [0, 300, 5] },
);

export const PICNIC_COLOURS = {
  checks: ['#d9473c', '#2f5ea8', '#3fa58a', '#e3a02b'] as readonly string[],
  mid: ['#f2a49b', '#a9bde3', '#a7d8c6', '#f2d29b'] as readonly string[],
  pie: '#d9a25a',
};
