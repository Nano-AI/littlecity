import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allParts } from '@/gen/discover';
import { MeshBuilder, meshBounds, triangleCount, type MeshData } from '@/gen/mesh';
import { TONE } from '@/parts/ground/kit';
import { resolveTown } from '@/resolve/index';
import treeRule from '@/rules/roles/R-P01.tree-species.rule';
import { TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import treeGen, { drawTree, mixedSpecies, TREE_ROLES, type TreeRole } from './tree.gen';

const SEEDS = [1, 2, 3, 17, 404, 9001, 31337];
/** Triangles per plant. The aim is under 400; a companion bush at the foot adds up to 160. */
const BUDGET: Record<TreeRole, number> = {
  'round-tree': 400,
  'cypress': 300,
  'bush': 320,
  'palm': 330,
  'willow': 400,
  'pine': 160,
  'planter-tree': 400,
  'fruit-tree': 480,
  'grove-tree': 480,
};
const COMPANION = 160;

function plant(role: TreeRole, seed: number, companion = false): MeshData {
  const b = new MeshBuilder({ ink: seed });
  drawTree(b, role, seed, companion);
  return b.build();
}

/** Builds a little world on hand-made terrain and resolves it with R-P01 only. */
function town(terrain: (t: TerrainBuilder) => void, build: (b: TownBuilder) => void, seed = 9) {
  const t = new TerrainBuilder(seed);
  terrain(t);
  const ground = t.build();
  const b = new TownBuilder(emptyWorld(seed), ground);
  build(b);
  return resolveTown(b.world, ground, { rules: [treeRule] }).shape;
}
const roleAt = (plan: ReturnType<typeof town>, x: number, y: number, z: number): string | undefined =>
  plan.roles.get(plan.structureAt.get(key(x, y, z))!)?.role;

describe('every tree species', () => {
  test.each(TREE_ROLES)('%s: a sound mesh, in budget, standing on the ground', (role) => {
    for (const seed of SEEDS) {
      const mesh = plant(role, seed);
      expect(validateMesh(mesh)).toEqual([]);
      expect(findDuplicateFaces(mesh)).toBe(0);
      expect(triangleCount(mesh), `${role} seed ${seed}`).toBeLessThanOrEqual(BUDGET[role]);
      expect(triangleCount(plant(role, seed, true)) - triangleCount(mesh)).toBeLessThanOrEqual(COMPANION);
      // A handful of outlined objects, never one per leaf.
      expect(inkGroups(mesh).size).toBeLessThanOrEqual(6);
      const { min, max } = meshBounds(mesh);
      expect(min[1]).toBeGreaterThanOrEqual(-0.06); // a trunk's foot is sunk a hair, never lifted
      expect(max[1], `${role} is ${max[1]} tall`).toBeGreaterThan(role === 'bush' ? 0.3 : role === 'fruit-tree' ? 0.6 : 0.75);
      expect(max[1]).toBeLessThan(1.65);
      for (const v of [min[0], min[2], max[0], max[2]]) expect(Math.abs(v)).toBeLessThan(0.75);
    }
  });

  test.each(TREE_ROLES)('%s: rooted at the foot, moving in the crown', (role) => {
    const mesh = plant(role, 5, true);
    let top = 0;
    for (let v = 0; v < mesh.sway.length; v++) {
      if (mesh.position[v * 3 + 1]! < 0.03) expect(mesh.sway[v]!).toBeLessThan(0.05);
      top = Math.max(top, mesh.sway[v]!);
    }
    expect(top).toBeGreaterThan(role === 'bush' ? 0.15 : 0.5);
  });

  test('one seed, one plant: the same every time, and no two seeds alike', () => {
    for (const role of TREE_ROLES) {
      expect(plant(role, 7)).toEqual(plant(role, 7));
      if (role !== 'planter-tree') expect(Array.from(plant(role, 7).position.slice(0, 600))).not.toEqual(Array.from(plant(role, 8).position.slice(0, 600)));
    }
  });

  test('crowns are drawn in flat tones: most leaf vertices carry one of the three tone normals', () => {
    const tones = [TONE.lit, TONE.mid, TONE.shade];
    for (const role of ['round-tree', 'cypress', 'willow', 'grove-tree', 'fruit-tree'] as const) {
      const mesh = plant(role, 3);
      let flat = 0, swaying = 0;
      for (let v = 0; v < mesh.sway.length; v++) {
        if (mesh.pattern[v] !== 17) continue; // leaves
        swaying++;
        const n = [mesh.normal[v * 3]!, mesh.normal[v * 3 + 1]!, mesh.normal[v * 3 + 2]!];
        if (tones.some((t) => Math.abs(t[0] - n[0]) + Math.abs(t[1] - n[1]) + Math.abs(t[2] - n[2]) < 1e-3)) flat++;
      }
      expect(swaying).toBeGreaterThan(100);
      expect(flat / swaying, role).toBeGreaterThan(0.9);
    }
  });
});

describe('the tree generator', () => {
  test('draws the species its role names, in the cell, in world space', () => {
    const plan = town((t) => t.flat(1), (b) => b.put('tree', 20, 20));
    const s = plan.structures.get(plan.structureAt.get(key(20, 1, 20))!)!;
    const out = treeGen.build(s, plan, allParts());
    expect(validateMesh(out.mesh)).toEqual([]);
    const { min, max } = meshBounds(out.mesh);
    expect(min[1]).toBeGreaterThan(0.72);
    expect(min[1]).toBeLessThanOrEqual(0.8);
    expect(min[0]).toBeGreaterThan(19.3);
    expect(max[0]).toBeLessThan(21.7);
    expect(triangleCount(out.mesh)).toBeLessThanOrEqual(400 + COMPANION);
    // The same structure draws the same mesh.
    expect(treeGen.build(s, plan, allParts()).mesh).toEqual(out.mesh);
  });

  test('with no role (no rules) it falls back to the seeded mix', () => {
    expect(mixedSpecies(0.1)).toBe('round-tree');
    expect(mixedSpecies(0.6)).toBe('cypress');
    expect(mixedSpecies(0.9)).toBe('bush');
  });
});

describe('R-P01 tree species', () => {
  const shore = (t: TerrainBuilder): void => {
    t.flat(1);
    t.water(4, 30, 43, 43);
    t.rect(30, 26, 36, 29, 2); // grass that meets the water
    t.rect(8, 8, 12, 12, 4); // a hill
  };

  test('first match wins: palm, willow, pine, planter, fruit, grove, then the mix', () => {
    const plan = town(shore, (b) => {
      b.put('tree', 15, 29); // sand beside water
      b.put('tree', 32, 29); // grass beside water
      b.put('tree', 10, 10); // level 4
      b.plaza(20, 20, 21, 21).put('tree', 20, 20).put('tree', 22, 20); // on a plaza, beside a plaza
      b.garden(25, 20).put('tree', 25, 20); // on a garden
      for (const [x, z] of [[14, 14], [15, 14], [16, 14], [15, 15], [15, 16]] as const) b.put('tree', x, z); // five touching
      b.put('tree', 30, 12).put('tree', 32, 12).put('tree', 34, 12).put('tree', 36, 12).put('tree', 38, 12).put('tree', 40, 12);
    });
    expect(roleAt(plan, 15, 1, 29)).toBe('palm');
    expect(roleAt(plan, 32, 2, 29)).toBe('willow');
    expect(roleAt(plan, 10, 4, 10)).toBe('pine');
    expect(roleAt(plan, 20, 1, 20)).toBe('planter-tree');
    expect(roleAt(plan, 22, 1, 20)).toBe('planter-tree');
    expect(roleAt(plan, 25, 1, 20)).toBe('fruit-tree');
    for (const [x, z] of [[14, 14], [15, 14], [16, 14], [15, 15], [15, 16]] as const) expect(roleAt(plan, x, 1, z)).toBe('grove-tree');
    const mix = new Set([30, 32, 34, 36, 38, 40].map((x) => roleAt(plan, x, 1, 12)));
    for (const r of mix) expect(['round-tree', 'cypress', 'bush']).toContain(r);
    expect(mix.size).toBeGreaterThanOrEqual(2);
  });

  test('four touching trees are not a grove; a tree on a block by the water is not a willow', () => {
    const plan = town(shore, (b) => {
      for (const [x, z] of [[14, 14], [15, 14], [16, 14], [15, 15]] as const) b.put('tree', x, z);
      b.put('marble', 20, 29).put('tree', 20, 29);
    });
    expect(roleAt(plan, 15, 1, 14)).not.toBe('grove-tree');
    expect(['round-tree', 'cypress', 'bush']).toContain(roleAt(plan, 20, 2, 29));
  });

  test('every tree gets exactly one role, and the choice does not change between runs', () => {
    const build = (b: TownBuilder): void => {
      for (let i = 0; i < 12; i++) b.put('tree', 10 + i * 2, 18);
    };
    const a = town(shore, build), c = town(shore, build);
    for (let i = 0; i < 12; i++) {
      expect(roleAt(a, 10 + i * 2, 1, 18)).toBeDefined();
      expect(roleAt(a, 10 + i * 2, 1, 18)).toBe(roleAt(c, 10 + i * 2, 1, 18));
    }
  });
});
