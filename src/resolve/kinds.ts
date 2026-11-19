// STUB (Stage 0). Owner: Logic (Stage 1). Final signature.
//
// Pass 2: the resolved kind of every block. The stub turns every Auto block
// into a house. The Logic owner implements K1–K5 exactly as in design
// section 8, reading only terrain, occupancy and PLACED kinds.

import type { CellKey } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { Terrain, World } from '@/core/world';

export function resolveKinds(w: World, _t: Terrain): Map<CellKey, Kind> {
  const kinds = new Map<CellKey, Kind>();
  for (const [cell, block] of w.blocks) kinds.set(cell, block.kind === 'auto' ? 'house' : block.kind);
  return kinds;
}
