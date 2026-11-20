import { describe, expect, test } from 'vitest';
import { columnIndex, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { MAT } from '@/core/world';
import { checkTerrain2, generateIsland2, MAT_RIVER, MAX_HEIGHT_2, type IslandCharacter } from './terrain2';
import { generateTerrain, initialWorld } from './terrain';
import { components, D4, hAt } from './noise';


const SEEDS = Array.from({ length: 500 }, (_, i) => i * 7919 - 400);
const gen1 = (s: number) => generateTerrain(s, 1);

describe('generator 2', () => {
  test('500 seeds: every hard requirement, no fallbacks, and the shares the spec asks for', () => {
    const failures: string[] = [];
    const chars: Record<IslandCharacter, number> = { gentle: 0, hilly: 0, steep: 0, archipelago: 0 };
    const rivers = [0, 0, 0];
    let through = 0;
    let fell = 0;
    let rolls = 0;
    const highest: Record<IslandCharacter, number[]> = { gentle: [], hilly: [], steep: [], archipelago: [] };
    for (const seed of SEEDS) {
      const isl = generateIsland2(seed, gen1);
      const r = checkTerrain2(isl.terrain);
      if (r.problems.length) failures.push(`${seed}: ${r.problems.join(', ')}`);
      if (isl.fellBack) fell++;
      chars[isl.character]++;
      rivers[isl.rivers]!++;
      through += isl.through;
      rolls += isl.attempts;
      highest[isl.character].push(r.highest);
      expect(Math.max(...isl.terrain.height), `seed ${seed}`).toBeLessThanOrEqual(MAX_HEIGHT_2); // one expect a seed, not one a column
    }
    expect(failures).toEqual([]);
    const pct = (n: number): number => Math.round((n / SEEDS.length) * 100);
    const shares = {
      gentle: pct(chars.gentle), hilly: pct(chars.hilly), steep: pct(chars.steep), archipelago: pct(chars.archipelago),
      rivers0: pct(rivers[0]!), rivers1: pct(rivers[1]!), rivers2: pct(rivers[2]!), through: pct(through), fellBack: fell,
      meanRolls: Math.round((rolls / SEEDS.length) * 10) / 10,
      steepHighest: Math.min(...highest.steep), gentleHighest: Math.max(...highest.gentle),
    };
    expect(fell).toBe(0);
    expect(Math.abs(shares.gentle - 45)).toBeLessThanOrEqual(7);
    expect(Math.abs(shares.hilly - 30)).toBeLessThanOrEqual(7);
    expect(Math.abs(shares.steep - 15)).toBeLessThanOrEqual(5);
    expect(Math.abs(shares.archipelago - 10)).toBeLessThanOrEqual(5);
    expect(Math.abs(shares.rivers0 - 20)).toBeLessThanOrEqual(7);
    expect(Math.abs(shares.rivers1 - 60)).toBeLessThanOrEqual(8);
    expect(Math.abs(shares.rivers2 - 20)).toBeLessThanOrEqual(7);
    expect(shares.steepHighest).toBeGreaterThanOrEqual(7);
    expect(shares.gentleHighest).toBeLessThanOrEqual(6);
  });

  test('rivers are channels you can row along: every water column reaches the sea, and none meets another only at a corner', () => {
    for (const seed of SEEDS.slice(0, 120)) {
      const t = generateTerrain(seed, 2);
      const h = t.height;
      const water = components((i) => h[i] === 0);
      // Problems gathered, then one expect a seed (an expect a column was most of this test's time).
      const cut: string[] = [];
      for (let i = 0; i < h.length; i++) if (h[i] === 0 && water.label[i] !== water.label[0]) cut.push(`water at ${i % SIZE_X},${Math.floor(i / SIZE_X)} cut off`);
      for (let z = 0; z + 1 < SIZE_Z; z++) {
        for (let x = 0; x + 1 < SIZE_X; x++) {
          const a = hAt(h, x, z) === 0, b = hAt(h, x + 1, z) === 0, c = hAt(h, x, z + 1) === 0, d = hAt(h, x + 1, z + 1) === 0;
          if ((a && d && !b && !c) || (b && c && !a && !d)) cut.push(`corner-only water at ${x},${z}`);
        }
      }
      expect(cut, `seed ${seed}`).toEqual([]);
    }
  });

  test('materials: water at 0, sand only at height 1 beside water, rock only on high ground', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const t = generateTerrain(seed, 2);
      const wrong: string[] = []; // gathered, then one expect a seed
      for (let z = 0; z < SIZE_Z; z++) {
        for (let x = 0; x < SIZE_X; x++) {
          const h = hAt(t.height, x, z);
          const m = t.material[columnIndex(x, z)];
          const at = `${x},${z} (height ${h}, material ${m})`;
          if (h === 0 && m !== MAT.water && m !== MAT_RIVER) wrong.push(`${at}: not water at height 0`);
          if (h !== 0 && m === MAT.water) wrong.push(`${at}: water above the sea`);
          if (m === MAT.sand) {
            if (h !== 1) wrong.push(`${at}: sand off height 1`);
            if (!D4.some(([dx, dz]) => hAt(t.height, x + dx, z + dz) === 0)) wrong.push(`${at}: sand away from water`);
          }
          if (m === MAT.rock && h < 3) wrong.push(`${at}: rock on low ground`);
        }
      }
      expect(wrong, `seed ${seed}`).toEqual([]);
    }
  });

  test('deterministic, and different from generator 1', () => {
    for (const seed of [0, 1, 42, -7]) expect(generateTerrain(seed, 2)).toEqual(generateTerrain(seed, 2));
    expect(generateTerrain(5, 2).height).not.toEqual(generateTerrain(5, 1).height);
    expect(generateTerrain(5, 2).seed).toBe(5);
  });

  test('starting trees: 6 to 14 on grass, the world records generator 2, and river banks get willows to be', () => {
    let bankTrees = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      const t = generateTerrain(seed, 2);
      const w = initialWorld(seed, t, 2);
      expect(w.terrainGen).toBe(2);
      expect(w.blocks.size).toBeGreaterThanOrEqual(6);
      expect(w.blocks.size).toBeLessThanOrEqual(14);
      for (const [cell, b] of w.blocks) {
        expect(b.kind).toBe('tree');
        const x = keyX(cell), z = keyZ(cell);
        expect(keyY(cell)).toBe(hAt(t.height, x, z));
        expect(t.material[columnIndex(x, z)]).toBe(MAT.grass);
        if (D4.some(([dx, dz]) => hAt(t.height, x + dx, z + dz) === 0)) bankTrees++;
      }
    }
    expect(bankTrees).toBeGreaterThan(20);
    expect(initialWorld(3, generateTerrain(3, 1)).terrainGen).toBeUndefined();
  });
});
