// A share code can carry a world no player could build (it is checked for
// format, not for placement rules). Town logic must still resolve it, and
// every fact must still compute, without throwing.

import { describe, expect, test } from 'vitest';
import { edgeKey, key } from '@/core/grid';
import type { Block, World } from '@/core/world';
import { flatTerrain } from '@/scenario';
import { decodeTown, encodeTown } from '@/world/save';
import { allFacts } from './engine/discover';
import { resolveShape, resolveTown } from './index';

describe('odd worlds resolve', () => {
  test('blocks in the ground, floating floors and edges, stairs on stairs, all at the limits', () => {
    const t = flatTerrain(1);
    const b = (kind: Block['kind'], seq: number, rot: Block['rot'] = 0): Block => ({ kind, color: seq % 8, rot, seq });
    const blocks = new Map<number, Block>([
      [key(10, 0, 10), b('house', 1)], // inside the terrain
      [key(10, 5, 10), b('auto', 2)], // floating
      [key(0, 31, 0), b('auto', 3)], // top corner of the map
      [key(47, 0, 47), b('arch', 4)],
      [key(20, 1, 20), b('stairs', 5, 1)],
      [key(20, 2, 20), b('stairs', 6, 1)],
      [key(21, 3, 20), b('tree', 7)],
      [key(5, 1, 5), b('windmill', 8)],
      [key(5, 2, 5), b('house', 9)],
    ]);
    for (let y = 1; y < 32; y++) blocks.set(key(30, y, 30), b('auto', 10 + y));
    const world: World = {
      version: 1,
      seed: 1,
      nextSeq: 100,
      blocks,
      floors: new Map([
        [key(12, 9, 12), 'path'],
        [key(1, 0, 1), 'plaza'],
        [key(10, 5, 10), 'garden'],
      ]),
      edges: new Map([
        [edgeKey(12, 9, 12, 'E'), 'wall'],
        [edgeKey(46, 31, 46, 'S'), 'fence'],
      ]),
    };
    const back = decodeTown(encodeTown(world));
    expect(back.ok).toBe(true);
    const shape = resolveShape(back.ok ? back.world : world, t);
    expect(shape.kinds.get(key(30, 31, 30))).toBe('tower'); // a 31-tall free run, far from the sea
    expect(shape.kinds.get(key(0, 31, 0))).toBe('house');
    for (const fact of allFacts()) expect(() => fact(shape.facts), fact.factName).not.toThrow();
    expect(() => resolveTown(world, t)).not.toThrow();
  });
});
