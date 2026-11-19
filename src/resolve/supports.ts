// Pass 4: generated supports, so nothing floats (design section 9). Owner: Logic.
//
// For every block that is not carried (the cell below is solid, or it is a
// windmill on a windmill), except docks at y = 0, first match wins:
//
//   S1  resolved kind arch → no support; the arch generator shapes itself
//   S2  a side neighbour at the same level is solid and grounded (terrain,
//       or solid directly below it) → 'bracket' against that neighbour
//       (the first in N, E, S, W order)
//   S3  otherwise → a support from the block's underside down to the first
//       solid top, or to the seabed over water:
//         'stilts'    if the column holds a non-solid piece before that top
//                     (four slim corner stilts: nothing placed is hidden)
//         'platform'  if the block carried is itself non-solid (a tree
//                     whose ground was erased)
//         'pillar'    otherwise
//
// Then S4 (arcade): two 'pillar' supports in adjacent columns, with the same
// top level and both at least 2 cells long, are joined by a generated arch;
// each records the other's direction in `arcadeTo`.
//
// bottomY is the level the foot stands on: the first solid top below, or 0
// over open water. The support's length in cells is carries.y − bottomY.

import { below, keyY, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS, type Kind } from '@/core/kinds';
import type { Terrain, World } from '@/core/world';
import { insideTerrain } from '@/world/world';
import type { Support } from './plan';

export function resolveSupports(w: World, t: Terrain, kinds: ReadonlyMap<CellKey, Kind>): Support[] {
  const solid = (c: CellKey): boolean => {
    if (c === NO_CELL) return false;
    if (insideTerrain(t, c)) return true;
    const k = kinds.get(c);
    return k !== undefined && KINDS[k].solid;
  };
  const out: Support[] = [];
  const pillars = new Map<CellKey, Support>();
  const cells = [...kinds.keys()].sort((a, b) => a - b);
  for (const cell of cells) {
    const kind = kinds.get(cell)!;
    const y = keyY(cell);
    const under = below(cell);
    if (solid(under)) continue;
    if (kind === 'windmill' && under !== NO_CELL && kinds.get(under) === 'windmill') continue;
    if (kind === 'dock' && y === 0) continue;
    // S1
    if (kind === 'arch') continue;
    // S2
    let against: Dir4 | -1 = -1;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const n = neighbor(cell, d);
      if (n !== NO_CELL && solid(n) && (insideTerrain(t, n) || solid(below(n)))) {
        against = d;
        break;
      }
    }
    if (against !== -1) {
      out.push({ type: 'bracket', carries: cell, bottomY: y, against });
      continue;
    }
    // S3
    let bottomY = 0;
    let piece = false;
    for (let c = under; c !== NO_CELL; c = below(c)) {
      if (solid(c)) {
        bottomY = keyY(c) + 1;
        break;
      }
      if (kinds.has(c)) piece = true;
    }
    const type: Support['type'] = piece ? 'stilts' : KINDS[kind].solid ? 'pillar' : 'platform';
    const s: Support = { type, carries: cell, bottomY };
    out.push(s);
    if (type === 'pillar' && y - bottomY >= 2) pillars.set(cell, s);
  }
  // S4: arcades between neighbouring long pillars with the same top.
  for (const [cell, s] of pillars) {
    for (const d of [1, 2] as Dir4[]) {
      const n = neighbor(cell, d);
      const other = n === NO_CELL ? undefined : pillars.get(n);
      if (!other) continue;
      (s.arcadeTo ??= []).push(d);
      (other.arcadeTo ??= []).push(opposite(d));
    }
  }
  for (const s of pillars.values()) s.arcadeTo?.sort((a, b) => a - b);
  return out;
}
