// Colours (from the spike). Owner: Look (Stage 1) refines these with the art
// guide. Only palette colours appear in the game.

import { defineStyle } from '@/core/style';
import type { StructureKind } from '@/core/kinds';

export const PALETTE = defineStyle('palette', {
  ink: '#3a2f2a',
  paper: '#f2ede3',
  grass: '#b9dc94',
  grassSide: '#a3cf80',
  /** High ground: each terrace above the first leans a step toward this lighter, sunnier green. */
  grassHigh: '#d6eeae',
  dirt: '#dcc39c',
  dirtDark: '#c7a982',
  sand: '#f0e2b6',
  rock: '#c9c0b4',
  path: '#f3e8d0',
  plaza: '#ece3d1',
  garden: '#a9d488',
  sea: '#a7d1f0',
  seaDeep: '#8fc0ea',
  seaSide: '#86b6e0',
  foam: '#f4fbff',
  shallow: '#c3e3f6',
  stone: '#f4eee3',
  stoneShade: '#dfd5c5',
  wood: '#c99764',
  white: '#fdfaf3',
  glass: '#7b96cf',
  leaf: '#9bcd76',
  leafDark: '#6fab62',
  bush: '#88c26b',
  trunk: '#9a6b4a',
  brick: '#d98a6c',
  redDark: '#bb5a4d',
  red: '#e56b58',
  yellow: '#ffd96e',
  pink: '#f4a3bf',
  metal: '#4b4a55',
  marble: '#f8f5ef',
  magic: '#c6b2ff',
});

/** Block.color indexes one of these, depending on KINDS[kind].ramp. Eight entries each. */
export const RAMPS = defineStyle('ramps', {
  wall: ['#f6d77c', '#c6b5e6', '#f5b0a6', '#b0dcc6', '#aacdee', '#faf3e6', '#f3c59a', '#d9e3a4'],
  stone: ['#f4eee3', '#e9e2d6', '#e3ddd6', '#efe6d2', '#dcd9d2', '#f1e9e0', '#e6dccb', '#d9d4cc'],
  wood: ['#c99764', '#b98656', '#d3a674', '#a97a50', '#c08d5e', '#dbb183', '#b48a63', '#9f7248'],
  roof: ['#e47a66', '#6d8ccf', '#eaa65c', '#7cbf9b', '#9a92b8'],
});

const FLAT: Partial<Record<StructureKind, keyof typeof PALETTE>> = {
  lighthouse: 'white',
  windmill: 'white',
  tree: 'leaf',
  fountain: 'shallow',
  stall: 'red',
  fence: 'white',
  path: 'path',
  plaza: 'plaza',
  garden: 'garden',
};
const RAMP_OF: Partial<Record<StructureKind, 'wall' | 'stone' | 'wood'>> = {
  house: 'wall',
  tower: 'stone',
  arch: 'stone',
  marble: 'stone',
  pillar: 'stone',
  stairs: 'stone',
  wall: 'stone',
  dock: 'wood',
};

/** The base colour of a structure kind for a palette index. */
export function rampColor(kind: StructureKind, index: number): string {
  const ramp = RAMP_OF[kind];
  if (ramp) {
    const colors = RAMPS[ramp];
    return colors[((index % colors.length) + colors.length) % colors.length]!;
  }
  return PALETTE[FLAT[kind] ?? 'stone'];
}
