// River water, for the watermill (R-H16). Not a rule file.
//
// A water column (terrain height 0) is river water if generator 2 marked it
// so (MAT_RIVER), or if it lies in a channel: land within 3 columns on both
// sides across it, along x or along z. The sea, a bay and a wide lagoon have
// no opposite bank that close. Reads only the terrain within 3 of the
// column. (L41's barge reads river water the same way, with a wider reach.)

import { columnIndex, inColumnBounds } from '@/core/grid';
import type { Terrain } from '@/core/world';
import { MAT_RIVER } from '@/terrain/terrain2';

/** How far a channel's banks may be from a river column, each side. */
export const BANK_REACH = 3;

export function riverAt(t: Terrain, x: number, z: number): boolean {
  if (!inColumnBounds(x, z) || t.height[columnIndex(x, z)]! > 0) return false;
  if (t.material[columnIndex(x, z)] === MAT_RIVER) return true;
  const land = (dx: number, dz: number): boolean => {
    for (let k = 1; k <= BANK_REACH; k++) {
      const nx = x + dx * k, nz = z + dz * k;
      if (inColumnBounds(nx, nz) && t.height[columnIndex(nx, nz)]! > 0) return true;
    }
    return false;
  };
  return (land(1, 0) && land(-1, 0)) || (land(0, 1) && land(0, -1));
}
