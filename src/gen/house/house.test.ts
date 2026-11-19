// The house shell and its roofs (catalogue J01–J04, J12, J24): merged cells
// are one building with no interior walls and one wall surface, base trim
// only at the bottom, a sound roof on any footprint, and a triangle budget.

import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allGenerators, allParts } from '@/gen/discover';
import { meshBounds, PATTERN, triangleCount, type MeshData } from '@/gen/mesh';
import { resolveTown } from '@/resolve/index';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { HOUSE } from '@/style/houses';
import { emptyWorld } from '@/world/world';

const SEED = 77;
const town = (build: (b: TownBuilder) => void, terrain = flatTerrain(SEED)): ShapePlan => {
  const b = new TownBuilder(emptyWorld(SEED), terrain);
  build(b);
  return resolveTown(b.world, terrain).shape;
};
const at = (plan: ShapePlan, x: number, y: number, z: number): Structure => plan.structures.get(plan.structureAt.get(key(x, y, z))!)!;
const draw = (plan: ShapePlan, s: Structure): MeshData => allGenerators().build(s, plan, allParts()).mesh;

/** Vertices of upright faces of a given pattern, up to a height (the wall top: dormers above it are their own objects). */
function uprights(m: MeshData, pattern: number, maxY = Infinity): number[] {
  const out: number[] = [];
  for (let v = 0; v < m.pattern.length; v++) {
    if (m.pattern[v] === pattern && Math.abs(m.normal[v * 3 + 1]!) < 1e-6 && m.position[v * 3 + 1]! <= maxY + 1e-4) out.push(v);
  }
  return out;
}
const wallTop = (s: Structure): number => (Math.max(...s.cells.map((c) => c >> 12)) + 1) * CELL_H;

