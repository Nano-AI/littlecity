// Distance fields over columns (design section 10, "Per cell"). Each is a
// grid of 4-connected steps from every column to the nearest source column;
// a column that is itself a source is 0; NONE (0xffff) when there is no
// source anywhere. Read with `.at(x, z)`.

import { columnIndex, keyX, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { defineFact } from './api';
import { columnDistance, openWater, type ColumnDistance } from './lib';

export type { ColumnDistance } from './lib';
export { NONE } from './lib';

/** Steps to the nearest open-water column (terrain height 0 with no block at sea level). */
export const distToWater = defineFact<ColumnDistance>('distToWater', (f) => columnDistance((x, z) => openWater(f, x, z)));

/** Steps to the nearest column holding a floor (path, plaza or garden) at any level. */
export const distToFloor = defineFact<ColumnDistance>('distToFloor', (f) => {
  const has = new Uint8Array(SIZE_X * SIZE_Z);
  for (const c of f.world.floors.keys()) has[columnIndex(keyX(c), keyZ(c))] = 1;
  return columnDistance((x, z) => has[columnIndex(x, z)] === 1);
});

/** Steps to the nearest column holding a block of any kind (trees included) at any level. */
export const distToStructure = defineFact<ColumnDistance>('distToStructure', (f) => {
  const has = new Uint8Array(SIZE_X * SIZE_Z);
  for (const c of f.kinds.keys()) has[columnIndex(keyX(c), keyZ(c))] = 1;
  return columnDistance((x, z) => has[columnIndex(x, z)] === 1);
});

/** Steps to the nearest column holding a path cell. */
export const distToPath = defineFact<ColumnDistance>('distToPath', (f) => {
  const has = new Uint8Array(SIZE_X * SIZE_Z);
  for (const [c, k] of f.world.floors) if (k === 'path') has[columnIndex(keyX(c), keyZ(c))] = 1;
  return columnDistance((x, z) => has[columnIndex(x, z)] === 1);
});
