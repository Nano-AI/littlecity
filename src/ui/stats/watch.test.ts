import { describe, expect, test } from 'vitest';
import { createStatsWatch } from './watch';

describe('the stats watch', () => {
  test('returns null more often than every 250 ms', () => {
    const w = createStatsWatch();
    const stage = {};
    expect(w.update(stage, 0)).not.toBeNull();
    expect(w.update(stage, 100)).toBeNull();
    expect(w.update(stage, 260)).not.toBeNull();
  });

  test('survives a stage with nothing on it yet', () => {
    const v = createStatsWatch().update({}, 0);
    expect(v).toEqual({ population: null, mood: 70, silly: null });
  });
});
