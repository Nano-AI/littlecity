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

const AVOID = new Set(['tower', 'lighthouse', 'windmill', 'marble', 'pillar', 'arch', 'auto', 'stairs', 'fountain', 'stall', 'dock', 'wall', 'fence']);

/** Nothing but houses (or nothing) beside this column, up to `levels` above its ground. */
function quietAround(g: Grower, x: number, z: number, levels: number): boolean {
  const h = g.h(x, z);
  for (const [dx, dz] of D4) {
    if (!g.inMap(x + dx, z + dz)) return false;
    const i = columnIndex(x + dx, z + dz);
    if ((g.claim[i]! & CLAIM.keep) !== 0) return false;
    for (let y = h - 1; y <= h + levels; y++) {
      const b = g.block(x + dx, y, z + dz);
      if (b && AVOID.has(b.kind)) return false;
    }
  }
  return true;
}

function buildable(g: Grower, x: number, z: number): boolean {
  // Ground left over, or a district's open margin (the streets are laid by now, so margins may fill).
  if (!g.inMap(x, z) || g.h(x, z) === 0 || g.groundTaken(x, z)) return false;
  if (g.claimed(x, z, CLAIM.street | CLAIM.built | CLAIM.keep | CLAIM.clear)) return false;
  return !g.world.floors.has(key(x, g.h(x, z), z));
}

/** Streets beside a column, as a bit per side. */
function streetSides(g: Grower, x: number, z: number): number {
  let bits = 0;
  D4.forEach(([dx, dz], i) => {
    if (g.claimed(x + dx, z + dz, CLAIM.street) && g.h(x + dx, z + dz) === g.h(x, z)) bits |= 1 << i;
  });
  return bits;
}

/**
 * Infill for one ring of distance from the square (ring 0 = the heart). The
 * heart is dense: two-storey houses right on the street (they open as small
 * shops), corner houses at junctions; farther out houses get one storey on
 * the street or two set back behind a front garden, and more gaps.
 */
export function buildInfill(town: Town, ring: number, scale = 1): void {
  const { g, site } = town;
  const d = startDistrict(town, `infill${ring}`, town.square?.x ?? 24, town.square?.z ?? 24);
  const lo = ring * 7, hi = ring >= 3 ? 999 : lo + 7;
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
  const density = [0.95, 0.8, 0.55, 0.3][Math.min(ring, 3)]! * scale;
  const heart = ring <= 1;
  let n = 0;
  const build = (hx: number, hz: number, floors: number): boolean => {
    const h = g.h(hx, hz);
    if (!quietAround(g, hx, hz, floors)) return false;
    const color = g.colorFor('house', [[hx, h, hz], [hx, h + floors - 1, hz]], `infill${ring}-${n}`);
    let ok = true;
    for (let f = 0; f < floors; f++) ok = g.put('house', hx, h + f, hz, color) && ok;
    if (!ok) return false;
    g.mark(hx, hz, CLAIM.built);
    n++;
    return true;
  };
  for (const [sx, sz] of streets) {
    for (const [dx, dz] of D4) {
      if (!g.chance(density, 'infill-try', sx, sz, dx, dz)) continue;
      const x = sx + dx, z = sz + dz;
      const h = g.h(x, z);
      if (h !== g.h(sx, sz) || !buildable(g, x, z) || site.waterDist[columnIndex(x, z)]! < 2) continue;
      const sides = streetSides(g, x, z);
      const corner = (sides & 0b0011) === 0b0011 || (sides & 0b0110) === 0b0110 || (sides & 0b1100) === 0b1100 || (sides & 0b1001) === 0b1001;
      if (heart || corner) {
        // On the street, two or three storeys: a shop in the heart, a corner house at a junction.
        build(x, z, 2 + (heart && g.chance(0.3, 'tall', x, z) ? 1 : 0));
        continue;
      }
      // Set back by one, two storeys, when the cell behind is free too.
      const bx = x + dx, bz = z + dz;
      const back = buildable(g, bx, bz) && g.h(bx, bz) === h && g.chance(0.5, 'setback', x, z) && !g.claimed(bx + dx, bz + dz, CLAIM.street);
      if (back) {
        if (build(bx, bz, 2)) g.mark(x, z, CLAIM.keep);
      } else build(x, z, 1);
    }
  }
  d.ways.length = 0;
}
