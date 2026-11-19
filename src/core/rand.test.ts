import { describe, expect, test } from 'vitest';
import { hash, pick, rand, randInt } from './rand';

describe('rand', () => {
  // Golden values: if these change, every saved town re-rolls. They must never change.
  test('rand is stable across runs', () => {
    expect(hash(0)).toBe(519224640);
    expect(hash(1, 2, 3)).toBe(635760356);
    expect(hash(7, 'D05.laundry-line', 4660)).toBe(3405246217);
    expect(hash(7, 'a', 'b')).toBe(4201326766);
    expect(hash(7, 'ab')).toBe(179615769);
    expect(hash(-5, 1.5)).toBe(3328129892);
    expect(rand(42, 'x')).toBe(0.4162948178127408);
    expect(rand(42, 'x', 1)).toBe(0.8464917337987572);
    expect(pick(['a', 'b', 'c', 'd'], [1, 1, 1, 5], 9, 'k')).toBe('c');
  });

  test('same inputs, same number; different inputs, different numbers', () => {
    expect(rand(3, 'rule', 100)).toBe(rand(3, 'rule', 100));
    expect(rand(3, 'rule', 100)).not.toBe(rand(3, 'rule', 101));
    expect(rand(3, 'rule', 100)).not.toBe(rand(4, 'rule', 100));
    expect(hash(1, 'ab', 'c')).not.toBe(hash(1, 'a', 'bc'));
    expect(hash(1, 1, 2)).not.toBe(hash(1, 2, 1));
  });

  test('rand is in [0, 1) and roughly uniform', () => {
    let sum = 0;
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const r = rand(11, 'u', i);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      sum += r;
      buckets[Math.floor(r * 10)]!++;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
    for (const b of buckets) expect(b).toBeGreaterThan(1700);
  });

  test('pick follows weights and randInt stays in range', () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[pick(['a', 'b'] as const, [3, 1], 5, i)]++;
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.6);
    expect(pick(['only'], null, 1)).toBe('only');
    expect(() => pick([], null, 1)).toThrow();
    for (let i = 0; i < 500; i++) {
      const n = randInt(3, 6, 8, i);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});
