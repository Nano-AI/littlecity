// Shaping the land, by seeded chance: random terrain strokes interleaved with
// random building edits on real towns.
//
//  - Carrying loses and duplicates nothing: every block keeps its seq, kind,
//    colour and style; the counts never change; nothing ends up inside the
//    ground.
//  - A land edit and its opposite on the same columns give back the world
//    exactly, when every column moved both times.
//  - One undo per stroke, and undoing everything gives back the start byte
//    for byte (through the game, as the player does it).
//  - Sinking the whole island, cutting it in two, filling the sea to the
//    limit: nothing throws, and the town resolves.

import { describe, expect, test } from 'vitest';
import { columnIndex, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import { createGame } from '@/app/game';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { randomEdit } from '@/scenario/edits';
import { islandOf, landEditable } from '@/terrain/land';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { randomLandEdit } from './land-edits';
import { encodeTown } from './save';
import { applyEdit, canApply } from './world';

const blockList = (w: World): string[] => [...w.blocks.values()].map((b) => `${b.seq}:${b.kind}:${b.color}:${b.rot}:${b.style ?? 0}`).sort();

function checkCarried(before: World, after: World, t: Terrain): void {
  expect(after.blocks.size).toBe(before.blocks.size);
  expect(after.floors.size).toBe(before.floors.size);
  expect(after.edges.size).toBe(before.edges.size);
  expect(after.nextSeq).toBe(before.nextSeq);
  expect(blockList(after)).toEqual(blockList(before));
  const isl = islandOf(after, t);
  // Gathered, then one expect (an expect a block every step was much of this file's time).
  const buried = (cells: Iterable<number>): number[] => [...cells].filter((c) => keyY(c) < isl.height[columnIndex(keyX(c), keyZ(c))]!);
  expect(buried(after.blocks.keys()), 'blocks inside the ground').toEqual([]);
  expect(buried(after.floors.keys()), 'floors inside the ground').toEqual([]);
}

const sameContent = (a: World, b: World): void => {
  expect([...a.blocks].sort((p, q) => p[0] - q[0])).toEqual([...b.blocks].sort((p, q) => p[0] - q[0]));
  expect([...a.floors].sort((p, q) => p[0] - q[0])).toEqual([...b.floors].sort((p, q) => p[0] - q[0]));
  expect([...a.edges].sort((p, q) => p[0] - q[0])).toEqual([...b.edges].sort((p, q) => p[0] - q[0]));
  expect(a.terrainEdits ? [...a.terrainEdits] : []).toEqual(b.terrainEdits ? [...b.terrainEdits] : []);
};

function play(name: string, steps: number, seed: number): void {
  const built = buildScenario(findScenario(name)!);
  const base = built.terrain;
  const game = createGame({ world: built.world, terrain: base }, { show() {} });
  const start = game.world;
  const startCode = encodeTown(start);
  let strokes = 0, inverses = 0;
  for (let i = 0; i < steps; i++) {
    const world = game.world;
    const land = i % 2 === 0;
    const e = land ? randomLandEdit(world, base, seed, i) : randomEdit(world, game.terrain, seed, i);
    if (!e) continue;
    if (land) {
      // A stroke of one to three dabs, one undo step.
      game.begin();
      expect(game.edit(e).ok).toBe(true);
      checkCarried(world, game.world, base);
      const after = game.world;
      if (e.type === 'land') {
        // The opposite edit on the same columns, when they all moved, gives the same world back.
        const inverse: Edit = { type: 'land', up: e.down, down: e.up };
        const moved = [...e.up, ...e.down].every((c) => islandOf(after, base).height[c] !== islandOf(world, base).height[c]);
        if (moved && canApply(after, base, inverse).ok) {
          const back = applyEdit(after, base, inverse);
          if ([...e.up, ...e.down].every((c) => islandOf(back, base).height[c] === islandOf(world, base).height[c])) {
            sameContent(back, world);
            inverses++;
          }
        }
      }
      for (let k = 1; k <= i % 3; k++) {
        const more = randomLandEdit(game.world, base, seed + k, i);
        if (more) {
          const was = game.world;
          game.edit(more);
          checkCarried(was, game.world, base);
        }
      }
      game.end();
      strokes++;
    } else expect(game.edit(e).ok).toBe(true);
  }
  expect(strokes).toBeGreaterThan(steps / 4);
  expect(inverses).toBeGreaterThan(0);
  while (game.canUndo) game.undo();
  expect(game.world).toBe(start);
  expect(encodeTown(game.world)).toBe(startCode);
  expect(islandOf(game.world, base)).toBe(base);
}

describe('carrying, by seeded chance', () => {
  test('grown town (generator 2): 160 steps', () => play('grown-town-1', 160, 31));
  test('everything: 120 steps', () => play('everything', 120, 32));
  test('split-level houses on stepped ground: 120 steps', () => play('J02.split-level', 120, 33));
});

describe('the extremes never throw', () => {
  const columns = (): number[] => {
    const out: number[] = [];
    for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) if (landEditable(x, z)) out.push(columnIndex(x, z));
    return out;
  };
  const resolves = (w: World, t: Terrain): void => {
    const shape = resolveShape(w, t);
    resolveDressing(shape);
  };

  test('sink the whole island with its town, then fill the sea to the limit', () => {
    const built = buildScenario(findScenario('grown-town-2')!);
    const t = built.terrain;
    let w = built.world;
    const all = columns();
    for (let pass = 0; pass < 12; pass++) {
      const e: Edit = { type: 'land', up: [], down: all };
      if (!canApply(w, t, e).ok) break;
      w = applyEdit(w, t, e);
    }
    resolves(w, t);
    const sunk = islandOf(w, t);
    // Whatever needs dry ground holds its column up; everything else is water.
    let land = 0;
    for (const c of all) if (sunk.height[c]! > 0) land++;
    expect(land).toBeLessThan(all.length / 4);
    for (let pass = 0; pass < 3; pass++) w = canApply(w, t, { type: 'land', up: all, down: [] }).ok ? applyEdit(w, t, { type: 'land', up: all, down: [] }) : w;
    resolves(w, t);
    // Only docks and bridges on the water hold a column down.
    expect(all.filter((c) => islandOf(w, t).height[c] === 0).length).toBeLessThan(all.length / 20);
    expect(w.blocks.size).toBe(built.world.blocks.size);
  });

  test('cut the island in two with a river, and wall in a moat', () => {
    const seed = 5;
    const t = generateTerrain(seed, 2);
    let w = initialWorld(seed, t, 2);
    for (let pass = 0; pass < 10; pass++) {
      const cut: number[] = [];
      for (let z = 5; z < SIZE_Z - 5; z++) cut.push(columnIndex(24, z));
      const e: Edit = { type: 'land', up: [], down: cut };
      if (canApply(w, t, e).ok) w = applyEdit(w, t, e);
    }
    const isl = islandOf(w, t);
    for (let z = 5; z < SIZE_Z - 5; z++) expect(isl.height[columnIndex(24, z)]).toBe(0);
    resolves(w, t);
  });

  test('random strokes anywhere on ten islands', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const t = generateTerrain(seed, seed % 3 === 0 ? 1 : 2);
      let w = initialWorld(seed, t, seed % 3 === 0 ? 1 : 2);
      for (let i = 0; i < 40; i++) {
        const e = randomLandEdit(w, t, seed, i);
        if (e) w = applyEdit(w, t, e);
      }
      resolves(w, t);
      const isl = islandOf(w, t);
      for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) if (!landEditable(x, z)) expect(isl.height[columnIndex(x, z)]).toBe(t.height[columnIndex(x, z)]);
    }
  });
});
