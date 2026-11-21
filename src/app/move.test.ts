import { describe, expect, test } from 'vitest';
import { SAVE_KEY } from '@/world/save';
import { FALLBACK_KEY, type TownEntry } from './library';
import { moveIn, readParcel, type Parcel } from './move';
import { ID_KEY, PREVIOUS_KEY } from './towns';

/** A localStorage stand-in (no IndexedDB under Node, so My towns lives in FALLBACK_KEY, as in a browser without it). */
function fakeStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}
const town = (id: string, code: string, updated: number, name = id): TownEntry => ({ id, code, name, created: 1, updated });
const library = (s: Storage): TownEntry[] => JSON.parse(s.getItem(FALLBACK_KEY) ?? '[]') as TownEntry[];
const parcel = (p: Partial<Parcel>): Parcel => ({ v: 1, local: {}, towns: [], open: '', ...p });

describe('moving in from the old address', () => {
  test('a browser new to littlecity.io gets every town, the town that opens next, and the settings', async () => {
    const s = fakeStorage();
    await moveIn(parcel({ local: { [SAVE_KEY]: 'CODE-A', [ID_KEY]: 'a', 'little-city.sound': 'off' }, towns: [town('a', 'CODE-A', 5), town('b', 'CODE-B', 6)] }), s);
    expect(s.getItem(SAVE_KEY)).toBe('CODE-A');
    expect(s.getItem(ID_KEY)).toBe('a');
    expect(s.getItem('little-city.sound')).toBe('off');
    expect(library(s).map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  test('nothing already at littlecity.io is written over: its own town and settings stay, the old town is kept beside them', async () => {
    const s = fakeStorage({ [SAVE_KEY]: 'NEW-HERE', [ID_KEY]: 'n', 'little-city.sound': 'on', [FALLBACK_KEY]: JSON.stringify([town('n', 'NEW-HERE', 9, 'Town 1')]) });
    await moveIn(parcel({ local: { [SAVE_KEY]: 'OLD-THERE', [ID_KEY]: 'o', 'little-city.sound': 'off' } }), s);
    expect(s.getItem(SAVE_KEY)).toBe('NEW-HERE');
    expect(s.getItem(ID_KEY)).toBe('n');
    expect(s.getItem('little-city.sound')).toBe('on');
    const codes = library(s).map((t) => t.code).sort();
    expect(codes).toEqual(['NEW-HERE', 'OLD-THERE']);
    expect(library(s).find((t) => t.code === 'OLD-THERE')!.name).toBe('Town 2');
  });

  test('the same town changed in both places: the one here is untouched, the other is added beside it', async () => {
    for (const updated of [3, 8]) {
      const s = fakeStorage({ [FALLBACK_KEY]: JSON.stringify([town('t', 'EDITED-HERE', 5)]) });
      await moveIn(parcel({ towns: [town('t', 'EDITED-THERE', updated)] }), s);
      const rows = library(s);
      expect(rows.find((t) => t.id === 't')).toEqual(town('t', 'EDITED-HERE', 5));
      expect(rows.map((t) => t.code).sort()).toEqual(['EDITED-HERE', 'EDITED-THERE']);
    }
  });

  test('a player who moved, played on in a tab still open at the old address, and came back: no version is lost', async () => {
    // First move: the town and the town that opens next.
    const s = fakeStorage();
    await moveIn(parcel({ local: { [SAVE_KEY]: 'V1', [ID_KEY]: 'a' }, towns: [town('a', 'V1', 5)] }), s);
    // Played on here a little (the keeper updates the town in place), then the old tab's newer version arrives.
    s.setItem(SAVE_KEY, 'V2-HERE');
    s.setItem(FALLBACK_KEY, JSON.stringify([town('a', 'V2-HERE', 7)]));
    await moveIn(parcel({ local: { [SAVE_KEY]: 'V2-THERE', [ID_KEY]: 'a' }, towns: [town('a', 'V2-THERE', 9)] }), s);
    expect(s.getItem(SAVE_KEY)).toBe('V2-HERE');
    expect(library(s).find((t) => t.id === 'a')!.code).toBe('V2-HERE');
    expect(library(s).map((t) => t.code).sort()).toEqual(['V2-HERE', 'V2-THERE']);
  });

  test('the town that opens next keeps clear of a different town with its id', async () => {
    const s = fakeStorage({ [FALLBACK_KEY]: JSON.stringify([town('a', 'OTHER', 5)]) });
    await moveIn(parcel({ local: { [SAVE_KEY]: 'MINE', [ID_KEY]: 'a' } }), s);
    expect(s.getItem(SAVE_KEY)).toBe('MINE');
    expect(s.getItem(ID_KEY)).not.toBe('a');
  });

  test('moving twice adds nothing the second time', async () => {
    const s = fakeStorage();
    const p = parcel({ local: { [SAVE_KEY]: 'CODE-A', [ID_KEY]: 'a' }, towns: [town('a', 'CODE-A', 5)] });
    await moveIn(p, s);
    await moveIn(p, s);
    expect(library(s)).toHaveLength(1);
  });

  test('a town waiting to be filed (PREVIOUS_KEY) comes along, or is filed at once if one is waiting here too', async () => {
    const prev = JSON.stringify({ id: 'p', code: 'PREV-THERE' });
    const empty = fakeStorage();
    await moveIn(parcel({ local: { [PREVIOUS_KEY]: prev } }), empty);
    expect(empty.getItem(PREVIOUS_KEY)).toBe(prev);
    const busy = fakeStorage({ [PREVIOUS_KEY]: JSON.stringify({ id: 'q', code: 'PREV-HERE' }) });
    await moveIn(parcel({ local: { [PREVIOUS_KEY]: prev } }), busy);
    expect(library(busy).map((t) => t.code)).toEqual(['PREV-THERE']);
  });

  test('reads a parcel packed the way the old page packs it (gzip, and plain where gzip is missing)', async () => {
    const p = parcel({ local: { [SAVE_KEY]: 'é-CODE' }, towns: [town('a', 'X', 1)], open: '#t=abc' });
    const json = JSON.stringify(p);
    const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const gz = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    expect(await readParcel('z.' + b64url(gz))).toEqual(p);
    expect(await readParcel('j.' + b64url(new TextEncoder().encode(json)))).toEqual(p);
    await expect(readParcel('nonsense')).rejects.toThrow();
  });
});
