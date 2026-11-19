// The core facts, one test each, on hand-built worlds.

import { describe, expect, test } from 'vitest';
import { E, key, N, S, W } from '@/core/grid';
import type { Terrain } from '@/core/world';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { demoRules } from '../../../tests/fixtures/demo';
import { resolveShape } from '../index';
import type { Facts } from './api';
import { alleys } from './alleys.fact';
import { cellInfo } from './cell.fact';
import { courtyards } from './courtyards.fact';
import { distToFloor, distToPath, distToStructure, distToWater, NONE } from './distance.fact';
import { facades } from './facades.fact';
import { gardens } from './gardens.fact';
import { wildGrass } from './grass.fact';
import { leftovers } from './leftovers.fact';
import { plazas } from './plazas.fact';
import { roofRegions } from './roofs.fact';
import { shelteredWater } from './sheltered-water.fact';
import { streets } from './streets.fact';
import { structureInfo } from './structure.fact';
import { sunnySide } from './sun.fact';
import { townFacts, townRoles } from './town.fact';
import { verges } from './verges.fact';
import { waterfront } from './waterfront.fact';

const flat = flatTerrain(2); // height 1 on columns 4–43 (sand on the outer ring), water around

function facts(build: (b: TownBuilder) => void, t: Terrain = flat): Facts & { b: TownBuilder } {
  const b = new TownBuilder(emptyWorld(2), t);
  build(b);
  const f = resolveShape(b.world, t, { rules: [] }).facts;
  return Object.assign(Object.create(f) as Facts, { b }) as Facts & { b: TownBuilder };
}
const k = key;
const sid = (f: Facts, x: number, y: number, z: number): number => f.structureAt.get(k(x, y, z))!;

describe('per cell', () => {
  test('cellInfo: kind, solidity, open faces, sky, walkable top, height above ground, distances, sunny faces', () => {
    const f = facts((b) => b.house(10, 10, { floors: 2 }).path(10, 12));
    const info = cellInfo(f);
    const wall = info.at(k(10, 1, 10));
    expect(wall).toMatchObject({ x: 10, y: 1, z: 10, ground: 1, water: false, kind: 'house', placed: 'house', solid: true, skyOpen: false, walkableTop: true, standable: false, aboveGround: 0 });
    expect(wall.structure).toBe(sid(f, 10, 1, 10));
    expect(wall.openFaces).toEqual([N, E, S, W]);
    expect(wall.sunnyFaces).toEqual([E, S]);
    expect(info.at(k(10, 2, 10)).skyOpen).toBe(true);
    expect(info.at(k(10, 3, 10))).toMatchObject({ standable: true, walkableTop: true, aboveGround: 2 });
    expect(info.at(k(10, 1, 12))).toMatchObject({ floor: 'path', standable: true, distToFloor: 0, distToStructure: 2 });
    expect(info.at(k(10, 1, 12)).floorStructure).toBe(f.floorAt.get(k(10, 1, 12)));
    expect(info.at(k(11, 4, 11))).toMatchObject({ standable: false, walkableTop: false, skyOpen: true });
    expect(info.at(k(10, 0, 10))).toMatchObject({ inTerrain: true, solid: true, aboveGround: -1 });
    expect(info.at(k(4, 1, 20)).distToWater).toBe(1);
    expect(info.at(k(1, 0, 20))).toMatchObject({ water: true, distToWater: 0 });
    expect(info.at(k(11, 1, 10)).openFaces).toEqual([N, E, S]);
    expect(info.topSolid(10, 10)).toBe(2);
    expect(info.at(k(10, 1, 10))).toBe(wall); // cached
  });

  test('distToWater, distToFloor, distToPath, distToStructure: 4-connected column steps', () => {
    const f = facts((b) => b.plaza(20, 20).put('tree', 30, 30).path(25, 20));
    expect(distToWater(f).at(4, 20)).toBe(1);
    expect(distToWater(f).at(6, 20)).toBe(3);
    expect(distToWater(f).at(2, 20)).toBe(0);
    expect(distToFloor(f).at(20, 20)).toBe(0);
    expect(distToFloor(f).at(22, 21)).toBe(3);
    expect(distToPath(f).at(22, 20)).toBe(3);
    expect(distToStructure(f).at(30, 32)).toBe(2);
    expect(distToStructure(f).at(-1, 0)).toBe(NONE);
    expect(distToFloor(facts(() => {})).at(10, 10)).toBe(NONE);
  });

  test('sunnySide: the sides facing the fixed light (E and S), S most squarely', () => {
    const sun = sunnySide(facts(() => {}));
    expect(sun.faces).toEqual([E, S]);
    expect(sun.best).toBe(S);
    expect(sun.isSunny(N)).toBe(false);
  });
});

