// J17 · tier 1 · Terrain steps.
//
// A path cell beside a path cell exactly one terrain level higher (both
// lying on the terrain, so they are one path region) gets carved stone steps
// between them: a `terrain-steps` feature on the LOWER cell, `dir` toward
// the higher one. Derived and walkable. The steps take the lower cell's
// edge slot on that side, so nothing is dressed onto them.

import { columnIndex, DIR4_NAMES, inColumnBounds, key, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import type { StructureId } from '@/resolve/plan';

const DIRS: readonly Dir4[] = [0, 1, 2, 3];

export interface TerrainStep {
  cell: CellKey;
  dir: Dir4;
  structure: StructureId;
}

export function terrainSteps(f: Facts): TerrainStep[] {
  const ground = (x: number, z: number): number => (inColumnBounds(x, z) ? f.terrain.height[columnIndex(x, z)]! : 0);
  const out: TerrainStep[] = [];
  for (const [cell, kind] of f.world.floors) {
    if (kind !== 'path') continue;
    const y = keyY(cell);
    if (y !== ground(keyX(cell), keyZ(cell))) continue;
    const structure = f.floorAt.get(cell);
    if (structure === undefined) continue;
    for (const d of DIRS) {
      const n = neighbor(cell, d);
      if (n === NO_CELL || y + 1 > 31 || ground(keyX(n), keyZ(n)) !== y + 1) continue;
      const up = key(keyX(n), y + 1, keyZ(n));
      if (f.world.floors.get(up) === 'path' && f.floorAt.get(up) === structure) out.push({ cell, dir: d, structure });
    }
  }
  return out.sort((a, b) => a.cell - b.cell || a.dir - b.dir);
}

export default defineRule<TerrainStep>({
  id: 'J17.terrain-steps',
  part: 'joinery',
  tier: 1,
  priority: 830,
  about: 'Reads: path cells on terrain one level apart. Emits: terrain-steps on the lower cell. Claims: that cell’s edge slot toward the steps.',
  find({ facts }) {
    return terrainSteps(facts).map((s): Candidate<TerrainStep> => ({ anchor: s.cell, key: s.dir, structure: s.structure, data: s }));
  },
  claims(c) {
    return [slot.floor(c.data.cell, DIR4_NAMES[c.data.dir]!)];
  },
  apply(c, out) {
    out.feature({ type: 'terrain-steps', structure: c.data.structure, cell: c.data.cell, dir: c.data.dir });
  },
});
