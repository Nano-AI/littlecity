import { describe, expect, test } from 'vitest';
import { CELL_H, chunkOf, SEA_Y } from '@/core/grid';
import { findDuplicateFaces, inkGroups, validateMesh } from '@/gen/checks';
import { allGenerators, allParts } from '@/gen/discover';
import { meshBounds, triangleCount, type MeshData } from '@/gen/mesh';
import { town, type TestTown } from '@/parts/monuments/testing';
import { supportsLayer } from './supports.gen';

const drawChunk = (t: TestTown, x: number, z: number): MeshData => supportsLayer.build(chunkOf(x, z), t.plan, allParts()).mesh;
const hashChunk = (t: TestTown, x: number, z: number): number => supportsLayer.hash(chunkOf(x, z), t.plan);

describe('supports layer (design section 9)', () => {
  test('it is discovered as a layer and draws nothing where nothing floats', () => {
    expect(allGenerators().layers().map((l) => l.layer)).toContain('supports');
    const t = town((b) => b.house(10, 10));
    expect(triangleCount(drawChunk(t, 10, 10))).toBe(0);
  });

  test('S3: a pillar from the block down to the ground, flush at both ends', () => {
    const t = town((b) => b.block('house', 10, 3, 10));
    const mesh = drawChunk(t, 10, 10);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    const { min, max } = meshBounds(mesh);
    expect(min[1]).toBeCloseTo(CELL_H, 6); // on the ground
    expect(max[1]).toBeCloseTo(3 * CELL_H, 6); // under the block
    expect(inkGroups(mesh).size).toBe(3); // base, shaft, capital
    expect(triangleCount(mesh)).toBeLessThan(500);
  });

  test('S3 over the sea: the pillar stands on a footing that shows above the water', () => {
    const t = town((b) => b.block('marble', 10, 2, 10), { terrain: (tb) => tb.flat(1).water(8, 8, 12, 12) });
    const mesh = drawChunk(t, 10, 10);
    expect(meshBounds(mesh).min[1]).toBeCloseTo(0, 6); // the seabed
    expect(inkGroups(mesh).size).toBe(4);
    let footTop = 0;
    for (let i = 0; i < mesh.position.length; i += 3) if (Math.abs(mesh.position[i]! - 10.5) > 0.3) footTop = Math.max(footTop, mesh.position[i + 1]!);
    expect(footTop).toBeGreaterThan(SEA_Y);
  });

  test('a stilt house stands on four timber piles, not a stone column', () => {
    const t = town((b) => b.block('house', 10, 2, 10), { terrain: (tb) => tb.flat(1).water(8, 8, 12, 12) });
    expect(t.plan.tags.get(t.at(10, 2, 10).id)?.has('plank-walls')).toBe(true);
    const mesh = drawChunk(t, 10, 10);
    expect(validateMesh(mesh)).toEqual([]);
    expect(inkGroups(mesh).size).toBe(1); // one piece of carpentry
    const { min, max } = meshBounds(mesh);
    expect(min[1]).toBeLessThan(SEA_Y); // the piles go down into the water
    expect(max[1]).toBeCloseTo(2 * CELL_H, 2);
    // Nothing stands under the middle of the house.
    for (let i = 0; i < mesh.position.length; i += 3) {
      if (mesh.position[i + 1]! < CELL_H) expect(Math.max(Math.abs(mesh.position[i]! - 10.5), Math.abs(mesh.position[i + 2]! - 10.5))).toBeGreaterThan(0.2);
    }
    // A stone block in the same place keeps its stone pillar.
    const stone = town((b) => b.block('marble', 10, 2, 10), { terrain: (tb) => tb.flat(1).water(8, 8, 12, 12) });
    expect(hashChunk(stone, 10, 10)).not.toBe(hashChunk(t, 10, 10));
  });

  test('S2: brackets hang under the block on the side of the wall that carries it', () => {
    const t = town((b) => b.house(10, 10, { floors: 3 }).block('house', 11, 3, 10));
    const mesh = drawChunk(t, 11, 10);
    expect(validateMesh(mesh)).toEqual([]);
    const { min, max } = meshBounds(mesh);
    expect(max[1]).toBeCloseTo(3 * CELL_H, 6);
    expect(min[1]).toBeGreaterThan(2 * CELL_H); // they do not reach the floor below
    expect(min[0]).toBeLessThan(11.01); // into the wall on the west
    expect(min[0]).toBeGreaterThan(10.85);
    expect(max[0]).toBeLessThan(12);
    expect(inkGroups(mesh).size).toBe(1); // one object
  });

  test('S4: an arcade is one wall across its bays', () => {
    const t = town((b) => {
      for (let x = 10; x <= 13; x++) b.block('house', x, 3, 10);
    });
    const mesh = drawChunk(t, 10, 10);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    // Four columns of three groups each, and one shared arcade group.
    expect(inkGroups(mesh).size).toBe(4 * 3 + 1);
    expect(triangleCount(mesh)).toBeLessThan(4 * 500);
    // Stone spans the gap between two pillars under the block, but not near the ground.
    let high = false, low = false;
    for (let i = 0; i < mesh.position.length; i += 3) {
      const x = mesh.position[i]!, y = mesh.position[i + 1]!;
      if (Math.abs(x - 11) < 0.1) {
        if (y > 2.5 * CELL_H) high = true;
        if (y < 2 * CELL_H) low = true;
      }
    }
    expect(high).toBe(true);
    expect(low).toBe(false);
  });

  test('stilts leave room for the tree; a platform carries a stranded one', () => {
    const t = town((b) => {
      b.put('tree', 10, 10).block('house', 10, 3, 10);
      b.stack('marble', 20, 10, { floors: 2 }).put('tree', 20, 10).erase(20, 2, 10);
    });
    const stilts = drawChunk(t, 10, 10);
    expect(validateMesh(stilts)).toEqual([]);
    // Nothing within 0.25 of the column's axis: the tree stands there.
    for (let i = 0; i < stilts.position.length; i += 3) {
      const x = stilts.position[i]!, z = stilts.position[i + 2]!;
      if (x < 16) expect(Math.max(Math.abs(x - 10.5), Math.abs(z - 10.5))).toBeGreaterThan(0.25);
    }
    const platform = drawChunk(t, 20, 10);
    let slab = 0;
    for (let i = 0; i < platform.position.length; i += 3) {
      if (platform.position[i]! > 16 && platform.position[i + 1]! > 3 * CELL_H - 0.01) slab = Math.max(slab, Math.abs(platform.position[i]! - 20.5) * 2);
    }
    expect(slab).toBeGreaterThan(0.85); // wide enough to plant on
  });

  test('the hash changes exactly when the chunk’s supports do', () => {
    const a = town((b) => b.block('house', 10, 3, 10));
    const same = town((b) => b.block('house', 10, 3, 10).house(30, 30));
    const taller = town((b) => b.block('house', 10, 4, 10));
    const other = town((b) => b.block('marble', 10, 3, 10));
    expect(hashChunk(same, 10, 10)).toBe(hashChunk(a, 10, 10));
    expect(hashChunk(taller, 10, 10)).not.toBe(hashChunk(a, 10, 10));
    expect(hashChunk(other, 10, 10)).not.toBe(hashChunk(a, 10, 10));
    expect(hashChunk(a, 30, 30)).toBe(hashChunk(same, 30, 30)); // a carried house needs no support
  });
});
