// Damage as saved data (mischief, design section 13b): the setRuin and repair
// edits, and the share codec's version 4.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { flatTerrain, TownBuilder } from '@/scenario';
import { deflatedVersion, encodeDeflated, encodeRanged, decodeTown, encodeTown } from './save';
import { isRuin, packRuin, ruinName, savedRuin, unpackRuin } from './damage';
import { applyEdit, canApply, emptyWorld, type World } from './world';

const terrain = flatTerrain(3);
function town() {
  const b = new TownBuilder(emptyWorld(3), terrain);
  b.house(10, 10, { floors: 2, color: 3 });
  b.put('tree', 14, 10);
  return b.world;
}

describe('the damage byte', () => {
  test('packs and unpacks every state', () => {
    for (const cause of ['fire', 'blast'] as const) {
      for (const stage of [0, 1, 2, 3] as const) {
        for (const mending of [false, true]) {
          const v = packRuin({ stage, cause, mending });
          if (stage === 0 && !mending) {
            expect(v).toBe(0);
            continue;
          }
          expect(isRuin(v)).toBe(true);
          const d = unpackRuin(v);
          expect([d.stage, d.mending]).toEqual([stage, mending]);
          if (stage > 0) expect(d.cause).toBe(cause);
        }
      }
    }
    expect(ruinName(packRuin({ stage: 3, cause: 'fire' }))).toBe('burnt out');
    expect(ruinName(packRuin({ stage: 3, cause: 'blast' }))).toBe('rubble');
  });
});

describe('setRuin and repair', () => {
  test('damage only blocks that are there; repair puts back exactly what was built', () => {
    const w = town();
    const c = key(10, 2, 10);
    expect(canApply(w, terrain, { type: 'setRuin', cell: key(30, 1, 30), ruin: 1 }).ok).toBe(false);
    expect(canApply(w, terrain, { type: 'setRuin', cell: c, ruin: 227 }).ok).toBe(false);
    expect(canApply(w, terrain, { type: 'repair', cell: c }).ok).toBe(false);
    const hurt = applyEdit(w, terrain, { type: 'setRuin', cell: c, ruin: packRuin({ stage: 2, cause: 'blast' }) });
    expect(hurt.blocks.get(c)).toEqual({ ...w.blocks.get(c), ruin: packRuin({ stage: 2, cause: 'blast' }) });
    const mended = applyEdit(hurt, terrain, { type: 'repair', cell: c });
    expect(mended.blocks.get(c)).toEqual(w.blocks.get(c));
    expect('ruin' in mended.blocks.get(c)!).toBe(false);
    // Damage never touches anything else: the next seq, floors, edges.
    expect(hurt.nextSeq).toBe(w.nextSeq);
  });
});

describe('the share codec', () => {
  test('a mended town leaves no trace in the save (in the deflated form it needs only version 1)', () => {
    const w = town();
    expect(deflatedVersion(w)).toBe(1);
    const hurt = applyEdit(w, terrain, { type: 'setRuin', cell: key(10, 1, 10), ruin: packRuin({ stage: 1, cause: 'fire' }) });
    const back = applyEdit(hurt, terrain, { type: 'repair', cell: key(10, 1, 10) });
    expect(encodeTown(back)).toBe(encodeTown(w));
  });

  test('ruins round-trip as version 4; chunks in the air are saved landed', () => {
    let w = town();
    w = applyEdit(w, terrain, { type: 'setRuin', cell: key(10, 1, 10), ruin: packRuin({ stage: 3, cause: 'blast', settling: true }) });
    w = applyEdit(w, terrain, { type: 'setRuin', cell: key(10, 2, 10), ruin: packRuin({ stage: 2, cause: 'fire', mending: true }) });
    w = applyEdit(w, terrain, { type: 'setRuin', cell: key(14, 1, 10), ruin: packRuin({ stage: 1, cause: 'fire' }) });
    expect(deflatedVersion(w)).toBe(4);
    // Either format may be written (the shorter); both must hold the town.
    expect(encodeDeflated(w).startsWith('TEME')).toBe(true);
    expect(decodeTown(encodeDeflated(w))).toEqual(decodeTown(encodeTown(w)));
    expect(decodeTown(encodeRanged(w))).toEqual(decodeTown(encodeDeflated(w)));
    const code = encodeTown(w);
    const r = decodeTown(code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const [cell, b] of w.blocks) expect(r.world.blocks.get(cell)).toEqual(b.ruin ? { ...b, ruin: savedRuin(b.ruin) } : b);
    expect(unpackRuin(r.world.blocks.get(key(10, 1, 10))!.ruin).settling).toBe(false);
  });

  test('a ruined town on the second island keeps its island', () => {
    let w: World = { ...town(), terrainGen: 2 };
    w = applyEdit(w, terrain, { type: 'setRuin', cell: key(10, 1, 10), ruin: packRuin({ stage: 3, cause: 'fire' }) });
    const r = decodeTown(encodeTown(w));
    expect(r.ok && r.world.terrainGen).toBe(2);
  });
});
