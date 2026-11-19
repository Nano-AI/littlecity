// LOOK FIXTURE. Hand-made islands for the look scenarios. This is NOT the
// terrain generator (that is Logic's, src/terrain); it is a quick sketch
// that always has what the terrain mesh must draw well: a beach, flat
// ground at heights 1 and 2, a hill reaching 4 or more with a cliff on one
// side, and a cove.

import { SIZE_X, SIZE_Z } from '@/core/grid';
import { rand } from '@/core/rand';
import type { TerrainBuilder } from '@/scenario';

function noise(seed: number, x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = rand(seed, ix, iz), b = rand(seed, ix + 1, iz), c = rand(seed, ix, iz + 1), d = rand(seed, ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export interface IslandSketch {
  /** Where the hill, the cove and the middle of the flat ground ended up (columns). */
  hill: [number, number];
  cove: [number, number];
  centre: [number, number];
}

export function sketchIsland(t: TerrainBuilder, seed: number): IslandSketch {
  const cx = SIZE_X / 2 + (rand(seed, 'cx') - 0.5) * 3, cz = SIZE_Z / 2 + (rand(seed, 'cz') - 0.5) * 3;
  const turn = rand(seed, 'turn') * Math.PI;
  const hillA = rand(seed, 'hill') * Math.PI * 2;
  const hillR = 5.2 + rand(seed, 'hillR') * 2;
  const hx = cx + Math.cos(hillA) * 7.5, hz = cz + Math.sin(hillA) * 7.5;
  const cliffA = hillA + (rand(seed, 'cliff') - 0.5) * 1.6;
  const coveA = hillA + Math.PI * (0.65 + rand(seed, 'cove') * 0.7);
  const coveX = cx + Math.cos(coveA) * 14, coveZ = cz + Math.sin(coveA) * 14;
  const coveR = 3.3 + rand(seed, 'coveR');
  for (let z = 6; z < SIZE_Z - 6; z++) {
    for (let x = 6; x < SIZE_X - 6; x++) {
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
      const rx = dx * Math.cos(turn) + dz * Math.sin(turn), rz = -dx * Math.sin(turn) + dz * Math.cos(turn);
      const d = Math.hypot(rx / 1.12, rz);
      const coast = 14.6 + (noise(seed, x * 0.13, z * 0.13) - 0.5) * 6.5 + (noise(seed + 1, x * 0.33, z * 0.33) - 0.5) * 2.6;
      if (d > coast) continue;
      if (Math.hypot(x + 0.5 - coveX, z + 0.5 - coveZ) < coveR) continue;
      const inland = coast - d;
      let level = inland > 2.2 && noise(seed + 2, x * 0.16, z * 0.16) > 0.5 ? 2 : 1;
      const hd = Math.hypot(x + 0.5 - hx, z + 0.5 - hz);
      if (hd < hillR) {
        level = Math.max(level, 2 + Math.round((1 - hd / hillR) * 3.3));
        // One flank is a cliff: the ground jumps instead of stepping.
        const toward = ((x + 0.5 - hx) * Math.cos(cliffA) + (z + 0.5 - hz) * Math.sin(cliffA)) / (hd || 1);
        if (toward > 0.25 && hd < hillR * 0.82) level = Math.max(level, 4);
      }
      t.set(x, z, level);
    }
  }
  // The cove ends in a narrow inlet reaching inland: water with land on three sides at its head.
  for (let k = 0; k <= 6; k++) {
    t.set(Math.floor(coveX - Math.cos(coveA) * k), Math.floor(coveZ - Math.sin(coveA) * k), 0);
  }
  return { hill: [Math.round(hx), Math.round(hz)], cove: [Math.round(coveX), Math.round(coveZ)], centre: [Math.round(cx), Math.round(cz)] };
}
