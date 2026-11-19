// Verges (catalogue part U): bare grass beside a street.

import { DIR4, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import type { StructureId } from '../plan';
import { defineFact } from './api';
import { wildGrass } from './grass.fact';
import { DIRS, edgeBetween, ground } from './lib';

export interface Verge {
  cell: CellKey;
  /** Sides with a street cell (same level, or one terrain step up or down). */
  dirs: readonly Dir4[];
  /** The streets (path structures) it lies beside. */
  streets: readonly StructureId[];
  /** True if an edge piece stands between it and every street beside it. */
  fenced: boolean;
}

export interface Verges {
  /** A verge is a bare grass cell beside a street cell. Ascending by cell. */
  list: readonly Verge[];
  byCell: ReadonlyMap<CellKey, Verge>;
}

export const verges = defineFact<Verges>('verges', (f) => {
  const grass = wildGrass(f);
  const list: Verge[] = [];
  for (const c of grass.cells) {
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    const dirs: Dir4[] = [];
    const ids = new Set<StructureId>();
    let open = false;
    for (const d of DIRS) {
      const nx = x + DIR4[d]![0], nz = z + DIR4[d]![1];
      for (const ny of [y, y + 1, y - 1]) {
        if (ny < 0 || ny > 31 || nx < 0 || nx >= SIZE_X || nz < 0 || nz >= SIZE_Z) continue;
        const n = key(nx, ny, nz);
        if (f.world.floors.get(n) !== 'path') continue;
        if (ny !== y && ny !== ground(f, nx, nz)) continue;
        dirs.push(d);
        ids.add(f.floorAt.get(n)!);
        if (!edgeBetween(f, c, d)) open = true;
        break;
      }
    }
    if (dirs.length) list.push({ cell: c, dirs, streets: [...ids].sort((a, b) => a - b), fenced: !open });
  }
  return { list, byCell: new Map(list.map((v) => [v.cell, v])) };
});
