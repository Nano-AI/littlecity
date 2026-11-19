// The edit flow without a browser: the game asks canApply, applies, keeps
// history, and tells its owner what to show. Uses only edits that are legal
// under the design's rules (pieces on flat ground), so it holds whatever the
// world module's rules become.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { Edit, World } from '@/core/world';
import type { ShapePlan } from '@/resolve/plan';
import { flatTerrain } from '@/scenario';
import { ghostFor } from '@/ui/ghost';
import { SAVE_KEY, loadTown } from '@/world/save';
import { emptyWorld } from '@/world/world';
import { createAutosave } from './autosave';
import { createGame } from './game';

const terrain = flatTerrain(3);
const place = (x: number, z: number, kind: 'house' | 'marble' | 'auto' = 'house', y = 1): Edit => ({
  type: 'placeBlock',
  cell: key(x, y, z),
  kind,
  color: 'auto',
  from: null,
});

function setup() {
  const shown: { shape: ShapePlan; landed: Edit | null }[] = [];
  let changes = 0;
  const game = createGame(
    { world: emptyWorld(3), terrain },
    { show: (shape, landed) => shown.push({ shape, landed }), changed: () => changes++ },
  );
  return { game, shown, changes: () => changes };
}

describe('the game', () => {
  test('shows the town at once, then after every edit, with the edit that landed', () => {
    const { game, shown } = setup();
    expect(shown).toHaveLength(1);
    expect(shown[0]!.landed).toBeNull();
    expect(game.edit(place(10, 10))).toEqual({ ok: true });
    expect(shown).toHaveLength(2);
    expect(shown[1]!.landed).toEqual(place(10, 10));
    expect(shown[1]!.shape).toBe(game.shape);
    expect(game.shape.world).toBe(game.world);
    expect(game.world.blocks.has(key(10, 1, 10))).toBe(true);
  });

  test('an illegal edit changes nothing and comes back with the reason', () => {
    const { game, shown } = setup();
    game.edit(place(10, 10));
    const before = game.world;
    const verdict = game.edit(place(10, 10));
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? '' : verdict.reason).not.toBe('');
    expect(game.world).toBe(before);
    expect(shown).toHaveLength(2);
    expect(game.can({ type: 'eraseBlock', cell: key(20, 1, 20) }).ok).toBe(false);
  });

  test('undo and redo step through edits; a new edit clears redo', () => {
    const { game } = setup();
    expect(game.canUndo).toBe(false);
    expect(game.undo()).toBe(false);
    game.edit(place(10, 10));
    game.edit(place(12, 10));
    expect(game.world.blocks.size).toBe(2);
    expect(game.undo()).toBe(true);
    expect(game.world.blocks.size).toBe(1);
    expect(game.canRedo).toBe(true);
    expect(game.redo()).toBe(true);
    expect(game.world.blocks.size).toBe(2);
    expect(game.redo()).toBe(false);
    game.undo();
    game.edit(place(14, 10));
    expect(game.canRedo).toBe(false);
    expect([...game.world.blocks.keys()].sort()).toEqual([key(10, 1, 10), key(14, 1, 10)].sort());
  });

  test('a batch (a Shift-drag run) is one undo step', () => {
    const { game } = setup();
    game.edit(place(8, 8));
    game.begin();
    for (let x = 10; x < 15; x++) game.edit(place(x, 10, 'marble'));
    // Nothing can be undone half-way through a run.
    expect(game.canUndo).toBe(false);
    game.end();
    expect(game.world.blocks.size).toBe(6);
    game.undo();
    expect(game.world.blocks.size).toBe(1);
    game.redo();
    expect(game.world.blocks.size).toBe(6);
    // An empty batch leaves no step behind.
    game.begin();
    game.end();
    game.undo();
    expect(game.world.blocks.size).toBe(1);
  });

  test('restart is a different town: history starts over', () => {
    const { game, shown } = setup();
    game.edit(place(10, 10));
    const other = emptyWorld(99);
    game.restart({ world: other, terrain: flatTerrain(99) });
    expect(game.world).toBe(other);
    expect(game.canUndo).toBe(false);
    expect(shown.at(-1)!.shape.world).toBe(other);
    expect(shown.at(-1)!.landed).toBeNull();
  });

  test('dressing arrives through poll, once, for the newest world', () => {
    const { game } = setup();
    game.edit(place(10, 10));
    game.edit(place(12, 10));
    // "When it is ready": the staged resolver may take a few polls.
    let ready = game.poll();
    for (let i = 0; i < 20 && !ready; i++) ready = game.poll();
    expect(ready?.shape).toBe(game.shape);
    expect(game.poll()).toBeNull();
  });
});

