// Short links (design section 15, "Sharing"): version 5, the town range-coded
// under learned contexts. New links round-trip exactly; a town is written in
// whichever of version 5 and the deflated format (1 to 4) is shorter; old
// links, written by the frozen old encoder, still open.

import { describe, expect, test } from 'vitest';
import { columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import type { Block, Edit, World } from '@/core/world';
import { rand } from '@/core/rand';
import { landEditable } from '@/terrain/land';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { CHARACTERS, type Character } from '@/townmaker/character';
import { planTown } from '@/townmaker/index';
import { FULL } from '../../tests/helpers/tier';
import { packRuin } from './damage';
import { fromBase64Url } from './deflate';
import { legacyEncodeTown } from './legacy-codec';
import { RangeDecoder, RangeEncoder, sint, SINT_CONTEXTS, sym, uint, UINT_CONTEXTS } from './rangecoder';
import { decodeTown, encodeDeflated, encodeRanged, encodeTown, readTownFile, townFileText } from './save';
import { applyEdit, emptyWorld } from './world';

/** A town grown the way the game grows one: the starting trees cleared, then the planner's edits. */
function grown(seed: number, gen: 1 | 2, character?: Character): World {
  const t = generateTerrain(seed, gen);
  let w = initialWorld(seed, t, gen);
  const clear: Edit[] = [...w.blocks.keys()].sort((a, b) => keyY(b) - keyY(a) || b - a).map((cell) => ({ type: 'eraseBlock', cell }));
  for (const e of clear) w = applyEdit(w, t, e);
  for (const e of planTown(t, seed, character ? { character } : {}).edits) w = applyEdit(w, t, e);
  return w;
}
/** Every third house styled. */
function styled(w: World): World {
  const blocks = new Map(w.blocks);
  for (const [c, b] of blocks) if (b.kind === 'house' && b.seq % 3 === 0) blocks.set(c, { ...b, style: 1 + (b.seq % 6) });
  return { ...w, blocks };
}
/** A blast and a fire, some of it being mended, a tree blown over. */
function ruined(w: World): World {
  const blocks = new Map<number, Block>(w.blocks);
  for (const [c, b] of blocks) {
    const d1 = Math.hypot(keyX(c) - 22, keyZ(c) - 24), d2 = Math.hypot(keyX(c) - 30, keyZ(c) - 18);
    if (d1 < 5) blocks.set(c, { ...b, ruin: packRuin({ stage: d1 < 2.5 ? 3 : 2, cause: 'blast', fall: b.kind === 'tree' ? 1 + (b.seq % 4) : 0 }) });
    else if (d2 < 3) blocks.set(c, { ...b, ruin: packRuin({ stage: (1 + (b.seq % 3)) as 1 | 2 | 3, cause: 'fire', mending: b.seq % 2 === 0, progress: b.seq % 32 }) });
  }
  return { ...w, blocks };
}
/** A raised hill and a dug pond. */
function reshaped(w: World): World {
  const edits = new Map<number, number>();
  for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) {
    if (!landEditable(x, z)) continue;
    const d = Math.hypot(x - 14, z - 30), e = Math.hypot(x - 34, z - 12);
    if (d < 4) edits.set(columnIndex(x, z), Math.min(10, 2 + Math.round(4 - d)));
    else if (e < 2.5) edits.set(columnIndex(x, z), 0);
  }
  return { ...w, terrainEdits: edits };
}

const towns: { name: string; w: World }[] = [];
const town = (name: string, make: () => World): void => void towns.push({ name, w: make() });
town('empty island, generator 1', () => emptyWorld(6));
town('empty island, generator 2', () => emptyWorld(-6, 2));
for (const [i, c] of CHARACTERS.entries()) {
  town(`${c}, generator 2`, () => grown(41 + i, 2, c));
  town(`${c}, generator 1`, () => grown(61 + i, 1, c));
}
town('styled, reshaped and ruined, generator 2', () => styled(ruined(reshaped(grown(3, 2)))));
town('styled and ruined, generator 1', () => styled(ruined(grown(4, 1))));

