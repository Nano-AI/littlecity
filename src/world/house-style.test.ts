// House styles in the world (design section 7, "House style"): stored on the
// block, carried through edits, undo, the share codec and town files; a
// structure takes its lowest-seq block's style, and its hash follows it.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { Block, Edit, World } from '@/core/world';
import { resolveShape } from '@/resolve/index';
import { structureStyle } from '@/resolve/structures';
import { flatTerrain, TownBuilder } from '@/scenario';
import { createHistory, pushHistory, redo, undo } from './history';
import { legacyEncodeTown } from './legacy-codec';
import { codecVersion, decodeTown, encodeTown, readTownFile, townFileText } from './save';
import { applyEdit, canApply, emptyWorld } from './world';

const terrain = flatTerrain(77);

/**
 * A share code made by the codec at 8531978, before house styles existed: the
 * save.test.ts sample town plus a house at (20, 1, 20). Kept to prove old
 * links still open.
 */
const LEGACY_CODE = 'TEMBXWGmtfNlYGDg52UQYRJxZGBgYoASTMxQFiMbI1ABkIVMsLAycDAzsDJwcTGIMnKyMqgwiSQKnVJjYMQKK5gYgdAOTHLN8gOawMRQycDGUMXADGSBVAAA';
const LEGACY_BLOCKS: [number, Block][] = [
  [642, { kind: 'dock', color: 0, rot: 0, seq: 13 }],
  [4746, { kind: 'house', color: 4, rot: 0, seq: 1 }],
  [4747, { kind: 'house', color: 4, rot: 0, seq: 4 }],
  [4750, { kind: 'auto', color: 0, rot: 0, seq: 7 }],
  [4752, { kind: 'stairs', color: 0, rot: 3, seq: 11 }],
  [5069, { kind: 'tree', color: 0, rot: 0, seq: 12 }],
  [5396, { kind: 'house', color: 6, rot: 0, seq: 14 }],
  [8842, { kind: 'house', color: 4, rot: 0, seq: 2 }],
  [8843, { kind: 'house', color: 4, rot: 0, seq: 5 }],
  [8846, { kind: 'auto', color: 0, rot: 0, seq: 8 }],
  [12938, { kind: 'house', color: 4, rot: 0, seq: 3 }],
  [12942, { kind: 'auto', color: 0, rot: 0, seq: 9 }],
  [17038, { kind: 'auto', color: 0, rot: 0, seq: 10 }],
];

function legacyTown(): World {
  const b = new TownBuilder(emptyWorld(77), terrain);
  b.house(10, 10, { floors: 3, w: 2, color: 4 }).auto(14, 10, { floors: 4 }).put('stairs', 16, 10, { rot: 3 });
  b.path(9, 13, 20, 13).garden(12, 15, 14, 16).fenceAround(12, 15, 14, 16).put('tree', 13, 15);
  b.block('dock', 2, 0, 10).erase(11, 3, 10);
  b.house(20, 20, { color: 6 });
  return b.world;
}

const place = (x: number, y: number, z: number, style?: number, color: number | 'auto' = 3): Edit => ({
  type: 'placeBlock',
  cell: key(x, y, z),
  kind: 'house',
  color,
  from: y > 1 ? key(x, y - 1, z) : null,
  ...(style === undefined ? {} : { style }),
});

describe('house style on blocks and edits', () => {
  test('placeBlock stores the style on a house, and nothing for Random', () => {
    let w = applyEdit(emptyWorld(1), terrain, place(10, 1, 10, 3));
    expect(w.blocks.get(key(10, 1, 10))).toEqual({ kind: 'house', color: 3, rot: 0, seq: 1, style: 3 });
    w = applyEdit(w, terrain, place(12, 1, 10, 0));
    w = applyEdit(w, terrain, place(14, 1, 10));
    expect('style' in w.blocks.get(key(12, 1, 10))!).toBe(false);
    expect('style' in w.blocks.get(key(14, 1, 10))!).toBe(false);
    // Auto blocks have no style, even if one is asked for.
    w = applyEdit(w, terrain, { type: 'placeBlock', cell: key(16, 1, 10), kind: 'auto', color: 'auto', from: null, style: 2 });
    expect('style' in w.blocks.get(key(16, 1, 10))!).toBe(false);
  });

  test('an unknown style is refused with a reason', () => {
    for (const style of [-1, 7, 2.5, Number.NaN]) {
      expect(canApply(emptyWorld(1), terrain, place(10, 1, 10, style))).toEqual({ ok: false, reason: 'unknown house style' });
    }
  });

  test('the Change tool and Paint keep the style', () => {
    let w = applyEdit(emptyWorld(1), terrain, place(10, 1, 10, 4));
    w = applyEdit(w, terrain, { type: 'setKind', cell: key(10, 1, 10), kind: 'tower' });
    w = applyEdit(w, terrain, { type: 'setKind', cell: key(10, 1, 10), kind: 'house' });
    w = applyEdit(w, terrain, { type: 'paint', cell: key(10, 1, 10), color: 6 });
    expect(w.blocks.get(key(10, 1, 10))).toMatchObject({ kind: 'house', color: 6, style: 4 });
  });

  test('undo restores the style, redo brings it back', () => {
    const w0 = applyEdit(emptyWorld(1), terrain, place(10, 1, 10, 1));
    let h = createHistory(w0);
    h = pushHistory(h, applyEdit(w0, terrain, { type: 'eraseBlock', cell: key(10, 1, 10) }));
    h = pushHistory(h, applyEdit(h.present, terrain, place(10, 1, 10, 6)));
    expect(h.present.blocks.get(key(10, 1, 10))?.style).toBe(6);
    h = undo(undo(h));
    expect(h.present.blocks.get(key(10, 1, 10))?.style).toBe(1);
    h = redo(redo(h));
    expect(h.present.blocks.get(key(10, 1, 10))?.style).toBe(6);
  });
});

