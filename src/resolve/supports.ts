// STUB (Stage 0). Owner: Logic (Stage 1). Final signature.
//
// Pass 4: generated supports for every block that is not carried. The stub
// generates none. The Logic owner implements S1–S4 (design section 9).

import type { CellKey } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { Terrain, World } from '@/core/world';
import type { Support } from './plan';

export function resolveSupports(_w: World, _t: Terrain, _kinds: ReadonlyMap<CellKey, Kind>): Support[] {
  return [];
}
