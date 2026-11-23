import { describe, expect, test } from 'vitest';
import { flatTerrain, TownBuilder } from '@/scenario';
import { packRuin } from '@/world/damage';
import { emptyWorld } from '@/world/world';
import { resolveShape } from '../index';
import { hashStructure } from './hash';

const terrain = flatTerrain(3);

function houseHashes(ruin: number): [number, number] {
  const b = new TownBuilder(emptyWorld(3), terrain);
  b.house(10, 10, { color: 2 });
  if (ruin) for (const [c] of b.world.blocks) b.edit({ type: 'setRuin', cell: c, ruin });
  const shape = resolveShape(b.world, terrain);
  const s = [...shape.structures.values()].find((x) => x.kind === 'house')!;
  return [hashStructure(s, shape), hashStructure(s, shape, true)];
}

describe('hashStructure ignoring ruin', () => {
  test('ignoring ruin, a ruined structure hashes like its sound self', () => {
    const [, sound] = houseHashes(0);
    const [, ruined] = houseHashes(packRuin({ stage: 2, cause: 'fire' }));
    expect(ruined).toBe(sound);
  });

  test('with ruin, the two hashes differ', () => {
    const [sound] = houseHashes(0);
    const [ruined] = houseHashes(packRuin({ stage: 2, cause: 'fire' }));
    expect(ruined).not.toBe(sound);
  });
});
