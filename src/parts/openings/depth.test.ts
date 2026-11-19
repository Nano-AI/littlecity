// The house parts of the urban-fill rules (U09 vista, U10 corner turret, U11
// arcade): sound meshes, a few ink groups, in budget, on the wall plane, and
// the sockets they promise.

import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allParts } from '@/gen/discover';
import { meshBounds, triangleCount } from '@/gen/mesh';
import { resolveTown } from '@/resolve/index';
import type { Feature } from '@/resolve/plan';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';

const SEED = 93;
const terrain = flatTerrain(SEED);
const plan = resolveTown(new TownBuilder(emptyWorld(SEED), terrain).house(10, 10, { floors: 3, color: 2 }).world, terrain).shape;
const house = plan.structures.get(plan.structureAt.get(key(10, 1, 10))!)!;
const draw = (type: string, variant?: string, params?: object) =>
  allParts().feature({ id: `${type}@t:${variant ?? ''}`, type, structure: house.id, cell: key(10, 2, 10), dir: 2, variant, params, rule: 'test' } as Feature, { plan, structure: house });

describe('urban-fill house parts', () => {
  test.each([
    ['vista', 'clock', 180, 5],
    ['vista', 'niche', 150, 4],
    ['vista', 'doorway', 120, 2],
    ['vista', 'oriel', 120, 4],
    ['corner-oriel', undefined, 560, 6],
    ['arcade', undefined, 160, 2],
  ] as const)('%s/%s is sound, in budget and not ink noise', (type, variant, budget, inks) => {
    const out = draw(type, variant, type === 'corner-oriel' ? { storeys: 2 } : type === 'arcade' ? { left: 1, right: 1 } : undefined);
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(findDuplicateFaces(out.mesh)).toBe(0);
    expect(triangleCount(out.mesh)).toBeGreaterThan(0);
    expect(triangleCount(out.mesh)).toBeLessThanOrEqual(budget);
    expect(inkGroups(out.mesh).size).toBeLessThanOrEqual(inks);
    const { min, max } = meshBounds(out.mesh);
    if (type === 'vista') {
      // On the wall plane, inside its cell, under the storey above.
      expect(min[2]).toBeGreaterThanOrEqual(-1e-6);
      expect(max[2]).toBeLessThan(0.25);
      expect(min[0]).toBeGreaterThan(-0.45);
      expect(max[0]).toBeLessThan(0.45);
      expect(max[1]).toBeLessThan(CELL_H);
    }
  });

  test('a clock owns its hands and a flag mount', () => {
    const out = draw('vista', 'clock');
    expect(out.anchors?.['clock-hands']).toBeDefined();
    expect(out.anchors?.['flag-mount']).toBeDefined();
  });

  test('an arcade bay reaches cell line to cell line at a closed end, and stays out of the next cell', () => {
    const { min, max } = meshBounds(draw('arcade', undefined, { left: 1, right: 1 }).mesh);
    expect(min[0]).toBeCloseTo(-0.57, 2);
    expect(max[0]).toBeCloseTo(0.57, 2);
    expect(max[2]).toBeLessThan(0.07 + 0.12 + 1e-6); // the wall is 0.07 inside the cell line; 0.12 past it at most
    expect(min[1]).toBeCloseTo(0, 5);
  });

  test('a corner turret stands on a corbel and rises above the eave', () => {
    const { min, max } = meshBounds(draw('corner-oriel', undefined, { storeys: 2 }).mesh);
    expect(min[1]).toBeLessThan(0);
    expect(max[1]).toBeGreaterThan(2 * CELL_H + 0.4);
  });
});