describe('per structure', () => {
  test('structureInfo: storeys, footprint, box and what it touches', () => {
    const f = facts((b) => b.house(10, 10, { floors: 2, w: 2, d: 2, color: 1 }).tower(12, 10, { floors: 4, color: 0 }).put('tree', 10, 9));
    const house = structureInfo(f).get(sid(f, 10, 1, 10))!;
    expect(house).toMatchObject({ kind: 'house', minY: 1, maxY: 2, storeys: 2, footprint: 4, groundFootprint: 4 });
    expect(house.box).toEqual({ x0: 10, z0: 10, x1: 11, z1: 11, y0: 1, y1: 2 });
    expect(house.touches.map((t) => [t.kind, t.sides])).toEqual([
      ['tower', [E]],
      ['tree', [N]],
    ]);
    expect(structureInfo(f).get(sid(f, 12, 1, 10))).toMatchObject({ storeys: 4, footprint: 1 });
    expect([...structureInfo(f).values()].every((s) => s.kind !== 'path')).toBe(true);
  });

  test('facades: what each faces within 3, with the gap to a facing structure', () => {
    const t = new TerrainBuilder(2).flat(1).rect(4, 4, 43, 8, 3).build(); // a cliff: height 3 for z ≤ 8
    const f = facts((b) => {
      b.house(10, 10, { floors: 2, color: 1 }).path(9, 11, 11, 11).house(13, 10, { color: 2 }).put('tree', 9, 10);
      b.house(5, 14, { color: 3 });
      b.house(20, 20, { color: 4 }).house(20, 22, { color: 5 }); // a 1-cell gap between them
    }, t);
    const at = (x: number, y: number, z: number, d: 0 | 1 | 2 | 3) => facades(f).at(k(x, y, z), d)!;
    expect(at(10, 1, 10, S)).toMatchObject({ faces: 'street', dist: 1, street: 1, storey: 1, drop: 0, sunny: true });
    expect(at(10, 1, 10, E)).toMatchObject({ faces: 'ground', ground: 1, other: sid(f, 13, 1, 10), gap: 2 });
    expect(at(10, 1, 10, N)).toMatchObject({ faces: 'ground', dist: 1, cliff: 2, cliffRise: 2 });
    expect(at(10, 1, 10, W)).toMatchObject({ touching: 'tree' });
    expect(at(10, 2, 10, S)).toMatchObject({ storey: 2, street: 1, drop: 1, faces: 'street' });
    expect(at(5, 1, 14, W)).toMatchObject({ ground: 1, water: 2 });
    expect(at(20, 1, 20, S)).toMatchObject({ faces: 'ground', other: sid(f, 20, 1, 22), gap: 1, alley: false });
    expect(at(13, 1, 10, W)).toMatchObject({ other: sid(f, 10, 1, 10), gap: 2 });
    // No facade against its own structure or a solid neighbour; every exposed side has one.
    expect(facades(f).byStructure.get(sid(f, 10, 1, 10))).toHaveLength(8);
  });

  test('facades: touching blocks, edge pieces, alleys', () => {
    const f = facts((b) => {
      b.house(10, 10, { w: 3, color: 1 }).house(10, 12, { w: 3, color: 2 }); // an alley along z = 11
      b.house(20, 20, { color: 1 }).fenceEdge(20, 20, 'S', 'fence', 1).put('house', 21, 20, { color: 3 });
    });
    expect(facades(f).at(k(11, 1, 10), S)).toMatchObject({ alley: true, gap: 1 });
    expect(facades(f).at(k(20, 1, 20), S)).toMatchObject({ edge: 'fence' });
    expect(facades(f).at(k(20, 1, 20), E)).toBeUndefined(); // a solid block touches it
  });

  test('roofRegions: top cells by level, extents, lean-to sides, things on the roof', () => {
    const f = facts((b) => {
      b.house(10, 10, { w: 3, color: 1 }).block('house', 10, 2, 10, { color: 1 });
      b.edit({ type: 'placeFloor', cell: k(12, 2, 10), floor: 'plaza' });
      b.block('stairs', 12, 1, 11, { rot: N });
      b.house(20, 20, { w: 2, d: 2, color: 2 }).block('tower', 20, 2, 20, { color: 3 });
    });
    const regions = roofRegions(f).byStructure.get(sid(f, 10, 1, 10))!;
    expect(regions.map((r) => [r.index, r.level, r.cells.length])).toEqual([
      [0, 1, 2],
      [1, 2, 1],
    ]);
    expect(regions[0]).toMatchObject({ width: 2, depth: 1, longAxis: 'x', rectangular: true, againstTaller: [W], floors: [k(12, 2, 10)], stairsOnto: [k(12, 1, 11)] });
    expect(regions[1]).toMatchObject({ width: 1, depth: 1, longAxis: null, againstTaller: [] });
    const pierced = roofRegions(f).byStructure.get(sid(f, 20, 1, 20))!;
    expect(pierced).toHaveLength(1);
    expect(pierced[0]!.pierced).toEqual([k(20, 1, 20)]);
    expect(roofRegions(f).byCell.get(k(11, 1, 10))).toBe(regions[0]);
  });
});

