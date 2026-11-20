// Fords (discovery round 1, UF-08): two path dead ends on the ground facing
// each other straight across 1 or 2 cells of open water, with no arch within
// 2 of the crossing. A fact because D03 (benches at a dead end with a view,
// via the streetEnds fact) runs first and must not stand a bench in the
// mouth of a ford; U22 lays the stepping stones.
//
// Reads only the shape-stage base (streets, terrain, kinds).

import { DIR4, keyX, keyZ, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { openWater } from '@/resolve/facts/lib';
import { streets } from '@/resolve/facts/streets.fact';
import { onGround } from '../decoration/lib';

export const FORD_GAP = 2;
const BRIDGE_CLEAR = 2;

export interface Ford {
  /** The west or north end, and the way across from it (E or S). */
  from: CellKey;
  to: CellKey;
  dir: Dir4;
  /** The water columns crossed, [x, z]. */
  water: readonly (readonly [number, number])[];
}

export const fords = defineFact<{ list: readonly Ford[]; ends: ReadonlySet<CellKey> }>('fords', (f) => {
  const ends = new Map<CellKey, Dir4>();
  for (const s of streets(f).list) {
    for (const e of s.deadEnds) {
      const links = s.links.get(e) ?? [];
      if (links.length === 1 && onGround(f, e)) ends.set(e, opposite(links[0]!.dir));
    }
  }
  const arches: [number, number][] = [];
  for (const [c, k] of f.kinds) if (k === 'arch') arches.push([keyX(c), keyZ(c)]);
  const list: Ford[] = [];
  for (const [e, d] of [...ends].sort((a, b) => a[0] - b[0])) {
    if (d !== 1 && d !== 2) continue;
    const [dx, dz] = DIR4[d]!;
    const water: [number, number][] = [];
    let far: CellKey = NO_CELL;
    for (let k = 1; k <= FORD_GAP + 1; k++) {
      const x = keyX(e) + dx * k, z = keyZ(e) + dz * k;
      if (openWater(f, x, z)) {
        water.push([x, z]);
        continue;
      }
      for (const [o, od] of ends) if (keyX(o) === x && keyZ(o) === z && od === opposite(d)) far = o;
      break;
    }
    if (far === NO_CELL || water.length < 1 || water.length > FORD_GAP) continue;
    if (arches.some(([ax, az]) => water.some(([wx, wz]) => Math.abs(ax - wx) + Math.abs(az - wz) <= BRIDGE_CLEAR))) continue;
    list.push({ from: e, to: far, dir: d, water });
  }
  return { list, ends: new Set(list.flatMap((x) => [x.from, x.to])) };
});
