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
import { packRuin } from '@/world/damage';
import { emptyWorld } from '@/world/world';
import type { InstanceHandle, LifeStage } from '../api';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { Director, mischiefOf, MEND, STRIKE, type MischiefEvent } from './director';
import mischiefSystem from './mischief.system';
import lightningSystem from './lightning.system';
import nukeSystem, { SCORCH } from './nuke.system';

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
  b.put('fountain', 30, 20);
  const signals = createSignals(3);
  const life = createLife(counting.stage, signals, { behaviours: [], systems: [mischiefSystem, nukeSystem, lightningSystem] });
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
    let t = 0;
    for (; t < 400 && (d.active || d.busy); t++) run(1);
    expect(d.active).toBe(false);
    // The cloud gone: only the scorch (and embers) left, the scorch not yet faded.
    if (t < 50) run(50 - t);
    expect(t).toBeLessThan(SCORCH.gone - 30);
    expect(counting.shown()).toBeGreaterThan(0);
    // What the undo button does.
    d.undoing();
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

  test('left alone, the scorch fades back to the ground and nothing of the nuke is left', () => {
    const { counting, d, run } = setup();
    d.dropNuke([24.5, 0.6, 20.5]);
    run(SCORCH.from + 5);
    expect(counting.shown()).toBeGreaterThan(0);
    run(SCORCH.gone + 60 - SCORCH.from - 5);
    expect(d.busy).toBe(false);
    expect(counting.shown()).toBe(0);
  });

  test('lightning: a cloud, the bolt, the house alight; undo puts it back; nothing left drawn once the cloud has gone', () => {
    const { counting, d, game, run } = setup();
    const before = game.world;
    const events: MischiefEvent['type'][] = [];
    d.on((e) => events.push(e.type));
    const cell = key(16, 2, 20);
    expect(d.strike(cell, [16.5, 2.4, 20.5])).toBe(true);
    // The cloud gathers first; nothing is alight yet.
    run(STRIKE.at - 0.2);
    expect(events).toEqual(['cloud']);
    expect(d.engine.burning().length).toBe(0);
    expect(counting.shown()).toBeGreaterThan(0);
    // The bolt comes down and the house catches, within a second of the click.
    run(0.4);
    expect(events).toEqual(['cloud', 'strike', 'lit']);
    expect(d.engine.burning().some((b) => b.cell === cell)).toBe(true);
    run(10);
    expect([...game.world.blocks.values()].some((b) => b.ruin)).toBe(true);
    // Undo while it burns: the town as before, and nothing of the strike or the fire drawn.
    d.cancel();
    run(0.5);
    expect([...game.world.blocks]).toEqual([...before.blocks]);
    expect(counting.shown()).toBe(0);
  });

  test('lightning on what cannot burn: the bolt strikes and fizzles, nothing burns, and the cloud goes', () => {
    const { counting, d, run } = setup();
    // A fountain (nothing in it burns).
    expect(d.strike(key(30, 1, 20), [30.5, 2.4, 20.5])).toBe(false);
    run(STRIKE.at + 0.1);
    expect(d.engine.burning().length).toBe(0);
    run(STRIKE.gone);
    expect(d.active).toBe(false);
    expect(counting.shown()).toBe(0);
  });
});

describe('the town mends in bounded batches', () => {
  const ENV = { wind: () => ({ dirX: 1, dirZ: 0, strength: 0.3 }) };

  /** A town of two-floor houses, every cell a blast ruin, mended by a director over a real game; the size of every batch it sends. */
  function mend(houses: number, w = 1, big = false) {
    const terrain = flatTerrain(3);
    const b = new TownBuilder(emptyWorld(3), terrain);
    if (big) b.house(8, 40, { floors: 2, w: 2, d: 2, color: 0 });
    const bigCells = new Set(b.world.blocks.keys());
    for (let i = 0; i < houses; i++) b.house(8 + (i % 6) * 5, 8 + Math.floor(i / 6) * 5, { floors: 2, w, d: w, color: i % 6 });
    const d = new Director(5);
    const game = createGame({ world: b.world, terrain }, { show: (shape) => d.sync(shape) });
    const batches: number[] = [];
    d.connect({
      begin: () => game.begin(),
      apply: (edits) => void game.editAll(edits),
      end: () => game.end(),
      abort: () => void game.abort(),
      edit: (edits) => void game.editAll(edits),
      amend: (edits) => {
        batches.push(edits.length);
        void game.amend(edits);
      },
    });
    const ruin = packRuin({ stage: 3, cause: 'blast' });
    game.editAll([...game.world.blocks.keys()].map((cell) => ({ type: 'setRuin', cell, ruin })));
    let bigFirst = -1;
    for (let t = 0; t < 600 * 30; t++) {
      d.update(1 / 30, ENV);
      if (bigFirst < 0 && [...bigCells].some((c) => game.world.blocks.get(c)?.ruin !== ruin)) bigFirst = t / 30;
    }
    return { bigFirst, batches, ruins: [...game.world.blocks.values()].filter((x) => x.ruin).length, cells: game.world.blocks.size };
  }

  test('a big aftermath mends in batches no bigger than MEND.cellsPerTick, and every building is mended', () => {
    const was = MEND.cellsPerTick;
    MEND.cellsPerTick = 6;
    try {
      const r = mend(12);
      expect(r.cells).toBeGreaterThan(12);
      expect(Math.max(...r.batches)).toBeLessThanOrEqual(6);
      expect(r.ruins).toBe(0);
    } finally {
      MEND.cellsPerTick = was;
    }
  });

  test('a building bigger than the cap still mends', () => {
    const was = MEND.cellsPerTick;
    MEND.cellsPerTick = 4;
    try {
      const r = mend(1, 2);
      expect(r.cells).toBeGreaterThan(4);
      expect(r.ruins).toBe(0);
    } finally {
      MEND.cellsPerTick = was;
    }
  });

  test('a building bigger than the cap is not passed over by smaller ones when many are due', () => {
    const was = MEND.cellsPerTick;
    MEND.cellsPerTick = 6;
    try {
      const r = mend(8, 1, true);
      // Everything is due by quiet + stagger; the big one leads within one lap of the due buildings (0.5 s a tick).
      expect(r.bigFirst).toBeLessThanOrEqual(MEND.quiet + MEND.stagger + 9 * 0.5);
      expect(r.ruins).toBe(0);
    } finally {
      MEND.cellsPerTick = was;
    }
  });
});