describe('regions', () => {
  test('streets: length, junctions, dead ends, straight segments', () => {
    // A T: x 10..16 at z = 10, and a branch south from x = 13 to z = 13.
    const f = facts((b) => b.path(10, 10, 16, 10).path(13, 11, 13, 13).path(30, 30));
    const all = streets(f);
    expect(all.list).toHaveLength(2);
    const t = all.byCell.get(k(10, 1, 10))!;
    expect(t.length).toBe(10);
    expect(t.junctions).toEqual([k(13, 1, 10)]);
    expect([...t.deadEnds].sort((a, b) => a - b)).toEqual([k(10, 1, 10), k(16, 1, 10), k(13, 1, 13)].sort((a, b) => a - b));
    expect(t.segments.map((s) => [s.axis, s.length])).toEqual([
      ['x', 7],
      ['z', 4],
    ]);
    expect(all.byCell.get(k(30, 1, 30))!.deadEnds).toEqual([k(30, 1, 30)]);
    expect(all.totalLength).toBe(11);
  });

  test('plazas: a square contains a full 3 × 3', () => {
    const f = facts((b) => b.plaza(10, 10, 12, 12).plaza(20, 10, 21, 15));
    const [a, c] = plazas(f).list;
    expect(a).toMatchObject({ area: 9, square: true, largestSquare: 3 });
    expect(a!.edgeCells).toHaveLength(8);
    expect(c).toMatchObject({ area: 12, square: false, largestSquare: 2 });
  });

  test('gardens: regions, and whether they lie by the water', () => {
    const f = facts((b) => b.garden(4, 10, 5, 11).garden(20, 20));
    expect(gardens(f).list.map((g) => [g.area, g.byWater])).toEqual([
      [4, true],
      [1, false],
    ]);
  });

  test('courtyards: up to 16 empty ground cells enclosed by blocks, walls or cliffs', () => {
    const ring = (b: TownBuilder, x0: number, z0: number, x1: number, z1: number, gapAt?: [number, number]) => {
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
        if (gapAt && gapAt[0] === x && gapAt[1] === z) continue;
        b.house(x, z, { color: 1 });
      }
    };
    const f = facts((b) => {
      ring(b, 10, 10, 13, 13); // 2 × 2 inside
      b.put('fountain', 11, 11);
      ring(b, 20, 10, 23, 13, [21, 10]); // a gap: open
      ring(b, 10, 20, 15, 25); // 4 × 4 = 16 inside: still a courtyard
      ring(b, 20, 20, 26, 25); // 5 × 4 = 20 inside: too big
    });
    const yards = courtyards(f).list;
    expect(yards.map((y) => y.area)).toEqual([4, 16]);
    expect(yards[0]!.empty).toHaveLength(3);
    expect(courtyards(f).byCell.get(k(11, 1, 11))).toBe(yards[0]);
    // Edge pieces enclose too, and a cliff of 2.
    const t = new TerrainBuilder(2).flat(1).rect(30, 4, 43, 43, 3).build();
    const g = facts((b) => b.wallEdge(28, 10, 'N').wallEdge(29, 10, 'N').wallEdge(28, 10, 'W').wallEdge(28, 10, 'S').wallEdge(29, 10, 'S'), t);
    expect(courtyards(g).list.map((y) => y.cells)).toEqual([[k(28, 1, 10), k(29, 1, 10)]]);
  });

  test('alleys: 1-wide corridors 2+ long with structures on both sides', () => {
    const f = facts((b) => {
      b.house(10, 10, { w: 4, color: 1 }).house(10, 12, { w: 3, color: 2 }); // corridor z = 11, x 10..12
      b.house(20, 10, { color: 1 }).house(20, 12, { color: 2 }); // only 1 long
      b.house(30, 10, { d: 3, color: 1 }).house(32, 10, { d: 3, color: 3 }); // along z, x = 31
    });
    const list = alleys(f).list;
    expect(list.map((a) => [a.axis, a.length])).toEqual([
      ['z', 3], // (31, 10) sorts before (10, 11)
      ['x', 3],
    ]);
    expect(list[1]!.cells).toEqual([k(10, 1, 11), k(11, 1, 11), k(12, 1, 11)]);
    expect(list[1]!.sides).toEqual([[sid(f, 10, 1, 10)], [sid(f, 10, 1, 12)]]);
    expect(list[0]!.sides).toEqual([[sid(f, 30, 1, 10)], [sid(f, 32, 1, 10)]]);
    expect(alleys(f).byCell.has(k(20, 1, 11))).toBe(false);
  });

  test('waterfront: standable cells beside open water, on land or a dock deck', () => {
    const f = facts((b) => b.block('dock', 2, 0, 20).house(4, 22));
    const wf = waterfront(f);
    expect(wf.has(k(4, 1, 10))).toBe(true);
    expect(wf.sides.get(k(4, 1, 10))).toEqual([W]);
    expect(wf.has(k(2, 1, 20))).toBe(true); // on the dock
    expect(wf.has(k(4, 1, 20))).toBe(true); // open water at (3, 20), beside the dock
    expect(wf.has(k(5, 1, 10))).toBe(false);
    expect(wf.has(k(4, 1, 22))).toBe(false); // a house stands there
  });

  test('shelteredWater: open water with land or dock on 2+ sides', () => {
    const t = new TerrainBuilder(2).flat(1).set(4, 10, 0).build(); // a one-column cove
    const f = facts((b) => b.block('dock', 2, 0, 20).block('dock', 2, 0, 22), t);
    const sw = shelteredWater(f);
    expect(sw.sides.get(k(4, 0, 10))).toBe(3);
    expect(sw.has(k(2, 0, 21))).toBe(true);
    expect(sw.has(k(1, 0, 30))).toBe(false);
    expect(sw.has(k(3, 0, 30))).toBe(false); // the open coast: land on one side only
  });
});

