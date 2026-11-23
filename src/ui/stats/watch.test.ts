import { describe, expect, test } from 'vitest';
import type { LifeStage } from '@/life/api';
import { mischiefOf } from '@/life/mischief/director';
import { raidsOf } from '@/life/raid/raids';
import type { Board } from '@/life/town/board';
import { scenesOf } from '@/life/town/scenes';
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

// The life layer's per-stage registers, with small stubs standing in for the town.
const asStage = (): LifeStage => ({}) as LifeStage;
const board = (stage: LifeStage, delivered: [string, number][] = []) =>
  ({ stage, now: 0, delivered: new Map(delivered), chains: [], season: { festival: 0 } }) as unknown as Board;
const scene = (kind: string) => scenesOf(boardWith).begin({ kind } as never);
let boardWith: Board;
const emit = (stage: LifeStage, e: object) => (mischiefOf(stage) as unknown as { emit(e: object): void }).emit(e);
const silly = (w: ReturnType<typeof createStatsWatch>, stage: object, now: number) => w.update(stage, now)?.silly;

describe('what the watch counts', () => {
  test('shows how many residents the town houses', () => {
    const shape = { structures: new Map([[1, { kind: 'house', cells: [1, 2, 3] }]]), structureAt: new Map() } as never;
    expect(createStatsWatch({ shape: () => shape }).update(asStage(), 0)?.population).toBe(2);
  });

  test('a nuke and a bomb are different tallies and moods; a blast counts what it hit', () => {
    const stage = asStage();
    const w = createStatsWatch();
    w.update(stage, 0);
    emit(stage, { type: 'drop', bomb: { nuke: true } });
    expect(w.update(stage, 300)).toMatchObject({ mood: 66, silly: { label: 'Times nuked', n: 1 } });
    emit(stage, { type: 'drop', bomb: {} });
    const v = w.update(stage, 600)!;
    expect(v.mood).toBeLessThan(66);
    emit(stage, { type: 'blast', bomb: 1, blast: { hit: [1, 2, 3] } });
    // Walk the rotation to the buildings count.
    const seen = new Map<string, number>();
    for (let t = 900; t < 900 + 8 * 4000; t += 4000) {
      const s = silly(w, stage, t);
      if (s) seen.set(s.label, s.n);
    }
    expect(seen.get('Bombs dropped')).toBe(1);
    expect(seen.get('Buildings ruined')).toBe(3);
  });

  test('loaves and fish are counted from the board, and a new town counts from its own first delivery', () => {
    const stage = asStage();
    const raids = raidsOf(stage);
    const w = createStatsWatch();
    raids.board = board(stage, [['loaf', 5]]);
    expect(silly(w, stage, 0)).toEqual({ label: 'Loaves delivered', n: 5 });
    // A different town: its board starts again from nothing, and its first fish still count.
    raids.board = board(stage, [['fishes', 2]]);
    let fish = 0;
    for (let t = 4300; t < 4300 + 4 * 4000 && !fish; t += 4000) {
      const s = silly(w, stage, t);
      if (s?.label === 'Fish landed') fish = s.n;
    }
    expect(fish).toBe(2);
  });

  test('a new town\'s first wedding counts although its scene numbers start again', () => {
    const stage = asStage();
    const w = createStatsWatch();
    boardWith = board(stage);
    scene('wedding');
    scene('wedding');
    w.update(stage, 0);
    boardWith = board(stage);
    scene('wedding');
    expect(silly(w, stage, 300)).toEqual({ label: 'Weddings', n: 3 });
  });
});

// A town of houses: each is [id, residents] (2 cells per resident), and `cells` maps cells to houses.
const town = (houses: [number, number][], cells: Record<number, number> = {}) => ({
  structures: new Map(
    houses.map(([id, n]) => [id, { id, kind: 'house', cells: Array.from({ length: n * 2 }, (_, i) => i) }]),
  ),
  structureAt: new Map(Object.entries(cells).map(([c, id]) => [Number(c), id])),
}) as never;
const burn = (stage: LifeStage, ...structures: number[]) => {
  (mischiefOf(stage).engine as unknown as { burning: () => unknown[] }).burning = () =>
    structures.map((structure) => ({ structure }));
};

describe('happiness follows the share of the town touched', () => {
  test('one bomb on one house barely moves it', () => {
    const stage = asStage();
    const shape = town([[1, 5], [2, 1495]], { 10: 1 });
    const w = createStatsWatch({ shape: () => shape });
    w.update(stage, 0);
    emit(stage, { type: 'blast', bomb: 1, blast: { hit: [{ cell: 10 }] } });
    expect(w.update(stage, 300)!.mood).toBeGreaterThanOrEqual(69.5);
  });

  test('a blast across a fifth of the homes drops it about twelve', () => {
    const stage = asStage();
    const shape = town([[1, 100], [2, 100], [3, 800]], { 10: 1, 11: 1, 12: 2 });
    const w = createStatsWatch({ shape: () => shape });
    w.update(stage, 0);
    emit(stage, { type: 'blast', bomb: 1, blast: { hit: [{ cell: 10 }, { cell: 11 }, { cell: 12 }] } });
    expect(Math.abs(w.update(stage, 300)!.mood - 58)).toBeLessThanOrEqual(0.5);
  });

  test('fires drag it down while they burn and let go when they are out', () => {
    const stage = asStage();
    const shape = town([[1, 500], [2, 500]]);
    const w = createStatsWatch({ shape: () => shape });
    burn(stage, 1, 1);
    let v = w.update(stage, 0)!;
    for (let t = 250; t < 600_000; t += 250) v = w.update(stage, t) ?? v;
    expect(Math.abs(v.mood - 50)).toBeLessThan(1);
    burn(stage);
    for (let t = 600_000; t < 1_200_000; t += 250) v = w.update(stage, t) ?? v;
    expect(Math.abs(v.mood - 70)).toBeLessThan(1);
  });

  test('a blast on empty ground touches no one', () => {
    const stage = asStage();
    const shape = town([[1, 5]]);
    const w = createStatsWatch({ shape: () => shape });
    w.update(stage, 0);
    emit(stage, { type: 'blast', bomb: 1, blast: { hit: [{ cell: 10 }, { cell: 11 }] } });
    expect(w.update(stage, 300)!.mood).toBe(70);
  });

  test("population counts every house, past the walkers' cap", () => {
    const shape = town(Array.from({ length: 80 }, (_, i) => [i, 2] as [number, number]));
    expect(createStatsWatch({ shape: () => shape }).update(asStage(), 0)!.population).toBe(160);
  });
});
