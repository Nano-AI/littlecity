import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { World } from '@/core/world';
import { flatTerrain } from '@/scenario';
import { canRedo, canUndo, createHistory, HISTORY_LIMIT, pushHistory, redo, undo } from './history';
import { applyEdit, emptyWorld } from './world';

const terrain = flatTerrain(4);
const put = (w: World, x: number, z = 10): World => applyEdit(w, terrain, { type: 'placeBlock', cell: key(x, 1, z), kind: 'house', color: 0, from: null });

describe('history', () => {
  test('undo and redo walk the stack; a new edit clears redo', () => {
    const w0 = emptyWorld(4);
    const w1 = put(w0, 10);
    const w2 = put(w1, 11);
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
    expect(undo(createHistory(w0))).toEqual(createHistory(w0));
    expect(redo(createHistory(w0))).toEqual(createHistory(w0));
  });

  test('pushing the same world is not a step', () => {
    const h = createHistory(emptyWorld(1));
    expect(pushHistory(h, h.present)).toBe(h);
  });

  test('at least 200 steps; older steps fall off the far end', () => {
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(200);
    const worlds: World[] = [emptyWorld(4)];
    let h = createHistory(worlds[0]!);
    for (let i = 0; i < 250; i++) {
      worlds.push(put(worlds[worlds.length - 1]!, 4 + (i % 40), 4 + Math.floor(i / 40)));
      h = pushHistory(h, worlds[worlds.length - 1]!);
    }
    let steps = 0;
    while (canUndo(h)) {
      h = undo(h);
      steps++;
    }
    expect(steps).toBe(HISTORY_LIMIT);
    expect(h.present).toBe(worlds[250 - HISTORY_LIMIT]);
    for (let i = 0; i < HISTORY_LIMIT; i++) h = redo(h);
    expect(h.present).toBe(worlds[250]);
  });

  test('one push after a batch undoes the batch together (a Shift-drag run)', () => {
    const w0 = emptyWorld(4);
    let w = w0;
    for (let x = 10; x < 15; x++) w = put(w, x);
    const h = undo(pushHistory(createHistory(w0), w));
    expect(h.present).toBe(w0);
  });
});
