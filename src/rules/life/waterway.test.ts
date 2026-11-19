// Routes through open water (waterway.ts): round a headland, never over it.

import { describe, expect, test } from 'vitest';
import { columnIndex, key, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { Terrain } from '@/core/world';
import { alongRoute, clearRun, routeLength, waterMask, waterRoute, type Pt } from './waterway';

/** All sea, with land where `land(x, z)` says so. */
function sea(land: (x: number, z: number) => boolean, kinds = new Map<number, Kind>()): { terrain: Terrain; kinds: Map<number, Kind> } {
  const height = new Uint8Array(SIZE_X * SIZE_Z);
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) if (land(x, z)) height[columnIndex(x, z)] = 2;
  return { terrain: { seed: 1, height, material: new Uint8Array(SIZE_X * SIZE_Z) }, kinds };
}

/** Every point along the route, every 0.05, lies on open water. */
function wetAll(m: Uint8Array, route: readonly Pt[]): boolean {
  const len = routeLength(route);
  for (let s = 0; s <= len; s += 0.05) {
    const p = alongRoute(route, s);
    if (m[columnIndex(Math.floor(p.x), Math.floor(p.z))] !== 1) return false;
  }
  return true;
}

describe('waterRoute', () => {
  test('straight across open water when nothing is in the way', () => {
    const m = waterMask(sea(() => false));
    expect(waterRoute(m, [5.5, 5.5], [30.5, 9.5])).toEqual([
      [5.5, 5.5],
      [30.5, 9.5],
    ]);
  });

  test('round a headland that reaches out between the two ends', () => {
    // A tongue of land from the north edge down to z = 30, at x 20..24.
    const m = waterMask(sea((x, z) => x >= 20 && x <= 24 && z <= 30));
    const from: Pt = [10.5, 10.5], to: Pt = [34.5, 10.5];
    expect(clearRun(m, from, to)).toBe(false);
    const route = waterRoute(m, from, to)!;
    expect(route).not.toBeNull();
    expect(route[0]).toEqual(from);
    expect(route[route.length - 1]).toEqual(to);
    expect(route.length).toBeGreaterThan(2);
    expect(wetAll(m, route)).toBe(true);
    // It goes round the tip, not the long way round the map.
    expect(routeLength(route)).toBeLessThan(70);
  });

  test('a dock at sea level is in the way too; no way at all gives null', () => {
    const docks = new Map<number, Kind>();
    for (let z = 0; z < SIZE_Z; z++) docks.set(key(24, 0, z), 'dock'); // a wall of dock from edge to edge
    const m = waterMask(sea(() => false, docks));
    expect(waterRoute(m, [10.5, 10.5], [34.5, 10.5])).toBeNull();
    expect(waterRoute(m, [10.5, 10.5], [10.5, 40.5])).not.toBeNull();
    // An end on land is no route.
    const land = waterMask(sea((x) => x < 5));
    expect(waterRoute(land, [2.5, 2.5], [20.5, 20.5])).toBeNull();
  });
});
