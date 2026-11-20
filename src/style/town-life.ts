// The living town (catalogue L50 and up): the scuffle, errands and chains,
// events. Times are seconds, lengths world units (a cell is 1 wide).

import { defineStyle } from '@/core/style';

/** L50: the street scuffle (a run-time reaction, like L26). */
export const SCUFFLE = defineStyle(
  'scuffle',
  {
    /** Chance that a head-on bump between two walkers who may fight turns into a scuffle; and a squeeze past. */
    chance: 0.3,
    squeeze: 0.5,
    /** Two walkers count as bumping when they meet head on closer than this to each other's line. */
    bumpLat: 0.16,
    /** Seconds the town rests after one scuffle before another may start: least, most (seeded between). */
    restMin: 75,
    restMax: 130,
    /** Seconds of the cloud: least, most. */
    fightMin: 4.2,
    fightMax: 5.8,
    /** Seconds sat dazed with stars, getting up and dusting off, and shaking hands. */
    dazed: 2.4,
    up: 1.1,
    shake: 1.8,
    /** Chance they make it up and go to the inn together (else they stomp off their own ways). */
    makeUp: 0.35,
    /** Watchers: within this many cells, at most this many; the share of them who cheer. */
    watchReach: 3.2,
    watchers: 7,
    cheer: 0.45,
    /** Size of the cloud (radius, height) and how far it rolls along the street either way. */
    cloudR: 0.36,
    cloudH: 0.58,
    roll: 0.22,
    /** Drawings a second of the cloud, its pop-outs and the swearing bubble. */
    drawRate: 12,
    /** Seconds each grawlix stays up in the bubble. */
    swear: 0.42,
    /** Seconds the cloud may roll on while somebody comes to break it up. */
    waitBreak: 16,
    /** How far off (cells) the watchman or a guard notices a scuffle and comes to break it up. */
    responderReach: 12,
  },
  {
    chance: [0, 1, 0.01],
    squeeze: [0, 1, 0.01],
    bumpLat: [0.02, 0.4, 0.01],
    restMin: [0, 600, 5],
    restMax: [0, 900, 5],
    fightMin: [1, 12, 0.1],
    fightMax: [1, 15, 0.1],
    dazed: [0.5, 6, 0.1],
    up: [0.2, 3, 0.1],
    shake: [0.5, 4, 0.1],
    makeUp: [0, 1, 0.01],
    watchReach: [1, 6, 0.1],
    watchers: [0, 16, 1],
    cheer: [0, 1, 0.01],
    cloudR: [0.1, 0.6, 0.01],
    cloudH: [0.2, 1, 0.01],
    roll: [0, 0.5, 0.01],
    drawRate: [4, 30, 1],
    swear: [0.1, 1.5, 0.02],
    waitBreak: [0, 60, 1],
    responderReach: [0, 48, 1],
  },
);

/** L51 and up: the town's chains. */
export const CHAINS = defineStyle(
  'chains',
  {
    /** L51: seconds between the miller's trips (they shuttle while the heap has room); sacks that heap by the bakery door. */
    millGap: 4,
    /** L51: how many carry sacks from the mill (the miller and a helper). */
    millers: 2,
    sacks: 6,
    /** L51: seconds the baker is in baking; seconds between batches; loaves a tray holds. */
    bake: 3.5,
    bakeGap: 4,
    tray: 3,
    /** L51: chance a resident choosing what to do goes for bread when there is some (mornings, and the rest of the day). */
    buyMorning: 0.3,
    buy: 0.14,
    /** L51: the farthest (grid steps) a resident walks for bread. */
    buyReach: 18,
    /** L52: chance a resident choosing what to do goes for water; seconds at the well filling the bucket. */
    water: 0.12,
    fill: 2.6,
    /** L53: seconds the fisher fishes before carrying the catch up; seconds between catches at least; chance a resident goes for fish. */
    fishing: 10,
    fishGap: 14,
    fishBuyMorning: 0.16,
    fishBuy: 0.08,
    /** L58: seconds a carter rests between trips with the cart. */
    cartGap: 3,
    /** L55: seconds the watchman stops at each post of the beat. */
    watchStop: 2.5,
  },
  {
    millGap: [0, 120, 1],
    millers: [1, 2, 1],
    sacks: [1, 8, 1],
    bake: [1, 20, 0.5],
    bakeGap: [0, 120, 1],
    tray: [1, 3, 1],
    buyMorning: [0, 1, 0.01],
    buy: [0, 1, 0.01],
    buyReach: [4, 40, 1],
    water: [0, 1, 0.01],
    fill: [0.5, 8, 0.1],
    fishing: [1, 120, 1],
    fishGap: [0, 300, 1],
    fishBuyMorning: [0, 1, 0.01],
    fishBuy: [0, 1, 0.01],
    watchStop: [0, 10, 0.1],
    cartGap: [0, 60, 1],
  },
);

