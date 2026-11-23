import { describe, expect, test } from 'vitest';
import { buildWithin } from './rebuild-budget';

/** A clock that moves on by `cost` milliseconds each time something is built. */
function setup(cost: number) {
  let now = 0;
  const built: number[] = [];
  const build = (id: number): void => {
    built.push(id);
    now += cost;
  };
  return { built, build, clock: () => now };
}

describe('building within a budget', () => {
  test('builds everything when the budget allows', () => {
    const { built, build, clock } = setup(0);
    expect(buildWithin([1, 2, 3], build, 6, clock)).toEqual([]);
    expect(built).toEqual([1, 2, 3]);
  });

  test('stops once the budget is spent', () => {
    const { built, build, clock } = setup(4);
    expect(buildWithin([1, 2, 3, 4], build, 6, clock)).toEqual([3, 4]);
    expect(built).toEqual([1, 2]);
  });

  test('always builds the first, even over budget', () => {
    const { built, build, clock } = setup(50);
    expect(buildWithin([1, 2, 3], build, 6, clock)).toEqual([2, 3]);
    expect(built).toEqual([1]);
  });

  test('an empty list builds nothing', () => {
    const { built, build, clock } = setup(4);
    expect(buildWithin([], build, 6, clock)).toEqual([]);
    expect(built).toEqual([]);
  });
});
