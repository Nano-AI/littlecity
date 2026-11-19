// Infill: once the districts and streets are down, cottages fill the free
// ground along the streets, densely near the square and thinning out
// towards the edge. A house right on a street gets one storey (two storeys
// facing a street would make it a shop); a house one cell back gets two,
// with grass between it and the street for a front garden (U03). Houses
// keep off towers, lighthouses, windmills and marble, so they never turn a
// tower into a steeple or a cottage into a mill house by accident.

import { columnIndex, key } from '@/core/grid';
import { CLAIM, type Grower } from '../grower';
import { fromSquare, startDistrict, type Town } from '../town';
import { D4 } from '../site';

const AVOID = new Set(['tower', 'lighthouse', 'windmill', 'marble', 'pillar', 'arch', 'auto', 'stairs', 'fountain', 'stall']);

/** Nothing but houses (or nothing) beside this column, up to `levels` above its ground. */
function quietAround(g: Grower, x: number, z: number, levels: number): boolean {
  const h = g.h(x, z);
  for (const [dx, dz] of D4) {
    if (!g.inMap(x + dx, z + dz)) return false;
    const i = columnIndex(x + dx, z + dz);
    if ((g.claim[i]! & (CLAIM.built | CLAIM.keep)) !== 0 && g.owner[i] !== g.district) return false;
    for (let y = h - 1; y <= h + levels; y++) {
      const b = g.block(x + dx, y, z + dz);
      if (b && AVOID.has(b.kind)) return false;
    }
  }
  return true;
}

function buildable(g: Grower, x: number, z: number): boolean {
  if (!g.free(x, z) || g.h(x, z) === 0 || g.groundTaken(x, z)) return false;
  return !g.world.floors.has(key(x, g.h(x, z), z));
}

export function buildInfill(town: Town, ring: number): void {
  const { g, site } = town;
  const d = startDistrict(town, `infill${ring}`, town.square?.x ?? 24, town.square?.z ?? 24);
  const lo = ring * 7, hi = lo + 7;
  // Street cells in this ring, by seeded order.
  const streets: [number, number, number][] = [];
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (!g.claimed(x, z, CLAIM.street)) continue;
      const dist = fromSquare(town, x, z);
      if (dist < lo || dist >= hi) continue;
      streets.push([x, z, g.rand('infill', x, z)]);
    }
  }
  streets.sort((a, b) => a[2] - b[2]);
  const density = Math.max(0.12, 0.7 - ring * 0.18);
  let n = 0;
  for (const [sx, sz] of streets) {
    for (const [dx, dz] of D4) {
      if (!g.chance(density, 'infill-try', sx, sz, dx, dz)) continue;
      const x = sx + dx, z = sz + dz;
      const h = g.h(x, z);
      if (h !== g.h(sx, sz) || !buildable(g, x, z) || site.waterDist[columnIndex(x, z)]! < 2) continue;
      // Set back by one, two storeys, when the cell behind is free too.
      const bx = x + dx, bz = z + dz;
      const back = buildable(g, bx, bz) && g.h(bx, bz) === h && g.chance(0.45, 'setback', x, z) && !g.claimed(bx + dx, bz + dz, CLAIM.street);
      const [hx, hz, floors] = back ? [bx, bz, 2] : [x, z, 1];
      if (!quietAround(g, hx, hz, floors)) continue;
      // Leave a gap now and then between neighbours.
      const color = g.colorFor('house', [[hx, h, hz], [hx, h + floors - 1, hz]], `infill${n}`);
      let ok = true;
      for (let f = 0; f < floors; f++) ok = g.put('house', hx, h + f, hz, color) && ok;
      if (!ok) continue;
      g.mark(hx, hz, CLAIM.built);
      if (back) g.mark(x, z, CLAIM.keep);
      n++;
    }
  }
  d.ways.length = 0;
}