describe('ground (catalogue part U)', () => {
  test('wildGrass: bare grass with no block and no floor; sand is not grass', () => {
    const f = facts((b) => b.house(10, 10).path(11, 10).put('tree', 12, 10));
    const g = wildGrass(f);
    expect(g.has(k(13, 1, 10))).toBe(true);
    expect(g.has(k(10, 1, 10)) || g.has(k(11, 1, 10)) || g.has(k(12, 1, 10))).toBe(false);
    expect(g.has(k(4, 1, 10))).toBe(false); // sand
    expect(g.cells.length).toBe(38 * 38 - 3);
  });

  test('leftovers: bare grass patches bounded by structures, floors, fences, walls, cliffs or water', () => {
    const f = facts((b) => {
      // A 2 × 1 patch: houses N and on both ends, a street S.
      b.house(9, 9, { w: 4, color: 1 }).house(9, 10, { color: 1 }).house(12, 10, { color: 1 }).path(9, 11, 12, 11);
      // A fenced 1-cell patch.
      b.fenceEdge(30, 30, 'N').fenceEdge(30, 30, 'E').fenceEdge(30, 30, 'S').fenceEdge(30, 30, 'W');
    });
    const list = leftovers(f).list;
    expect(list.map((l) => l.cells)).toEqual([[k(10, 1, 10), k(11, 1, 10)], [k(30, 1, 30)]]);
    expect([...list[0]!.bounds].sort()).toEqual(['floor', 'structure']);
    expect(list[0]!.streets).toEqual([f.floorAt.get(k(9, 1, 11))]);
    expect([...list[1]!.bounds]).toEqual(['fence']);
    expect(leftovers(f).byCell.has(k(20, 1, 20))).toBe(false); // the open island is not a leftover
  });

  test('verges: bare grass beside a street', () => {
    const f = facts((b) => b.path(10, 10, 14, 10).fenceEdge(12, 10, 'N'));
    const v = verges(f);
    expect(v.byCell.get(k(10, 1, 9))).toMatchObject({ dirs: [S], fenced: false });
    expect(v.byCell.get(k(12, 1, 9))).toMatchObject({ dirs: [S], fenced: true });
    expect(v.byCell.get(k(15, 1, 10))).toMatchObject({ dirs: [W] });
    expect(v.byCell.has(k(10, 1, 12))).toBe(false);
    expect(v.list).toHaveLength(5 + 5 + 2);
    expect(v.byCell.get(k(10, 1, 9))!.streets).toEqual([f.floorAt.get(k(10, 1, 10))]);
  });
});

