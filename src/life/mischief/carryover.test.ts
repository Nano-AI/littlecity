// Nothing of one town's mischief outlives it (design section 13b; the owner:
// "the new islands still have scorch marks and random burned windows ... you
// should have no trace of the old one"). The mischief systems run on a stage
// that counts what is drawn; after the town is replaced, called off or undone,
// nothing of it may be left in the picture.

import { describe, expect, test } from 'vitest';
import { columnIndex, key } from '@/core/grid';
import { identity, type Mat4Like } from '@/core/mat4';
import { createGame } from '@/app/game';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import type { InstanceHandle, LifeStage } from '../api';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { mischiefOf } from './director';
import mischiefSystem from './mischief.system';
import nukeSystem from './nuke.system';

/** A stage that knows which of the handles it gave out are still there, and which of those are shown. */
function countingStage() {
  const live = new Map<InstanceHandle, boolean>();
  const handle = (): InstanceHandle => {
    const h: InstanceHandle = {
      base: identity(),
      setMatrix: (_m: Mat4Like) => {},
      setVisible: (v) => void (live.has(h) && live.set(h, v)),
      setParams() {},
      release: () => void live.delete(h),
    };
    live.set(h, true);
    return h;
  };
  const stage: LifeStage = { instance: () => null, spawn: handle, spawnMesh: handle, liftStructure: handle, socket: () => identity() };
  return { stage, live: () => live.size, shown: () => [...live.values()].filter(Boolean).length };
}

function setup() {
  const counting = countingStage();
  const terrain = flatTerrain(3);
  // A bay of sea in one corner.
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) terrain.height[columnIndex(x, z)] = 0;
  const b = new TownBuilder(emptyWorld(3), terrain);
  for (let i = 0; i < 6; i++) b.house(14 + i * 2, 20, { floors: 2, color: i });
  b.put('tree', 20, 24);
  const signals = createSignals(3);
  const life = createLife(counting.stage, signals, { behaviours: [], systems: [mischiefSystem, nukeSystem] });
  const d = mischiefOf(counting.stage);
  const game = createGame({ world: b.world, terrain }, { show: (shape) => life.sync({ shape, dressing: null }) });
  d.connect({
    begin: () => game.begin(),
    apply: (edits) => void game.editAll(edits),
    end: () => game.end(),
    abort: () => void game.abort(),
    edit: (edits) => void game.editAll(edits),
    amend: (edits) => void game.amend(edits),
  });
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 0.1) {
      life.update(signals.advance(0.1));
      d.flush();
    }
  };
  /** A fire (its windows aglow) and a nuke, and on into the cloud. */
  const havoc = (): void => {
    d.ignite(key(14, 1, 20));
    run(12);
    d.dropNuke([24.5, 0.6, 20.5]);
    run(8);
    expect(counting.shown()).toBeGreaterThan(20);
  };
  return { counting, life, d, game, run, havoc };
}

describe('nothing of the mischief outlives the town', () => {
  test('a different town (a new island, the dice, a town opened): every handle is given back', () => {
    const { counting, life, d, havoc } = setup();
    havoc();
    // What the app does when it opens a different town.
    d.detach();
    life.dispose();
    expect(counting.live()).toBe(0);
    expect(d.busy).toBe(false);
  });

  test('undone mid-cloud: the town as before, and nothing of the show left', () => {
    const { counting, d, run, havoc } = setup();
    havoc();
    d.cancel();
    run(0.5);
    expect(counting.shown()).toBe(0);
  });

  test('undone after the act is over: the scorch and the rest of the show go with the crater', () => {
    const { counting, d, game, run } = setup();
    d.rebuild = false;
    d.dropNuke([24.5, 0.6, 20.5]);
    for (let i = 0; i < 400 && (d.active || d.busy); i++) run(1);
    expect(d.active).toBe(false);
    run(50); // the cloud gone: only the scorch (and embers) left
    expect(counting.shown()).toBeGreaterThan(0);
    expect(game.undo()).toBe(true);
    run(1);
    expect(counting.shown()).toBe(0);
  });

  test('a nuke over the sea, undone after it is over: its cloud goes with the undo', () => {
    const { counting, d, run } = setup();
    d.dropNuke([3.5, 0, 3.5]);
    run(8);
    expect(counting.shown()).toBeGreaterThan(20);
    for (let i = 0; i < 100 && d.active; i++) run(1);
    expect(d.active).toBe(false);
    d.undoing();
    run(0.5);
    expect(counting.shown()).toBe(0);
  });
});
