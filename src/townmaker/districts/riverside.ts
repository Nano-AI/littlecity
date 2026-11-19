// The river: what a town puts on its banks. Willows on the grass banks
// (R-P01: a tree on land that is not sand, beside open water), a reed bed,
// a boathouse with its landing stage, and two river landings far apart by
// water (a barge plies between docks on one river), each a dock with a path
// to it on the bank. The mill goes to a bank by its own search (country.ts),
// and streets cross the river by bridges (route.ts).

import { columnIndex, key } from '@/core/grid';
import { CLAIM, type Grower } from '../grower';
import { pave } from '../route';
import { D4 } from '../site';
import { startDistrict, type Town } from '../town';
import { buildBoathouse } from './harbour';

function openWater(g: Grower, x: number, z: number): boolean {
  return g.inMap(x, z) && g.h(x, z) === 0 && !g.world.blocks.has(key(x, 0, z)) && !g.claimed(x, z, CLAIM.keep | CLAIM.built);
}

/** Free bank columns: land beside river water, nothing on them. */
function banks(town: Town): { x: number; z: number; water: [number, number] }[] {
  const { g, site } = town;
  const out: { x: number; z: number; water: [number, number] }[] = [];
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (g.h(x, z) === 0 || !g.free(x, z) || g.groundTaken(x, z)) continue;
      for (const [dx, dz] of D4) {
        const wx = x + dx, wz = z + dz;
        if (!g.inMap(wx, wz) || !site.river[columnIndex(wx, wz)] || !openWater(g, wx, wz)) continue;
        out.push({ x, z, water: [wx, wz] });
        break;
      }
    }
  }
  return out;
}

/** Steps between two water columns through open water (Infinity when not joined). */
function byWater(g: Grower, a: readonly [number, number], b: readonly [number, number]): number {
  const dist = new Int32Array(48 * 48).fill(-1);
  const q: number[] = [columnIndex(a[0], a[1])];
  dist[q[0]!] = 0;
  const goal = columnIndex(b[0], b[1]);
  for (let i = 0; i < q.length; i++) {
    const c = q[i]!;
    if (c === goal) return dist[c]!;
    const x = c % 48, z = Math.floor(c / 48);
    for (const [dx, dz] of D4) {
      const nx = x + dx, nz = z + dz;
      if (!g.inMap(nx, nz) || g.h(nx, nz) !== 0) continue;
      const j = columnIndex(nx, nz);
      if (dist[j] !== -1) continue;
      dist[j] = dist[c]! + 1;
      q.push(j);
    }
  }
  return Infinity;
}

export function buildRiverside(town: Town): boolean {
  const { g, site } = town;
  let any = false;
  for (let i = 0; i < site.river.length; i++) if (site.river[i]) any = true;
  if (!any) return false;
  const all = banks(town);
  if (all.length === 0) return false;
  const mid = all[Math.floor(all.length / 2)]!;
  const d = startDistrict(town, 'riverside', mid.x, mid.z);
  const order = all.map((b) => ({ b, r: g.rand('bank', b.x, b.z) })).sort((p, q) => p.r - q.r).map((p) => p.b);

  // Two river landings, far apart by water: a dock in the river with a path to it on the bank.
  const landings: { x: number; z: number; water: [number, number] }[] = [];
  for (const b of order) {
    if (landings.length >= 2) break;
    if (!g.free(b.x, b.z) || g.h(b.x, b.z) > 2 || !openWater(g, b.water[0], b.water[1])) continue;
    // Keep the river passable: the dock's other neighbours in the water stay open.
    const [wx, wz] = b.water;
    let neighbours = 0;
    for (const [dx, dz] of D4) if (g.inMap(wx + dx, wz + dz) && g.world.blocks.has(key(wx + dx, 0, wz + dz))) neighbours++;
    if (neighbours > 0) continue;
    if (landings.length === 1 && byWater(g, landings[0]!.water, b.water) < 10) continue;
    landings.push(b);
  }
  if (landings.length === 2) {
    for (const b of landings) {
      g.put('auto', b.water[0], 0, b.water[1], 'auto');
      g.mark(b.water[0], b.water[1], CLAIM.built);
      if (pave(g, b.x, b.z)) d.ways.push([b.x, b.z]);
      g.floor('path', b.water[0], b.water[1], 1);
    }
  }

  // Willows along the grass banks, a few apart.
  const willows: [number, number][] = [];
  for (const b of order) {
    if (willows.length >= 3) break;
    if (!g.free(b.x, b.z) || site.isSand(b.x, b.z) || g.groundTaken(b.x, b.z)) continue;
    if (willows.some(([x, z]) => Math.abs(x - b.x) + Math.abs(z - b.z) < 5)) continue;
    if (g.put('tree', b.x, g.h(b.x, b.z), b.z, 0)) {
      g.mark(b.x, b.z, CLAIM.built);
      willows.push([b.x, b.z]);
    }
  }

  // A reed bed: two cells of garden on the bank.
  for (const b of order) {
    if (!g.free(b.x, b.z)) continue;
    const next = D4.map(([dx, dz]) => [b.x + dx, b.z + dz] as const).find(([x, z]) => g.free(x, z) && g.h(x, z) === g.h(b.x, b.z) && !g.groundTaken(x, z));
    if (!next) continue;
    g.floor('garden', b.x, b.z);
    g.floor('garden', next[0], next[1]);
    g.mark(b.x, b.z, CLAIM.keep);
    g.mark(next[0], next[1], CLAIM.keep);
    break;
  }

  // A boathouse on a bank, its boat doors onto a landing stage.
  buildBoathouse(town, d, [mid.water[0], mid.water[1]]);
  return true;
}