describe('town', () => {
  test('townFacts: counts, tallest, highest walkable point, street length', () => {
    const t = new TerrainBuilder(2).flat(1).rect(30, 30, 33, 33, 4).build();
    const f = facts((b) => b.house(10, 10, { floors: 2 }).tower(14, 10, { floors: 5 }).put('pillar', 20, 20).path(9, 12, 12, 12).put('tree', 31, 31), t);
    const town = townFacts(f);
    expect(town.blocks).toBe(9);
    expect(town.cellsByKind.get('tower')).toBe(5);
    expect(town.structuresByKind.get('path')).toBe(1);
    expect(town.topLevel).toBe(5);
    expect(town.tallest).toEqual({ id: sid(f, 14, 1, 10), top: 6 });
    expect(town.tallestByKind.get('house')).toEqual({ id: sid(f, 10, 1, 10), storeys: 2 });
    expect(town.highestWalkable).toBe(k(14, 6, 10));
    expect(town.streetLength).toBe(4);
    expect(town.floorCells.get('path')).toBe(4);
    expect(townFacts(facts(() => {}, t)).highestWalkable).toBe(k(30, 4, 30));
  });

  test('townRoles counts roles once the shape is done (dressing-stage rules only)', () => {
    const b = new TownBuilder(emptyWorld(2), flat).house(10, 10).house(14, 10).tower(20, 20);
    const shape = resolveShape(b.world, flat, { rules: demoRules });
    expect(townRoles(shape.facts).get('cottage')).toBe(2);
  });
});
