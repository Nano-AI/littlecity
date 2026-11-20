// Shaping the land in the save (design section 6, "Saved"): the share codec
// version 4 carries World.terrainEdits as an optional section; a town with no
// reshaped land is written exactly as before; old links decode unchanged.

import { describe, expect, test } from 'vitest';
import { columnIndex, key } from '@/core/grid';
import type { World } from '@/core/world';
import { flatTerrain, TownBuilder } from '@/scenario';
import { islandOf } from '@/terrain/land';
import { generateTerrain, initialWorld, terrainOf } from '@/terrain/terrain';
import { codecVersion, decodeTown, encodeTown, loadTown, readTownFile, saveTown, townFileText } from './save';
import { applyEdit, emptyWorld } from './world';
import { createHistory, pushHistory, undo } from './history';
import { fromBase64Url, inflateRaw, deflateRaw, toBase64Url } from './deflate';
import { legacyEncodeTown } from './legacy-codec';

const terrain = flatTerrain(77);
const col = columnIndex(30, 30);

function town(gen: 1 | 2): World {
  const b = new TownBuilder(emptyWorld(77, gen), terrain);
  b.house(10, 10, { floors: 3, w: 2, color: 4 }).path(9, 13, 20, 13).put('tree', 13, 15);
  b.block('dock', 2, 0, 10);
  return applyEdit(b.world, terrain, { type: 'placeBlock', cell: key(30, 1, 30), kind: 'house', color: 3, from: null, style: 4 });
}

/** Codes written before shaping the land existed (base commit 185fe60), for the towns above. */
const BEFORE = {
  plain1: 'TEMB9M7fbvNlYGDg5GAQYRJxZGBgYoASTMwwFphgYebiYhBl5GTlOaXGwIgVMgAA',
  styled1: 'TEMCgZyeAvNlYGDg4mQQYRJxZGBgYoASTMwwFphgYebiYhBl5GRlsGDS2MjCc0qNgRErZAAA',
  plain2: 'TEMDHg6YQvNlYGBg4uRgEGEScQSyGKAEEzOMBSZYmLm4GEQZOVl5TqkxMGKFDAA',
  styled2: 'TEMDq3lDe_NlYGBg4uJkEGEScQSyGKAEEzOMBSZYmLm4GEQZOVkZLJg0NrLwnFJjYMQKGQA',
};

describe('saving the reshaped land', () => {
  test('old links decode as before, to the towns the old encoder made them from', () => {
    // legacy-codec.ts is the old encoder: it still writes these codes byte for byte.
    expect(legacyEncodeTown(town(1))).toBe(BEFORE.styled1);
    expect(legacyEncodeTown(town(2))).toBe(BEFORE.styled2);
    expect(decodeTown(BEFORE.styled1)).toEqual({ ok: true, world: town(1) });
    expect(decodeTown(BEFORE.styled2)).toEqual({ ok: true, world: town(2) });
    for (const code of Object.values(BEFORE)) {
      const r = decodeTown(code);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect('terrainEdits' in r.world).toBe(false);
        expect(legacyEncodeTown(r.world)).toBe(code);
        // Written again today, it is no longer and opens to the same town.
        const again = encodeTown(r.world);
        expect(again.length).toBeLessThanOrEqual(code.length);
        expect(decodeTown(again)).toEqual(r);
      }
    }
  });

  test('raising and digging back leaves no trace in the save', () => {
    const w = town(2);
    const up = applyEdit(w, terrain, { type: 'land', up: [col], down: [] });
    expect(codecVersion(up)).toBe(4);
    const back = applyEdit(up, terrain, { type: 'land', up: [], down: [col] });
    expect('terrainEdits' in back).toBe(false);
    expect(encodeTown(back)).toBe(encodeTown(w));
  });

  test('version 4 round-trips through links, town files and autosave, on either generator', () => {
    for (const gen of [1, 2] as const) {
      let w = town(gen);
      w = applyEdit(w, terrain, { type: 'land', up: [col, col + 1], down: [] });
      w = applyEdit(w, terrain, { type: 'land', up: [], down: [columnIndex(20, 20)] });
      const code = encodeTown(w);
      expect(code.startsWith('TEME')).toBe(true);
      const r = decodeTown(code);
      expect(r).toEqual({ ok: true, world: w });
      if (r.ok) expect(r.world.terrainGen === 2 ? 2 : 1).toBe(gen);
      expect(readTownFile(townFileText(w))).toEqual({ ok: true, world: w });
      expect(JSON.parse(townFileText(w)).littleCity).toBe(4);
      const store = new Map<string, string>();
      const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
      expect(saveTown(storage, w)).toBe(true);
      expect(loadTown(storage)).toEqual(w);
    }
  });

  test('a loaded town stands on its reshaped island', () => {
    const t = generateTerrain(21, 2);
    let w = initialWorld(21, t, 2);
    let target = -1;
    for (let i = 0; i < t.height.length && target < 0; i++) if (t.height[i] === 1 && i % 48 > 12 && i % 48 < 36 && i > 48 * 12) target = i;
    w = applyEdit(w, t, { type: 'land', up: [target], down: [] });
    const r = decodeTown(encodeTown(w));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(terrainOf(r.world).height[target]).toBe(2);
    expect(terrainOf(r.world)).toEqual(islandOf(w, t));
  });

  test('the history keeps a reshaped island per step', () => {
    const w0 = town(1);
    const w1 = applyEdit(w0, terrain, { type: 'land', up: [col], down: [] });
    const h = pushHistory(createHistory(w0), w1);
    expect(h.present.terrainEdits?.get(col)).toBe(2);
    expect(undo(h).present).toBe(w0);
  });

  test('a damaged or unknown section is refused, never trusted', () => {
    const w = applyEdit(town(1), terrain, { type: 'land', up: [col], down: [] });
    const code = encodeTown(w);
    for (let i = 3; i < code.length; i++) {
      const bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
      const r = decodeTown(bad);
      if (r.ok && r.world.terrainEdits) for (const [c, v] of r.world.terrainEdits) expect(c >= 0 && c < 2304 && v >= 0 && v <= 10).toBe(true);
    }
    // Re-pack the payload with a flag bit nobody knows yet: "a different version", not a broken town.
    const bytes = fromBase64Url(code)!;
    const payload = inflateRaw(bytes.subarray(7));
    // The sections sit at the end: flags, length, count, delta (two bytes: column 1470), height.
    const at = payload.length - 6;
    expect(payload[at]).toBe(1);
    const changed = payload.slice();
    changed[at] = 5; // bit 2: nobody's yet (bit 1 is mischief's ruins)
    let h = 0x811c9dc5;
    for (let i = 0; i < changed.length; i++) h = Math.imul(h ^ changed[i]!, 0x01000193);
    const sum = h >>> 0;
    const head = Uint8Array.from([0x4c, 0x43, 4, sum & 255, (sum >>> 8) & 255, (sum >>> 16) & 255, sum >>> 24]);
    const packed = deflateRaw(changed);
    const all = new Uint8Array(head.length + packed.length);
    all.set(head);
    all.set(packed, head.length);
    expect(decodeTown(toBase64Url(all))).toEqual({ ok: false, reason: 'This town was made by a different version of Little City.' });
  });
});
