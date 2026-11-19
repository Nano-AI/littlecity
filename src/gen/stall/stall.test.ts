import { describe, expect, test } from 'vitest';
import { E, key, N, S, W, type Dir4 } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allParts } from '@/gen/discover';
import { MeshBuilder, meshBounds, PATTERN, triangleCount, type MeshData } from '@/gen/mesh';
import { resolveTown } from '@/resolve/index';
import stallRule from '@/rules/roles/R-S01.stall.rule';
import { GOODS, goodsAt, readFront, readGoods, type Goods, type StallRole } from '@/rules/roles/ground-props';
import { TerrainBuilder, TownBuilder } from '@/scenario';
import { STALL } from '@/style/props';
import { emptyWorld } from '@/world/world';
import { awningColor, drawStall, type StallLook } from './draw';
import stallGen, { STALL_ROLES } from './stall.gen';

const SEEDS = [1, 2, 3, 17, 404, 9001];
const FRONTS: Dir4[] = [N, E, S, W];
/** Triangles per stall. The flower stall is eleven buckets of flowers. */
const BUDGET: Record<StallRole, number> = { 'market-stall': 700, 'fish-stall': 640, 'flower-stall': 800 };

function draw(look: StallLook): MeshData {
  const b = new MeshBuilder({ ink: look.seed });
  drawStall(b, look);
  return b.build();
}
const looks: StallLook[] = [];
for (const seed of SEEDS) {
  for (const front of FRONTS) {
    for (const goods of GOODS) looks.push({ role: 'market-stall', goods, front, seed });
    looks.push({ role: 'fish-stall', goods: 'fruit', front, seed }, { role: 'flower-stall', goods: 'fruit', front, seed });
  }
}

describe('the stalls', () => {
  test('every stall, every goods, every side: a sound mesh, in budget, inside its cell, about 0.9 tall', () => {
    for (const look of looks) {
      const mesh = draw(look);
      const what = `${look.role} ${look.goods} front ${look.front} seed ${look.seed}`;
      expect(validateMesh(mesh), what).toEqual([]);
      expect(findDuplicateFaces(mesh), what).toBe(0);
      expect(triangleCount(mesh), what).toBeLessThanOrEqual(BUDGET[look.role]);
      expect(triangleCount(mesh), what).toBeGreaterThan(250);
      const groups = inkGroups(mesh).size;
      expect(groups, what).toBeGreaterThanOrEqual(9);
      expect(groups, what).toBeLessThanOrEqual(18);
      const { min, max } = meshBounds(mesh);
      for (const v of [min[0], min[2], max[0], max[2]]) expect(Math.abs(v), what).toBeLessThanOrEqual(0.5);
      expect(min[1], what).toBeGreaterThanOrEqual(0);
      expect(max[1], what).toBeGreaterThan(0.85);
      expect(max[1], what).toBeLessThan(0.95);
    }
  });

  test('the awning is striped cloth; its ridge and posts are fixed and its valance sways most', () => {
    const mesh = draw({ role: 'market-stall', goods: 'bread', front: S, seed: 5 });
    let cloth = 0, ridgeSway = 0, maxSway = 0, lowestSwayY = Infinity;
    for (let v = 0; v < mesh.pattern.length; v++) {
      if (mesh.pattern[v] !== PATTERN.stripes) {
        expect(mesh.sway[v]).toBe(0);
        continue;
      }
      cloth++;
      const y = mesh.position[v * 3 + 1]!;
      if (y > STALL.ridgeY - 0.03) ridgeSway = Math.max(ridgeSway, mesh.sway[v]!);
      if (mesh.sway[v]! > maxSway) {
        maxSway = mesh.sway[v]!;
        lowestSwayY = y;
      }
    }
    expect(cloth).toBeGreaterThan(100);
    expect(ridgeSway).toBe(0);
    expect(maxSway).toBeCloseTo(STALL.sway, 5);
    // The vertex that moves most is a point of the valance, below the eave.
    expect(lowestSwayY).toBeLessThan(STALL.frontY);
  });

  test('each sort of goods is its own stall: different meshes, different awnings', () => {
    const sizes = new Set<number>();
    const awnings = new Set<string>();
    for (const goods of GOODS) {
      const look: StallLook = { role: 'market-stall', goods, front: S, seed: 9 };
      sizes.add(triangleCount(draw(look)));
      awnings.add(awningColor(look));
    }
    expect(sizes.size).toBe(GOODS.length);
    expect(awnings.size).toBe(GOODS.length);
    expect(awningColor({ role: 'fish-stall', goods: 'fruit', front: S, seed: 9 })).not.toBe(awningColor({ role: 'market-stall', goods: 'fruit', front: S, seed: 9 }));
    // Painting a stall picks its awning.
    expect(awningColor({ role: 'market-stall', goods: 'fruit', front: S, seed: 9, color: 2 })).not.toBe(awningColor({ role: 'market-stall', goods: 'fruit', front: S, seed: 9, color: 3 }));
  });

  test('a stall turned to another side is the same stall turned: the awning ridge follows the front', () => {
    const south = meshBounds(draw({ role: 'market-stall', goods: 'pots', front: S, seed: 4 }));
    const east = meshBounds(draw({ role: 'market-stall', goods: 'pots', front: E, seed: 4 }));
    // Facing south the counter reaches toward +z; facing east, toward +x.
    expect(south.max[2]).toBeGreaterThan(-south.min[2] - 0.05);
    expect(east.max[0]).toBeCloseTo(south.max[2], 1);
    expect(east.max[1]).toBeCloseTo(south.max[1], 5);
  });

  test('the same seed draws the same stall', () => {
    const look: StallLook = { role: 'flower-stall', goods: 'fruit', front: W, seed: 77 };
    expect(draw(look).position).toEqual(draw(look).position);
    expect(draw(look).position).not.toEqual(draw({ ...look, seed: 78 }).position);
  });
});

