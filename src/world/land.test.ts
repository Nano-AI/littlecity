// Shaping the land (design section 6): one test per rule of the paragraph,
// plus carrying. The property tests are in land.property.test.ts.

import { describe, expect, test } from 'vitest';
import { columnIndex, edgeKey, key } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import { MAT } from '@/core/world';
import { flatTerrain, TerrainBuilder } from '@/scenario';
import { islandOf, LAND_MAX, MAT_POND } from '@/terrain/land';
import { generateTerrain, terrainOf } from '@/terrain/terrain';
import { MAT_RIVER } from '@/terrain/terrain2';
import { applyEdit, canApply, emptyWorld } from './world';

const flat = flatTerrain(4); // height 1 on columns 4–43, water around
/** Land at 1 on columns 8–39, so the sea at 5–7 can be filled and the shore dug. */
const isle = new TerrainBuilder(4).rect(8, 8, 39, 39, 1).build();
const c = (x: number, z: number): number => columnIndex(x, z);
const up = (...cols: number[]): Edit => ({ type: 'land', up: cols, down: [] });
const down = (...cols: number[]): Edit => ({ type: 'land', up: [], down: cols });
const h = (w: World, t: Terrain, x: number, z: number): number => islandOf(w, t).height[c(x, z)]!;
const place = (w: World, kind: Extract<Edit, { type: 'placeBlock' }>['kind'], x: number, y: number, z: number, t: Terrain = flat): World =>
  applyEdit(w, t, { type: 'placeBlock', cell: key(x, y, z), kind, color: 'auto', from: null });
const w0 = emptyWorld(4);

describe('raise', () => {
  test('a land column rises one level', () => {
    const w = applyEdit(w0, flat, up(c(10, 10)));
    expect(h(w, flat, 10, 10)).toBe(2);
    expect(w.terrainEdits).toEqual(new Map([[c(10, 10), 2]]));
    expect(h(w, flat, 11, 10)).toBe(1);
  });
  test('water becomes new land at level 1', () => {
    const w = applyEdit(w0, isle, up(c(6, 20)));
    expect(h(w, isle, 6, 20)).toBe(1);
    expect(islandOf(w, isle).material[c(6, 20)]).toBe(MAT.sand);
  });
  test('no higher than level 10', () => {
    let w = w0;
    for (let i = 1; i < LAND_MAX; i++) w = applyEdit(w, flat, up(c(10, 10)));
    expect(h(w, flat, 10, 10)).toBe(LAND_MAX);
    expect(canApply(w, flat, up(c(10, 10)))).toEqual({ ok: false, reason: 'the land can rise no higher' });
  });
});

describe('dig', () => {
  test('a column drops one level', () => {
    const t = new TerrainBuilder(4).flat(1).rect(10, 10, 20, 20, 3).build();
    const w = applyEdit(w0, t, down(c(15, 15)));
    expect(h(w, t, 15, 15)).toBe(2);
  });
  test('digging level 1 next to the sea makes sea', () => {
    const w = applyEdit(w0, isle, down(c(8, 20)));
    const t = islandOf(w, isle);
    expect(t.height[c(8, 20)]).toBe(0);
    expect(t.material[c(8, 20)]).toBe(MAT.water);
    expect(t.material[c(9, 20)]).toBe(MAT.sand); // a new beach
  });
  test('a narrow channel dug in from the sea is a river', () => {
    let w = w0;
    for (let x = 8; x <= 16; x++) w = applyEdit(w, isle, down(c(x, 20)));
    const t = islandOf(w, isle);
    for (let x = 8; x <= 16; x++) expect(t.material[c(x, 20)]).toBe(MAT_RIVER);
    expect(t.material[c(14, 19)]).toBe(MAT.grass); // grass banks inland
  });
  test('water shut in by land is a pond', () => {
    let w = w0;
    for (const [x, z] of [[20, 20], [21, 20], [20, 21], [21, 21]] as const) w = applyEdit(w, flat, down(c(x, z)));
    const t = islandOf(w, flat);
    expect(t.material[c(20, 20)]).toBe(MAT_POND);
    expect(t.material[c(19, 20)]).toBe(MAT.sand);
  });
  test('water cannot be dug', () => {
    expect(canApply(w0, flat, down(c(3, 20)))).toEqual({ ok: false, reason: 'the outer five columns of the map stay sea' });
    const w = applyEdit(w0, flat, down(c(20, 20)));
    expect(canApply(w, flat, down(c(20, 20)))).toEqual({ ok: false, reason: 'this is water already' });
  });
});

