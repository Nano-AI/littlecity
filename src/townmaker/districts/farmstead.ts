// An outlying farmstead: a cottage and its barn on free land more than ten
// column steps from every floor of the town, so they read as rustic (U12-E:
// thatch, timber, rough stone). Laid last, where the town left such ground;
// no street goes to it.

import { columnIndex, keyX, keyZ } from '@/core/grid';
import { DEPTH } from '@/style/depth';
import { CLAIM } from '../grower';
import { fromSquare, startDistrict, type Town } from '../town';

/**
 * Keeps the far end of the island clear for the farmstead: the land column
 * with the least land within the rustic reach (a tip of the island, mostly
 * sea round it), if that costs little land. Nothing else is built or laid
 * there; buildFarmstead puts the farm in the middle at the end.
 */
export function reserveFarmstead(town: Town): void {
  const { g, site } = town;
  const reach = Math.round(DEPTH.edgeReach) + 1;
  let best: { x: number; z: number; land: number } | null = null;
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      const i = columnIndex(x, z);
      if (g.h(x, z) === 0 || !g.free(x, z) || site.waterDist[i]! < 3) continue;
      if (fromSquare(town, x, z) < 14) continue;
      // Both cottage and barn on one level.
      if (g.h(x + 2, z) !== g.h(x, z)) continue;
      let land = 0;
      for (let dz = -reach; dz <= reach; dz++) {
        for (let dx = -reach + Math.abs(dz); dx <= reach - Math.abs(dz); dx++) {
          if (g.h(x + dx, z + dz) > 0) land++;
          if (g.claimed(x + dx, z + dz, 0xff)) land += 1000;
        }
      }
      if (!best || land < best.land) best = { x, z, land };
    }
  }
  if (!best || best.land > 140) return;
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach + Math.abs(dz); dx <= reach - Math.abs(dz); dx++) g.mark(best.x + dx, best.z + dz, CLAIM.keep);
  }
  town.farm = [best.x, best.z];
}

export function buildFarmstead(town: Town): boolean {
  if (town.farm) {
    const { g } = town;
    const [x, z] = town.farm;
    const h = g.h(x, z);
    startDistrict(town, 'farmstead', x, z);
    g.put('house', x, h, z, g.colorFor('house', [[x, h, z]], 'farm'));
    if (g.h(x + 2, z) === h) g.put('house', x + 2, h, z, g.colorFor('house', [[x + 2, h, z]], 'barn'));
    g.put('tree', x + 1, h, z + 1, 0);
    return true;
  }
  const { g } = town;
  const reach = Math.round(DEPTH.edgeReach) + 1;
  const dist = new Int32Array(48 * 48).fill(-1);
  const queue: number[] = [];
  for (const c of g.world.floors.keys()) {
    const i = columnIndex(keyX(c), keyZ(c));
    if (dist[i] === -1) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  if (queue.length === 0) return false;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % 48, z = Math.floor(i / 48);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= 48 || nz >= 48) continue;
      const j = columnIndex(nx, nz);
      if (dist[j] === -1) {
        dist[j] = dist[i]! + 1;
        queue.push(j);
      }
    }
  }
  let best: [number, number] | null = null;
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      const i = columnIndex(x, z);
      if (dist[i]! < reach || !g.free(x, z) || g.h(x, z) === 0 || g.groundTaken(x, z) || town.site.waterDist[i]! < 2) continue;
      if (!best || dist[i]! > dist[columnIndex(best[0], best[1])]!) best = [x, z];
    }
  }
  if (!best) return false;
  const [x, z] = best;
  startDistrict(town, 'farmstead', x, z);
  const h = g.h(x, z);
  g.put('house', x, h, z, g.colorFor('house', [[x, h, z]], 'farm'));
  g.mark(x, z, CLAIM.built);
  for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2]] as const) {
    const bx = x + dx, bz = z + dz;
    if (g.free(bx, bz) && g.h(bx, bz) === h && !g.groundTaken(bx, bz) && dist[columnIndex(bx, bz)]! >= reach) {
      g.put('house', bx, h, bz, g.colorFor('house', [[bx, h, bz]], 'barn'));
      g.mark(bx, bz, CLAIM.built);
      break;
    }
  }
  return true;
}
