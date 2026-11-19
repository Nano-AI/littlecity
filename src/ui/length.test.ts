// Held length: the run a click places. The rules come from canApply; what
// is tested here is which cells are tried, in which order, and when the run
// stops.

import { describe, expect, test } from 'vitest';
import { CELL_H, E, edgeKey, key, N, S, W } from '@/core/grid';
import type { Edit } from '@/core/world';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { INPUT } from '@/style/input';
import { emptyWorld } from '@/world/world';
import { planUse, type ActionContext, type ToolState } from './actions';
import { clampLength, createScrollSteps, growthOf, MAX_LENGTH, planRun } from './length';
import { pickCell, type Pick } from './pick';

const flat = flatTerrain(1);
const down = (x: number, z: number) => ({ origin: [x, 50, z] as const, dir: [0, -1, 0] as const });

function setup(build: (b: TownBuilder) => void = () => {}, terrain = flat): ActionContext {
  const b = new TownBuilder(emptyWorld(1), terrain);
  build(b);
  return { world: b.world, terrain, rayDir: [-0.5, -0.6, -0.6] };
}
const pickAt = (ctx: ActionContext, x: number, z: number): Pick => pickCell(down(x, z), ctx.world, ctx.terrain)!;
const tool = (item: ToolState['item'], swatch: ToolState['swatch'] = 'auto'): ToolState => ({ item, swatch });
const cellsOf = (edits: Edit[]): number[] => edits.map((e) => ('cell' in e ? e.cell : 'edge' in e ? e.edge : -1));

describe('which pieces have a length', () => {
  test('upward: pillar, tower, lighthouse; along the ground: fences, walls, floors, dock, arch, marble; nothing else', () => {
    for (const id of ['pillar', 'tower', 'lighthouse'] as const) expect(growthOf(id)).toBe('up');
    for (const id of ['fence', 'wall', 'path', 'plaza', 'garden', 'dock', 'arch', 'marble'] as const) expect(growthOf(id)).toBe('ground');
    for (const id of ['auto', 'house', 'stairs', 'windmill', 'tree', 'fountain', 'stall', 'change', 'paint', 'erase'] as const) expect(growthOf(id)).toBeNull();
  });

  test('length runs from 1 to 12', () => {
    expect(MAX_LENGTH).toBe(12);
    expect([clampLength(0), clampLength(5), clampLength(40)]).toEqual([1, 5, 12]);
  });
});