describe('house shell', () => {
  test('J02: a merged house has no interior walls, no doubled faces and one wall ink group', () => {
    const plan = town((b) => b.house(10, 10, { w: 3, d: 2, floors: 2, color: 2 }));
    const s = at(plan, 10, 1, 10);
    expect(s.cells.length).toBe(12);
    const m = draw(plan, s);
    expect(validateMesh(m)).toEqual([]);
    expect(findDuplicateFaces(m)).toBe(0);
    const wall = uprights(m, PATTERN.plaster, wallTop(s) - 0.1);
    expect(new Set(wall.map((v) => m.inkId[v])).size).toBe(1);
    // Every wall vertex lies on the outline (inset from the cell line), never on a line between merged cells.
    const i = HOUSE.inset;
    for (const v of wall) {
      const x = m.position[v * 3]!, z = m.position[v * 3 + 2]!;
      const onOutline = Math.abs(x - (10 + i)) < 1e-4 || Math.abs(x - (13 - i)) < 1e-4 || Math.abs(z - (10 + i)) < 1e-4 || Math.abs(z - (12 - i)) < 1e-4;
      expect(onOutline, `wall vertex at (${x}, ${z})`).toBe(true);
    }
  });

  test('J01: base trim only on the lowest cells, a roof only on top', () => {
    const plan = town((b) => b.house(10, 10, { floors: 3, color: 4 }));
    const m = draw(plan, at(plan, 10, 1, 10));
    const ground = CELL_H;
    for (let v = 0; v < m.pattern.length; v++) {
      if (m.pattern[v] === PATTERN.stone && Math.abs(m.normal[v * 3 + 1]!) < 1e-6) expect(m.position[v * 3 + 1]).toBeLessThan(ground + HOUSE.plinthH + 1e-4);
      if (m.pattern[v] === PATTERN.shingles || m.pattern[v] === PATTERN.thatch) expect(m.position[v * 3 + 1]).toBeGreaterThan(4 * CELL_H - 0.35);
    }
    const { min, max } = meshBounds(m);
    expect(min[1]).toBeCloseTo(ground, 5);
    expect(max[1]).toBeGreaterThan(4 * CELL_H + 0.3);
  });

  test('J03: touching houses of different colours stay two buildings with their own walls and roofs', () => {
    const plan = town((b) => {
      b.house(10, 10, { floors: 2, color: 1 });
      b.house(11, 10, { floors: 2, color: 3 });
    });
    const a = at(plan, 10, 1, 10), c = at(plan, 11, 1, 10);
    expect(a.id).not.toBe(c.id);
    const ma = draw(plan, a), mc = draw(plan, c);
    // Each keeps its wall on the shared side (inset from the cell line, so there is a gap of ink between them).
    expect(uprights(ma, PATTERN.plaster).some((v) => Math.abs(ma.position[v * 3]! - (11 - HOUSE.inset)) < 1e-4)).toBe(true);
    expect(uprights(mc, PATTERN.plaster).some((v) => Math.abs(mc.position[v * 3]! - (11 + HOUSE.inset)) < 1e-4)).toBe(true);
    // No roof reaches over the neighbour.
    expect(meshBounds(ma).max[0]).toBeLessThanOrEqual(11 + 1e-4);
    expect(meshBounds(mc).min[0]).toBeGreaterThanOrEqual(11 - 1e-4);
    // And no ink group is shared between them.
    const inks = new Set(inkGroups(ma).keys());
    for (const id of inkGroups(mc).keys()) expect(inks.has(id)).toBe(false);
  });

  test('every weird footprint draws a sound mesh inside its triangle budget', () => {
    const shapes: Record<string, (b: TownBuilder) => void> = {
      L: (b) => b.house(10, 10, { w: 3, d: 1, floors: 2, color: 0 }).house(10, 11, { w: 1, d: 2, floors: 2, color: 0 }),
      T: (b) => b.house(10, 10, { w: 4, d: 1, color: 0 }).house(11, 11, { w: 2, d: 3, color: 0 }),
      U: (b) => b.house(10, 10, { w: 4, d: 2, color: 0 }).house(10, 12, { w: 1, d: 2, color: 0 }).house(13, 12, { w: 1, d: 2, color: 0 }),
      ring: (b) => b.house(10, 10, { w: 4, d: 1, color: 0 }).house(10, 13, { w: 4, d: 1, color: 0 }).house(10, 11, { w: 1, d: 2, color: 0 }).house(13, 11, { w: 1, d: 2, color: 0 }),
      tall: (b) => b.house(10, 10, { floors: 6, color: 0 }),
      stepped: (b) => b.house(10, 10, { w: 3, d: 3, color: 0 }).house(10, 10, { w: 2, d: 2, color: 0 }).house(10, 10, { color: 0 }),
      jettied: (b) => b.house(10, 10, { floors: 3, color: 0 }).block('house', 11, 2, 10, { color: 0 }).block('house', 10, 3, 11, { color: 0 }),
      wide: (b) => b.house(10, 10, { w: 5, d: 4, color: 0 }),
    };
    for (const [name, build] of Object.entries(shapes)) {
      const plan = town(build);
      const s = at(plan, 10, 1, 10);
      const m = draw(plan, s);
      expect(validateMesh(m), name).toEqual([]);
      expect(findDuplicateFaces(m), name).toBe(0);
      // Below the lowest eave: above it, dormers and the gables of lower wings are other objects.
      expect(new Set(uprights(m, PATTERN.plaster, 2 * CELL_H - 0.1).map((v) => m.inkId[v])).size, `${name}: one wall surface`).toBeLessThanOrEqual(1);
      // Roughly 600 triangles a cell at most, openings included (a lone cell carries the most).
      expect(triangleCount(m) / s.cells.length, `${name}: triangles per cell`).toBeLessThan(600);
      // Nothing reaches more than an eave's width into the next cell.
      const { min, max } = meshBounds(m);
      expect(min[0], name).toBeGreaterThan(10 - 0.2);
      expect(min[2], name).toBeGreaterThan(10 - 0.2);
      expect(min[1], name).toBeGreaterThanOrEqual(CELL_H - 1e-4);
      void max;
    }
  });

  test('a single cottage stays inside its budget and its cell', () => {
    const plan = town((b) => b.house(10, 10, { color: 2 }));
    const m = draw(plan, at(plan, 10, 1, 10));
    expect(triangleCount(m)).toBeLessThan(900);
    const { min, max } = meshBounds(m);
    expect(min[0]).toBeGreaterThan(9.85);
    expect(max[0]).toBeLessThan(11.15);
    expect(max[1]).toBeLessThan(2 * CELL_H + 1.1);
    expect(new Set(m.pattern).has(PATTERN.glass)).toBe(true);
  });

  test('J24: a house over lower ground stands on a stone foundation down to it', () => {
    const t = new TerrainBuilder(SEED).rect(4, 4, 43, 43, 1).rect(10, 4, 43, 43, 2);
    const terrain = t.build();
    const plan = town((b) => b.house(10, 10, { color: 3 }), terrain);
    const s = at(plan, 10, 2, 10);
    const f = (plan.featuresByStructure.get(s.id) ?? []).filter((x) => x.type === 'foundation');
    expect(f.some((x) => x.variant === 'plinth' && x.dir === 3)).toBe(true);
    const m = draw(plan, s);
    // The stone goes down a whole storey on the west side.
    expect(meshBounds(m).min[1]).toBeLessThan(CELL_H + 0.01);
    expect(meshBounds(m).min[0]).toBeLessThan(10);
  });

  test('the same structure draws the same mesh twice (no hidden chance)', () => {
    const build = (b: TownBuilder): void => void b.house(10, 10, { w: 2, d: 2, floors: 2, color: 6 });
    const a = town(build), c = town(build);
    const ma = draw(a, at(a, 10, 1, 10)), mc = draw(c, at(c, 10, 1, 10));
    expect(Array.from(ma.position)).toEqual(Array.from(mc.position));
    expect(Array.from(ma.inkId)).toEqual(Array.from(mc.inkId));
  });
});
