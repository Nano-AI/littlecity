// Mischief through the game (design section 13b): one act is one undo step,
// and undo, in the middle of it or after, puts back a byte-identical town.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { World } from '@/core/world';
import { Director } from '@/life/mischief/director';
import { flatTerrain, TownBuilder } from '@/scenario';
import { ruinStage } from '@/world/damage';
import { encodeTown } from '@/world/save';
import { emptyWorld } from '@/world/world';
import { createGame } from './game';

const ENV = { wind: () => ({ dirX: 1, dirZ: 0, strength: 0.6 }) };

function setup() {
  const terrain = flatTerrain(3);
  const b = new TownBuilder(emptyWorld(3), terrain);
  for (let i = 0; i < 4; i++) b.house(10 + i, 10, { floors: 2, color: i });
  b.house(20, 10, { color: 5 });
  const d = new Director(7);
  const game = createGame({ world: b.world, terrain }, { show: (shape) => d.sync(shape) });
  d.connect({
    begin: () => game.begin(),
    apply: (edits) => void game.editAll(edits),
    end: () => game.end(),
    abort: () => void game.abort(),
    edit: (edits) => void game.editAll(edits),
    amend: (edits) => void game.amend(edits),
  });
  // One edit of the player's own first, so there is something to undo past.
  game.edit({ type: 'placeBlock', cell: key(24, 1, 10), kind: 'tree', color: 'auto', from: null });
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 0.1) {
      d.update(0.1, ENV);
      d.flush();
    }
  };
  return { game, d, run };
}

const same = (a: World, b: World): void => {
  expect(encodeTown(a)).toBe(encodeTown(b));
  expect([...a.blocks]).toEqual([...b.blocks]);
};

describe('one act of mischief is one undo step', () => {
  test('a fire, after it has burnt out: one undo puts the town back', () => {
    const { game, d, run } = setup();
    const before = game.world;
    d.ignite(key(10, 1, 10));
    expect(d.active).toBe(true);
    run(150);
    expect(d.active).toBe(false);
    expect(ruinStage(game.world.blocks.get(key(10, 1, 10))!.ruin)).toBe(3);
    expect(game.undo()).toBe(true);
    same(game.world, before);
    // And the undo before that is the player's tree, not some step of the fire.
    expect(game.undo()).toBe(true);
    expect(game.world.blocks.has(key(24, 1, 10))).toBe(false);
  });

  test('undo in the middle of a fire: out at once, the town as before, history as before', () => {
    const { game, d, run } = setup();
    const before = game.world;
    d.ignite(key(10, 1, 10));
    run(30);
    expect(ruinStage(game.world.blocks.get(key(10, 1, 10))!.ruin)).toBeGreaterThan(0);
    d.cancel();
    same(game.world, before);
    expect(d.busy).toBe(false);
    run(10);
    same(game.world, before);
    expect(game.undo()).toBe(true);
    expect(game.world.blocks.has(key(24, 1, 10))).toBe(false);
  });

  test('a bomb: undone after it has gone off and settled, and before it goes off', () => {
    const { game, d, run } = setup();
    const before = game.world;
    d.dropBomb([11.5, 0.8, 11.5]);
    run(8);
    expect(d.active).toBe(false);
    expect(ruinStage(game.world.blocks.get(key(11, 1, 10))!.ruin)).toBeGreaterThan(0);
    game.undo();
    same(game.world, before);
    d.dropBomb([11.5, 0.8, 11.5]);
    run(1);
    d.cancel();
    run(5);
    same(game.world, before);
  });

  test('mending is a step of its own, and mending everything restores the town exactly', () => {
    const { game, d, run } = setup();
    const before = game.world;
    d.knock(key(20, 1, 10));
    run(3);
    d.knock(key(20, 1, 10));
    run(3);
    expect(ruinStage(game.world.blocks.get(key(20, 1, 10))!.ruin)).toBe(2);
    d.mend(key(20, 1, 10), true);
    run(1);
    same(game.world, before);
  });
});