describe('R-S01 and the stall generator together', () => {
  const seed = 6;
  const t = new TerrainBuilder(seed);
  t.flat(1);
  t.water(4, 30, 43, 43);
  const terrain = t.build();
  const b = new TownBuilder(emptyWorld(seed), terrain);
  for (let z = 30; z <= 32; z++) b.block('dock', 12, 0, z);
  b.put('stall', 12, 28); //            2 steps from the dock
  b.put('stall', 13, 28); //            3 steps
  b.put('stall', 12, 26); //            4 steps: out of reach
  b.garden(17, 24, 19, 25);
  b.put('stall', 18, 24); //            on a garden
  b.path(22, 25, 32, 25);
  for (const x of [23, 24, 25, 26, 27]) b.put('stall', x, 24); // a row along the street's north side
  b.put('stall', 26, 26); //            across the street
  b.house(35, 20, { floors: 1 });
  b.put('stall', 35, 21); //            hard against a house on its north side
  const plan = resolveTown(b.world, terrain, { rules: [stallRule] }).shape;
  const at = (x: number, z: number) => plan.structures.get(plan.structureAt.get(key(x, 1, z))!)!;
  const roleAt = (x: number, z: number): string | undefined => plan.roles.get(at(x, z).id)?.role;
  const tagsAt = (x: number, z: number) => plan.tags.get(at(x, z).id);

  test('first match wins: fish within 3 steps of a dock, flowers on a garden, otherwise a market stall', () => {
    expect(roleAt(12, 28)).toBe('fish-stall');
    expect(roleAt(13, 28)).toBe('fish-stall');
    expect(roleAt(12, 26)).toBe('market-stall');
    expect(roleAt(18, 24)).toBe('flower-stall');
    expect(roleAt(25, 24)).toBe('market-stall');
  });

  test('the counter faces the street; with nothing to face, south; never a wall', () => {
    for (const x of [23, 24, 25, 26, 27]) expect(readFront(tagsAt(x, 24))).toBe(S);
    expect(readFront(tagsAt(26, 26))).toBe(N);
    expect(readFront(tagsAt(12, 26))).toBe(S);
    expect(readFront(tagsAt(35, 21))).toBe(S);
  });

  test('market stalls say what they sell, and neighbours never sell the same', () => {
    const row = [23, 24, 25, 26, 27].map((x) => readGoods(tagsAt(x, 24)));
    expect(new Set(row).size).toBe(5);
    for (const x of [23, 24, 25, 26, 27]) expect(readGoods(tagsAt(x, 24))).toBe(goodsAt(seed, key(x, 1, 24)));
    expect(readGoods(tagsAt(12, 28))).toBeUndefined();
    expect(readGoods(tagsAt(18, 24))).toBeUndefined();
    // Anywhere on the map: no stall within two cells along a row, a column or a diagonal matches.
    for (let x = 10; x < 20; x++) {
      for (let z = 10; z < 20; z++) {
        const here: Goods = goodsAt(seed, key(x, 1, z));
        for (const [dx, dz] of [[1, 0], [2, 0], [0, 1], [0, 2], [1, 1], [1, -1], [2, 2], [2, -2]] as const) {
          expect(goodsAt(seed, key(x + dx, 1, z + dz)), `${x},${z} + ${dx},${dz}`).not.toBe(here);
        }
      }
    }
  });

  test('the generator draws every stall from its role and tags', () => {
    let stalls = 0;
    for (const s of plan.structures.values()) {
      if (s.kind !== 'stall') continue;
      stalls++;
      const out = stallGen.build(s, plan, allParts());
      expect(validateMesh(out.mesh)).toEqual([]);
      expect(findDuplicateFaces(out.mesh)).toBe(0);
      const role = plan.roles.get(s.id)!.role as StallRole;
      expect(STALL_ROLES).toContain(role);
      expect(triangleCount(out.mesh)).toBeLessThanOrEqual(BUDGET[role]);
    }
    expect(stalls).toBe(11);
  });

  test('with no role or tags (rules not run) a stall is still drawn', () => {
    const bare = resolveTown(b.world, terrain, { rules: [] }).shape;
    const s = [...bare.structures.values()].find((k) => k.kind === 'stall')!;
    expect(triangleCount(stallGen.build(s, bare, allParts()).mesh)).toBeGreaterThan(250);
  });
});
