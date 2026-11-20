// Everything broken mends on its own, out over the water too (design section
// 13b; the owner: "the auto healing doesn't seem to work for structures that
// are built over water"): docks, jetties, bridges, houses on stilts and on
// bridges, rocks, in a grown harbour, broken and left alone.

import { expect, test } from 'vitest';
import { columnIndex, keyX, keyZ } from '@/core/grid';
import { Director } from '@/life/mischief/director';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { packRuin } from '@/world/damage';
import { createGame } from './game';

test('every structure over the water in a grown harbour, wrecked, mends with no help', () => {
  const { world, terrain } = buildScenario(findScenario('grown-harbour')!);
  const d = new Director(7);
  const game = createGame({ world, terrain }, { show: (shape) => d.sync(shape) });
  d.connect({ begin: () => game.begin(), apply: (e) => void game.editAll(e), end: () => game.end(), abort: () => void game.abort(), edit: (e) => void game.editAll(e), amend: (e) => void game.amend(e) });
  const wet = [...game.world.blocks.keys()].filter((c) => terrain.height[columnIndex(keyX(c), keyZ(c))] === 0);
  expect(new Set(wet.map((c) => game.world.blocks.get(c)!.kind))).toEqual(new Set(['dock', 'arch', 'house', 'auto']));
  game.editAll(wet.map((cell, i) => ({ type: 'setRuin' as const, cell, ruin: packRuin({ stage: (1 + (i % 3)) as 1 | 2 | 3, cause: i % 2 ? 'blast' : 'fire' }) })));
  expect([...game.world.blocks.values()].filter((b) => b.ruin).length).toBe(wet.length);
  for (let t = 0; t < 150; t += 0.1) {
    d.update(0.1, { wind: () => ({ dirX: 1, dirZ: 0, strength: 0 }) });
    d.flush();
  }
  expect([...game.world.blocks.values()].filter((b) => b.ruin)).toEqual([]);
});
