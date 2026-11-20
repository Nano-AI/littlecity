import { inflateRawSync, deflateRawSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { edgeKey, key } from '@/core/grid';
import { rand, randInt } from '@/core/rand';
import type { World } from '@/core/world';
import { buildScenario, flatTerrain, TownBuilder } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { deflateRaw, fromBase64Url, inflateRaw, toBase64Url } from './deflate';
import {
  codeFromLink,
  createAutosave,
  decodeTown,
  encodeTown,
  loadTown,
  readTownFile,
  saveTown,
  shareTown,
  townFileName,
  townFileText,
  type Timers,
  type TownStorage,
} from './save';
import { applyEdit, emptyWorld } from './world';

const terrain = flatTerrain(77);

function sampleTown(): World {
  const b = new TownBuilder(emptyWorld(77), terrain);
  b.house(10, 10, { floors: 3, w: 2, color: 4 }).auto(14, 10, { floors: 4 }).put('stairs', 16, 10, { rot: 3 });
  b.path(9, 13, 20, 13).garden(12, 15, 14, 16).fenceAround(12, 15, 14, 16).put('tree', 13, 15);
  b.block('dock', 2, 0, 10).erase(11, 3, 10);
  return b.world;
}

/** A big random town, valid by construction (bench-like). */
function bigTown(): World {
  const b = new TownBuilder(emptyWorld(-123456), terrain);
  for (let i = 0; i < 600; i++) {
    const x = randInt(4, 43, 5, 'x', i);
    const z = randInt(4, 43, 5, 'z', i);
    if (b.onTerrain(x, z) > 8) continue;
    const r = rand(5, 'k', i);
    if (r < 0.7) b.put(r < 0.35 ? 'house' : 'auto', x, z, { color: randInt(0, 7, 5, 'c', i) });
    else if (r < 0.8 && b.onTerrain(x, z) === 1 && !b.world.floors.has(key(x, 1, z))) b.path(x, z);
  }
  return b.world;
}

describe('deflate', () => {
  test('round-trips, and agrees with zlib both ways', () => {
    // Fibonacci-weighted bytes make a Huffman tree deeper than 15 levels (the length limit must hold),
    // a few bytes make a near-empty code, noise makes a stored block, the rest dynamic or fixed blocks.
    const fib: number[] = [];
    for (let a = 1, b = 1, s = 0; s < 22; s++, [a, b] = [b, a + b]) for (let k = 0; k < a; k++) fib.push(s * 11);
    const cases = [
      new Uint8Array(0), Uint8Array.from([1]), Uint8Array.from([1, 2, 3]), new Uint8Array(5000).fill(7),
      Uint8Array.from({ length: 3000 }, (_, i) => (i * 7919) % 251),
      Uint8Array.from({ length: 4000 }, (_, i) => Math.floor(rand(3, 'noise', i) * 256)),
      Uint8Array.from({ length: 3000 }, (_, i) => (i % 7 === 0 ? i & 255 : i % 3)),
      Uint8Array.from(fib.map((v, i) => (i % 5 === 0 ? v : fib[(i * 7919) % fib.length]!))),
    ];
    for (const data of cases) {
      const mine = deflateRaw(data);
      expect(inflateRaw(mine, 1 << 22, true)).toEqual(data);
      expect(new Uint8Array(inflateRawSync(mine))).toEqual(data);
      expect(mine.length).toBeLessThanOrEqual(new Uint8Array(deflateRawSync(data, { level: 9 })).length + 8);
      expect(deflateRaw(data)).toEqual(mine); // deterministic
      expect(inflateRaw(new Uint8Array(deflateRawSync(data)))).toEqual(data); // dynamic Huffman blocks
      expect(inflateRaw(new Uint8Array(deflateRawSync(data, { level: 0 })))).toEqual(data); // stored blocks
    }
  });

  test('base64url round-trips every length', () => {
    for (let n = 0; n < 10; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + n) & 255);
      const s = toBase64Url(bytes);
      expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(fromBase64Url(s)).toEqual(bytes);
    }
    expect(fromBase64Url('a')).toBeNull();
    expect(fromBase64Url('ab!c')).toBeNull();
  });
});