describe('house style in structures', () => {
  test('a structure takes the style of its lowest-seq block', () => {
    let w = emptyWorld(5);
    w = applyEdit(w, terrain, place(10, 1, 10, 2));
    w = applyEdit(w, terrain, place(11, 1, 10, 5)); // merges: same colour, touching
    w = applyEdit(w, terrain, place(12, 1, 10)); // Random, merges too
    w = applyEdit(w, terrain, place(20, 1, 10)); // Random alone
    const plan = resolveShape(w, terrain);
    const big = plan.structures.get(plan.structureAt.get(key(12, 1, 10))!)!;
    expect(big.cells).toHaveLength(3);
    expect(structureStyle(w, big)).toBe(2);
    expect(structureStyle(w, plan.structures.get(plan.structureAt.get(key(20, 1, 10))!)!)).toBe(0);
    // Erase the first block: the structure now starts at the style-5 block.
    const w2 = applyEdit(w, terrain, { type: 'eraseBlock', cell: key(10, 1, 10) });
    const plan2 = resolveShape(w2, terrain);
    expect(structureStyle(w2, plan2.structures.get(plan2.structureAt.get(key(11, 1, 10))!)!)).toBe(5);
  });

  test("the structure hash changes with its style, and Random hashes as an unstyled house", () => {
    const hashWith = (style: number | undefined): number => {
      const w = applyEdit(applyEdit(emptyWorld(5), terrain, place(10, 1, 10, style)), terrain, place(10, 2, 10, style));
      const plan = resolveShape(w, terrain);
      return plan.structures.get(plan.structureAt.get(key(10, 1, 10))!)!.hash;
    };
    const hashes = [1, 2, 3, 4, 5, 6].map(hashWith);
    expect(new Set(hashes).size).toBe(6);
    expect(hashes).not.toContain(hashWith(undefined));
    expect(hashWith(0)).toBe(hashWith(undefined));
  });
});

describe('house style in the share codec', () => {
  test('a link made before styles still opens, unchanged', () => {
    const r = decodeTown(LEGACY_CODE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.world.blocks].sort((a, b) => a[0] - b[0])).toEqual(LEGACY_BLOCKS);
    expect(r.world.floors.size).toBe(18);
    expect(r.world.edges.size).toBe(10);
    expect(r.world.nextSeq).toBe(15);
    expect(r.world).toEqual(legacyTown());
  });

  test('a town with no styled block is still version 1, and the old encoder wrote exactly the pinned code', () => {
    expect(codecVersion(legacyTown())).toBe(1);
    // The pinned code is the old encoder's (legacy-codec.ts); today's writes a shorter code that opens to the same town.
    expect(legacyEncodeTown(legacyTown())).toBe(LEGACY_CODE);
    const code = encodeTown(legacyTown());
    expect(code.length).toBeLessThanOrEqual(LEGACY_CODE.length);
    expect(decodeTown(code)).toEqual({ ok: true, world: legacyTown() });
  });

  test('styles round-trip through version 2', () => {
    let w = legacyTown();
    for (const [i, style] of [1, 2, 3, 4, 5, 6].entries()) w = applyEdit(w, terrain, place(6 + i * 2, 1, 30, style, i));
    w = applyEdit(w, terrain, { type: 'placeBlock', cell: key(30, 1, 30), kind: 'stairs', color: 'auto', from: null, rot: 1 });
    w = applyEdit(w, terrain, place(32, 1, 30, 3, 7));
    expect(codecVersion(w)).toBe(2);
    const code = encodeTown(w);
    expect(code.startsWith('TEMC')).toBe(true);
    const r = decodeTown(code);
    expect(r).toEqual({ ok: true, world: w });
    // Through a town file as well.
    expect(readTownFile(townFileText(w))).toEqual({ ok: true, world: w });
    expect(JSON.parse(townFileText(w)).littleCity).toBe(2);
  });

  test('a damaged style byte is refused, not trusted', () => {
    const w = applyEdit(emptyWorld(3), terrain, place(10, 1, 10, 6));
    const good = encodeTown(w);
    expect(decodeTown(good).ok).toBe(true);
    // Corrupt every character in turn: nothing throws, and anything that decodes has valid styles.
    for (let i = 3; i < good.length; i++) {
      const bad = good.slice(0, i) + (good[i] === 'A' ? 'B' : 'A') + good.slice(i + 1);
      const r = decodeTown(bad);
      if (r.ok) for (const b of r.world.blocks.values()) expect(b.style === undefined || (b.style >= 1 && b.style <= 6)).toBe(true);
    }
  });
});
