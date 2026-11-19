import { describe, expect, test } from 'vitest';
import { createGame } from '@/app/game';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { growTown } from '@/townmaker/index';
import { clearingEdits, createGrowth, onlyStartingTrees } from './growth';

function setup(seed = 3) {
  const terrain = generateTerrain(seed);
  const world = initialWorld(seed, terrain);
  let shows = 0;
  const game = createGame({ world, terrain }, { show: () => void shows++ });
  return { game, terrain, world, edits: growTown(terrain, seed), shows: () => shows };
}

describe('growth playback', () => {
  test('plays about 25 edits a second, a few at most per frame, as one undo step', () => {
    const { game, world, edits } = setup();
    let done = 0;
    const growth = createGrowth(game, { onDone: () => done++ });
    growth.start(edits);
    expect(growth.active).toBe(true);
    expect(game.world.blocks.size).toBe(0); // the starting trees are cleared
    growth.tick(0);
    growth.tick(1000); // a second: capped at 3 in one frame
    expect(growth.left).toBe(edits.length - 3);
    for (let t = 1016; growth.active; t += 16) growth.tick(t);
    expect(done).toBe(1);
    expect(game.world.blocks.size).toBeGreaterThan(200);
    expect(game.canUndo).toBe(true);
    game.undo();
    expect(game.world).toBe(world);
    expect(game.canUndo).toBe(false);
  }, 240_000);

  test('skip puts the rest down at once and shows it once', () => {
    const { game, edits, shows } = setup();
    const growth = createGrowth(game);
    growth.start(edits);
    growth.tick(0);
    growth.tick(200);
    const before = shows();
    growth.skip();
    expect(shows()).toBe(before + 1);
    expect(growth.active).toBe(false);
    const full = setup();
    full.game.editAll(clearingEdits(full.game.world));
    full.game.editAll(edits);
    expect(game.world.blocks.size).toBe(full.game.world.blocks.size);
  });

  test('knows an untouched island, and how to clear one', () => {
    const { game, terrain, world } = setup();
    expect(onlyStartingTrees(world, terrain)).toBe(true);
    game.edit({ type: 'placeFloor', cell: [...world.blocks.keys()][0]!, floor: 'garden' });
    expect(onlyStartingTrees(game.world, terrain)).toBe(false);
    const cleared = setup();
    cleared.game.editAll(clearingEdits(game.world));
    expect(clearingEdits(world).length).toBe(world.blocks.size);
  });
});
