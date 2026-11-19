// Structures: merging per the kind table (design section 6), ids from the lowest seq, splits,
// floor regions and fence/wall runs as structures.

import { describe, expect, test } from 'vitest';
import { E, edgeKey, key, N, type CellKey } from '@/core/grid';
import type { Terrain } from '@/core/world';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { resolveKinds } from './kinds';
import { EDGE_ID_BASE, FLOOR_ID_BASE } from './plan';
import { buildStructures, structureSeed, type StructureSet } from './structures';

const flat = flatTerrain(3);

function build(fn: (b: TownBuilder) => void, t: Terrain = flat): StructureSet & { b: TownBuilder; same(a: CellKey, c: CellKey): boolean } {
  const b = new TownBuilder(emptyWorld(3), t);
  fn(b);
  const set = buildStructures(b.world, t, resolveKinds(b.world, t));
  return { ...set, b, same: (a, c) => set.structureAt.get(a) !== undefined && set.structureAt.get(a) === set.structureAt.get(c) };
}
const k = key;

describe('merging per kind', () => {
  test('houses: touching, sideways and up/down, same colour only', () => {
    const s = build((b) => b.house(10, 10, { floors: 2, w: 2, color: 1 }).house(12, 10, { color: 1 }).house(13, 10, { color: 2 }).block('house', 10, 3, 10, { color: 1 }));
    expect(s.same(k(10, 1, 10), k(11, 2, 10))).toBe(true);
    expect(s.same(k(10, 1, 10), k(12, 1, 10))).toBe(true);
    expect(s.same(k(10, 1, 10), k(10, 3, 10))).toBe(true);
    expect(s.same(k(12, 1, 10), k(13, 1, 10))).toBe(false); // different colour
    expect(s.structures.get(s.structureAt.get(k(10, 1, 10))!)!.cells).toHaveLength(6);
  });

  test('houses touching only at a corner do not merge', () => {
    const s = build((b) => b.house(10, 10, { color: 1 }).house(11, 11, { color: 1 }));
    expect(s.same(k(10, 1, 10), k(11, 1, 11))).toBe(false);
  });

  test('houses join across a one-level step in the ground, not a two-level one, and not diagonally', () => {
    const t = new TerrainBuilder(3).flat(1).rect(12, 4, 43, 43, 2).rect(30, 4, 43, 43, 4).build();
    const s = build((b) => {
      b.house(11, 10, { color: 1 }).house(12, 10, { color: 1 }); // one step: (11, 1) and (12, 2)
      b.house(11, 14, { color: 1 }).house(12, 14, { color: 2 }); // one step, different colours
      b.house(11, 18, { color: 1 }).house(12, 19, { color: 1 }); // a step and a corner: diagonal
      b.house(29, 10, { color: 3 }).house(30, 10, { color: 3 }); // a two-level step: (29, 2) and (30, 4)
    }, t);
    expect(s.same(k(11, 1, 10), k(12, 2, 10))).toBe(true);
    expect(s.same(k(11, 1, 14), k(12, 2, 14))).toBe(false);
    expect(s.same(k(11, 1, 18), k(12, 2, 19))).toBe(false);
    expect(s.same(k(29, 2, 10), k(30, 4, 10))).toBe(false);
  });

  test('a split-level join needs the higher block on a step: terrain or a solid non-building block', () => {
    const s = build((b) => {
      // On another building: a colour-5 house, with a colour-1 block on its roof beside a colour-1 house.
      b.house(10, 10, { color: 1 }).house(11, 10, { color: 5 }).block('house', 11, 2, 10, { color: 1 });
      // On a marble block: that is a step.
      b.house(10, 14, { color: 1 }).put('marble', 11, 14, { color: 0 }).put('house', 11, 14, { color: 1 });
      // On a tower: another building.
      b.house(10, 18, { color: 1 }).put('tower', 11, 18, { color: 0 }).put('house', 11, 18, { color: 1 });
    });
    expect(s.same(k(10, 1, 10), k(11, 2, 10))).toBe(false);
    expect(s.same(k(11, 1, 10), k(11, 2, 10))).toBe(false); // different colours, as ever
    expect(s.same(k(10, 1, 14), k(11, 2, 14))).toBe(true);
    expect(s.same(k(10, 1, 18), k(11, 2, 18))).toBe(false);
  });

  test('Auto blocks that resolve to house merge with placed houses of the same colour', () => {
    const s = build((b) => b.house(10, 10, { color: 4 }).auto(11, 10, { color: 4 }));
    expect(s.same(k(10, 1, 10), k(11, 1, 10))).toBe(true);
  });

  test('towers: same-colour tower directly above/below only', () => {
    const s = build((b) => b.tower(10, 10, { floors: 3, color: 2 }).tower(11, 10, { floors: 3, color: 2 }).block('tower', 10, 4, 10, { color: 3 }));
    expect(s.same(k(10, 1, 10), k(10, 3, 10))).toBe(true);
    expect(s.same(k(10, 1, 10), k(11, 1, 10))).toBe(false);
    expect(s.same(k(10, 3, 10), k(10, 4, 10))).toBe(false);
  });

  test('lighthouse, pillar and windmill: directly above/below, any colour', () => {
    const s = build((b) => {
      b.put('lighthouse', 10, 10, { color: 1 }).put('lighthouse', 10, 10, { color: 2 }).put('lighthouse', 11, 10);
      b.put('pillar', 14, 10, { color: 1 }).put('pillar', 14, 10, { color: 5 }).put('pillar', 15, 10);
      b.put('windmill', 18, 10).put('windmill', 18, 10).put('windmill', 19, 10);
    });
    expect(s.same(k(10, 1, 10), k(10, 2, 10))).toBe(true);
    expect(s.same(k(10, 1, 10), k(11, 1, 10))).toBe(false);
    expect(s.same(k(14, 1, 10), k(14, 2, 10))).toBe(true);
    expect(s.same(k(14, 1, 10), k(15, 1, 10))).toBe(false);
    expect(s.same(k(18, 1, 10), k(18, 2, 10))).toBe(true);
    expect(s.same(k(18, 1, 10), k(19, 1, 10))).toBe(false);
  });

  test('marble: touching, same colour; dock: touching', () => {
    const s = build((b) => {
      b.fill('marble', 10, 10, 11, 11, { color: 0 }).put('marble', 12, 10, { color: 3 });
      for (let z = 10; z <= 13; z++) b.block('dock', 2, 0, z);
      b.block('dock', 1, 0, 13);
    });
    expect(s.same(k(10, 1, 10), k(11, 1, 11))).toBe(true);
    expect(s.same(k(11, 1, 10), k(12, 1, 10))).toBe(false);
    expect(s.structures.get(s.structureAt.get(k(2, 0, 10))!)!.cells).toHaveLength(5);
  });

  test('arches: the same run (side by side) and tier (stacked)', () => {
    const s = build((b) => {
      b.house(10, 10, { floors: 3 }).house(14, 10, { floors: 3 });
      for (let x = 11; x <= 13; x++) b.block('arch', x, 2, 10);
      b.block('arch', 12, 3, 10);
    });
    expect(s.same(k(11, 2, 10), k(13, 2, 10))).toBe(true);
    expect(s.same(k(12, 2, 10), k(12, 3, 10))).toBe(true);
  });

  test('stairs: side by side with the same rot, or continuing the flight', () => {
    const t = new TerrainBuilder(3).flat(1).rect(20, 4, 43, 43, 3).build();
    const s = build((b) => {
      b.block('stairs', 10, 1, 10, { rot: E }).block('stairs', 10, 1, 11, { rot: E }); // a wide flight
      b.block('stairs', 12, 1, 10, { rot: N }); // beside but turned: separate
      b.house(18, 10).block('stairs', 17, 1, 10, { rot: E }).block('stairs', 18, 2, 10, { rot: E }); // continuing up
      b.block('stairs', 10, 1, 14, { rot: E }).block('stairs', 11, 1, 14, { rot: E }); // in line along the run: not beside
    }, t);
    expect(s.same(k(10, 1, 10), k(10, 1, 11))).toBe(true);
    expect(s.same(k(10, 1, 10), k(12, 1, 10))).toBe(false);
    expect(s.same(k(17, 1, 10), k(18, 2, 10))).toBe(true);
    expect(s.same(k(10, 1, 14), k(11, 1, 14))).toBe(false);
  });

  test('trees, fountains and stalls never merge', () => {
    const s = build((b) => b.put('tree', 10, 10).put('tree', 11, 10).put('fountain', 12, 10).put('fountain', 13, 10).put('stall', 14, 10).put('stall', 15, 10));
    expect(s.structures.size).toBe(6);
  });
});

