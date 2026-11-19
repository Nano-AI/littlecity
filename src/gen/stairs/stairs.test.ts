import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { findDuplicateFaces, inkGroups, triangleCount, validateMesh } from '@/gen/checks';
import { MeshBuilder, meshBounds } from '@/gen/mesh';
import { flightSteps } from '@/rules/joinery/edges-lib';
import { blockStructure, edgeParts, town } from '../fence/testing';
import stairs from './stairs.gen';

/** Triangle budgets per stairs cell: without handrails, and with them. */
const BARE = 150;
const RAILED = 420;

const inkOf = (structure: number, group: string): number => new MeshBuilder({ ink: structure }).inkOf(group);

describe('the stairs generator (J18)', () => {
  test('a single flight: one storey high, five ink groups, in budget', () => {
    const plan = town((b) => {
      b.put('marble', 10, 10);
      b.block('stairs', 10, 1, 11, { rot: 0 });
    });
    const s = blockStructure(plan, 10, 1, 11);
    const { mesh } = stairs.build(s, plan, edgeParts);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).size).toBe(5); // risers, tread slabs, cheek walls, newels, newel caps
    expect(triangleCount(mesh)).toBeLessThan(BARE);
    const { min, max } = meshBounds(mesh);
    expect(min[1]).toBeCloseTo(CELL_H, 5);
    expect(min[0]).toBeGreaterThanOrEqual(10);
    expect(max[0]).toBeLessThanOrEqual(11);
  });

  test('flights side by side are one wide flight: no faces between them, every tread slab in one ink group', () => {
    const plan = town((b) => {
      b.fill('marble', 10, 10, 13, 10);
      for (let x = 10; x <= 13; x++) b.block('stairs', x, 1, 11, { rot: 0 });
    });
    const s = blockStructure(plan, 10, 1, 11);
    expect(s.cells).toHaveLength(4);
    const { mesh } = stairs.build(s, plan, edgeParts);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const groups = inkGroups(mesh);
    expect(groups.size).toBe(5);
    // Four cells × four treads × (top + front lip): all in the one 'nosing' group.
    expect(groups.get(inkOf(s.id, 'nosing'))).toBe(4 * 4 * 4);
    expect(groups.get(inkOf(s.id, 'steps'))).toBe(4 * 4 * 2);
    // Cheek walls only on the two outer sides.
    expect(groups.get(inkOf(s.id, 'cheek'))).toBe(2 * 6);
    expect(triangleCount(mesh)).toBeLessThan(4 * BARE);
  });

  test('whichever way it climbs, a flight stays inside its cell and reaches the next storey at its high end', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const plan = town((b) => b.block('stairs', 20, 1, 20, { rot }));
      const { mesh } = stairs.build(blockStructure(plan, 20, 1, 20), plan, edgeParts);
      expect(findDuplicateFaces(mesh)).toBe(0);
      // The highest tread lies on the side the flight climbs toward.
      const p = mesh.position;
      let sum = 0, n = 0;
      for (let v = 0; v < p.length; v += 3) {
        if (Math.abs(p[v + 1]! - 2 * CELL_H) > 1e-4) continue;
        sum += rot % 2 === 0 ? p[v + 2]! - 20.5 : p[v]! - 20.5;
        n++;
      }
      expect(n).toBeGreaterThan(0);
      expect(Math.sign(sum / n)).toBe(rot === 0 || rot === 3 ? -1 : 1);
    }
  });

  test('a long flight has landings every third cell and handrails where the drop is two or more', () => {
    const plan = town((b) => {
      for (let i = 1; i <= 5; i++) b.stack('marble', 10, 20 - i, { floors: i });
      for (let i = 0; i < 5; i++) b.block('stairs', 10, 1 + i, 20 - i, { rot: 0 });
    });
    const s = blockStructure(plan, 10, 1, 20);
    expect(s.cells).toHaveLength(5);
    const steps = flightSteps(plan, s.cells);
    expect(s.cells.map((c) => steps.get(c))).toEqual([0, 1, 2, 3, 4]);
    const mine = plan.featuresByStructure.get(s.id) ?? [];
    expect(mine.filter((f) => f.type === 'stair-landing').map((f) => f.cell)).toEqual([key(10, 4, 17)]);
    const rails = mine.filter((f) => f.type === 'railing' && s.cells.includes(f.cell!));
    expect(rails).toHaveLength(8); // four upper cells, both sides
    const { mesh } = stairs.build(s, plan, edgeParts);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).get(inkOf(s.id, 'nosing'))).toBe(5 * 4 * 4);
    expect(inkGroups(mesh).has(inkOf(s.id, 'rail'))).toBe(true);
    expect(triangleCount(mesh)).toBeLessThan(5 * RAILED);
  });

  test('against a wall the treads run flush to it: no cheek wall, no rail on that side', () => {
    const plan = town((b) => {
      b.fill('marble', 9, 10, 9, 11, { floors: 2 });
      b.put('marble', 10, 10);
      b.block('stairs', 10, 1, 11, { rot: 0 });
    });
    const s = blockStructure(plan, 10, 1, 11);
    const { mesh } = stairs.build(s, plan, edgeParts);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).get(inkOf(s.id, 'cheek'))).toBe(6); // the east side only
    expect(meshBounds(mesh).min[0]).toBeCloseTo(10, 5); // flush with the wall on the west
    expect(plan.features.filter((f) => f.type === 'railing')).toHaveLength(0);
  });
});
