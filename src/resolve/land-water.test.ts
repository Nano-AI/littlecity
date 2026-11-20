// Shaping the land: the town reads the edited island. Water dug or filled by
// the player is sea, river or pond as the spec says, and the rules that care
// see it: Auto's lighthouse (K3) wants the sea, not a river or a pond; a river
// dug to a dock brings a barge (L41); the walking graph and the waterfront
// follow the new shore.

import { describe, expect, test } from 'vitest';
import { columnIndex, key } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import { MAT } from '@/core/world';
import { TerrainBuilder } from '@/scenario';
import { islandOf, MAT_POND } from '@/terrain/land';
import { MAT_RIVER } from '@/terrain/terrain2';
import { applyEdit, emptyWorld } from '@/world/world';
import { resolveDressing, resolveShape } from './index';

/** Land at 1 on columns 8–39, the sea all round. */
const isle: Terrain = new TerrainBuilder(9).rect(8, 8, 39, 39, 1).build();
const c = columnIndex;
const dig = (w: World, cols: number[]): World => applyEdit(w, isle, { type: 'land', up: [], down: cols } as Edit);
const rect = (x0: number, z0: number, x1: number, z1: number): number[] => {
  const out: number[] = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push(c(x, z));
  return out;
};
const autoStack = (w: World, x: number, z: number, n: number): World => {
  for (let y = 1; y <= n; y++) w = applyEdit(w, isle, { type: 'placeBlock', cell: key(x, y, z), kind: 'auto', color: 0, from: null });
  return w;
};

describe('water the player makes', () => {
  test('sea, river and pond', () => {
    let w = emptyWorld(9);
    w = dig(w, rect(8, 20, 9, 23)); // a notch in the coast: sea
    w = dig(w, rect(20, 8, 20, 18)); // a narrow channel from the sea: a river
    w = dig(w, rect(30, 30, 32, 32)); // a pool shut in: a pond
    const t = islandOf(w, isle);
    expect(t.material[c(8, 21)]).toBe(MAT.water);
    for (let z = 8; z <= 18; z++) expect(t.material[c(20, z)]).toBe(MAT_RIVER);
    expect(t.material[c(31, 31)]).toBe(MAT_POND);
    // Cut the pond through to the river: it joins the sea, so it is a pond no more.
    const joined = islandOf(dig(dig(w, rect(21, 18, 29, 18)), rect(29, 19, 29, 30)), isle);
    expect(joined.material[c(31, 31)]).not.toBe(MAT_POND);
  });

  test('a lighthouse wants the sea: a pond or a river beside an Auto stack makes a tower', () => {
    let w = autoStack(emptyWorld(9), 24, 24, 4);
    expect(resolveShape(w, isle).kinds.get(key(24, 1, 24))).toBe('tower');
    // A pond beside it: still a tower.
    w = dig(w, rect(25, 23, 27, 25));
    expect(resolveShape(w, isle).kinds.get(key(24, 1, 24))).toBe('tower');
    // A wide bay dug in from the sea to its foot: now it looks out over the sea.
    const bay = dig(w, [...rect(25, 22, 29, 26), ...rect(30, 21, 39, 27)]);
    expect(islandOf(bay, isle).material[c(26, 24)]).toBe(MAT.water);
    expect(resolveShape(bay, isle).kinds.get(key(24, 1, 24))).toBe('lighthouse');
  });

  test('a river dug to a dock brings a barge', () => {
    let w = emptyWorld(9);
    // A channel three wide from the south coast up to z = 14.
    w = dig(w, rect(22, 14, 24, 39));
    w = applyEdit(w, isle, { type: 'placeBlock', cell: key(22, 0, 15), kind: 'dock', color: 0, from: null });
    w = applyEdit(w, isle, { type: 'placeBlock', cell: key(22, 0, 16), kind: 'dock', color: 0, from: null });
    const t = islandOf(w, isle);
    expect(t.material[c(23, 20)]).toBe(MAT_RIVER);
    const shape = resolveShape(w, isle);
    const dressing = resolveDressing(shape);
    expect(dressing.actors.filter((a) => a.type === 'ship-call' && a.rule === 'L41.river-barge').length).toBe(1);
  });

  test('the walking graph follows the new ground', () => {
    let w = emptyWorld(9);
    w = applyEdit(w, isle, { type: 'placeFloor', cell: key(15, 1, 15), floor: 'path' });
    w = applyEdit(w, isle, { type: 'land', up: [c(15, 15)], down: [] });
    const nav = resolveDressing(resolveShape(w, isle)).nav;
    expect(nav.nodeAt.has(key(15, 2, 15))).toBe(true);
    expect(nav.nodeAt.has(key(15, 1, 15))).toBe(false);
  });
});