describe('ids', () => {
  test('a block structure takes the seq of its lowest-seq member; extending it keeps the id and seed', () => {
    const a = build((b) => b.house(10, 10, { color: 1 }));
    const id = a.structureAt.get(k(10, 1, 10))!;
    expect(id).toBe(1);
    const grown = build((b) => b.put('tree', 30, 30).house(10, 10, { color: 1 }).house(11, 10, { color: 1 }).house(10, 10, { color: 1 }));
    const s = grown.structures.get(grown.structureAt.get(k(11, 1, 10))!)!;
    expect(s.id).toBe(2);
    expect(s.seed).toBe(structureSeed(3, 2));
    expect(s.cells).toEqual([k(10, 1, 10), k(11, 1, 10), k(10, 2, 10)]);
  });

  test('split by an erase: the part without the lowest seq gets its own lowest seq', () => {
    const s = build((b) => {
      for (let x = 10; x <= 14; x++) b.house(x, 10, { color: 2 }); // seqs 1..5
      b.erase(12, 1, 10);
    });
    expect(s.structureAt.get(k(10, 1, 10))).toBe(1);
    expect(s.structureAt.get(k(11, 1, 10))).toBe(1);
    expect(s.structureAt.get(k(13, 1, 10))).toBe(4);
    expect(s.structureAt.get(k(14, 1, 10))).toBe(4);
  });

  test('the structure colour is its lowest-seq block colour; kind is the resolved kind', () => {
    const s = build((b) => b.auto(20, 20, { floors: 3, color: 6 }));
    expect(s.structures.get(1)).toMatchObject({ kind: 'tower', color: 6, edges: [] });
  });
});