describe('share codec', () => {
  test('a town survives encode and decode exactly', () => {
    for (const w of [emptyWorld(0), emptyWorld(-5), sampleTown(), bigTown()]) {
      const code = encodeTown(w);
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      const back = decodeTown(code);
      expect(back.ok && back.world).toEqual(w);
    }
  });

  test('it is compact and reports when it is too long for a link', () => {
    // The 2,000-block reference town fits a link with room to spare.
    const bench = buildScenario(findScenario('bench-2000')!).world;
    const { code, fitsLink } = shareTown(bench);
    expect(bench.blocks.size).toBeGreaterThan(1800);
    expect(code.length).toBeLessThan(3000);
    expect(fitsLink).toBe(true);
    expect(shareTown(bigTown()).fitsLink).toBe(true);
    // A dense 2,300-block random town is too long for a link.
    let w = emptyWorld(1);
    for (let i = 0; i < 2300; i++) {
      const x = randInt(4, 43, 9, 'x', i), z = randInt(4, 43, 9, 'z', i);
      const y = 1 + randInt(0, 20, 9, 'y', i);
      const cell = key(x, y, z);
      if (!w.blocks.has(cell)) w = { ...w, blocks: new Map(w.blocks).set(cell, { kind: 'house', color: randInt(0, 7, 9, 'c', i), rot: 0, seq: w.nextSeq }), nextSeq: w.nextSeq + 1 };
    }
    expect(shareTown(w).fitsLink).toBe(false);
    expect(decodeTown(shareTown(w).code)).toEqual({ ok: true, world: w });
  });

  test('decode rejects garbage without throwing (Review Focus 2)', () => {
    const good = encodeTown(sampleTown());
    const bad = [
      '', '   ', 'not a town', '%%%', 'e30', 'TEM', 'TEMC', good.slice(0, 20), good.slice(0, -3), good + 'AAAA',
      good.slice(0, 12) + 'x' + good.slice(13), 'TEMJ' + good.slice(4), // version 9, nobody's
      toBase64Url(Uint8Array.from([0x4c, 0x43, 1, 0, 0, 0, 0, 3, 0])),
      undefined as unknown as string, 42 as unknown as string,
    ];
    for (const code of bad) {
      const r = decodeTown(code);
      expect(r.ok, String(code)).toBe(false);
      expect(!r.ok && r.reason).toMatch(/\.$/);
    }
    expect(decodeTown('TEMJ' + good.slice(4))).toEqual({ ok: false, reason: 'This town was made by a different version of Little City.' });
    // Every truncation and every single-character corruption is refused or decodes to a valid town.
    for (let n = 0; n < good.length; n++) expect(decodeTown(good.slice(0, n)).ok).toBe(false);
    for (let i = 0; i < good.length; i += 3) {
      const c = good[i] === 'A' ? 'B' : 'A';
      expect(() => decodeTown(good.slice(0, i) + c + good.slice(i + 1))).not.toThrow();
    }
  });

  test('a link, a fragment or a bare code all read', () => {
    const code = encodeTown(sampleTown());
    expect(codeFromLink(`https://x.y/?a=1#${code}`)).toBe(code);
    expect(codeFromLink(`#town=${code}`)).toBe(code);
    expect(codeFromLink(code)).toBe(code);
  });

  test('the town file round-trips, and bad files are refused with a message', () => {
    const w = sampleTown();
    expect(townFileName(w)).toBe('little-city-77.town');
    expect(readTownFile(townFileText(w))).toEqual({ ok: true, world: w });
    expect(readTownFile(encodeTown(w))).toEqual({ ok: true, world: w });
    for (const text of ['{', '{"town": 3}', 'null', '<html>', '']) expect(readTownFile(text).ok).toBe(false);
  });
});

describe('autosave', () => {
  const memory = (): TownStorage & { map: Map<string, string>; writes: number } => {
    const map = new Map<string, string>();
    const s = { map, writes: 0, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { s.writes++; map.set(k, v); } };
    return s;
  };
  const fakeTimers = () => {
    let now = 0;
    const due = new Map<number, { at: number; fn: () => void }>();
    let next = 1;
    const timers: Timers = {
      set(fn, ms) { due.set(next, { at: now + ms, fn }); return next++; },
      clear(h) { due.delete(h as number); },
    };
    const advance = (ms: number) => {
      now += ms;
      for (const [h, t] of [...due]) if (t.at <= now) { due.delete(h); t.fn(); }
    };
    return { timers, advance };
  };

  test('debounced by 500 ms: a burst of edits is one write of the newest world', () => {
    const store = memory();
    const { timers, advance } = fakeTimers();
    const save = createAutosave(store, { timers });
    let w = emptyWorld(3);
    for (let i = 0; i < 5; i++) {
      w = applyEdit(w, terrain, { type: 'placeBlock', cell: key(10 + i, 1, 10), kind: 'house', color: 0, from: null });
      save.schedule(w);
      advance(100);
    }
    expect(store.writes).toBe(0);
    advance(400);
    expect(store.writes).toBe(1);
    expect(loadTown(store)).toEqual(w);
    save.schedule(emptyWorld(9));
    expect(save.flush()).toBe(true);
    expect(loadTown(store)?.seed).toBe(9);
    expect(store.writes).toBe(2);
  });

  test('autosave survives storage errors (Review Focus 5): plays on, says so once', () => {
    const w = sampleTown();
    const full: TownStorage = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('QuotaExceededError'); },
    };
    expect(saveTown(full, w)).toBe(false);
    expect(loadTown(full)).toBeNull();
    expect(saveTown(null, w)).toBe(false);
    expect(loadTown(undefined)).toBeNull();
    const garbage: TownStorage = { getItem: () => 'garbage!', setItem() {} };
    expect(loadTown(garbage)).toBeNull();

    const { timers, advance } = fakeTimers();
    let told = 0;
    for (const storage of [full, null]) {
      const save = createAutosave(storage, { timers, onUnavailable: () => { told++; throw new Error('listener bug'); } });
      for (let i = 0; i < 3; i++) {
        save.schedule(w);
        expect(() => advance(600)).not.toThrow();
      }
      expect(save.failed).toBe(true);
      expect(save.flush()).toBe(false);
    }
    expect(told).toBe(2); // once per autosaver
  });

  test('cancel drops a pending save', () => {
    const store = memory();
    const { timers, advance } = fakeTimers();
    const save = createAutosave(store, { timers });
    save.schedule(emptyWorld(1));
    save.cancel();
    advance(1000);
    expect(store.writes).toBe(0);
    expect(saveTown(store, applyEdit(emptyWorld(1), terrain, { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'E'), kind: 'wall' }))).toBe(true);
  });
});
