// While the app dresses the town it holds the mischief edits for that frame (main.ts): nothing is lost.

import { describe, expect, test } from 'vitest';
import { columnIndex, key } from '@/core/grid';
import { identity } from '@/core/mat4';
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
    expect(alt.game.world.blocks.size).toBe(plain.game.world.blocks.size);
  });
});