describe('planRun', () => {
  test('a length of 1 is exactly a plain click', () => {
    const ctx = setup();
    const pick = pickAt(ctx, 20.9, 20.5);
    const run = planRun(tool('marble'), pick, ctx, 1);
    expect(run.edits).toEqual([planUse(tool('marble'), pick, ctx).tries[0]]);
    expect(run.dir).toBeNull();
  });

  test('a ground run grows toward the edge of the face nearest the pointer', () => {
    const ctx = setup();
    const east = planRun(tool('path'), pickAt(ctx, 20.9, 20.5), ctx, 3);
    expect(east.dir).toBe(E);
    expect(cellsOf(east.edits)).toEqual([key(20, 1, 20), key(21, 1, 20), key(22, 1, 20)]);
    // Nudging the pointer within the square swings the run round.
    const north = planRun(tool('path'), pickAt(ctx, 20.5, 20.1), ctx, 3);
    expect(north.dir).toBe(N);
    expect(cellsOf(north.edits)).toEqual([key(20, 1, 20), key(20, 1, 19), key(20, 1, 18)]);
    expect(planRun(tool('path'), pickAt(ctx, 20.2, 20.6), ctx, 2).dir).toBe(W);
    expect(planRun(tool('path'), pickAt(ctx, 20.4, 20.8), ctx, 2).dir).toBe(S);
  });

  test('a side face: the nearer of its upright edges', () => {
    const ctx = setup((b) => b.block('marble', 20, 1, 20));
    // From the east, at z = 20.8: the run goes south along the face.
    const ray = { origin: [40, 1.5 * CELL_H, 20.8] as const, dir: [-1, 0, 0] as const };
    const pick = pickCell(ray, ctx.world, ctx.terrain)!;
    const run = planRun(tool('marble'), pick, ctx, 3);
    expect(run.dir).toBe(S);
    expect(cellsOf(run.edits)).toEqual([key(21, 1, 20), key(21, 1, 21), key(21, 1, 22)]);
  });

  test('follows a terrain step of one level, up and down', () => {
    const hill = new TerrainBuilder(1).flat(1).rect(22, 18, 23, 22, 2).build();
    const ctx = setup(() => {}, hill);
    const run = planRun(tool('fence'), pickAt(ctx, 20.6, 20.5), ctx, 5);
    expect(cellsOf(run.edits)).toEqual([key(20, 1, 20), key(21, 1, 20), key(22, 2, 20), key(23, 2, 20), key(24, 1, 20)]);
  });

  test('stops at a step of two levels', () => {
    const cliff = new TerrainBuilder(1).flat(1).rect(22, 18, 23, 22, 3).build();
    const ctx = setup(() => {}, cliff);
    const run = planRun(tool('path'), pickAt(ctx, 20.9, 20.5), ctx, 6);
    expect(cellsOf(run.edits)).toEqual([key(20, 1, 20), key(21, 1, 20)]);
    // And down a two-level drop, the same.
    const fromTop = planRun(tool('path'), pickAt(ctx, 23.9, 20.5), ctx, 6);
    expect(cellsOf(fromTop.edits)).toEqual([key(23, 3, 20)]);
  });

  test('ends at the first cell canApply refuses', () => {
    const ctx = setup((b) => b.block('tree', 23, 1, 20));
    const run = planRun(tool('marble'), pickAt(ctx, 20.9, 20.5), ctx, 8);
    expect(cellsOf(run.edits)).toEqual([key(20, 1, 20), key(21, 1, 20), key(22, 1, 20)]);
    expect(run.refusal).toBeNull();
  });

  test('each cell is tried against the world after the earlier ones', () => {
    // A path along a row that already has path in its third square: the run ends there (already a path).
    const ctx = setup((b) => b.path(22, 20));
    const run = planRun(tool('path'), pickAt(ctx, 20.9, 20.5), ctx, 5);
    expect(cellsOf(run.edits)).toEqual([key(20, 1, 20), key(21, 1, 20)]);
  });

  test('a refused first cell places nothing', () => {
    const shore = new TerrainBuilder(1).flat(1).build();
    const ctx = setup(() => {}, shore);
    const run = planRun(tool('path'), pickAt(ctx, 2.5, 20.5), ctx, 4);
    expect(run.edits).toEqual([]);
    expect(run.refusal).toBe('floors cannot go on water');
    expect(run.at).toBe(key(2, 0, 20));
    expect(run.world).toBe(ctx.world);
  });

  test('never longer than 12', () => {
    const ctx = setup();
    const run = planRun(tool('plaza'), pickAt(ctx, 6.9, 20.5), ctx, 30);
    expect(run.edits).toHaveLength(12);
    expect(cellsOf(run.edits).at(-1)).toBe(key(17, 1, 20));
  });

  test("the first cell's colour throughout, down a step", () => {
    const ctx = setup((b) => b.block('marble', 20, 1, 20, { color: 5 }));
    // On top of the marble block; the run steps down one level beside it.
    const run = planRun(tool('marble'), pickCell({ origin: [20.9, 50, 20.5], dir: [0, -1, 0] }, ctx.world, ctx.terrain)!, ctx, 3);
    expect(cellsOf(run.edits)).toEqual([key(20, 2, 20), key(21, 1, 20), key(22, 1, 20)]);
    expect(cellsOf(run.edits).map((c) => run.world.blocks.get(c)?.color)).toEqual([5, 5, 5]);
    // A forced swatch colour likewise.
    const forced = planRun(tool('marble', 2), pickAt(ctx, 30.9, 30.5), ctx, 3);
    expect(cellsOf(forced.edits).map((c) => forced.world.blocks.get(c)?.color)).toEqual([2, 2, 2]);
  });

  test('upward pieces grow straight up from the target cell', () => {
    const ctx = setup();
    const run = planRun(tool('pillar'), pickAt(ctx, 20.9, 20.5), ctx, 4);
    expect(run.dir).toBe('up');
    expect(cellsOf(run.edits)).toEqual([1, 2, 3, 4].map((y) => key(20, y, 20)));
  });

  test('an edge fence grows along its boundary line, toward the nearer end', () => {
    const ctx = setup();
    // The east strip of (20, 20), toward its south end.
    const run = planRun(tool('fence'), pickAt(ctx, 20.9, 20.7), ctx, 3);
    expect(run.dir).toBe(S);
    expect(cellsOf(run.edits)).toEqual([20, 21, 22].map((z) => edgeKey(20, 1, z, 'E')));
    // The north strip, toward its west end.
    const west = planRun(tool('wall'), pickAt(ctx, 20.3, 20.1), ctx, 2);
    expect(west.dir).toBe(W);
    expect(cellsOf(west.edits)).toEqual([edgeKey(20, 1, 19, 'S'), edgeKey(19, 1, 19, 'S')]);
  });

  test('a dock run stays on the water', () => {
    const ctx = setup();
    const run = planRun(tool('dock'), pickAt(ctx, 1.5, 20.9), ctx, 4);
    expect(cellsOf(run.edits)).toEqual([20, 21, 22, 23].map((z) => key(1, 0, z)));
  });
});

describe('scroll steps', () => {
  test('one step per wheel notch, whatever its size; scrolling up adds', () => {
    const steps = createScrollSteps();
    expect(steps.feed(-100, false)).toBe(1);
    expect(steps.feed(-3, true)).toBe(1);
    expect(steps.feed(240, false)).toBe(-1);
  });

  test(`a trackpad steps once per ${INPUT.lengthScroll} px, and a change of direction starts over`, () => {
    const steps = createScrollSteps();
    const fed = Array.from({ length: 10 }, () => steps.feed(-10, false));
    expect(fed.reduce((a, b) => a + b, 0)).toBe(Math.floor(100 / INPUT.lengthScroll));
    expect(steps.feed(30, false)).toBe(0);
    expect(steps.feed(15, false)).toBe(-1);
  });
});
