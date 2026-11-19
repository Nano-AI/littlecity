import { describe, expect, test } from 'vitest';
import { edgeKey } from '@/core/grid';
import { findDuplicateFaces, inkGroups, triangleCount, validateMesh } from '@/gen/checks';
import { MeshBuilder, meshBounds } from '@/gen/mesh';
import { defineRule } from '@/resolve/engine/api';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { blockStructure, EDGE_RULES, edgeParts, edgeStructure, town } from '../fence/testing';
import wall from './wall.gen';

/** Triangle budgets per cell of run. */
const LOW = 120;
const CURTAIN = 200;
const CREEPERS = 450;

describe('the wall generator', () => {
  test('the low wall: body, coping, blocks, piers and pier caps, each one ink group for the whole run', () => {
    const plan = town((b) => {
      for (let x = 10; x <= 15; x++) b.put('wall', x, 10);
      b.put('wall', 15, 11).put('wall', 15, 12);
    });
    const s = blockStructure(plan, 10, 1, 10);
    expect(plan.roles.get(s.id)?.role).toBe('low-wall');
    const { mesh } = wall.build(s, plan, edgeParts);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const groups = inkGroups(mesh);
    expect(groups.size).toBe(5);
    // The body of an L of eight cells is two stretches: four long faces, eight triangles.
    expect(groups.get(new MeshBuilder({ ink: s.id }).inkOf('body'))).toBe(8);
    expect(triangleCount(mesh)).toBeLessThan(8 * LOW);
  });

  test('a curtain wall stands one storey tall between its towers and ends in them without piers', () => {
    const plan = town((b) => {
      b.tower(9, 10, { floors: 2 }).tower(15, 10, { floors: 2 });
      for (let x = 10; x <= 14; x++) b.put('wall', x, 10);
    });
    const s = blockStructure(plan, 10, 1, 10);
    expect(plan.roles.get(s.id)?.role).toBe('curtain-wall');
    const { mesh } = wall.build(s, plan, edgeParts);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const { min, max } = meshBounds(mesh);
    expect(max[1] - min[1]).toBeCloseTo(0.8, 5);
    expect(min[0]).toBeLessThan(10); // into the west tower
    expect(max[0]).toBeGreaterThan(15); // and the east one
    expect(inkGroups(mesh).size).toBe(3); // body, wall-walk, merlons: no piers
    expect(triangleCount(mesh)).toBeLessThan(5 * CURTAIN);
  });

  test('arched openings in a low wall and in a curtain wall are sound', () => {
    const plan = town((b) => {
      for (let x = 10; x <= 14; x++) b.put('wall', x, 10);
      b.path(12, 8, 12, 12);
      b.put('marble', 9, 16);
      for (let x = 10; x <= 14; x++) b.put('wall', x, 16);
      b.path(12, 14, 12, 18);
    });
    for (const z of [10, 16]) {
      const s = blockStructure(plan, 10, 1, z);
      expect(plan.features.filter((f) => f.type === 'gate' && f.variant === 'arched' && f.structure === s.id)).toHaveLength(1);
      const { mesh } = wall.build(s, plan, edgeParts);
      expect(validateMesh(mesh)).toEqual([]);
      expect(findDuplicateFaces(mesh)).toBe(0);
      expect(triangleCount(mesh)).toBeLessThan(5 * CURTAIN);
    }
  });

  test('a garden wall of edge pieces, with creepers, stays in budget and adds one ink group', () => {
    const creepers = defineRule({
      id: 'X-TEST.creepers',
      part: 'joinery',
      tier: 1,
      priority: 1,
      find: ({ plan }) => [...plan.roles].filter(([, r]) => r.role === 'garden-wall').map(([id]) => ({ anchor: 0, key: id, structure: id })),
      apply: (c, out) => out.tag(c.structure!, 'creepers'),
    });
    const terrain = flatTerrain(3);
    const b = new TownBuilder(emptyWorld(3), terrain);
    b.garden(10, 10, 13, 12);
    b.fenceAround(10, 10, 13, 12, 'wall');
    const plan = resolveTown(b.world, terrain, { rules: [...EDGE_RULES, creepers] }).shape;
    const s = edgeStructure(plan, edgeKey(10, 1, 12, 'S'));
    expect(plan.roles.get(s.id)?.role).toBe('garden-wall');
    const bare = wall.build(s, { ...plan, tags: new Map() }, edgeParts).mesh;
    const grown = wall.build(s, plan, edgeParts).mesh;
    for (const mesh of [bare, grown]) {
      expect(validateMesh(mesh)).toEqual([]);
      expect(findDuplicateFaces(mesh)).toBe(0);
    }
    expect(inkGroups(bare).size).toBe(4); // body, coping, piers, pier caps
    expect(inkGroups(grown).size).toBe(5);
    expect(triangleCount(bare)).toBeLessThan(14 * LOW);
    expect(triangleCount(grown)).toBeGreaterThan(triangleCount(bare));
    expect(triangleCount(grown)).toBeLessThan(14 * CREEPERS);
  });
});
