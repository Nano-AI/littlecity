// The stub world: only what the skeleton relies on. The Logic owner replaces
// this file's cases with a test per placement rule (design section 7).

import { describe, expect, test } from 'vitest';
import { edgeKey, key } from '@/core/grid';
import { flatTerrain } from '@/scenario';
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from './history';
import { decodeTown, encodeTown, loadTown, saveTown, type TownStorage } from './save';
import { applyEdit, canApply, emptyWorld } from './world';

const terrain = flatTerrain(4);

describe('edits (stub)', () => {
  test('applyEdit returns a new world and leaves the input untouched', () => {
    const w0 = emptyWorld(4);
    const w1 = applyEdit(w0, terrain, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'house', color: 3, from: null });
    expect(w0.blocks.size).toBe(0);
    expect(w1.blocks.get(key(10, 1, 10))).toEqual({ kind: 'house', color: 3, rot: 0, seq: 1 });
    expect(w1.nextSeq).toBe(2);
    const w2 = applyEdit(w1, terrain, { type: 'placeBlock', cell: key(10, 2, 10), kind: 'auto', color: 'auto', from: key(10, 1, 10) });
    expect(w2.blocks.get(key(10, 2, 10))).toMatchObject({ kind: 'auto', color: 3, seq: 2 });
    expect(w1.blocks.size).toBe(1);
  });

  test('automatic colour on bare ground: varied for houses, default tint for marble', () => {
    const place = (kind: 'house' | 'marble', x: number) => applyEdit(emptyWorld(4), terrain, { type: 'placeBlock', cell: key(x, 1, 10), kind, color: 'auto', from: null }).blocks.get(key(x, 1, 10))!.color;
    const houseColours = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((x) => place('house', x)));
    expect(houseColours.size).toBeGreaterThan(2);
    expect(place('marble', 10)).toBe(0);
    expect(place('house', 10)).toBe(place('house', 10));
  });

  test('illegal edits are refused with a reason, never an exception from canApply', () => {
    const w = applyEdit(emptyWorld(4), terrain, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'house', color: 0, from: null });
    expect(canApply(w, terrain, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'tower', color: 0, from: null })).toEqual({ ok: false, reason: 'something is already there' });
    expect(canApply(w, terrain, { type: 'placeBlock', cell: key(10, 0, 10), kind: 'tower', color: 0, from: null }).ok).toBe(false);
    expect(canApply(w, terrain, { type: 'placeBlock', cell: -1, kind: 'tower', color: 0, from: null }).ok).toBe(false);
    expect(canApply(w, terrain, { type: 'placeBlock', cell: key(10, 31, 10) + (1 << 12), kind: 'tower', color: 0, from: null }).ok).toBe(false);
    expect(canApply(w, terrain, { type: 'eraseBlock', cell: key(1, 1, 1) }).ok).toBe(false);
    expect(() => applyEdit(w, terrain, { type: 'eraseFloor', cell: key(1, 1, 1) })).toThrow(/nothing there/);
  });

  test('floors, edges, erase, kind, rot and paint', () => {
    let w = emptyWorld(4);
    w = applyEdit(w, terrain, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'path' });
    w = applyEdit(w, terrain, { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'E'), kind: 'fence' });
    w = applyEdit(w, terrain, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'tree', color: 'auto', from: null });
    expect(w.floors.get(key(10, 1, 10))).toBe('path'); // a tree keeps the floor
    w = applyEdit(w, terrain, { type: 'setKind', cell: key(10, 1, 10), kind: 'stairs' });
    w = applyEdit(w, terrain, { type: 'setRot', cell: key(10, 1, 10), rot: 2 });
    w = applyEdit(w, terrain, { type: 'paint', cell: key(10, 1, 10), color: 6 });
    expect(w.blocks.get(key(10, 1, 10))).toMatchObject({ kind: 'stairs', rot: 2, color: 6 });
    w = applyEdit(w, terrain, { type: 'eraseBlock', cell: key(10, 1, 10) });
    w = applyEdit(w, terrain, { type: 'eraseFloor', cell: key(10, 1, 10) });
    w = applyEdit(w, terrain, { type: 'eraseEdge', edge: edgeKey(10, 1, 10, 'E') });
    expect([w.blocks.size, w.floors.size, w.edges.size]).toEqual([0, 0, 0]);
    const house = applyEdit(applyEdit(emptyWorld(4), terrain, { type: 'placeFloor', cell: key(5, 1, 5), floor: 'plaza' }), terrain, { type: 'placeBlock', cell: key(5, 1, 5), kind: 'house', color: 0, from: null });
    expect(house.floors.size).toBe(0); // a house removes the floor
  });
});

describe('history (stub)', () => {
  test('undo and redo walk the stack; a new edit clears redo', () => {
    const w0 = emptyWorld(4);
    const w1 = applyEdit(w0, terrain, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'house', color: 0, from: null });
    const w2 = applyEdit(w1, terrain, { type: 'placeBlock', cell: key(11, 1, 10), kind: 'house', color: 0, from: null });
    let h = createHistory(w0);
    expect(canUndo(h)).toBe(false);
    h = pushHistory(pushHistory(h, w1), w2);
    h = undo(h);
    expect(h.present).toBe(w1);
    expect(canRedo(h)).toBe(true);
    expect(redo(h).present).toBe(w2);
    h = pushHistory(h, w0);
    expect(canRedo(h)).toBe(false);
    expect(undo(undo(undo(undo(h)))).present).toBe(w0);
  });
});

describe('save and share (stub)', () => {
  const w = applyEdit(
    applyEdit(emptyWorld(77), terrain, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'auto', color: 5, from: null }),
    terrain,
    { type: 'placeFloor', cell: key(12, 1, 10), floor: 'garden' },
  );

  test('a town survives encode and decode', () => {
    const code = encodeTown(w);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodeTown(code);
    expect(back.ok && back.world).toEqual(w);
  });

  test('decode rejects garbage without throwing', () => {
    for (const bad of ['', 'not a town', '%%%', 'e30', encodeTown(w).slice(0, 20)]) {
      const r = decodeTown(bad);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.reason.length).toBeGreaterThan(0);
    }
  });

  test('autosave survives storage errors', () => {
    const memory = new Map<string, string>();
    const good: TownStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
    const full: TownStorage = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('quota');
      },
    };
    expect(saveTown(good, w)).toBe(true);
    expect(loadTown(good)).toEqual(w);
    expect(saveTown(full, w)).toBe(false);
    expect(loadTown(full)).toBeNull();
    expect(saveTown(null, w)).toBe(false);
    expect(loadTown(undefined)).toBeNull();
  });
});