describe('level', () => {
  test('one edit raises some columns and digs others, one step each', () => {
    const t = new TerrainBuilder(4).flat(1).rect(10, 10, 10, 10, 3).build();
    const w = applyEdit(w0, t, { type: 'land', up: [c(11, 10)], down: [c(10, 10)] });
    expect(h(w, t, 10, 10)).toBe(2);
    expect(h(w, t, 11, 10)).toBe(2);
  });
});

describe('brush', () => {
  test('a 3 × 3 brush is one edit; columns that cannot move are skipped', () => {
    const cols: number[] = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) cols.push(c(5 + dx, 20 + dz));
    const w = applyEdit(w0, flat, up(...cols));
    expect(h(w, flat, 5, 20)).toBe(2);
    expect(h(w, flat, 6, 21)).toBe(2);
    expect(h(w, flat, 4, 20)).toBe(1); // x = 4 is in the sea border: skipped
  });
});

describe('limits', () => {
  test('the outer five columns stay sea', () => {
    for (const [x, z] of [[4, 20], [43, 20], [20, 0], [20, 47]] as const) {
      expect(canApply(w0, flat, up(c(x, z)))).toEqual({ ok: false, reason: 'the outer five columns of the map stay sea' });
    }
    expect(canApply(w0, flat, up(c(5, 5))).ok).toBe(true);
    expect(canApply(w0, flat, up(c(42, 42))).ok).toBe(true);
  });
  test('a malformed edit is refused, never thrown', () => {
    expect(canApply(w0, flat, { type: 'land', up: [-1], down: [] }).ok).toBe(false);
    expect(canApply(w0, flat, { type: 'land', up: [5000], down: [] }).ok).toBe(false);
    expect(canApply(w0, flat, { type: 'land', up: [c(10, 10)], down: [c(10, 10)] }).ok).toBe(false);
    expect(canApply(w0, flat, { type: 'land', up: [], down: [] }).ok).toBe(false);
    expect(canApply(w0, flat, { type: 'land' } as unknown as Edit).ok).toBe(false);
  });
});