describe('the ghost', () => {
  test('a legal placement shows the new structure of a what-if plan, and changes nothing', () => {
    const { game } = setup();
    const before = game.world;
    const cell = key(10, 1, 10);
    const ghost = ghostFor({ tries: [place(10, 10)], at: cell }, game)!;
    expect(game.world).toBe(before);
    expect(ghost.refuse).toBeUndefined();
    expect(ghost.plan.world.blocks.has(cell)).toBe(true);
    expect(ghost.show).toEqual([ghost.plan.structureAt.get(cell)]);
    expect(ghost.plan.structures.has(ghost.show[0]!)).toBe(true);
  });

  test('floors and edge pieces have ghosts too', () => {
    const { game } = setup();
    const cell = key(10, 1, 10);
    const floor = ghostFor({ tries: [{ type: 'placeFloor', cell, floor: 'path' }], at: cell }, game)!;
    expect(floor.show).toEqual([floor.plan.floorAt.get(cell)]);
    const edge = ghostFor({ tries: [{ type: 'placeEdge', edge: cell * 2, kind: 'fence' }], at: cell }, game)!;
    expect(edge.show).toEqual([edge.plan.edgeAt.get(cell * 2)]);
  });

  test('an illegal target is refused in red, on the plan that is showing', () => {
    const { game } = setup();
    game.edit(place(10, 10));
    const cell = key(10, 1, 10);
    expect(ghostFor({ tries: [place(10, 10)], at: cell }, game)).toEqual({ plan: game.shape, show: [], refuse: cell });
  });

  test('only placing has a ghost: change, paint and erase do not', () => {
    const { game } = setup();
    game.edit(place(10, 10, 'auto'));
    const cell = key(10, 1, 10);
    expect(ghostFor({ tries: [{ type: 'eraseBlock', cell }], at: cell }, game)).toBeNull();
    expect(ghostFor({ tries: [{ type: 'setKind', cell, kind: 'tower' }], at: cell }, game)).toBeNull();
    expect(ghostFor({ tries: [], at: cell, wiggle: true }, game)).toBeNull();
  });
});

describe('autosave', () => {
  function fakeStorage(fail = false) {
    const data = new Map<string, string>();
    let writes = 0;
    return {
      data,
      writes: () => writes,
      getItem: (k: string) => data.get(k) ?? null,
      setItem(k: string, v: string) {
        writes++;
        if (fail) throw new Error('QuotaExceededError');
        data.set(k, v);
      },
    };
  }
  function clock() {
    let pending: { fn: () => void; ms: number } | null = null;
    return {
      setTimer: (fn: () => void, ms: number) => (pending = { fn, ms }),
      clearTimer: () => void (pending = null),
      waitingMs: () => pending?.ms ?? null,
      fire() {
        const p = pending;
        pending = null;
        p?.fn();
      },
    };
  }

  test('saves 500 ms after the last change, once however many changes there were', () => {
    const storage = fakeStorage();
    const timers = clock();
    let world: World = emptyWorld(5);
    const autosave = createAutosave({ storage, world: () => world, onFail: () => {}, ...timers });
    autosave.schedule();
    autosave.schedule();
    world = { ...world, nextSeq: 7 };
    autosave.schedule();
    expect(timers.waitingMs()).toBe(500);
    expect(storage.writes()).toBe(0);
    timers.fire();
    expect(storage.writes()).toBe(1);
    expect(storage.data.has(SAVE_KEY)).toBe(true);
    expect(loadTown(storage)?.nextSeq).toBe(7);
  });

  test('flush saves at once if a save is waiting; while off, nothing is saved', () => {
    const storage = fakeStorage();
    const timers = clock();
    const autosave = createAutosave({ storage, world: () => emptyWorld(5), onFail: () => {}, ...timers });
    autosave.flush();
    expect(storage.writes()).toBe(0);
    autosave.schedule();
    autosave.flush();
    expect(storage.writes()).toBe(1);
    autosave.enabled = false;
    autosave.schedule();
    autosave.flush();
    timers.fire();
    expect(storage.writes()).toBe(1);
  });

  test('when storage fails the game goes on and says so once', () => {
    const timers = clock();
    let said = 0;
    for (const storage of [fakeStorage(true), null]) {
      said = 0;
      const autosave = createAutosave({ storage, world: () => emptyWorld(5), onFail: () => said++, ...timers });
      for (let i = 0; i < 3; i++) {
        autosave.schedule();
        timers.fire();
      }
      expect(said).toBe(1);
    }
  });
});
