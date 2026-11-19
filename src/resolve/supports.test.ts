// S1–S4 (design section 9): every worked example, as arrangement → expected supports.

import { describe, expect, test } from 'vitest';
import { E, key, S, W } from '@/core/grid';
import type { Terrain } from '@/core/world';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { resolveKinds } from './kinds';
import type { Support } from './plan';
import { resolveSupports } from './supports';

const flat = flatTerrain(3);

function supports(build: (b: TownBuilder) => void, t: Terrain = flat): { list: Support[]; at(x: number, y: number, z: number): Support | undefined } {
  const b = new TownBuilder(emptyWorld(3), t);
  build(b);
  const list = resolveSupports(b.world, t, resolveKinds(b.world, t));
  return { list, at: (x, y, z) => list.find((s) => s.carries === key(x, y, z)) };
}

describe('supports', () => {
  test('carried blocks get none: on terrain, on a solid block, a windmill on a windmill, a dock at sea level', () => {
    const { list } = supports((b) => {
      b.house(10, 10, { floors: 3 }).put('tree', 10, 10);
      b.put('windmill', 14, 14).put('windmill', 14, 14);
      b.block('dock', 2, 0, 10);
    });
    expect(list).toEqual([]);
  });

  test('S1: an arch is never given a generated support', () => {
    const { list } = supports((b) => {
      b.house(10, 10, { floors: 3 }).house(14, 10, { floors: 3 });
      for (let x = 11; x <= 13; x++) b.block('auto', x, 3, 10); // a valid span: arches
      b.house(20, 10, { floors: 2 }).block('arch', 21, 2, 10); // a hanging placed arch
    });
    expect(list).toEqual([]);
  });

  test('S2: a block hung off a grounded wall gets brackets against it', () => {
    const { at } = supports((b) => b.house(10, 10, { floors: 3 }).block('house', 11, 3, 10, { color: 5 }).block('marble', 10, 2, 9));
    expect(at(11, 3, 10)).toEqual({ type: 'bracket', carries: key(11, 3, 10), bottomY: 3, against: W });
    expect(at(10, 2, 9)).toEqual({ type: 'bracket', carries: key(10, 2, 9), bottomY: 2, against: S });
  });

  test('S2: terrain beside the block counts as grounded (a cliff face)', () => {
    const t = new TerrainBuilder(3).flat(1).rect(10, 4, 43, 43, 4).build();
    const { at } = supports((b) => b.block('house', 9, 3, 20), t);
    expect(at(9, 3, 20)).toMatchObject({ type: 'bracket', against: E });
  });

  test('S2 needs the neighbour grounded: one hung off a hanging block gets a pillar', () => {
    const { at } = supports((b) => b.house(10, 10, { floors: 3 }).block('house', 11, 3, 10).block('house', 12, 3, 10, { color: 6 }));
    expect(at(11, 3, 10)?.type).toBe('bracket');
    expect(at(12, 3, 10)).toEqual({ type: 'pillar', carries: key(12, 3, 10), bottomY: 1 });
  });

  test('S3: with nothing beside it, a pillar down to the first solid top', () => {
    const { at } = supports((b) => b.house(10, 10, { floors: 4 }).put('marble', 10, 12).erase(10, 1, 10).erase(10, 2, 10));
    expect(at(10, 3, 10)).toEqual({ type: 'pillar', carries: key(10, 3, 10), bottomY: 1 });
    expect(at(10, 4, 10)).toBeUndefined();
    const onMarble = supports((b) => b.put('marble', 10, 10).house(10, 10, { floors: 4 }).erase(10, 2, 10).erase(10, 3, 10));
    expect(onMarble.at(10, 4, 10)).toEqual({ type: 'pillar', carries: key(10, 4, 10), bottomY: 2 });
  });

  test('S3 over water: a stilt to the seabed (bottomY 0)', () => {
    const { at } = supports((b) => b.block('house', 2, 0, 10).block('house', 2, 1, 10).erase(2, 0, 10));
    expect(at(2, 1, 10)).toEqual({ type: 'pillar', carries: key(2, 1, 10), bottomY: 0 });
    expect(supports((b) => b.block('house', 2, 0, 10)).at(2, 0, 10)).toEqual({ type: 'pillar', carries: key(2, 0, 10), bottomY: 0 });
  });

  test('S3 with a non-solid piece in the column: four corner stilts, so nothing placed is hidden', () => {
    const { at } = supports((b) => b.house(10, 10, { floors: 3 }).erase(10, 1, 10).erase(10, 2, 10).block('tree', 10, 1, 10));
    expect(at(10, 3, 10)).toEqual({ type: 'stilts', carries: key(10, 3, 10), bottomY: 1 });
  });

  test('S3 carrying a non-solid piece (a tree whose ground was erased): a pillar ending in a platform', () => {
    const { at } = supports((b) => b.house(10, 10, { floors: 2 }).put('tree', 10, 10).erase(10, 2, 10));
    expect(at(10, 3, 10)).toEqual({ type: 'platform', carries: key(10, 3, 10), bottomY: 2 });
  });

  test('S4: two long pillars side by side with the same top are joined by an arcade', () => {
    const { at } = supports((b) => {
      b.house(10, 10, { floors: 3, w: 2 }).put('marble', 20, 20);
      b.erase(10, 1, 10).erase(10, 2, 10).erase(11, 1, 10).erase(11, 2, 10);
    });
    expect(at(10, 3, 10)).toEqual({ type: 'pillar', carries: key(10, 3, 10), bottomY: 1, arcadeTo: [E] });
    expect(at(11, 3, 10)).toEqual({ type: 'pillar', carries: key(11, 3, 10), bottomY: 1, arcadeTo: [W] });
  });

  test('S4 needs both pillars 2+ long and the same top level', () => {
    const short = supports((b) => b.house(10, 10, { floors: 2, w: 2 }).erase(10, 1, 10).erase(11, 1, 10));
    expect(short.at(10, 2, 10)?.arcadeTo).toBeUndefined();
    const uneven = supports((b) => {
      b.house(10, 10, { floors: 3 }).house(11, 10, { floors: 4, color: 1 });
      b.erase(10, 1, 10).erase(10, 2, 10).erase(11, 1, 10).erase(11, 2, 10).erase(11, 3, 10);
    });
    expect(uneven.list.map((s) => s.type)).toEqual(['pillar', 'pillar']);
    expect(uneven.list.every((s) => !s.arcadeTo)).toBe(true);
  });

  test('S4 joins a whole row, each pillar to both neighbours', () => {
    const { at } = supports((b) => {
      b.house(10, 10, { floors: 3, w: 3 });
      for (let x = 10; x <= 12; x++) b.erase(x, 1, 10).erase(x, 2, 10);
    });
    expect(at(11, 3, 10)?.arcadeTo).toEqual([E, W]);
    expect(at(10, 3, 10)?.arcadeTo).toEqual([E]);
    expect(at(10, 3, 10)?.against).toBeUndefined();
  });
});

describe('supports at world limits (Review Focus 3)', () => {
  test('erasing the bottom of a 30-tall stack: one full-height support, no loops', () => {
    const { list } = supports((b) => b.house(10, 10, { floors: 30 }).erase(10, 1, 10));
    expect(list).toEqual([{ type: 'pillar', carries: key(10, 2, 10), bottomY: 1 }]);
    const top = supports((b) => {
      b.house(10, 10, { floors: 31 });
      for (let y = 1; y < 31; y++) b.erase(10, y, 10);
    });
    expect(top.list).toEqual([{ type: 'pillar', carries: key(10, 31, 10), bottomY: 1 }]);
  });

  test('blocks on the map border and over deep water resolve', () => {
    const { list } = supports((b) => b.block('house', 0, 0, 0).block('house', 0, 1, 0).block('house', 47, 0, 47).erase(0, 0, 0));
    expect(list.map((s) => [s.carries, s.bottomY])).toEqual([
      [key(47, 0, 47), 0],
      [key(0, 1, 0), 0],
    ]);
  });
});
