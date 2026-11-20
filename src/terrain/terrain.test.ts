import { describe, expect, test } from 'vitest';

import { columnIndex, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { hash } from '@/core/rand';
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
      expect(Math.max(...t.height), `seed ${seed}`).toBeLessThanOrEqual(6); // one expect a seed, not one a column
    }
    expect(failures).toEqual([]);
  });

  test('generator 1 is frozen: its islands and starting trees match the digests taken before generator 2', () => {
    // Taken on 2026-11-19 before generator 2 existed. Every saved town on generator 1 depends on these.
    const pinned = [
      '0:985767133:3672504995', '1:3282243841:3454046421', '2:4208019968:349991262', '42:324720022:3398259350',
      '-7:4115070419:3481315432', '12345:2770682464:2449019399', '99991:986167734:1071322550',
      '2026:3527204830:1406187372', '777:70010054:3919015125', '31337:270985800:1038755752',
    ];
    const got = pinned.map((p) => {
      const s = Number(p.split(':')[0]);
      const t = generateTerrain(s, 1);
      let a = 0;
      for (let i = 0; i < t.height.length; i++) a = hash(a, t.height[i]!, t.material[i]!);
      let b = 0;
      for (const [k, bl] of [...initialWorld(s, t).blocks].sort((p, q) => p[0] - q[0])) b = hash(b, k, bl.seq, bl.color);
      return `${s}:${a}:${b}`;
    });
    expect(got).toEqual(pinned);
    expect(generateTerrain(42)).toEqual(generateTerrain(42, 1));
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
