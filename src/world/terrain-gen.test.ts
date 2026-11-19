// Which island generator made a town (design section 6, "Old towns"): saved
// as World.terrainGen, carried through edits, undo, the share codec (version
// 3), town files and autosave. A town on generator 1 is written exactly as it
// always was, so old links and files keep their island.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { World } from '@/core/world';
import { flatTerrain, TownBuilder } from '@/scenario';
import { generateTerrain, initialWorld, terrainOf } from '@/terrain/terrain';
import { createHistory, pushHistory, undo } from './history';
import { codecVersion, decodeTown, encodeTown, loadTown, readTownFile, saveTown, townFileText } from './save';
import { applyEdit, emptyWorld } from './world';

const terrain = flatTerrain(77);

function town(gen: 1 | 2): World {
  const b = new TownBuilder(emptyWorld(77, gen), terrain);
  b.house(10, 10, { floors: 3, w: 2, color: 4 }).path(9, 13, 20, 13).put('tree', 13, 15);
  b.block('dock', 2, 0, 10);
  return b.world;
}

describe('the island generator in the saved world', () => {
  test('generator 1 leaves no trace: no field, versions 1 and 2 as before', () => {
    expect('terrainGen' in emptyWorld(5)).toBe(false);
    expect('terrainGen' in initialWorld(5, generateTerrain(5))).toBe(false);
    expect(codecVersion(town(1))).toBe(1);
    expect(decodeTown(encodeTown(town(1)))).toEqual({ ok: true, world: town(1) });
  });

  test('generator 2 rides through edits and undo', () => {
    let w = emptyWorld(9, 2);
    expect(w.terrainGen).toBe(2);
    const h = createHistory(w);
    w = applyEdit(w, terrain, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'house', color: 2, from: null });
    pushHistory(h, w);
    expect(h.present.terrainGen).toBe(2);
    undo(h);
    expect(h.present.terrainGen).toBe(2);
  });

  test('version 3 round-trips a town on generator 2, styled or not, through links, files and autosave', () => {
    const w = town(2);
    expect(codecVersion(w)).toBe(3);
    const code = encodeTown(w);
    expect(code.startsWith('TEMD')).toBe(true);
    expect(decodeTown(code)).toEqual({ ok: true, world: w });
    expect(readTownFile(townFileText(w))).toEqual({ ok: true, world: w });
    expect(JSON.parse(townFileText(w)).littleCity).toBe(3);
    const styled = applyEdit(w, terrain, { type: 'placeBlock', cell: key(30, 1, 30), kind: 'house', color: 3, from: null, style: 4 });
    expect(decodeTown(encodeTown(styled))).toEqual({ ok: true, world: styled });
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(saveTown(storage, styled)).toBe(true);
    expect(loadTown(storage)).toEqual(styled);
  });

  test('a damaged generator byte is refused, never trusted', () => {
    const code = encodeTown(town(2));
    for (let i = 3; i < code.length; i++) {
      const bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
      const r = decodeTown(bad);
      if (r.ok) expect([undefined, 2]).toContain(r.world.terrainGen);
    }
  });

  test('terrainOf regenerates the recorded island', () => {
    expect(terrainOf({ seed: 12 })).toEqual(generateTerrain(12, 1));
    expect(terrainOf({ seed: 12, terrainGen: 2 })).toEqual(generateTerrain(12, 2));
    const back = decodeTown(encodeTown(emptyWorld(12, 2)));
    expect(back.ok && terrainOf(back.world)).toEqual(generateTerrain(12, 2));
  });
});
