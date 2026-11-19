// Generator 2's islands (design section 6, "Terrain, second generation"):
// one scenario per seed, with its starting trees and nothing else, seen from
// the four orbit quarters, along the river, at the tallest cliff and in the
// gorge, and at dusk and night. Cameras are placed from the island itself,
// so they follow the generator when it is tuned.
//
//   npm run shots -- 'look-terrain2*'

import { columnIndex, SIZE_X, SIZE_Z } from '@/core/grid';
import type { CameraSpec } from '@/scenario';
import { scenario, type Scenario } from '@/scenario';
import { generateTerrain } from '@/terrain/terrain';
import { distanceFrom, D4, hAt } from '@/terrain/noise';
import { generateIsland2 } from '@/terrain/terrain2';

/** Where to look on a generator-2 island: its middle, its river, its tallest cliff, its gorge. */
export function islandSights(seed: number) {
  const isl = generateIsland2(seed, (s) => generateTerrain(s, 1));
  const h = isl.terrain.height;
  let sx = 0, sz = 0, land = 0;
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) if (h[columnIndex(x, z)]! > 0) {
    sx += x;
    sz += z;
    land++;
  }
  const mid: [number, number, number] = [sx / land + 0.5, 1, sz / land + 0.5];
  const sea = distanceFrom((i) => h[i] === 0 && !isl.river[i]);
  const rivers: number[] = [];
  for (let i = 0; i < h.length; i++) if (isl.river[i]) rivers.push(i);
  rivers.sort((a, b) => sea[a]! - sea[b]! || a - b);
  const at = (i: number, y = 0): [number, number, number] => [(i % SIZE_X) + 0.5, y, ((i / SIZE_X) | 0) + 0.5];
  const mouth = rivers.length ? at(rivers[Math.min(rivers.length - 1, 3)]!) : null;
  const along = rivers.length ? at(rivers[Math.floor(rivers.length * 0.55)]!) : null;
  // The gorge: the river column with the highest ground beside it.
  let gorge: { i: number; hi: number; yaw: number } | null = null;
  for (const i of rivers) {
    const x = i % SIZE_X, z = (i / SIZE_X) | 0;
    for (const [dx, dz] of D4) {
      const v = hAt(h, x + dx, z + dz);
      // Look at the wall: from the water, toward the high side.
      if (v >= 3 && (!gorge || v > gorge.hi)) gorge = { i, hi: v, yaw: (Math.atan2(-dx, -dz) * 180) / Math.PI };
    }
  }
  // The tallest cliff on land: the biggest drop between neighbours, looked at from the low side.
  let cliff: { x: number; z: number; y: number; drop: number; yaw: number } | null = null;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const here = hAt(h, x, z);
      if (here === 0) continue;
      for (const [dx, dz] of D4) {
        const v = hAt(h, x + dx, z + dz);
        const drop = here - v;
        if (drop >= 2 && (!cliff || drop > cliff.drop)) cliff = { x: x + dx, z: z + dz, y: v + drop / 2, drop, yaw: (Math.atan2(-dx, -dz) * 180) / Math.PI };
      }
    }
  }
  return { isl, mid, mouth, along, gorge, cliff };
}

export function terrain2Scenario(name: string, seed: number, about: string, extra: CameraSpec[] = []): Scenario {
  const { isl, mid, mouth, along, gorge, cliff } = islandSights(seed);
  const cameras: CameraSpec[] = [
    { name: 'sw', yaw: 45, pitch: 35, zoom: 1.25, target: mid },
    { name: 'se', yaw: 135, pitch: 35, zoom: 1.25, target: mid },
    { name: 'ne', yaw: 225, pitch: 35, zoom: 1.25, target: mid },
    { name: 'nw', yaw: 315, pitch: 35, zoom: 1.25, target: mid },
  ];
  if (mouth) cameras.push({ name: 'mouth', yaw: 45, pitch: 30, zoom: 3.4, target: mouth });
  if (along) cameras.push({ name: 'river', yaw: 135, pitch: 32, zoom: 3.6, target: along });
  if (gorge) {
    // Look down the gorge along the channel: the river's local direction from the river columns near it.
    const gx = gorge.i % SIZE_X, gz = (gorge.i / SIZE_X) | 0;
    let sxx = 0, szz = 0, sxz = 0;
    for (let i = 0; i < isl.river.length; i++) {
      if (!isl.river[i]) continue;
      const dx = (i % SIZE_X) - gx, dz = ((i / SIZE_X) | 0) - gz;
      if (dx * dx + dz * dz > 12) continue;
      sxx += dx * dx;
      szz += dz * dz;
      sxz += dx * dz;
    }
    const axis = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    const yaw = (Math.atan2(-Math.cos(axis), -Math.sin(axis)) * 180) / Math.PI + 20;
    cameras.push({ name: 'gorge', yaw, pitch: 50, zoom: 3.4, target: [gx + 0.5, 1, gz + 0.5] });
  }
  if (cliff) cameras.push({ name: 'cliff', yaw: cliff.yaw, pitch: 24, zoom: 3.2, target: [cliff.x + 0.5, cliff.y, cliff.z + 0.5] });
  cameras.push(
    { name: 'dusk', yaw: 45, pitch: 35, zoom: 1.25, target: mid, time: 'dusk' },
    { name: 'night', yaw: 225, pitch: 35, zoom: 1.25, target: mid, time: 'night' },
  );
  if (along) cameras.push({ name: 'river-dusk', yaw: 45, pitch: 32, zoom: 3, target: along, time: 'dusk' });
  if (cliff && cliff.drop >= 3) cameras.push({ name: 'cliff-night', yaw: cliff.yaw, pitch: 26, zoom: 2.6, target: [cliff.x + 0.5, cliff.y, cliff.z + 0.5], time: 'night' });
  cameras.push(...extra);
  return scenario({
    name,
    seed,
    about: `${about} (generator 2: ${isl.character}, ${isl.rivers} river${isl.rivers === 1 ? '' : 's'}).`,
    terrain: 'generated',
    terrainGen: 2,
    startingTrees: true,
    build() {},
    cameras,
  });
}
