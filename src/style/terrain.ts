// The shape of the ground (design section 6, "Look"). Owner: Look. Read by
// src/gen/terrain. All lengths are world units (a cell is 1 wide, 0.8 tall).

import { defineStyle } from '@/core/style';
import { PALETTE } from './palette';

export const TERRAIN = defineStyle(
  'terrain',
  {
    /** Corner radius of terrace outlines. 0.5 turns a one-cell step into an S-curve. */
    radius: 0.5,
    /** Each corner's radius is smaller than `radius` by up to this much (seeded). */
    radiusVary: 0.1,
    /** Radius where something stands on the corner cell, so nothing overhangs a rounded edge. */
    radiusBuilt: 0.1,
    /** How far outline points wander from the grid (seeded, smooth). */
    wobble: 0.045,
    /** How far each terrace above the first leans toward PALETTE.grassHigh (0 keeps one green everywhere). */
    levelTint: 0.34,
    /** Height of the grass lip that caps an earth bank or a cliff. */
    turf: 0.12,
    /** How far a ledge juts out partway up a rock face of two levels or more (0 for none). */
    ledge: 0.17,
    /** How far the grass lip overhangs. */
    turfOut: 0.025,
    /** How far the foot of a bank stands out from its top: beach, earth, rock. */
    beachRun: 0.3,
    earthRun: 0.06,
    rockRun: 0.0,
    /** The same at the waterline, where every shore gets a foot. */
    shoreRun: 0.1,
    /** A grass bank one level above the water (a river bank) slopes in this far. */
    bankRun: 0.34,
    /** Bare rock on a terrace top (summits, ridges, gorge rims): paler and cooler than a cliff face, so tops read as tops. */
    rockTop: '#d9d0c0',
    /** Rock turns this mossy green near grass, and grass this dry olive near rock: the soft border between them. */
    rockMoss: '#c3c99e',
    grassDry: '#c6d29a',
    /** How far the rock border wanders off the grid, and how many tufts of grass hold on in the rock (0 for none). */
    rockWander: 0.6,
    rockTufts: 0.22,
    /** Stones of scree at the foot of a rock face this many levels tall or more (where its top is rock). */
    screeDrop: 3,
    /** The floating slab: corner radius, the sea's thickness, and the earth under it. */
    slabRadius: 3,
    seaDepth: 0.52,
    earthDepth: 0.95,
  },
  {
    radius: [0.1, 0.5, 0.01],
    radiusVary: [0, 0.3, 0.01],
    radiusBuilt: [0.02, 0.5, 0.01],
    wobble: [0, 0.12, 0.005],
    levelTint: [0, 1, 0.02],
    turf: [0, 0.3, 0.01],
    ledge: [0, 0.3, 0.01],
    turfOut: [0, 0.08, 0.005],
    beachRun: [0, 0.45, 0.01],
    earthRun: [0, 0.2, 0.01],
    rockRun: [0, 0.2, 0.01],
    shoreRun: [0, 0.3, 0.01],
    bankRun: [0, 0.45, 0.01],
    rockWander: [0, 1.2, 0.02],
    rockTufts: [0, 0.6, 0.01],
    screeDrop: [2, 8, 1],
    slabRadius: [0.5, 4, 0.1],
    seaDepth: [0.1, 1.5, 0.02],
    earthDepth: [0.2, 2, 0.05],
  },
);

/**
 * The grass colour of the terrain at a level (1 is the lowest land): each terrace above the first
 * leans a step toward PALETTE.grassHigh, so plateaus read from every side. A lawn or garden piece
 * that should melt into the ground it lies on uses this instead of PALETTE.grass.
 */
export function terraceGrass(level: number): [number, number, number] {
  const rgb = (hex: string): [number, number, number] => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = rgb(PALETTE.grass), b = rgb(PALETTE.grassHigh);
  const t = Math.min(1, Math.max(0, level - 1) * TERRAIN.levelTint);
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}
