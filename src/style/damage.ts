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

/** '#rrggbb' → [r, g, b] 0–255. */
export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
