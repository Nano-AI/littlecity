// Small pure helpers shared by both island generators (src/terrain/terrain.ts
// and src/terrain/terrain2.ts). Moved out of terrain.ts unchanged, so
// generator 1 still makes exactly the islands it always made (its digest is
// pinned in terrain.test.ts).

import { columnIndex, inColumnBounds, SIZE_X, SIZE_Z } from '@/core/grid';
import { rand } from '@/core/rand';

export const N = SIZE_X * SIZE_Z;
export const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1) on a lattice of the given cell size. */
export function valueNoise(seed: number, layer: string, x: number, z: number, size: number): number {
  const fx = x / size;
  const fz = z / size;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = smooth(fx - ix);
  const tz = smooth(fz - iz);
  const v = (a: number, b: number): number => rand(seed, layer, a, b);
  const top = v(ix, iz) + (v(ix + 1, iz) - v(ix, iz)) * tx;
  const bot = v(ix, iz + 1) + (v(ix + 1, iz + 1) - v(ix, iz + 1)) * tx;
  return top + (bot - top) * tz;
}

/** Two octaves of value noise, in [0, 1). */
export function fbm(seed: number, layer: string, x: number, z: number, size: number): number {
  return (valueNoise(seed, layer + '1', x, z, size) * 2 + valueNoise(seed, layer + '2', x, z, size / 2)) / 3;
}

export function hAt(h: Uint8Array, x: number, z: number): number {
  return inColumnBounds(x, z) ? h[columnIndex(x, z)]! : 0;
}

/** Labels 4-connected components of columns where `inSet` is true. Returns labels (−1 outside) and sizes. */
export function components(inSet: (i: number) => boolean): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(N).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < N; start++) {
    if (label[start] !== -1 || !inSet(start)) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % SIZE_X;
      const z = (i / SIZE_X) | 0;
      for (const [dx, dz] of D4) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inColumnBounds(nx, nz)) continue;
        const j = columnIndex(nx, nz);
        if (label[j] === -1 && inSet(j)) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

/** Steps (4-connected) from each column to the nearest column where `source` is true (0 on a source). */
export function distanceFrom(source: (i: number) => boolean): Int32Array {
  const dist = new Int32Array(N).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < N; i++) {
    if (source(i)) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % SIZE_X;
    const z = (i / SIZE_X) | 0;
    for (const [dx, dz] of D4) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inColumnBounds(nx, nz)) continue;
      const j = columnIndex(nx, nz);
      if (dist[j] === -1) {
        dist[j] = dist[i]! + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}

/** Steps (4-connected) from each land column to the nearest water column. */
export function coastDistance(h: Uint8Array): Int32Array {
  return distanceFrom((i) => h[i] === 0);
}

