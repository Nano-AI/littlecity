import { describe, expect, test } from 'vitest';
import { CELL_H } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { MeshBuilder, meshBounds, PATTERN, triangleCount } from '@/gen/mesh';
import { inksWhere, town } from '@/parts/monuments/testing';

describe('marble (J16, R-M07)', () => {
  test('a merged mass draws only its exposed faces, as one ink group', () => {
    // 3 × 2 × 2 = 12 cells. Exposed: top 6 quads, sides (3 + 2) × 2 × 2 = 20 quads; the bottom is on the ground.
    const t = town((b) => b.fill('marble', 10, 10, 12, 11, { floors: 2 }));
    const s = t.at(10, 1, 10);
    expect(s.cells.length).toBe(12);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const mass = new MeshBuilder({ ink: s.id }).inkOf('mass');
    const groups = inkGroups(mesh);
    expect(groups.size).toBe(2); // the mass and its base course
    // 20 side quads, and a paved top of 6 cells each split into a field and its coping strips.
    expect(groups.get(mass)).toBeGreaterThanOrEqual(20 * 2 + 6 * 2);
    expect(triangleCount(mesh)).toBeLessThan(12 * 40);
    // No face lies strictly inside the mass (between merged cells).
    const inner = inksWhere(mesh, (x, y, z) => x > 10.01 && x < 12.99 && z > 10.01 && z < 11.99 && y > CELL_H + 0.01 && y < 3 * CELL_H - 0.01);
    expect(inner.size).toBe(0);
  });

  test('a block fills its cell exactly, so stacks and neighbours are flush', () => {
    const t = town((b) => b.put('marble', 10, 10));
    const { min, max } = meshBounds(t.drawAt(10, 1, 10));
    expect(max[1]).toBeCloseTo(2 * CELL_H, 6);
    expect(min[1]).toBeCloseTo(CELL_H, 6);
    // Only the base course stands proud, and by less than 0.05.
    expect(min[0]).toBeGreaterThan(10 - 0.05);
    expect(max[0]).toBeLessThan(11 + 0.05);
  });

  test('top edges are marked for the bevel line; a walkable top is paved (terrace)', () => {
    const t = town((b) => b.put('marble', 10, 10).put('marble', 14, 10).block('marble', 14, 2, 10, { color: 3 }));
    const s = t.at(10, 1, 10);
    expect(t.plan.roles.get(s.id)?.role).toBe('terrace');
    expect(t.plan.tags.get(s.id)?.has('top:paved')).toBe(true);
    const mesh = t.draw(s);
    let bevelled = 0, paved = 0;
    for (let v = 0; v < mesh.edge.length; v++) {
      if (mesh.edge[v]! < 1) bevelled++;
      if (mesh.pattern[v] === PATTERN.paving) paved++;
    }
    expect(bevelled).toBeGreaterThan(0);
    expect(paved).toBe(6); // one quad on top
    // The lower block of the two-colour stack is covered: no paving, no walkable top.
    const covered = t.at(14, 1, 10);
    expect(t.plan.tags.get(covered.id)?.has('top:paved') ?? false).toBe(false);
    const cm = t.draw(covered);
    for (let v = 0; v < cm.pattern.length; v++) expect(cm.pattern[v]).not.toBe(PATTERN.paving);
  });

  test('colours never merge; a mass level with higher ground is tagged flush', () => {
    const t = town((b) => b.put('marble', 10, 10, { color: 0 }).put('marble', 11, 10, { color: 4 }).put('marble', 20, 11), {
      terrain: (tb) => tb.flat(1).rect(18, 6, 22, 10, 2),
    });
    expect(t.at(10, 1, 10).id).not.toBe(t.at(11, 1, 10).id);
    expect(t.plan.tags.get(t.at(20, 1, 11).id)?.has('top:flush')).toBe(true);
    expect(t.plan.tags.get(t.at(10, 1, 10).id)?.has('top:flush') ?? false).toBe(false);
    expect(findDuplicateFaces(t.drawAt(10, 1, 10))).toBe(0);
  });
});