describe('floor regions', () => {
  test('connected floor cells of one kind are one region; ids from the lowest cell', () => {
    const s = build((b) => b.path(10, 10, 15, 10).path(15, 11, 15, 13).plaza(16, 10, 18, 12).path(20, 10));
    const pathId = s.floorAt.get(k(10, 1, 10))!;
    expect(pathId).toBe(FLOOR_ID_BASE + k(10, 1, 10));
    expect(s.floorAt.get(k(15, 1, 13))).toBe(pathId);
    expect(s.structures.get(pathId)).toMatchObject({ kind: 'path', color: 0 });
    expect(s.structures.get(pathId)!.cells).toHaveLength(9);
    expect(s.floorAt.get(k(16, 1, 10))).not.toBe(pathId); // plaza: another kind
    expect(s.floorAt.get(k(20, 1, 10))).not.toBe(pathId); // not touching
  });

  test('a path climbing a terrace stays one region; a roof path beside a ground path does not join it', () => {
    const t = new TerrainBuilder(3).flat(1).rect(20, 4, 43, 43, 2).build();
    const s = build((b) => b.path(17, 10, 22, 10).house(10, 10).path(10, 11).edit({ type: 'placeFloor', cell: k(10, 2, 10), floor: 'path' }), t);
    expect(s.floorAt.get(k(17, 1, 10))).toBe(s.floorAt.get(k(22, 2, 10)));
    expect(s.floorAt.get(k(10, 1, 11))).not.toBe(s.floorAt.get(k(10, 2, 10)));
  });

  test('a cell can hold a block structure and a floor structure at once', () => {
    const s = build((b) => b.path(10, 10).put('tree', 10, 10));
    expect(s.structureAt.has(k(10, 1, 10))).toBe(true);
    expect(s.floorAt.has(k(10, 1, 10))).toBe(true);
  });
});

describe('fence and wall runs', () => {
  test('edge pieces meeting at corners form one run, keyed by the lowest edge', () => {
    const s = build((b) => b.fenceAround(10, 10, 12, 11));
    const ids = new Set(s.edgeAt.values());
    expect(ids.size).toBe(1);
    const run = s.structures.get([...ids][0]!)!;
    expect(run.id).toBe(EDGE_ID_BASE + Math.min(...s.edgeAt.keys()));
    expect(run).toMatchObject({ kind: 'fence', cells: [] });
    expect(run.edges).toHaveLength(10);
  });

  test('cell pieces join side by side and with edge pieces on their sides; the id is then the lowest seq', () => {
    const s = build((b) => {
      b.put('wall', 10, 10).put('wall', 11, 10); // seqs 1, 2
      b.wallEdge(11, 10, 'E', 1);
      b.wallEdge(12, 10, 'S'); // meets the E edge at a corner
      b.fenceEdge(10, 10, 'N', 'fence', 1); // a fence: other kind
    });
    const id = s.structureAt.get(k(10, 1, 10))!;
    expect(id).toBe(1);
    expect(s.structureAt.get(k(11, 1, 10))).toBe(id);
    expect(s.edgeAt.get(edgeKey(11, 1, 10, 'E'))).toBe(id);
    expect(s.edgeAt.get(edgeKey(12, 1, 10, 'S'))).toBe(id);
    expect(s.structures.get(id)!.edges).toHaveLength(2);
    expect(s.edgeAt.get(edgeKey(10, 1, 9, 'S'))).not.toBe(id);
  });

  test('parallel edges that do not touch are separate runs; runs at different levels are separate', () => {
    const s = build((b) => b.fenceEdge(10, 10, 'E').fenceEdge(10, 12, 'E').house(20, 10).fenceEdge(20, 10, 'E').fenceEdge(21, 10, 'S', 'fence', 1));
    expect(new Set(s.edgeAt.values()).size).toBe(4);
  });
});
