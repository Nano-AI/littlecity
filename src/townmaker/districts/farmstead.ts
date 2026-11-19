// An outlying farmstead: a cottage and its barn on free land more than ten
// column steps from every floor of the town, so they read as rustic (U12-E:
// thatch, timber, rough stone). Laid last, where the town left such ground;
// no street goes to it.

import { columnIndex, keyX, keyZ } from '@/core/grid';
import { DEPTH } from '@/style/depth';
import { CLAIM } from '../grower';
import { fromSquare, startDistrict, type Town } from '../town';

/** Column steps from every floor laid so far (4-connected, over land and sea). */
function floorDistance(town: Town): Int32Array {
  const { g } = town;
  const dist = new Int32Array(48 * 48).fill(-1);
  const queue: number[] = [];
  for (const c of g.world.floors.keys()) {
    const i = columnIndex(keyX(c), keyZ(c));
    if (dist[i] === -1) {
      dist[i] = 0;
      queue.push(i);
    }
  }
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
  return dist;
}

/**
 * Keeps ground for the farmstead once the main districts are down: the free
 * column farthest from every floor, if it is beyond the rustic reach. No
 * street or garden may come within the reach of it afterwards (kept ground);
 * buildFarmstead puts the farm there at the end.
 */
export function reserveFarmstead(town: Town): void {
  const { g, site } = town;
  const reach = Math.round(DEPTH.edgeReach) + 1;
  const dist = floorDistance(town);
  // The spot costing the town least ground: the fewest free land columns within the reach (a tip of the island).
  let best: [number, number] | null = null;
  let bestCost = Infinity;
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      const i = columnIndex(x, z);
      if (g.h(x, z) === 0 || !g.free(x, z) || site.waterDist[i]! < 2 || dist[i]! < reach) continue;
      if (fromSquare(town, x, z) < 14) continue;
      let cost = 0;
      for (let dz = -reach; dz <= reach; dz++) {
        for (let dx = -reach + Math.abs(dz); dx <= reach - Math.abs(dz); dx++) if (g.h(x + dx, z + dz) > 0 && g.free(x + dx, z + dz)) cost++;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = [x, z];
      }
    }
  }
  if (!best || bestCost > Math.min(95, town.site.land * 0.11)) return;
  const [bx, bz] = best;
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach + Math.abs(dz); dx <= reach - Math.abs(dz); dx++) {
      if (!g.claimed(bx + dx, bz + dz, CLAIM.built)) g.mark(bx + dx, bz + dz, CLAIM.keep);
    }
  }
  town.farm = best;
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
