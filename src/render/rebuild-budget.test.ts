import { describe, expect, test } from 'vitest';
import { buildWithin, oldestFirst, sameAnchors, sameKeys } from './rebuild-budget';

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

describe('the queue of waiting rebuilds', () => {
  test('what waited keeps its place, new changes join at the back, what needs nothing leaves', () => {
    expect(oldestFirst([3, 1, 9], [1, 2, 3, 4])).toEqual([3, 1, 2, 4]);
  });

  test('under changes every frame, nothing starves behind newer ones', () => {
    // Every structure changes again each frame, and two fit in the budget.
    const { built, build, clock } = setup(4);
    const ids = [1, 2, 3, 4, 5, 6, 7, 8];
    let waiting: number[] = [];
    for (let frame = 0; frame < 4; frame++) waiting = buildWithin(oldestFirst(waiting, ids), build, 6, clock);
    expect([...built].sort()).toEqual(ids);
  });
});

describe('what may wait', () => {
  test('the same cells in the same order, and nothing else', () => {
    expect(sameKeys([4, 9, 12], [4, 9, 12])).toBe(true);
    expect(sameKeys([], [])).toBe(true);
    expect(sameKeys([4, 9, 12], [4, 9, 8])).toBe(false); // a column dug down: a cell a level lower
    expect(sameKeys([4, 9], [4, 9, 12])).toBe(false);
  });

  test('anchor frames match frame for frame, or the props must follow', () => {
    const door = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0.8, 5, 1];
    expect(sameAnchors({ door, sign: door }, { sign: [...door], door: [...door] })).toBe(true);
    expect(sameAnchors({}, {})).toBe(true);
    expect(sameAnchors({ door }, { door: door.map((v, i) => (i === 13 ? 0 : v)) })).toBe(false); // sunk a level
    expect(sameAnchors({ door }, { door, sign: door })).toBe(false);
    expect(sameAnchors({ door }, { sign: door })).toBe(false);
  });
});
