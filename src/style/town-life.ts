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
  },
);

/** L51 and up: the town's chains. */
export const CHAINS = defineStyle(
  'chains',
  {
    /** L51: seconds between the miller's trips; sacks that fit by the bakery door. */
    millGap: 18,
    sacks: 4,
    /** L51: seconds the baker is in baking; seconds between batches; loaves a tray holds. */
    bake: 5,
    bakeGap: 10,
    tray: 3,
    /** L51: chance a resident choosing what to do goes for bread when there is some (mornings, and the rest of the day). */
    buyMorning: 0.3,
    buy: 0.14,
    /** L51: the farthest (grid steps) a resident walks for bread. */
    buyReach: 18,
    /** L52: chance a resident choosing what to do goes for water; seconds at the well filling the bucket. */
    water: 0.1,
    fill: 2.6,
  },
  {
    millGap: [0, 120, 1],
    sacks: [1, 8, 1],
    bake: [1, 20, 0.5],
    bakeGap: [0, 120, 1],
    tray: [1, 3, 1],
    buyMorning: [0, 1, 0.01],
    buy: [0, 1, 0.01],
    buyReach: [4, 40, 1],
    water: [0, 1, 0.01],
    fill: [0.5, 8, 0.1],
  },
);
