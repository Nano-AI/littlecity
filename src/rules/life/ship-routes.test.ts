import { describe, expect, it } from 'vitest';
import { SIZE_X, SIZE_Z } from '@/core/grid';
import { seaField, seaFieldUncached } from './ship-routes';

function mask(...on: number[]): Uint8Array {
  const m = new Uint8Array(SIZE_X * SIZE_Z);
  for (const i of on) m[i] = 1;
  return m;
}

describe('seaField', () => {
  it('gives the same field for the same mask without working it out again', () => {
    const a = seaField(mask(100, 101, 148));
    const b = seaField(mask(100, 101, 148));
    expect(b).toBe(a);
  });

  it('a different mask gets its own field', () => {
    const a = seaField(mask(200, 201));
    const m = mask(200, 201);
    m[900] = 1;
    const b = seaField(m);
    expect(b).not.toBe(a);
    expect(Array.from(b.dist)).toEqual(Array.from(seaFieldUncached(m).dist));
  });

  it('does not change when the caller changes its mask afterwards', () => {
    const m = mask(300, 301);
    const a = seaField(m);
    m[1000] = 1;
    expect(seaField(mask(300, 301))).toBe(a);
    expect(a.blocked[1000]).toBe(0);
  });

  it('the cache holds a few masks', () => {
    const first = seaField(mask(400));
    seaField(mask(401));
    seaField(mask(402));
    seaField(mask(403));
    expect(seaField(mask(400))).toBe(first);
  });
});
