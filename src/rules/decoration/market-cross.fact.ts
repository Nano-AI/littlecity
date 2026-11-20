// Market crosses (discovery round 1, RC-12): the plinths that mark a
// market's centre. A fact because D19 (statue), which runs first, must leave
// these plinths to D37.
//
// A plinth (an R-M06 'statue-base' socket) is a market cross when two or more
// stalls stand within 3 columns of it and no fountain within 2 (with a
// fountain on the square, the fountain is its centre).

import { keyX, keyZ } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

export const STALLS_NEAR = 3;
export const FOUNTAIN_CLEAR = 2;

export const marketCrosses = defineFact<ReadonlySet<string>>('marketCrosses', (f) => {
  const stalls: [number, number][] = [];
  const fountains: [number, number][] = [];
  for (const [c, k] of f.kinds) {
    if (k === 'stall') stalls.push([keyX(c), keyZ(c)]);
    else if (k === 'fountain') fountains.push([keyX(c), keyZ(c)]);
  }
  const out = new Set<string>();
  for (const s of socketsOfType(f, 'statue-base')) {
    const x = keyX(s.cell), z = keyZ(s.cell);
    const near = (list: [number, number][], d: number): number => list.filter(([a, b]) => Math.abs(a - x) + Math.abs(b - z) <= d).length;
    if (near(stalls, STALLS_NEAR) >= 2 && near(fountains, FOUNTAIN_CLEAR) === 0) out.add(s.id);
  }
  return out;
});
