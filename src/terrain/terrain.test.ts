import { describe, expect, test } from 'vitest';
import { columnIndex, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { MAT } from '@/core/world';
import { checkTerrain, generateTerrain, heightAt, initialWorld, terrainFromHeights } from './terrain';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 - 400);

describe('the island generator', () => {
  test('every required feature on 200 seeds (design section 6)', () => {
    const failures: string[] = [];
    for (const seed of SEEDS) {
      const t = generateTerrain(seed);
      const r = checkTerrain(t.height);
      if (r.problems.length) failures.push(`${seed}: ${r.problems.join(', ')}`);
      for (let i = 0; i < t.height.length; i++) expect(t.height[i]).toBeLessThanOrEqual(6);
    }
    expect(failures).toEqual([]);
  });

  test('deterministic per seed, and different seeds give different islands', () => {
    for (const seed of [0, 1, 42, -7]) {
      expect(generateTerrain(seed)).toEqual(generateTerrain(seed));
    }
    expect(generateTerrain(1).height).not.toEqual(generateTerrain(2).height);
  });

  test('checkTerrain finds what is missing', () => {
    const flat = new Uint8Array(SIZE_X * SIZE_Z);
    for (let z = 10; z < 38; z++) for (let x = 10; x < 38; x++) flat[columnIndex(x, z)] = 1;
    const r = checkTerrain(flat);
    expect(r.problems.join('; ')).toMatch(/highest ground 1/);
    expect(r.problems.join('; ')).toMatch(/no cliff/);
    expect(r.problems.join('; ')).toMatch(/no cove/);
    expect(checkTerrain(new Uint8Array(SIZE_X * SIZE_Z)).problems.length).toBeGreaterThan(3);
  });

  test('materials: water at 0, sand on low shore, grass elsewhere', () => {
    const t = generateTerrain(5);
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        const h = heightAt(t, x, z);
        const m = t.material[columnIndex(x, z)];
        if (h === 0) expect(m).toBe(MAT.water);
        else expect([MAT.sand, MAT.grass]).toContain(m);
      }
    }
    expect(heightAt(t, -1, 3)).toBe(0);
    expect(() => terrainFromHeights(1, new Uint8Array(3))).toThrow();
  });
});

describe('the starting world', () => {
  test('6 to 14 trees on grass, nothing else, on every seed', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const t = generateTerrain(seed);
      const w = initialWorld(seed, t);
      expect(w.blocks.size).toBeGreaterThanOrEqual(6);
      expect(w.blocks.size).toBeLessThanOrEqual(14);
      expect(w.floors.size + w.edges.size).toBe(0);
      for (const [cell, b] of w.blocks) {
        expect(b.kind).toBe('tree');
        expect(keyY(cell)).toBe(heightAt(t, keyX(cell), keyZ(cell)));
        expect(t.material[columnIndex(keyX(cell), keyZ(cell))]).toBe(MAT.grass);
      }
      expect(w.nextSeq).toBe(w.blocks.size + 1);
      expect(initialWorld(seed, t)).toEqual(w);
    }
  });
});