describe('version 5 links', () => {
  test('every kind of grown town round-trips exactly, through the link, the town file and the old encoder', () => {
    for (const { name, w } of towns) {
      const code = encodeTown(w);
      expect(code, name).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeTown(code), name).toEqual({ ok: true, world: w });
      // Both forms hold it, whichever was chosen.
      expect(decodeTown(encodeRanged(w)), name).toEqual({ ok: true, world: w });
      expect(decodeTown(encodeDeflated(w)), name).toEqual({ ok: true, world: w });
      expect(code.length, name).toBe(Math.min(encodeRanged(w).length, encodeDeflated(w).length));
      expect(readTownFile(townFileText(w)), name).toEqual({ ok: true, world: w });
      // The same town as the old encoder wrote it still opens.
      expect(decodeTown(legacyEncodeTown(w)), name).toEqual({ ok: true, world: w });
    }
  });

  test('a grown town\'s link is at least a third shorter than the old encoder made it', () => {
    for (const { name, w } of towns) {
      if (w.blocks.size < 100) continue;
      const code = encodeTown(w);
      expect(code.startsWith('TEMF'), name).toBe(true);
      expect(code.length, name).toBeLessThan(legacyEncodeTown(w).length * 0.67);
    }
  });

  test('a damaged or truncated version 5 code is refused with a sentence, never thrown', () => {
    const w = towns.find((t) => t.name.startsWith('styled, reshaped'))!.w;
    const good = encodeRanged(w);
    expect(good.startsWith('TEMF')).toBe(true);
    for (let n = 0; n < good.length; n++) {
      const r = decodeTown(good.slice(0, n));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/\.$/);
    }
    expect(decodeTown(good + 'A').ok).toBe(false);
    // Every character after the version: the checksum catches it.
    for (let i = 4; i < good.length; i++) {
      const bad = good.slice(0, i) + (good[i] === 'A' ? 'B' : 'A') + good.slice(i + 1);
      // (The last character's spare bits carry nothing: changing only them changes no byte.)
      if (String(fromBase64Url(bad)) === String(fromBase64Url(good))) continue;
      const r = decodeTown(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('This town link is damaged or incomplete.');
    }
  });

  test('random bytes behind a good checksum decode to a town or a refusal, never a throw, and quickly', () => {
    // The checksum stops almost all garbage; this drives the decoder itself with garbage it must survive.
    for (let k = 0; k < 200; k++) {
      const body = Uint8Array.from({ length: 1 + Math.floor(rand(5, 'len', k) * 300) }, (_, i) => Math.floor(rand(5, 'b', k, i) * 256));
      const all = new Uint8Array(11 + body.length);
      all.set([0x4c, 0x43, 5, 0, 0, 0, 0, 9, 0, 0, 0]);
      all.set(body, 11);
      let h = 0x811c9dc5;
      for (let i = 7; i < all.length; i++) h = Math.imul(h ^ all[i]!, 0x01000193);
      for (let i = 0; i < 4; i++) all[3 + i] = ((h >>> 0) >>> (8 * i)) & 255;
      let s = '';
      const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      for (let i = 0; i < all.length; i += 3) {
        const n = (all[i]! << 16) | ((all[i + 1] ?? 0) << 8) | (all[i + 2] ?? 0);
        s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < all.length ? B64[(n >> 6) & 63]! : '') + (i + 2 < all.length ? B64[n & 63]! : '');
      }
      const r = decodeTown(s);
      if (!r.ok) expect(r.reason).toMatch(/\.$/);
    }
  });

  test('a section bit nobody knows yet (bit 2, promised to the island size) is "a different version"', () => {
    const w = towns[2]!.w;
    expect(decodeTown(encodeRanged(w, 1 << 2))).toEqual({ ok: false, reason: 'This town was made by a different version of Little City.' });
    expect(decodeTown(encodeRanged(w, 1 << 5))).toEqual({ ok: false, reason: 'This town was made by a different version of Little City.' });
  });

  test.runIf(FULL)('a 600-block town encodes and decodes well inside a click (50 ms)', () => {
    const w = grown(101, 2);
    expect(w.blocks.size).toBeGreaterThan(500);
    for (let i = 0; i < 3; i++) encodeTown(w); // warm up
    const t0 = performance.now();
    const code = encodeTown(w);
    const t1 = performance.now();
    decodeTown(code);
    const t2 = performance.now();
    expect(t1 - t0).toBeLessThan(50);
    expect(t2 - t1).toBeLessThan(50);
  });
});

describe('the range coder', () => {
  test('bits, numbers and symbols come back exactly, in many contexts, at the extremes', () => {
    const values: [string, number][] = [];
    for (let i = 0; i < 3000; i++) {
      const r = rand(11, 'v', i);
      if (r < 0.4) values.push(['bit', rand(11, 'b', i) < 0.9 ? 1 : 0]);
      else if (r < 0.6) values.push(['uint', Math.floor(rand(11, 'u', i) ** 6 * 2 ** 30)]);
      else if (r < 0.8) values.push(['sint', Math.round((rand(11, 's', i) - 0.5) * 200) || 0]);
      else values.push(['sym', Math.floor(rand(11, 'y', i) * 1024)]);
    }
    values.push(['uint', 0], ['uint', 2 ** 31 - 2], ['sint', -(2 ** 30)], ['sint', 2 ** 30]);
    const size = 4 + UINT_CONTEXTS + SINT_CONTEXTS + 1024;
    const run = (c: RangeEncoder | RangeDecoder): number[] =>
      values.map(([kind, v], i) => {
        if (kind === 'bit') return c.bit(i % 4, v);
        if (kind === 'uint') return uint(c, 4, v);
        if (kind === 'sint') return sint(c, 4 + UINT_CONTEXTS, v);
        return sym(c, 4 + UINT_CONTEXTS + SINT_CONTEXTS, v, 10);
      });
    const enc = new RangeEncoder(size);
    expect(run(enc)).toEqual(values.map(([, v]) => v));
    const bytes = enc.finish();
    expect(bytes[bytes.length - 1]).not.toBe(0); // trailing zeros trimmed
    expect(run(new RangeDecoder(bytes, size))).toEqual(values.map(([, v]) => v));
    // A run of one certain bit costs next to nothing.
    const quiet = new RangeEncoder(1);
    for (let i = 0; i < 10000; i++) quiet.bit(0, 0);
    expect(quiet.finish().length).toBeLessThan(8);
  });
});
