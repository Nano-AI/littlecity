// While the app dresses the town it holds the mischief edits for that frame (main.ts): nothing is lost.

import { describe, expect, test, vi } from 'vitest';
import { columnIndex, key } from '@/core/grid';
import { identity } from '@/core/mat4';
import { allGenerators } from '@/gen/discover';
import { createGame } from '@/app/game';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import type { InstanceHandle, LifeStage } from '../api';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { mischiefOf } from './director';
import mischiefSystem from './mischief.system';
import nukeSystem from './nuke.system';

function town() {
  const handle = (): InstanceHandle => ({ base: identity(), setMatrix() {}, setVisible() {}, setParams() {}, release() {} });
  const stage: LifeStage = { instance: () => null, spawn: handle, spawnMesh: handle, liftStructure: handle, socket: () => identity() };
  const terrain = flatTerrain(3);
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) terrain.height[columnIndex(x, z)] = 0;
  const b = new TownBuilder(emptyWorld(3), terrain);
  for (let i = 0; i < 6; i++) b.house(14 + i * 2, 20, { floors: 2, color: i });
  const signals = createSignals(3);
  const life = createLife(stage, signals, { behaviours: [], systems: [mischiefSystem, nukeSystem] });
  const d = mischiefOf(stage);
  const game = createGame({ world: b.world, terrain }, { show: (shape) => life.sync({ shape, dressing: null }) });
  let edits = 0;
  d.connect({
    begin: () => game.begin(),
    apply: (e) => void (edits += e.length, game.editAll(e)),
    end: () => game.end(),
    abort: () => void game.abort(),
    edit: (e) => void (edits += e.length, game.editAll(e)),
    amend: (e) => void (edits += e.length, game.amend(e)),
  });
  const frame = (held: boolean): void => {
    d.holdEdits = held;
    life.update(signals.advance(0.1));
    d.flush();
    d.holdEdits = false;
  };
  return { d, game, frame, edits: () => edits };
}

describe('holding the mischief edits', () => {
  test('a held update makes no edits and a later one makes them all', () => {
    const run = (hold: (i: number) => boolean) => {
      const t = town();
      t.d.ignite(key(14, 1, 20));
      for (let i = 0; i < 400; i++) t.frame(hold(i));
      return t;
    };
    const plain = run(() => false);
    expect(plain.edits()).toBeGreaterThan(0);
    // Held in every other frame, and in a long stretch up front: nothing lands in a held frame.
    const held = town();
    held.d.ignite(key(14, 1, 20));
    for (let i = 0; i < 100; i++) held.frame(true);
    expect(held.edits()).toBe(0);
    for (let i = 0; i < 300; i++) held.frame(false);
    expect(held.edits()).toBeGreaterThan(0);
    const alt = run((i) => i % 2 === 0);
    const blocks = (t: ReturnType<typeof town>) => [...t.game.world.blocks].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    expect(blocks(held)).toEqual(blocks(plain));
    expect(blocks(alt)).toEqual(blocks(plain));
  });
});

describe('flames and a late roof', () => {
  test('flames re-seat once a late sampler arrives', () => {
    // Every house lit at once: one roof is built a frame, the rest of the flames stand roofless and move when theirs comes.
    // A window's glow is set once, with the flames' placement: count those placements.
    let placed = 0;
    const handle = (): InstanceHandle => ({
      base: identity(),
      setMatrix: (m) => void (Math.abs(Math.hypot(m[0]!, m[1]!, m[2]!) - 0.17) < 1e-6 && placed++),
      setVisible() {},
      setParams() {},
      release() {},
    });
    const stage: LifeStage = { instance: () => null, spawn: handle, spawnMesh: handle, liftStructure: handle, socket: () => identity() };
    const terrain = flatTerrain(3);
    const b = new TownBuilder(emptyWorld(3), terrain);
    for (let i = 0; i < 5; i++) b.house(14 + i * 3, 20, { floors: 2, color: i });
    const signals = createSignals(3);
    const life = createLife(stage, signals, { behaviours: [], systems: [mischiefSystem] });
    const d = mischiefOf(stage);
    const game = createGame({ world: b.world, terrain }, { show: (shape) => life.sync({ shape, dressing: null }) });
    d.connect({ begin: () => game.begin(), apply: (e) => game.editAll(e), end: () => game.end(), abort: () => game.abort(), edit: (e) => game.editAll(e), amend: (e) => game.amend(e) });
    const build = vi.spyOn(allGenerators(), 'build');
    for (let i = 0; i < 5; i++) d.ignite(key(14 + i * 3, 1, 20));
    life.update(signals.advance(0.05));
    expect(build.mock.calls.length).toBeLessThanOrEqual(1);
    const first = placed;
    for (let i = 0; i < 6; i++) life.update(signals.advance(0.05));
    expect(placed).toBeGreaterThan(first);
    expect(build.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
