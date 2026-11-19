import { describe, expect, test } from 'vitest';
import { CELL_H, SEA_Y } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { meshBounds, triangleCount } from '@/gen/mesh';
import { town } from '@/parts/monuments/testing';

describe('pillar (J14)', () => {
  test('a stack is one shaft with one base and one capital', () => {
    const t = town((b) => b.stack('pillar', 10, 10, { floors: 3 }));
    const s = t.at(10, 1, 10);
    expect(s.cells.length).toBe(3);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).size).toBe(3); // base, shaft, capital: however tall
    expect(triangleCount(mesh)).toBeLessThan(500);
    const { min, max } = meshBounds(mesh);
    expect(min[1]).toBeCloseTo(CELL_H, 6);
    expect(max[1]).toBeCloseTo(4 * CELL_H, 6); // flush under whatever is put on it
    expect(min[0]).toBeGreaterThanOrEqual(10.2);
    expect(max[0]).toBeLessThanOrEqual(10.8);
  });

  test('the triangle count does not grow with height', () => {
    const one = town((b) => b.stack('pillar', 10, 10, { floors: 1 }));
    const six = town((b) => b.stack('pillar', 10, 10, { floors: 6 }));
    expect(triangleCount(six.drawAt(10, 1, 10))).toBeLessThan(triangleCount(one.drawAt(10, 1, 10)) + 150);
  });

  test('under a block the capital flares, and the rule says so', () => {
    const free = town((b) => b.stack('pillar', 10, 10, { floors: 2 }));
    const loaded = town((b) => b.stack('pillar', 10, 10, { floors: 2 }).block('marble', 10, 3, 10));
    const width = (m: ReturnType<typeof free.drawAt>): number => {
      // The widest thing in the top 0.1 of the column is its abacus.
      let w = 0;
      for (let i = 0; i < m.position.length; i += 3) if (m.position[i + 1]! > 3 * CELL_H - 0.1) w = Math.max(w, Math.abs(m.position[i]! - 10.5) * 2);
      return w;
    };
    expect(width(loaded.drawAt(10, 1, 10))).toBeGreaterThan(width(free.drawAt(10, 1, 10)) + 0.1);
    expect(loaded.plan.tags.get(loaded.at(10, 1, 10).id)?.has('capital:flared')).toBe(true);
    expect(free.plan.tags.get(free.at(10, 1, 10).id)?.has('capital:flared') ?? false).toBe(false);
    expect(free.plan.sockets.some((s) => s.type === 'perch' && s.structure === free.at(10, 1, 10).id)).toBe(true);
    expect(loaded.plan.sockets.some((s) => s.type === 'perch' && s.structure === loaded.at(10, 1, 10).id)).toBe(false);
  });

  test('in the sea it stands on a stone footing that shows above the water', () => {
    const t = town((b) => b.block('pillar', 10, 0, 10).block('pillar', 10, 1, 10), { terrain: (tb) => tb.flat(1).water(8, 8, 12, 12) });
    const s = t.at(10, 0, 10);
    expect(t.plan.tags.get(s.id)?.has('footing:water')).toBe(true);
    const mesh = t.draw(s);
    expect(validateMesh(mesh)).toEqual([]);
    expect(inkGroups(mesh).size).toBe(4); // + the footing
    // The footing is the widest part and its top is above the sea.
    let top = 0;
    for (let i = 0; i < mesh.position.length; i += 3) if (Math.abs(mesh.position[i]! - 10.5) > 0.3) top = Math.max(top, mesh.position[i + 1]!);
    expect(top).toBeGreaterThan(SEA_Y);
    expect(top).toBeLessThan(SEA_Y + 0.3);
  });
});
