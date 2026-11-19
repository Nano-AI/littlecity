// Dense per-cell arrays for fast lookups in hot loops (facades, alleys and
// any rule that scans many cells). Indexed directly by CellKey.

import { columnIndex, key, SIZE_X, SIZE_Z } from '@/core/grid';
import { ALL_KINDS, KINDS, type FloorKind, type Kind } from '@/core/kinds';
import { defineFact } from './api';

/** Codes in `Occupancy.kind`: 0 = no block, else ALL_KINDS.indexOf(kind) + 1. */
export const KIND_CODES: readonly Kind[] = ALL_KINDS;
/** Codes in `Occupancy.floor`: 0 = no floor. */
export const FLOOR_CODES: readonly (FloorKind | null)[] = [null, 'path', 'plaza', 'garden'];

export interface Occupancy {
  /** Resolved kind code per cell (0 = none; see KIND_CODES, offset by one). */
  kind: Uint8Array;
  /** Bit flags per cell: SOLID (terrain or a solid block), TERRAIN, BULKY (a solid or building block). */
  flags: Uint8Array;
  /** Floor code per cell (see FLOOR_CODES). */
  floor: Uint8Array;
  /** Block structure id per cell, or −1. */
  structure: Int32Array;
  kindAt(cell: number): Kind | undefined;
}

export const SOLID = 1;
export const TERRAIN = 2;
export const BULKY = 4;

const SIZE = 1 << 17;

export const occupancy = defineFact<Occupancy>('occupancy', (f) => {
  const kind = new Uint8Array(SIZE);
  const flags = new Uint8Array(SIZE);
  const floor = new Uint8Array(SIZE);
  const structure = new Int32Array(SIZE).fill(-1);
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const h = f.terrain.height[columnIndex(x, z)]!;
      for (let y = 0; y < h; y++) flags[key(x, y, z)] = SOLID | TERRAIN;
    }
  }
  const codes = new Map(ALL_KINDS.map((k, i) => [k, i + 1] as const));
  for (const [c, k] of f.kinds) {
    kind[c] = codes.get(k)!;
    const info = KINDS[k];
    flags[c] = (info.solid ? SOLID : 0) | (info.solid || info.building ? BULKY : 0);
    structure[c] = f.structureAt.get(c) ?? -1;
  }
  for (const [c, k] of f.world.floors) floor[c] = FLOOR_CODES.indexOf(k);
  return { kind, flags, floor, structure, kindAt: (c) => (c >= 0 && kind[c] ? ALL_KINDS[kind[c]! - 1] : undefined) };
});
