// Mischief (design section 13b): the colours and numbers of damage, fire,
// blasts and repair. Owner: Mischief.

import { defineStyle } from '@/core/style';

/** Colours of ruin and repair. Pencil-paper versions of soot, char, ash and fresh wood. */
export const DAMAGE_COLORS = defineStyle('damage-colors', {
  /** Burnt wood and blackened plaster. */
  char: '#5e504a',
  /** Deep char: the inside of a burnt-out shell. */
  charDeep: '#4a3f3b',
  /** Soot streaks over windows and doors. */
  soot: '#5f534d',
  /** Ash on the floor of a shell. */
  ash: '#b7aea3',
  /** A dark hole where glass was. */
  hole: '#3f3532',
  /** Plaster dust on everything a blast shook. */
  dust: '#e8dcc6',
  /** Rubble mortar between the chunks. */
  rubble: '#d8ccb6',
  /** The broken face of a wall top. */
  broken: '#cfc2ae',
  /** The inside of a wall broken open (not burnt). */
  inside: '#8d7f74',
  /** Scorched crown of a tree. */
  scorchedLeaf: '#b39a5a',
  /** Scorched ground. */
  scorch: '#8a7a6a',
  /** New timber going up. */
  fresh: '#efd6a8',
  /** A fresh patch of plaster. */
  freshPlaster: '#fbf3e2',
  /** Scaffold poles and planks. */
  scaffold: '#c29361',
  /** The canvas sheet on the scaffold. */
  canvas: '#f1e8d2',
  /** Rope. */
  rope: '#a88a62',
  /** Flames, from the root to the tips, and embers. */
  flameRoot: '#ff7a3c',
  flameMid: '#ffb347',
  flameTip: '#ffe58a',
  ember: '#ff8a4a',
  /** Smoke: a warm grey puff near the fire, paler as it rises. */
  smokeDark: '#8b8079',
  smokePale: '#d9d2ca',
});

/** Numbers for how ruins are drawn. */
export const RUIN = defineStyle(
  'ruin',
  {
    /** Side of the square tiles a broken wall top is cut in (world units). */
    tile: 0.25,
    /** A burnt-out shell's walls stand this many storeys, at least ... */
    shellMin: 0.55,
    /** ... and at most (corners stand a little higher). */
    shellMax: 1.35,
    /** A blasted block's stub, in storeys. */
    stubMin: 0.06,
    stubMax: 0.45,
    /** How thick a broken wall is drawn (its inside face sits this far in). */
    wallThickness: 0.05,
    /** Size of the chunks a blast breaks a building into. */
    chunk: 0.34,
    /** How far rubble spills past the ruin's own cell onto open ground. */
    spill: 0.42,
    /** Height of a rubble heap, in storeys. */
    heap: 0.42,
  },
  {
    tile: [0.125, 0.5, 0.025],
    shellMin: [0.2, 1.5, 0.05],
    shellMax: [0.5, 2.5, 0.05],
    stubMin: [0, 0.5, 0.02],
    stubMax: [0.1, 1, 0.02],
    wallThickness: [0.02, 0.12, 0.01],
    chunk: [0.15, 0.8, 0.02],
    spill: [0, 0.8, 0.02],
    heap: [0.1, 1, 0.02],
  },
);

/** The fire simulation (src/life/mischief/engine.ts). Times in seconds. */
export const FIRE = defineStyle(
  'fire',
  {
    /** How fast a fire takes hold once lit (intensity per second, times the material's catch). */
    growth: 0.32,
    /** Fuel burnt per second at full intensity (a block holds 1). */
    burn: 0.045,
    /** Heat a burning block gives the block above it (per second at full intensity). */
    climb: 0.42,
    /** Heat given to a touching block of the same building. */
    within: 0.3,
    /** Heat given to a block of another building at one cell (falls off to nothing at the reach). */
    across: 0.2,
    /** How far fire reaches between buildings in still air (cells, centre to centre) ... */
    reach: 1.55,
    /** ... and how much farther downwind in a full wind (sparks). */
    windReach: 1.0,
    /** Heat lost per second by anything not burning. */
    cool: 0.06,
    /** Fuel burnt for scorched, half-burnt and burnt out. */
    scorchedAt: 0.12,
    halfAt: 0.48,
    outAt: 0.88,
    /** Rain puts fires out this fast (intensity per second at full rain). */
    rain: 0.35,
  },
  {
    growth: [0.05, 1, 0.01],
    burn: [0.01, 0.2, 0.005],
    climb: [0, 1, 0.01],
    within: [0, 1, 0.01],
    across: [0, 1, 0.01],
    reach: [1, 3, 0.05],
    windReach: [0, 2, 0.05],
    cool: [0, 0.5, 0.01],
    scorchedAt: [0, 1, 0.01],
    halfAt: [0, 1, 0.01],
    outAt: [0, 1, 0.01],
    rain: [0, 2, 0.01],
  },
);

/** Blasts (bombs, and anything else that goes bang). Distances in cells, centre to centre. */
export const BLAST = defineStyle(
  'blast',
  {
    /** A power-1 bomb: rubble within this ... */
    rubble: 0.95,
    /** ... half-wrecked within this ... */
    wreck: 1.6,
    /** ... and cracked, glass out, within this. */
    shake: 2.7,
    /** Stone stands up to a blast: its distances are multiplied by this. */
    stone: 0.7,
    /** Timber within this many cells of a blast may catch fire. */
    ignite: 1.4,
    /** Chance that a timber block in reach catches. */
    igniteChance: 0.35,
    /** Seconds a blast's chunks are in the air before they land as rubble. */
    settle: 1.5,
    /** The fuse, from landing to bang. */
    fuse: 1.8,
  },
  {
    rubble: [0, 3, 0.05],
    wreck: [0, 4, 0.05],
    shake: [0, 6, 0.05],
    stone: [0.1, 1, 0.05],
    ignite: [0, 3, 0.05],
    igniteChance: [0, 1, 0.05],
    settle: [0.5, 4, 0.1],
    fuse: [0.3, 5, 0.1],
  },
);

/** '#rrggbb' → [r, g, b] 0–255. */
export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
