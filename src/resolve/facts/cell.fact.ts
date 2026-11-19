// Per-cell information (design section 10, "Per cell"), computed for a cell
// the first time it is asked for, then cached for the resolve.

import { columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, SIZE_X, SIZE_Y, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS, type FloorKind, type Kind, type PlacedKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import { defineFact, type Facts } from './api';
import { distToFloor, distToStructure, distToWater } from './distance.fact';
import { DIRS, onWalkableTop, solid, standable } from './lib';
import { sunnySide } from './sun.fact';

export interface CellInfo {
  cell: CellKey;
  x: number;
  y: number;
  z: number;
  /** Terrain height of the column (0 = open water). */
  ground: number;
  /** The column is water (terrain height 0), whether or not a dock stands on it. */
  water: boolean;
  /** The cell is inside the terrain. */
  inTerrain: boolean;
  /** Resolved kind of the block in the cell. */
  kind?: Kind;
  /** Placed kind ('auto' stays 'auto'). */
  placed?: PlacedKind;
  /** The block structure in the cell. */
  structure?: StructureId;
  floor?: FloorKind;
  /** The floor-region structure in the cell. */
  floorStructure?: StructureId;
  /** Terrain or a solid block. */
  solid: boolean;
  /** Sides whose neighbour at this level is not solid (and is on the map). */
  openFaces: readonly Dir4[];
  /** Open faces that face the light (sunnySide). */
  sunnyFaces: readonly Dir4[];
  /** No solid block anywhere above this cell in its column. */
  skyOpen: boolean;
  /** Lies on a walkable top: the terrain top of a land column, or the top of a solid block. */
  walkableTop: boolean;
  /** A person could stand here: on a walkable top and no solid block in it. */
  standable: boolean;
  /** y − terrain height: 0 on the ground, negative inside the terrain. */
  aboveGround: number;
  /** Column steps to open water, the nearest floor, the nearest block (NONE = 0xffff if there is none). */
  distToWater: number;
  distToFloor: number;
  distToStructure: number;
}

export interface CellInfoFact {
  /** Information for one cell (cached). */
  at(cell: CellKey): CellInfo;
  /** Highest solid block level in a column, or −1 (terrain not counted). */
  topSolid(x: number, z: number): number;
}

export const cellInfo = defineFact<CellInfoFact>('cellInfo', (f: Facts) => {
  const top = new Int8Array(SIZE_X * SIZE_Z).fill(-1);
  for (const [c, k] of f.kinds) {
    if (!KINDS[k].solid) continue;
    const i = columnIndex(keyX(c), keyZ(c));
    if (keyY(c) > top[i]!) top[i] = keyY(c);
  }
  const cache = new Map<CellKey, CellInfo>();
  const sun = sunnySide(f);
  const at = (cell: CellKey): CellInfo => {
    const hit = cache.get(cell);
    if (hit) return hit;
    const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
    if (cell < 0 || y >= SIZE_Y || x >= SIZE_X || z >= SIZE_Z) throw new Error(`cellInfo: ${cell} is not a cell`);
    const g = f.terrain.height[columnIndex(x, z)]!;
    const openFaces = DIRS.filter((d) => {
      const n = neighbor(cell, d);
      return n !== NO_CELL && !solid(f, n);
    });
    const info: CellInfo = {
      cell, x, y, z,
      ground: g,
      water: g === 0,
      inTerrain: y < g,
      kind: f.kinds.get(cell),
      placed: f.world.blocks.get(cell)?.kind,
      structure: f.structureAt.get(cell),
      floor: f.world.floors.get(cell),
      floorStructure: f.floorAt.get(cell),
      solid: solid(f, cell),
      openFaces,
      sunnyFaces: openFaces.filter((d) => sun.isSunny(d)),
      skyOpen: top[columnIndex(x, z)]! <= y,
      walkableTop: onWalkableTop(f, cell),
      standable: standable(f, cell),
      aboveGround: y - g,
      distToWater: distToWater(f).at(x, z),
      distToFloor: distToFloor(f).at(x, z),
      distToStructure: distToStructure(f).at(x, z),
    };
    cache.set(cell, info);
    return info;
  };
  return { at, topSolid: (x, z) => top[columnIndex(x, z)]! };
});
