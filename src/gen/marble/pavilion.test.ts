import { describe, expect, test } from 'vitest';
import { CELL_H } from '@/core/grid';
import { findDuplicateFaces, validateMesh } from '@/gen/checks';
import { meshBounds, triangleCount } from '@/gen/mesh';
import { town, type TestTown } from '@/parts/monuments/testing';
import type { TownBuilder } from '@/scenario';
import { pavilionLayout } from './pavilion';

/** A bandstand: pillars `h` tall under each cell, marble on them, on a plaza. */
function bandstand(cells: readonly (readonly [number, number])[], h = 2): TestTown {
  return town((b: TownBuilder) => {
    b.plaza(4, 4, 20, 20);
    for (const [x, z] of cells) b.stack('pillar', x, z, { floors: h }).block('marble', x, 1 + h, z, { color: 2 });
  });
}

const SQUARE = [[10, 10], [11, 10], [10, 11], [11, 11]] as const;
const SHAPES = {
  square: SQUARE,
  bar: [[10, 10], [11, 10], [12, 10], [13, 10]],
  ell: [[10, 10], [10, 11], [10, 12], [11, 12]],
  tee: [[10, 10], [11, 10], [12, 10], [11, 11]],
  ess: [[11, 10], [12, 10], [10, 11], [11, 11]],
} as const;

describe('the bandstand pavilion (R-M11)', () => {
  test('a 2 × 2 is an octagon of eight columns, two in each pillar’s cell', () => {
    const pv = pavilionLayout({ cells: SQUARE, ground: 1, low: 1, level: 3 });
    expect(pv.round).toBe(true);
    expect(pv.outline.length).toBe(8);
    expect(pv.columns.length).toBe(8);
    for (const [x, z] of SQUARE) expect(pv.columns.filter((p) => Math.floor(p[0]) === x && Math.floor(p[1]) === z).length).toBe(2);
  });

  test('every footprint draws clean meshes, inside its cells, with nothing drawn twice', () => {
    for (const [name, cells] of Object.entries(SHAPES)) {
      for (const h of [2, 3, 4]) {
        const t = bandstand(cells, h);
        const roof = t.at(cells[0][0], 1 + h, cells[0][1]);
        expect(t.plan.roles.get(roof.id)?.role, name).toBe('bandstand');
        const mesh = t.draw(roof);
        expect(validateMesh(mesh), `${name} ${h}`).toEqual([]);
        expect(findDuplicateFaces(mesh), `${name} ${h}`).toBe(0);
        // The eaves reach at most 0.12 past the footprint; the roof stands on the ground and rises above the block's foot.
        const xs = cells.map((c) => c[0]), zs = cells.map((c) => c[1]);
        const { min, max } = meshBounds(mesh);
        expect(min[0]).toBeGreaterThan(Math.min(...xs) - 0.121);
        expect(max[0]).toBeLessThan(Math.max(...xs) + 1.121);
        expect(min[2]).toBeGreaterThan(Math.min(...zs) - 0.121);
        expect(max[2]).toBeLessThan(Math.max(...zs) + 1.121);
        expect(min[1]).toBeCloseTo(CELL_H, 6);
        expect(max[1]).toBeGreaterThan((1 + h) * CELL_H);
        // Each pillar draws only slender columns centred in its own cell (no fat shaft), inside the footprint.
        let columns = 0;
        for (const [x, z] of cells) {
          const pm = t.draw(t.at(x, 1, z));
          expect(validateMesh(pm)).toEqual([]);
          expect(findDuplicateFaces(pm)).toBe(0);
          const b = meshBounds(pm);
          expect(b.min[0]).toBeGreaterThan(Math.min(...xs));
          expect(b.max[0]).toBeLessThan(Math.max(...xs) + 1);
          expect(b.min[2]).toBeGreaterThan(Math.min(...zs));
          expect(b.max[2]).toBeLessThan(Math.max(...zs) + 1);
          expect(b.max[0] - b.min[0]).toBeLessThan(1.3);
          expect(triangleCount(pm), `${name} ${h}: the pillar at ${x}, ${z}`).toBeGreaterThan(0);
          columns += triangleCount(pm);
        }
        expect(columns).toBeGreaterThan(0);
      }
    }
  });

  test('a taller stack is a taller pavilion with a second tier, not longer columns alone', () => {
    const two = pavilionLayout({ cells: SQUARE, ground: 1, low: 1, level: 3 });
    const four = pavilionLayout({ cells: SQUARE, ground: 1, low: 1, level: 5 });
    expect(two.tier).toBeNull();
    expect(four.tier).not.toBeNull();
    const col = (p: typeof two): number => p.architrave - p.floor;
    expect(col(four) / col(two)).toBeLessThan(1.6);
    expect(four.floor).toBeGreaterThan(two.floor);
  });

  test('the triangle budget: a whole pavilion (roof and its four pillars)', () => {
    const t = bandstand(SQUARE);
    const roof = triangleCount(t.drawAt(10, 3, 10));
    const columns = SQUARE.reduce((n, [x, z]) => n + triangleCount(t.drawAt(x, 1, z)), 0);
    console.log(`pavilion: roof ${roof}, columns ${columns}, tall ${triangleCount(bandstand(SQUARE, 4).drawAt(10, 5, 10))}`);
    expect(roof + columns).toBeLessThan(3000);
  });

  test('the open bay faces the path', () => {
    const t = town((b: TownBuilder) => {
      b.plaza(7, 7, 14, 14);
      b.path([7, 15], [14, 15]);
      for (const [x, z] of SQUARE) b.stack('pillar', x, z, { floors: 2 }).block('marble', x, 3, z, { color: 2 });
    });
    const tags = t.plan.tags.get(t.at(10, 3, 10).id);
    expect(tags?.has('bandstand:s')).toBe(true);

    const t2 = town((b: TownBuilder) => {
      b.plaza(7, 7, 14, 14);
      b.path([6, 7], [6, 14]);
      for (const [x, z] of SQUARE) b.stack('pillar', x, z, { floors: 2 }).block('marble', x, 3, z, { color: 2 });
    });
    expect(t2.plan.tags.get(t2.at(10, 3, 10).id)?.has('bandstand:w')).toBe(true);
    const t3 = town((b: TownBuilder) => {
      b.plaza(7, 7, 14, 14);
      b.path([7, 6], [14, 6]);
      for (const [x, z] of SQUARE) b.stack('pillar', x, z, { floors: 2 }).block('marble', x, 3, z, { color: 2 });
    });
    expect(t3.plan.tags.get(t3.at(10, 3, 10).id)?.has('bandstand:n')).toBe(true);
  });
});
