import { describe, expect, test } from 'vitest';
import {
  above, allChunks, below, chunkOf, DIR4, E, edgeCells, edgeKey, edgeOf, inBounds, key, keyX, keyY, keyZ, N, neighbor,
  NO_CELL, opposite, S, SIZE_X, SIZE_Y, SIZE_Z, turn, unedge, unkey, W,
} from './grid';

describe('grid', () => {
  test('key/unkey round-trips', () => {
    const seen = new Set<number>();
    for (let y = 0; y < SIZE_Y; y++) {
      for (let z = 0; z < SIZE_Z; z++) {
        for (let x = 0; x < SIZE_X; x++) {
          const k = key(x, y, z);
          expect(unkey(k)).toEqual({ x, y, z });
          expect([keyX(k), keyY(k), keyZ(k)]).toEqual([x, y, z]);
          seen.add(k);
        }
      }
    }
    expect(seen.size).toBe(SIZE_X * SIZE_Y * SIZE_Z);
  });

  test('keys sort by y, then z, then x', () => {
    expect(key(5, 0, 0)).toBeLessThan(key(0, 0, 1));
    expect(key(47, 0, 47)).toBeLessThan(key(0, 1, 0));
  });

  test('inBounds covers exactly the grid', () => {
    expect(inBounds(0, 0, 0)).toBe(true);
    expect(inBounds(47, 31, 47)).toBe(true);
    expect(inBounds(48, 0, 0)).toBe(false);
    expect(inBounds(0, 32, 0)).toBe(false);
    expect(inBounds(0, 0, -1)).toBe(false);
  });

  test('directions: N is −z, E is +x, S is +z, W is −x', () => {
    expect(DIR4[N]).toEqual([0, -1]);
    expect(DIR4[E]).toEqual([1, 0]);
    expect(DIR4[S]).toEqual([0, 1]);
    expect(DIR4[W]).toEqual([-1, 0]);
    expect(opposite(N)).toBe(S);
    expect(turn(N, 1)).toBe(E);
    expect(turn(N, -1)).toBe(W);
  });

  test('neighbours stop at the border', () => {
    expect(neighbor(key(3, 2, 3), E)).toBe(key(4, 2, 3));
    expect(neighbor(key(0, 2, 3), W)).toBe(NO_CELL);
    expect(neighbor(key(3, 2, 47), S)).toBe(NO_CELL);
    expect(above(key(1, 31, 1))).toBe(NO_CELL);
    expect(below(key(1, 0, 1))).toBe(NO_CELL);
    expect(above(key(1, 4, 1))).toBe(key(1, 5, 1));
  });

  test('edges are canonical: each boundary has one key', () => {
    expect(unedge(edgeKey(3, 1, 4, 'S'))).toEqual({ cell: key(3, 1, 4), side: 'S' });
    expect(edgeOf(key(3, 1, 4), E)).toBe(edgeKey(3, 1, 4, 'E'));
    expect(edgeOf(key(4, 1, 4), W)).toBe(edgeKey(3, 1, 4, 'E'));
    expect(edgeOf(key(3, 1, 5), N)).toBe(edgeKey(3, 1, 4, 'S'));
    expect(edgeOf(key(0, 1, 5), W)).toBe(NO_CELL);
    expect(edgeCells(edgeKey(3, 1, 4, 'E'))).toEqual([key(3, 1, 4), key(4, 1, 4)]);
  });

  test('chunks tile the map', () => {
    expect(allChunks()).toHaveLength(9);
    expect(chunkOf(17, 40)).toMatchObject({ cx: 1, cz: 2, x0: 16, x1: 31, z0: 32, z1: 47 });
  });
});
