// Helpers for the shaping-the-land gallery (design section 6, "Shaping the
// land"). Every scenario here stands on generator 2's island for seed 2 (a
// gentle island with two rivers), so dug ground can be checked side by side
// with the generator's own. Land edits go through the builder like any edit;
// the builder's own height helpers read the island as generated, so the
// level of a reshaped column is read here instead.

import { columnIndex, key, SIZE_Y } from '@/core/grid';
import type { PlacedKind } from '@/core/kinds';
import type { CameraSpec, TownBuilder } from '@/scenario';
import { islandOf } from '@/terrain/land';

export const SEED = 2;

/** The column's height as the player has left it. */
export const heightOf = (b: TownBuilder, x: number, z: number): number => islandOf(b.world, b.terrain).height[columnIndex(x, z)]!;

/** The first free level of a column on the reshaped island. */
export function topOf(b: TownBuilder, x: number, z: number): number {
  let y = heightOf(b, x, z);
  while (y < SIZE_Y && b.world.blocks.has(key(x, y, z))) y++;
  return y;
}

export function rect(x0: number, z0: number, x1: number, z1: number): number[] {
  const out: number[] = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push(columnIndex(x, z));
  return out;
}

/** One brush dab: the columns go up (1) or down (-1) a level, `times` times. Columns that cannot are skipped. */
export function shape(b: TownBuilder, cols: number[], dy: 1 | -1, times = 1): void {
  for (let i = 0; i < times; i++) {
    try {
      b.edit({ type: 'land', up: dy > 0 ? cols : [], down: dy < 0 ? cols : [] }, dy > 0 ? 'raise' : 'dig');
    } catch {
      return; // nothing left that can move
    }
  }
}

/** Digs columns down to the water. */
export const digToWater = (b: TownBuilder, cols: number[]): void => shape(b, cols, -1, 10);

/** Stacks `floors` blocks of a kind on top of a column of the reshaped island. */
export function stack(b: TownBuilder, kind: PlacedKind, x: number, z: number, floors = 1, color = 0): void {
  for (let i = 0; i < floors; i++) b.block(kind, x, topOf(b, x, z), z, { color });
}

/** A path (or plaza, garden) on each column of a rectangle, on the reshaped island. */
export function lay(b: TownBuilder, floor: 'path' | 'plaza' | 'garden', x0: number, z0: number, x1: number, z1: number): void {
  for (const i of rect(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1))) {
    const x = i % 48, z = Math.floor(i / 48);
    b.edit({ type: 'placeFloor', cell: key(x, topOf(b, x, z), z), floor }, `${floor} at (${x}, ${z})`);
  }
}

/** Four cameras round a spot, one from each quarter. */
export function quarters(target: [number, number, number], zoom: number): CameraSpec[] {
  return [45, 135, 225, 315].map((yaw) => ({ name: `q${yaw}`, yaw, pitch: 34, zoom, target }));
}