/** L54: builders and onlookers when a building lands. */
export const BUILD = defineStyle(
  'build',
  {
    /** Seconds between two building jobs at least; jobs going at once at most. */
    gap: 6,
    most: 2,
    /** More than this many pieces landing in five seconds is a paste or a playback: then a job only every floodGap seconds. */
    flood: 10,
    floodGap: 40,
    /** Seconds a job waits for its builders before it lapses. */
    lapse: 25,
    /** The farthest (grid steps) a builder or onlooker comes from. */
    reach: 12,
    /** Seconds of hammering; onlookers for something big, and how long they look. */
    hammer: 4.5,
    watchers: 4,
    look: 7,
  },
  { gap: [0, 60, 1], most: [0, 6, 1], flood: [2, 60, 1], floodGap: [0, 300, 5], lapse: [5, 120, 1], reach: [2, 40, 1], hammer: [1, 15, 0.5], watchers: [0, 10, 1], look: [1, 20, 0.5] },
);

/** L56: market day. */
export const MARKET = defineStyle(
  'market',
  {
    /** Share of days that are market days (the first day the town is seen always is). */
    chance: 0.6,
    /** The phase of the loop at which it packs up (day runs 0–0.56; 0.4 is mid-afternoon). */
    close: 0.4,
    /** Chance a resident choosing what to do goes to buy at the market while it is on, and stops to watch the busker. */
    buy: 0.25,
    watch: 0.12,
    /** The farthest (grid steps) a resident walks to the market. */
    reach: 26,
    /** Seconds a stall stands after closing with nobody to pack it before it folds by itself. */
    abandon: 20,
  },
  { chance: [0, 1, 0.01], close: [0, 0.56, 0.01], buy: [0, 1, 0.01], watch: [0, 1, 0.01], reach: [4, 48, 1], abandon: [0, 120, 1] },
);

/** L57: the wedding. */
export const WEDDING = defineStyle(
  'wedding',
  {
    /** Share of days with a wedding (the first day the town is seen always has one), and how far into the day it may start (phase). */
    chance: 0.7,
    latest: 0.2,
    /** Seconds after the town is first seen that the first day's wedding starts, at least. */
    first: 25,
    /** Guests at most, and the farthest (grid steps) they come from. */
    guests: 8,
    reach: 22,
    /** Seconds the guests gather before the couple comes out regardless; seconds the couple is inside. */
    gather: 40,
    vows: 4,
    /** Seconds on the doorstep (petals, bells) and at the square. */
    step: 3.5,
    square: 14,
  },
  { chance: [0, 1, 0.01], latest: [0, 0.5, 0.01], first: [0, 300, 1], guests: [0, 16, 1], reach: [4, 48, 1], gather: [5, 120, 1], vows: [0, 30, 0.5], step: [0, 10, 0.5], square: [0, 60, 1] },
);

/** L51 and up: what people carry. */
export const LOADS = defineStyle(
  'loads',
  {
    /** How much bigger loads are drawn from the whole-island view than close in (they grow as the camera draws back). */
    far: 1.9,
  },
  { far: [1, 3, 0.05] },
);
