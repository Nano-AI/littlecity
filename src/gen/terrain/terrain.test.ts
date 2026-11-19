import { describe, expect, test } from 'vitest';
import { allChunks, CELL_H, chunkOf, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import { MAT } from '@/core/world';
import { resolveShape } from '@/resolve/index';
import type { ShapePlan } from '@/resolve/plan';
import { TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { inkGroups, validateMesh } from '../checks';
import { EDGE_FAR, PATTERN, triangleCount, type MeshData } from '../mesh';
import { buildTerrainChunk, terrainLayer } from './terrain.gen';

/** A hand-made island with everything the mesh must handle: beach, steps, a 2-level cliff, a cove, a peak. */
function island(build?: (b: TownBuilder) => void): ShapePlan {
  const t = new TerrainBuilder(11);
  t.rect(10, 10, 37, 37, 1);
  t.rect(14, 14, 30, 30, 2);
  t.rect(18, 18, 24, 24, 4); // a two-level cliff all round
  t.disc(21, 21, 1.5, 5);
  t.disc(37, 24, 3.2, 0); // a cove
  t.set(12, 20, 0); // a pond one cell wide
  const terrain = t.build();
  const b = new TownBuilder(emptyWorld(11), terrain);
  build?.(b);
  return resolveShape(b.world, terrain, { rules: [] });
}

const meshOf = (plan: ShapePlan, x: number, z: number): MeshData => terrainLayer.build(chunkOf(x, z), plan, null as never).mesh;

function tris(mesh: MeshData, keep: (pattern: number, ny: number) => boolean): number[][] {
  const out: number[][] = [];
  for (let v = 0; v < mesh.pattern.length; v += 3) {
    if (!keep(mesh.pattern[v]!, mesh.normal[v * 3 + 1]!)) continue;
    out.push([...mesh.position.subarray(v * 3, v * 3 + 9)]);
  }
  return out;
}

describe('the terrain layer', () => {
  const plan = island();

  test('every chunk is a sound mesh inside its triangle budget', () => {
    let total = 0;
    for (const chunk of allChunks()) {
      const mesh = terrainLayer.build(chunk, plan, null as never).mesh;
      expect(validateMesh(mesh)).toEqual([]);
      expect(triangleCount(mesh)).toBeLessThan(26_000);
      total += triangleCount(mesh);
    }
    expect(total).toBeGreaterThan(20_000);
    expect(total).toBeLessThan(140_000);
  });

  test('tops face up and sit exactly on their level, so pieces stand flush on them', () => {
    const mesh = meshOf(plan, 20, 20);
    const tops = tris(mesh, (p, ny) => (p === PATTERN.grass || p === PATTERN.rock) && ny > 0.99);
    expect(tops.length).toBeGreaterThan(500);
    for (const t of tops) {
      const level = t[1]! / CELL_H;
      expect(Math.abs(level - Math.round(level))).toBeLessThan(1e-6);
      expect(t[4]).toBe(t[1]);
      expect(t[7]).toBe(t[1]);
    }
  });

  test('a lawn that crosses a chunk border is one surface: the same ink id on both sides', () => {
    const a = meshOf(plan, 15, 20), b = meshOf(plan, 16, 20); // columns 15 and 16 are in different chunks
    const level2 = (mesh: MeshData): Set<number> => {
      const ids = new Set<number>();
      for (let v = 0; v < mesh.pattern.length; v++) {
        if (mesh.pattern[v] === PATTERN.grass && Math.abs(mesh.position[v * 3 + 1]! - 2 * CELL_H) < 1e-6) ids.add(mesh.inkId[v]!);
      }
      return ids;
    };
    expect(level2(a).size).toBe(1);
    expect(level2(a)).toEqual(level2(b));
    // Earth banks, rock, turf, sea, the slab: a handful of surfaces, not one per cell.
    expect(inkGroups(a).size).toBeLessThan(16);
  });

  test('outlines are rounded: a terrace corner is cut back from the grid corner', () => {
    // The north-west corner of the level-1 terrace is the grid vertex (10, 10).
    const mesh = meshOf(plan, 10, 10);
    let nearest = Infinity;
    for (let v = 0; v < mesh.pattern.length; v++) {
      if (mesh.pattern[v] !== PATTERN.grass || Math.abs(mesh.position[v * 3 + 1]! - CELL_H) > 1e-6) continue;
      nearest = Math.min(nearest, Math.hypot(mesh.position[v * 3]! - 10, mesh.position[v * 3 + 2]! - 10));
    }
    expect(nearest).toBeGreaterThan(0.05); // a square corner would have a vertex at distance 0
    expect(nearest).toBeLessThan(0.32);
  });

  test('a drop of two or more is rock; one level is an earth bank with a grass lip; sand meets the sea as a beach', () => {
    const cliff = meshOf(plan, 20, 20);
    const patterns = (mesh: MeshData): Set<number> => new Set(mesh.pattern);
    expect(patterns(cliff).has(PATTERN.rock)).toBe(true);
    const bank = meshOf(plan, 14, 14);
    expect(patterns(bank).has(PATTERN.earth)).toBe(true);
    // The beach slopes: its foot stands out from the terrace edge, below the waterline.
    const shore = meshOf(plan, 10, 20);
    let lowest = Infinity, westmost = Infinity;
    for (let v = 0; v < shore.pattern.length; v++) {
      if (shore.pattern[v] !== PATTERN.sand) continue;
      lowest = Math.min(lowest, shore.position[v * 3 + 1]!);
      westmost = Math.min(westmost, shore.position[v * 3]!);
    }
    expect(lowest).toBeLessThan(SEA_Y);
    expect(westmost).toBeLessThan(9.85);
    expect(plan.terrain.material[10 + 20 * SIZE_X]).toBe(MAT.sand);
  });

  test('the sea carries the distance to the shore: 0 at the waterline, far on open water', () => {
    const mesh = meshOf(plan, 5, 20);
    let nearShore = Infinity, open = 0;
    for (let v = 0; v < mesh.pattern.length; v++) {
      if (mesh.pattern[v] !== PATTERN.water) continue;
      expect(mesh.position[v * 3 + 1]).toBeCloseTo(SEA_Y, 6);
      const x = mesh.position[v * 3]!;
      if (x > 9.4 && x < 9.6) nearShore = Math.min(nearShore, mesh.edge[v]!);
      if (x < 4) open = Math.max(open, mesh.edge[v]!);
    }
    expect(nearShore).toBeLessThan(0.4);
    expect(open).toBeGreaterThan(3);
    expect(open).toBeLessThan(EDGE_FAR);
  });

  test('the sea sheet stays inside the slab: its corners are rounded off', () => {
    const mesh = meshOf(plan, 0, 0);
    let nearest = Infinity;
    for (let v = 0; v < mesh.pattern.length; v++) {
      if (mesh.pattern[v] === PATTERN.water) nearest = Math.min(nearest, Math.hypot(mesh.position[v * 3]!, mesh.position[v * 3 + 2]!));
    }
    expect(nearest).toBeGreaterThan(1);
    // And the slab has sides here: sea, then earth below it.
    let lowest = Infinity;
    for (let v = 0; v < mesh.pattern.length; v++) lowest = Math.min(lowest, mesh.position[v * 3 + 1]!);
    expect(lowest).toBeLessThan(-0.5);
  });

  test('the hash changes exactly when the chunk would: flat ground ignores what is built on it, a step does not', () => {
    const chunk = chunkOf(20, 20);
    const base = terrainLayer.hash(chunk, plan);
    expect(terrainLayer.hash(chunk, island())).toBe(base);
    // A house in the middle of the level-2 lawn: nothing about the ground changes.
    const lawn = island((b) => b.house(26, 27));
    expect(terrainLayer.hash(chunk, lawn)).toBe(base);
    expect(terrainLayer.build(chunk, lawn, null as never).mesh.position).toEqual(terrainLayer.build(chunk, plan, null as never).mesh.position);
    // A house on the corner cell of the level-4 bluff: its rounded corner is squared off under it.
    const corner = island((b) => b.house(18, 18));
    expect(terrainLayer.hash(chunk, corner)).not.toBe(base);
    const cut = (p: ShapePlan): number => {
      const mesh = terrainLayer.build(chunk, p, null as never).mesh;
      let nearest = Infinity;
      for (let v = 0; v < mesh.pattern.length; v++) {
        if (Math.abs(mesh.position[v * 3 + 1]! - 4 * CELL_H) > 1e-6 || mesh.normal[v * 3 + 1]! < 0.99) continue;
        nearest = Math.min(nearest, Math.hypot(mesh.position[v * 3]! - 18, mesh.position[v * 3 + 2]! - 18));
      }
      return nearest;
    };
    expect(cut(corner)).toBeLessThan(cut(plan) - 0.05);
    // Another chunk is not disturbed by any of it.
    const other = chunkOf(40, 40);
    expect(terrainLayer.hash(other, corner)).toBe(terrainLayer.hash(other, plan));
  });

  test('building a chunk is quick enough to do on an edit', () => {
    const chunk = chunkOf(20, 20);
    buildTerrainChunk(chunk, plan);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) buildTerrainChunk(chunk, plan).build();
    expect((performance.now() - t0) / 5).toBeLessThan(40);
  });

  test('an empty sea and a map-filling plateau both build', () => {
    const sea = resolveShape(emptyWorld(1), new TerrainBuilder(1).build(), { rules: [] });
    const full = new TerrainBuilder(2);
    full.rect(0, 0, SIZE_X - 1, SIZE_Z - 1, 6);
    const plateau = resolveShape(emptyWorld(2), full.build(), { rules: [] });
    for (const p of [sea, plateau]) for (const chunk of allChunks()) expect(validateMesh(terrainLayer.build(chunk, p, null as never).mesh)).toEqual([]);
  });
});
