// The look fixtures are sound meshes, use ink groups the way the art guide
// says, and are installed only for the look scenarios' seeds.

import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allGenerators } from '@/gen/discover';
import { meshBounds, PATTERN, triangleCount } from '@/gen/mesh';
import { registriesFor } from '@/render/registries';
import { resolveTown } from '@/resolve/index';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { flatTerrain, resolveScenario, TerrainBuilder, TownBuilder } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { emptyWorld } from '@/world/world';
import { isLookSeed, LOOK_SEED, lookGenerators, lookParts } from './fixtures';
import { sketchIsland } from './fixtures/islands';
import { SWATCH_SEED, SWATCHES, swatchLayer } from './fixtures/swatches.gen';

const town = (build: (b: TownBuilder) => void, seed = LOOK_SEED): ShapePlan => {
  const terrain = flatTerrain(seed);
  const b = new TownBuilder(emptyWorld(seed), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: [] }).shape;
};
const at = (plan: ShapePlan, x: number, y: number, z: number): Structure => plan.structures.get(plan.structureAt.get(key(x, y, z))!)!;
const draw = (plan: ShapePlan, s: Structure) => lookGenerators.build(s, plan, lookParts).mesh;

describe('look fixtures', () => {
  test('they draw only the look scenarios; every other town gets what discovery found', () => {
    expect(isLookSeed(LOOK_SEED + 3)).toBe(true);
    expect(isLookSeed(7)).toBe(false);
    const look = town((b) => b.house(10, 10));
    expect(registriesFor(look).generators).toBe(lookGenerators);
    const other = town((b) => b.house(10, 10), 7);
    expect(registriesFor(other).generators).toBe(allGenerators());
    // Kinds without a fixture still fall through to discovery (or its placeholder).
    expect(lookGenerators.forKind('tower')).toBe(allGenerators().forKind('tower'));
    expect(lookGenerators.layers().map((l) => l.layer)).toEqual(expect.arrayContaining(['terrain', 'look-swatches']));
  });

  test('every piece of the proof scene is a sound mesh', () => {
    const r = resolveScenario(findScenario('look-primitives')!);
    let triangles = 0;
    for (const s of r.shape.structures.values()) {
      const mesh = draw(r.shape, s);
      expect(validateMesh(mesh), `${s.kind} ${s.id}`).toEqual([]);
      triangles += triangleCount(mesh);
    }
    expect(triangles).toBeGreaterThan(10_000);
    for (const p of r.dressing.props) expect(validateMesh(lookParts.prop(p, { plan: r.shape }).mesh)).toEqual([]);
  });

  test('house: one storey fits its cell, has a roof, and stays inside its triangle budget', () => {
    const plan = town((b) => b.house(10, 10, { color: 2 }));
    const mesh = draw(plan, at(plan, 10, 1, 10));
    const { min, max } = meshBounds(mesh);
    expect(min[1]).toBeCloseTo(CELL_H, 6); // stands on the ground
    expect(max[1]).toBeGreaterThan(2 * CELL_H); // roof and chimney rise above the storey
    expect(max[1]).toBeLessThan(2 * CELL_H + 0.6);
    expect(min[0]).toBeGreaterThan(9.9); // the roof overhangs a little, never into the next cell's walls
    expect(max[0]).toBeLessThan(11.1);
    expect(triangleCount(mesh)).toBeLessThan(1200);
    expect(new Set(mesh.pattern).has(PATTERN.shingles)).toBe(true);
    expect(new Set(mesh.pattern).has(PATTERN.glass)).toBe(true);
  });

  test('house: a stack is one building: one roof, shared wall ink, a door only at the bottom', () => {
    const plan = town((b) => b.house(10, 10, { floors: 3, color: 4 }));
    const storeys = [1, 2, 3].map((y) => draw(plan, at(plan, 10, y, 10)));
    const shingled = storeys.map((m) => new Set(m.pattern).has(PATTERN.shingles));
    expect(shingled).toEqual([false, false, true]);
    // The walls of all three storeys are one ink group: no seam where they meet.
    const wallInk = (i: number): number | undefined => {
      const m = storeys[i]!;
      for (let v = 0; v < m.pattern.length; v++) if (m.pattern[v] === PATTERN.plaster && m.normal[v * 3 + 1] === 0) return m.inkId[v];
      return undefined;
    };
    expect(wallInk(0)).toBeDefined();
    expect(wallInk(1)).toBe(wallInk(0));
    expect(wallInk(2)).toBe(wallInk(0));
    // Stacked storeys do not double up the faces between them.
    expect(findDuplicateFaces(storeys[0]!)).toBe(0);
  });

  test('marble: a cluster is one seamless mass with no hidden faces', () => {
    const plan = town((b) => b.fill('marble', 10, 10, 11, 11, { floors: 2 }));
    let triangles = 0;
    const inks = new Set<number>();
    for (const s of plan.structures.values()) {
      const mesh = draw(plan, s);
      triangles += triangleCount(mesh);
      for (const id of inkGroups(mesh).keys()) inks.add(id);
    }
    // 2 × 2 × 2 cells: only the 24 outer cell faces are drawn (two triangles each), in one ink group.
    expect(triangles).toBe(24 * 2);
    expect(inks.size).toBe(1);
  });

  test('pillar: a stack is one shaft with one base and one capital', () => {
    const plan = town((b) => b.stack('pillar', 10, 10, { floors: 3 }));
    const cells = [1, 2, 3].map((y) => draw(plan, at(plan, 10, y, 10)));
    expect(inkGroups(cells[0]!).size).toBe(3); // shaft, base, collar
    expect(inkGroups(cells[1]!).size).toBe(1); // shaft only
    expect(inkGroups(cells[2]!).size).toBe(3); // shaft, collar, capital
    const shaft = (i: number): number => [...inkGroups(cells[i]!).entries()].sort((a, b) => b[1] - a[1])[0]![0];
    expect(shaft(1)).toBe(shaft(0));
    expect(shaft(2)).toBe(shaft(0));
  });

  test('trees sway, and no two are the same', () => {
    const plan = town((b) => b.put('tree', 10, 10).put('tree', 14, 10).put('tree', 18, 10));
    const meshes = [10, 14, 18].map((x) => draw(plan, at(plan, x, 1, 10)));
    for (const m of meshes) {
      expect(Math.max(...m.sway)).toBeGreaterThan(0.2);
      expect(Math.min(...m.sway)).toBe(0); // the trunk's foot is planted
    }
    expect(new Set(meshes.map((m) => m.position.length)).size + new Set(meshes.map((m) => Math.round(meshBounds(m).max[1] * 1000))).size).toBeGreaterThan(3);
  });

  test('the swatch layer has a sample for every pattern id and draws only in its own scenario', () => {
    expect(SWATCHES.map((s) => PATTERN[s.name]).sort((a, b) => a - b)).toEqual(
      Object.values(PATTERN).filter((id) => id !== PATTERN.beam).sort((a, b) => a - b),
    );
    const swatches = town(() => {}, SWATCH_SEED);
    const elsewhere = town(() => {});
    const chunk = { cx: 1, cz: 1, x0: 16, z0: 16, x1: 31, z1: 31 };
    expect(triangleCount(swatchLayer.build(chunk, swatches, lookParts).mesh)).toBeGreaterThan(100);
    expect(triangleCount(swatchLayer.build(chunk, elsewhere, lookParts).mesh)).toBe(0);
  });

  test('the sketched islands always have a beach, a hill of 4 or more, a cliff and a cove', () => {
    for (let n = 1; n <= 6; n++) {
      const t = new TerrainBuilder(LOOK_SEED + 16 + n);
      sketchIsland(t, LOOK_SEED + 16 + n);
      const terrain = t.build();
      const h = (x: number, z: number): number => (x < 0 || z < 0 || x > 47 || z > 47 ? 0 : terrain.height[x + z * 48]!);
      let top = 0, cliff = false, beach = 0, cove = false;
      for (let z = 0; z < 48; z++) {
        for (let x = 0; x < 48; x++) {
          const here = h(x, z);
          top = Math.max(top, here);
          const around = [h(x + 1, z), h(x - 1, z), h(x, z + 1), h(x, z - 1)];
          if (around.some((a) => here - a >= 2)) cliff = true;
          if (here === 1 && around.includes(0)) beach++;
          if (here === 0 && around.filter((a) => a > 0).length >= 3) cove = true;
          if (here > 0) expect(x >= 5 && x <= 42 && z >= 5 && z <= 42, 'five columns of water all round').toBe(true);
        }
      }
      expect(top, `isle ${n}`).toBeGreaterThanOrEqual(4);
      expect(cliff, `isle ${n} cliff`).toBe(true);
      expect(beach, `isle ${n} beach`).toBeGreaterThanOrEqual(8);
      expect(cove, `isle ${n} cove`).toBe(true);
    }
  });
});