describe('carrying', () => {
  test('a stack rides its column up and down; seq, colour and style are kept', () => {
    let w = place(w0, 'house', 10, 1, 10);
    w = place(w, 'house', 10, 2, 10);
    w = place(w, 'tree', 11, 1, 10);
    w = applyEdit(w, flat, { type: 'placeFloor', cell: key(10, 3, 10), floor: 'garden' });
    const raised = applyEdit(w, flat, up(c(10, 10)));
    expect([...raised.blocks.keys()].sort()).toEqual([key(10, 2, 10), key(10, 3, 10), key(11, 1, 10)].sort());
    expect(raised.blocks.get(key(10, 2, 10))).toBe(w.blocks.get(key(10, 1, 10)));
    expect(raised.floors.get(key(10, 4, 10))).toBe('garden');
    expect(raised.nextSeq).toBe(w.nextSeq);
    const back = applyEdit(raised, flat, down(c(10, 10)));
    expect(back.blocks).toEqual(w.blocks);
    expect(back.floors).toEqual(w.floors);
    expect(back.terrainEdits).toBeUndefined();
  });
  test('an edge piece goes with the side it rests on and stays where the still side holds it', () => {
    let w = applyEdit(w0, flat, { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'E'), kind: 'fence' });
    w = applyEdit(w, flat, { type: 'placeBlock', cell: key(11, 1, 10), kind: 'house', color: 0, from: null });
    // The fence rests on (10, 10) only (its other side holds a house): it rides with column 10.
    const raised = applyEdit(w, flat, up(c(10, 10)));
    expect(raised.edges.has(edgeKey(10, 2, 10, 'E'))).toBe(true);
    // Raising the house's column leaves the fence on the still ground.
    const other = applyEdit(w, flat, up(c(11, 10)));
    expect(other.edges.has(edgeKey(10, 1, 10, 'E'))).toBe(true);
  });
  test('a bridge over a gap stays where it is when the ground under it is dug', () => {
    const t = new TerrainBuilder(4).flat(1).rect(10, 10, 10, 10, 3).rect(12, 10, 12, 10, 3).build();
    let w = place(w0, 'arch', 11, 3, 10, t); // spans the gap at x = 11 between two level-3 columns
    w = place(w, 'house', 11, 1, 10, t);
    const dug = applyEdit(w, t, down(c(11, 10)));
    expect(dug.blocks.has(key(11, 3, 10))).toBe(true); // the arch did not move
    expect(dug.blocks.has(key(11, 0, 10))).toBe(true); // the house rode the ground down into the water
  });
  test('refused: past the top of the world', () => {
    let w = w0;
    for (let y = 1; y < 32; y++) w = place(w, 'marble', 10, y, 10);
    expect(canApply(w, flat, up(c(10, 10)))).toEqual({ ok: false, reason: 'it would push something past the top of the world' });
  });
  test('refused: into something that is not moving', () => {
    const t = new TerrainBuilder(4).flat(1).rect(10, 10, 10, 10, 3).rect(12, 10, 12, 10, 3).build();
    let w = place(w0, 'arch', 11, 2, 10, t);
    w = applyEdit(w, t, { type: 'placeFloor', cell: key(11, 1, 10), floor: 'path' });
    expect(canApply(w, t, up(c(11, 10)))).toEqual({ ok: false, reason: 'something above is in the way' });
  });
  test('refused: a dock or bridge on the water is not lifted', () => {
    const w = applyEdit(w0, flat, { type: 'placeBlock', cell: key(6, 0, 3), kind: 'dock', color: 0, from: null });
    expect(canApply(w, flat, up(c(6, 3))).ok).toBe(false);
  });
  test('refused: a tree or a path would end up in the water', () => {
    const w = place(w0, 'tree', 20, 1, 20);
    expect(canApply(w, flat, down(c(20, 20)))).toEqual({ ok: false, reason: 'the tree there needs dry ground' });
    const p = applyEdit(w0, flat, { type: 'placeFloor', cell: key(20, 1, 20), floor: 'path' });
    expect(canApply(p, flat, down(c(20, 20)))).toEqual({ ok: false, reason: 'the path there needs dry ground' });
  });
  test('a house dug down to the water stands in it (it can be raised back)', () => {
    const w = place(w0, 'house', 20, 1, 20);
    const dug = applyEdit(w, flat, down(c(20, 20)));
    expect(dug.blocks.get(key(20, 0, 20))?.kind).toBe('house');
    const back = applyEdit(dug, flat, up(c(20, 20)));
    expect(back.blocks).toEqual(w.blocks);
  });
});

describe('the island a world stands on', () => {
  test('terrainOf lays the edits over the generated island; edits back to the start leave none', () => {
    const t = generateTerrain(7, 2);
    let col = -1;
    for (let i = 0; i < t.height.length && col < 0; i++) if (t.height[i] === 2) col = i;
    const w = applyEdit(emptyWorld(7, 2), t, up(col));
    expect(terrainOf(w).height[col]).toBe(3);
    expect(terrainOf(emptyWorld(7, 2)).height[col]).toBe(2);
    expect(applyEdit(w, t, down(col)).terrainEdits).toBeUndefined();
  });
  test('the terrain passed may be the generated one or a derived one', () => {
    const w = applyEdit(w0, flat, up(c(10, 10)));
    const derived = islandOf(w, flat);
    const w2 = applyEdit(w, derived, up(c(10, 10)));
    expect(h(w2, flat, 10, 10)).toBe(3);
    expect(islandOf(w2, derived)).toBe(islandOf(w2, flat));
  });
  test('unedited ground keeps the generator materials exactly', () => {
    const t = generateTerrain(11, 2);
    let col = -1;
    for (let i = 0; i < t.height.length && col < 0; i++) if (t.height[i] === 1 && i % 48 > 15 && i % 48 < 30) col = i;
    const w = applyEdit(emptyWorld(11, 2), t, up(col));
    const e = islandOf(w, t);
    const x0 = col % 48, z0 = (col / 48) | 0;
    for (let i = 0; i < t.height.length; i++) {
      const x = i % 48, z = (i / 48) | 0;
      if (Math.max(Math.abs(x - x0), Math.abs(z - z0)) > 2) expect(e.material[i]).toBe(t.material[i]);
    }
  });
});
