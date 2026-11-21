import { describe, expect, test } from 'vitest';
import { parseVolume } from './volume';

describe('the volumes', () => {
  test('a stored level is a number from 0 to 1', () => {
    expect(parseVolume('0.4', 1)).toBe(0.4);
    expect(parseVolume('0', 1)).toBe(0);
    expect(parseVolume('1', 0.4)).toBe(1);
  });
  test('out of range is brought in; nothing or nonsense is the fallback', () => {
    expect(parseVolume('7', 0.4)).toBe(1);
    expect(parseVolume('-2', 0.4)).toBe(0);
    expect(parseVolume(null, 0.4)).toBe(0.4);
    expect(parseVolume('', 0.4)).toBe(0.4);
    expect(parseVolume('loud', 0.4)).toBe(0.4);
  });
});
