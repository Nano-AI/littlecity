import { describe, expect, test } from 'vitest';
import type { LifeStage } from '@/life/api';
import { setCrowd } from '@/life/doors/table';
import { mischiefOf } from '@/life/mischief/director';
import type { Crowd } from '@/life/people/crowd';
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
  test('shows how many residents the crowd says live here', () => {
    const stage = asStage();
    setCrowd(stage, { residents: 70, people: [], scuffles: { now: null } } as unknown as Crowd);
    expect(createStatsWatch().update(stage, 0)?.population).toBe(70);
  });

  test('a nuke and a bomb are different tallies and moods; a blast counts what it hit', () => {
    const stage = asStage();
    const w = createStatsWatch();
    w.update(stage, 0);
    emit(stage, { type: 'drop', bomb: { nuke: true } });
    expect(w.update(stage, 300)).toMatchObject({ mood: 25, silly: { label: 'Times nuked', n: 1 } });
    emit(stage, { type: 'drop', bomb: {} });
    const v = w.update(stage, 600)!;
    expect(v.mood).toBeLessThan(25);
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
