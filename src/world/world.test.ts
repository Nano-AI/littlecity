// Edits: one test per placement, colour and erase rule in design section 7.

import { describe, expect, test } from 'vitest';
import { E, edgeKey, key, N, S, W, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import type { Edit, Terrain, World } from '@/core/world';
import { flatTerrain, TerrainBuilder } from '@/scenario';
import { applyEdit, canApply, edgeIsValid, emptyWorld, nextChangeKind, stairsUpDirs } from './world';
import type { PlacedKind } from '@/core/kinds';

const flat = flatTerrain(4); // height 1 on columns 4–43, water around

/** Flat land at 1, a step to 2 at x ≥ 20, water at x ≤ 3. */
const stepped: Terrain = new TerrainBuilder(4).flat(1).rect(20, 4, 43, 43, 2).build();

function place(w: World, kind: PlacedKind, x: number, y: number, z: number, extra: Partial<Extract<Edit, { type: 'placeBlock' }>> = {}, t = flat): World {
  return applyEdit(w, t, { type: 'placeBlock', cell: key(x, y, z), kind, color: 'auto', from: null, ...extra });
}
function tryPlace(w: World, kind: PlacedKind, x: number, y: number, z: number, t = flat) {
  return canApply(w, t, { type: 'placeBlock', cell: key(x, y, z), kind, color: 'auto', from: null });
}
const w0 = emptyWorld(4);

describe('placing blocks', () => {
  test('applyEdit returns a new world; seq counts up; the input is untouched', () => {
    const w1 = place(w0, 'house', 10, 1, 10, { color: 3 });
    expect(w0.blocks.size).toBe(0);
    expect(w1.blocks.get(key(10, 1, 10))).toEqual({ kind: 'house', color: 3, rot: 0, seq: 1 });
    expect(place(w1, 'house', 11, 1, 10).blocks.get(key(11, 1, 10))!.seq).toBe(2);
    expect(w1.nextSeq).toBe(2);
  });

  test('the target must be inside the grid', () => {
    expect(tryPlace(w0, 'house', 10, 1, 10).ok).toBe(true);
    expect(canApply(w0, flat, { type: 'placeBlock', cell: -1, kind: 'house', color: 0, from: null })).toEqual({ ok: false, reason: 'outside the map' });
    expect(canApply(w0, flat, { type: 'placeBlock', cell: key(10, 31, 10) + (1 << 12), kind: 'house', color: 0, from: null }).ok).toBe(false);
    expect(canApply(w0, flat, { type: 'placeBlock', cell: 1.5, kind: 'house', color: 0, from: null }).ok).toBe(false);
  });

  test('the target must hold no block and not be inside the ground', () => {
    const w = place(w0, 'house', 10, 1, 10);
    expect(tryPlace(w, 'tower', 10, 1, 10)).toEqual({ ok: false, reason: 'something is already there' });
    expect(tryPlace(w, 'tower', 10, 0, 10)).toEqual({ ok: false, reason: 'inside the ground' });
  });

  test('cannot build directly on a non-solid block', () => {
    for (const under of ['tree', 'fountain', 'stall', 'fence', 'wall', 'stairs', 'windmill'] as const) {
      const w = place(w0, under, 10, 1, 10);
      for (const kind of ['house', 'auto', 'tree', 'marble', 'pillar'] as const) {
        expect(tryPlace(w, kind, 10, 2, 10).ok, `${kind} on ${under}`).toBe(false);
      }
    }
    // Solid blocks carry anything.
    const house = place(w0, 'house', 10, 1, 10);
    for (const kind of ['house', 'tree', 'fountain', 'windmill', 'stairs', 'pillar'] as const) expect(tryPlace(house, kind, 10, 2, 10).ok).toBe(true);
  });

  test('windmill on windmill is the one exception; nothing else goes on a windmill', () => {
    let w = place(w0, 'windmill', 10, 1, 10);
    expect(tryPlace(w, 'windmill', 10, 2, 10).ok).toBe(true);
    w = place(w, 'windmill', 10, 2, 10);
    expect(tryPlace(w, 'windmill', 10, 3, 10).ok).toBe(true);
    expect(tryPlace(w, 'tree', 10, 3, 10).ok).toBe(false);
    expect(tryPlace(w, 'house', 10, 3, 10).ok).toBe(false);
  });

  test('dock only at y = 0 over open water', () => {
    expect(tryPlace(w0, 'dock', 2, 0, 10).ok).toBe(true);
    expect(tryPlace(w0, 'dock', 10, 1, 10).ok).toBe(false); // on land
    const w = place(w0, 'dock', 2, 0, 10);
    expect(tryPlace(w, 'dock', 2, 1, 10).ok).toBe(false); // not at sea level
  });

  test('tree, fountain, stall, cell fence, cell wall, windmill base and stairs only onto a walkable top', () => {
    const house = place(w0, 'house', 10, 1, 10);
    for (const kind of ['tree', 'fountain', 'stall', 'fence', 'wall', 'windmill', 'stairs'] as const) {
      expect(tryPlace(w0, kind, 10, 1, 10).ok, `${kind} on terrain`).toBe(true);
      expect(tryPlace(house, kind, 10, 2, 10).ok, `${kind} on a house`).toBe(true);
      expect(tryPlace(w0, kind, 2, 0, 10).ok, `${kind} on water`).toBe(false);
      expect(tryPlace(house, kind, 11, 2, 10).ok, `${kind} hanging off a wall`).toBe(false);
    }
  });

  test('other blocks go on any face: hanging off a wall, or on the water', () => {
    const house = place(w0, 'house', 10, 1, 10);
    for (const kind of ['auto', 'house', 'tower', 'lighthouse', 'arch', 'marble', 'pillar'] as const) {
      expect(tryPlace(house, kind, 11, 2, 10).ok, kind).toBe(true);
      expect(tryPlace(w0, kind, 2, 0, 10).ok, kind).toBe(true);
    }
  });

  test('a floor stays under a tree, fountain, stall, cell fence, cell wall, or an arch standing on a solid top', () => {
    const withPath = applyEdit(w0, flat, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'path' });
    for (const kind of ['tree', 'fountain', 'stall', 'fence', 'wall', 'arch'] as const) {
      expect(place(withPath, kind, 10, 1, 10).floors.get(key(10, 1, 10)), kind).toBe('path');
    }
    for (const kind of ['house', 'auto', 'tower', 'marble', 'pillar', 'stairs', 'windmill', 'lighthouse'] as const) {
      expect(place(withPath, kind, 10, 1, 10).floors.has(key(10, 1, 10)), kind).toBe(false);
    }
  });

  test('stairs rot: from the edit, else towards the neighbour exactly one level higher', () => {
    expect(stairsUpDirs(w0, stepped, key(19, 1, 10))).toEqual([E]);
    expect(place(w0, 'stairs', 19, 1, 10, {}, stepped).blocks.get(key(19, 1, 10))!.rot).toBe(E);
    expect(place(w0, 'stairs', 19, 1, 10, { rot: W }, stepped).blocks.get(key(19, 1, 10))!.rot).toBe(W);
    // A house beside it with nothing on top is also one level higher.
    const w = place(w0, 'house', 10, 1, 9);
    expect(stairsUpDirs(w, flat, key(10, 1, 10))).toEqual([N]);
    expect(stairsUpDirs(place(w, 'house', 10, 2, 9), flat, key(10, 1, 10))).toEqual([]);
    expect(place(w0, 'stairs', 10, 1, 10).blocks.get(key(10, 1, 10))!.rot).toBe(0); // none: the UI's default
    expect(place(w0, 'house', 10, 1, 10, { rot: 2 }).blocks.get(key(10, 1, 10))!.rot).toBe(0); // only stairs keep rot
  });

  test('placing a solid block removes an edge piece only when both of its sides are then solid', () => {
    let w = applyEdit(w0, flat, { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'E'), kind: 'fence' });
    w = place(w, 'house', 10, 1, 10);
    expect(w.edges.size).toBe(1); // the east side is still open ground
    w = place(w, 'tree', 11, 1, 10);
    expect(w.edges.size).toBe(1); // a tree is not solid
    let v = applyEdit(w0, flat, { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'E'), kind: 'wall' });
    v = place(place(v, 'house', 10, 1, 10), 'marble', 11, 1, 10);
    expect(v.edges.size).toBe(0);
  });
});

describe('colour', () => {
  test('a chosen swatch colour is used as is', () => {
    expect(place(w0, 'marble', 10, 1, 10, { color: 5 }).blocks.get(key(10, 1, 10))!.color).toBe(5);
    expect(canApply(w0, flat, { type: 'placeBlock', cell: key(10, 1, 10), kind: 'house', color: 8, from: null }).ok).toBe(false);
  });

  test('auto colour copies the block it was placed on', () => {
    const w = place(w0, 'marble', 10, 1, 10, { color: 6 });
    expect(place(w, 'house', 11, 1, 10, { from: key(10, 1, 10) }).blocks.get(key(11, 1, 10))!.color).toBe(6);
    expect(place(w, 'tree', 10, 2, 10, { from: key(10, 1, 10) }).blocks.get(key(10, 2, 10))!.color).toBe(6);
  });

  test('on bare ground or water: hash(seed, cell) mod 8 for Auto, house and tower; 0 for every other kind', () => {
    for (const kind of ['auto', 'house', 'tower'] as const) {
      for (const [x, y] of [[10, 1], [2, 0]] as const) {
        expect(place(w0, kind, x, y, 10).blocks.get(key(x, y, 10))!.color).toBe(hash(4, key(x, y, 10)) % 8);
      }
    }
    const colours = new Set([10, 11, 12, 13, 14, 15, 16, 17].map((x) => place(w0, 'house', x, 1, 10).blocks.get(key(x, 1, 10))!.color));
    expect(colours.size).toBeGreaterThan(2);
    for (const kind of ['lighthouse', 'arch', 'marble', 'pillar', 'stairs', 'windmill', 'tree', 'fountain', 'stall', 'fence', 'wall'] as const) {
      expect(place(w0, kind, 10, 1, 10).blocks.get(key(10, 1, 10))!.color, kind).toBe(0);
    }
    expect(place(w0, 'dock', 2, 0, 10).blocks.get(key(2, 0, 10))!.color).toBe(0);
  });

  test('paint sets a block colour; only on a block, only palette colours', () => {
    const w = place(w0, 'house', 10, 1, 10, { color: 1 });
    expect(applyEdit(w, flat, { type: 'paint', cell: key(10, 1, 10), color: 7 }).blocks.get(key(10, 1, 10))!.color).toBe(7);
    expect(canApply(w, flat, { type: 'paint', cell: key(11, 1, 10), color: 7 }).ok).toBe(false);
    expect(canApply(w, flat, { type: 'paint', cell: key(10, 1, 10), color: -1 }).ok).toBe(false);
  });
});

describe('floors', () => {
  const floor = (w: World, x: number, y: number, z: number, t = flat) => canApply(w, t, { type: 'placeFloor', cell: key(x, y, z), floor: 'plaza' });

  test('only directly above a walkable top: terrain or a solid block', () => {
    expect(floor(w0, 10, 1, 10).ok).toBe(true);
    expect(floor(w0, 10, 2, 10).ok).toBe(false);
    expect(floor(w0, 10, 0, 10).ok).toBe(false); // in the ground
    const w = place(w0, 'house', 10, 1, 10);
    expect(floor(w, 10, 2, 10).ok).toBe(true); // a roof terrace
    expect(floor(place(w0, 'tree', 10, 1, 10), 10, 2, 10).ok).toBe(false); // a tree is not a walkable top
  });

  test('not on water', () => {
    expect(floor(w0, 2, 0, 10)).toEqual({ ok: false, reason: 'floors cannot go on water' });
    expect(floor(place(w0, 'dock', 2, 0, 10), 2, 1, 10).ok).toBe(true); // a dock deck is a walkable top
  });

  test('into an empty cell, or one holding a tree, fountain, stall, cell fence, cell wall or a standing arch', () => {
    for (const kind of ['tree', 'fountain', 'stall', 'fence', 'wall', 'arch'] as const) expect(floor(place(w0, kind, 10, 1, 10), 10, 1, 10).ok, kind).toBe(true);
    for (const kind of ['house', 'auto', 'marble', 'stairs', 'windmill', 'pillar'] as const) expect(floor(place(w0, kind, 10, 1, 10), 10, 1, 10).ok, kind).toBe(false);
  });

  test('a different floor kind replaces; the same kind is refused', () => {
    const w = applyEdit(w0, flat, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'path' });
    expect(applyEdit(w, flat, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'garden' }).floors.get(key(10, 1, 10))).toBe('garden');
    expect(canApply(w, flat, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'path' }).ok).toBe(false);
  });
});

describe('edge pieces', () => {
  const edge = (w: World, e: number, t = flat) => canApply(w, t, { type: 'placeEdge', edge: e, kind: 'fence' });

  test('valid where at least one side is on a walkable top and holds no solid block', () => {
    expect(edge(w0, edgeKey(10, 1, 10, 'E')).ok).toBe(true);
    expect(edge(w0, edgeKey(10, 2, 10, 'E')).ok).toBe(false); // in the air
    expect(edge(w0, edgeKey(3, 1, 10, 'E')).ok).toBe(true); // water on one side, land on the other
    expect(edge(w0, edgeKey(1, 0, 10, 'E')).ok).toBe(false); // water on both sides
    const both = place(place(w0, 'house', 10, 1, 10), 'house', 11, 1, 10);
    expect(edge(both, edgeKey(10, 1, 10, 'E')).ok).toBe(false); // solid on both sides
    expect(edge(both, edgeKey(10, 1, 10, 'S')).ok).toBe(true); // open on the south side
    expect(edge(both, edgeKey(10, 2, 10, 'E')).ok).toBe(true); // along a roof
    expect(edge(place(w0, 'tree', 10, 1, 10), edgeKey(10, 1, 10, 'E')).ok).toBe(true); // a tree is not solid
    expect(edge(w0, edgeKey(47, 1, 10, 'E')).ok).toBe(false); // the map's own edge
  });

  test('the edge between a terrace and its cliff foot', () => {
    expect(edge(w0, edgeKey(19, 1, 10, 'E'), stepped).ok).toBe(true);
    expect(edge(w0, edgeKey(19, 2, 10, 'E'), stepped).ok).toBe(true);
  });

  test('an edge kind replaces the other; the same kind is refused', () => {
    const w = applyEdit(w0, flat, { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'S'), kind: 'fence' });
    expect(edge(w, edgeKey(10, 1, 10, 'S')).ok).toBe(false);
    expect(applyEdit(w, flat, { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'S'), kind: 'wall' }).edges.get(edgeKey(10, 1, 10, 'S'))).toBe('wall');
  });
});

describe('erasing', () => {
  test('removes one block, floor or edge piece; terrain and empty cells cannot be erased', () => {
    let w = place(w0, 'house', 10, 1, 10);
    w = applyEdit(w, flat, { type: 'placeFloor', cell: key(11, 1, 10), floor: 'path' });
    w = applyEdit(w, flat, { type: 'placeEdge', edge: edgeKey(12, 1, 10, 'E'), kind: 'wall' });
    expect(canApply(w, flat, { type: 'eraseBlock', cell: key(10, 0, 10) }).ok).toBe(false);
    expect(canApply(w, flat, { type: 'eraseFloor', cell: key(12, 1, 10) }).ok).toBe(false);
    expect(() => applyEdit(w, flat, { type: 'eraseEdge', edge: edgeKey(13, 1, 10, 'E') })).toThrow(/nothing there/);
    w = applyEdit(w, flat, { type: 'eraseBlock', cell: key(10, 1, 10) });
    w = applyEdit(w, flat, { type: 'eraseFloor', cell: key(11, 1, 10) });
    w = applyEdit(w, flat, { type: 'eraseEdge', edge: edgeKey(12, 1, 10, 'E') });
    expect([w.blocks.size, w.floors.size, w.edges.size]).toEqual([0, 0, 0]);
  });

  test('blocks above are never removed', () => {
    let w = place(w0, 'house', 10, 1, 10);
    w = place(place(w, 'house', 10, 2, 10), 'tree', 10, 3, 10);
    w = applyEdit(w, flat, { type: 'eraseBlock', cell: key(10, 1, 10) });
    expect([...w.blocks.keys()].sort()).toEqual([key(10, 2, 10), key(10, 3, 10)].sort());
  });

  test('floors resting on the erased block go with it; a floor in its own cell stays', () => {
    let w = place(w0, 'house', 10, 1, 10);
    w = applyEdit(w, flat, { type: 'placeFloor', cell: key(10, 2, 10), floor: 'garden' });
    expect(applyEdit(w, flat, { type: 'eraseBlock', cell: key(10, 1, 10) }).floors.size).toBe(0);
    let g = applyEdit(w0, flat, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'path' });
    g = place(g, 'tree', 10, 1, 10);
    expect(applyEdit(g, flat, { type: 'eraseBlock', cell: key(10, 1, 10) }).floors.get(key(10, 1, 10))).toBe('path');
  });

  test('edge pieces resting on the erased top go, unless the other side still has a walkable top', () => {
    let w = place(place(w0, 'house', 10, 1, 10), 'house', 11, 1, 10);
    w = applyEdit(w, flat, { type: 'placeEdge', edge: edgeKey(10, 2, 10, 'E'), kind: 'fence' }); // between the two roofs
    w = applyEdit(w, flat, { type: 'placeEdge', edge: edgeKey(10, 2, 10, 'S'), kind: 'fence' }); // roof edge over the air
    const after = applyEdit(w, flat, { type: 'eraseBlock', cell: key(10, 1, 10) });
    expect(after.edges.has(edgeKey(10, 2, 10, 'E'))).toBe(true); // the other roof still holds it
    expect(after.edges.has(edgeKey(10, 2, 10, 'S'))).toBe(false);
    for (const e of after.edges.keys()) expect(edgeIsValid(after, flat, e)).toBe(true);
  });
});

describe('change tool, rot', () => {
  test('setKind steps Auto → House → Tower → Lighthouse → Arch → Dock (only if legal) → Auto', () => {
    let w = place(w0, 'auto', 10, 1, 10);
    const seen: (PlacedKind | null)[] = [];
    for (let i = 0; i < 6; i++) {
      const k = nextChangeKind(w, flat, key(10, 1, 10));
      seen.push(k);
      w = applyEdit(w, flat, { type: 'setKind', cell: key(10, 1, 10), kind: k! });
    }
    expect(seen).toEqual(['house', 'tower', 'lighthouse', 'arch', 'auto', 'house']);
    let d = place(w0, 'arch', 2, 0, 10);
    expect(nextChangeKind(d, flat, key(2, 0, 10))).toBe('dock');
    d = applyEdit(d, flat, { type: 'setKind', cell: key(2, 0, 10), kind: 'dock' });
    expect(nextChangeKind(d, flat, key(2, 0, 10))).toBe('auto');
  });

  test('setKind does nothing to other kinds, and refuses an illegal dock', () => {
    const w = place(place(w0, 'marble', 10, 1, 10), 'house', 11, 1, 10);
    expect(nextChangeKind(w, flat, key(10, 1, 10))).toBeNull();
    expect(canApply(w, flat, { type: 'setKind', cell: key(10, 1, 10), kind: 'house' }).ok).toBe(false);
    expect(canApply(w, flat, { type: 'setKind', cell: key(11, 1, 10), kind: 'dock' }).ok).toBe(false);
    expect(canApply(w, flat, { type: 'setKind', cell: key(11, 1, 10), kind: 'tree' }).ok).toBe(false);
  });

  test('an arch over a path changed to Auto drops the floor (Auto does not keep floors)', () => {
    let w = applyEdit(w0, flat, { type: 'placeFloor', cell: key(10, 1, 10), floor: 'path' });
    w = place(w, 'arch', 10, 1, 10);
    expect(applyEdit(w, flat, { type: 'setKind', cell: key(10, 1, 10), kind: 'auto' }).floors.size).toBe(0);
  });

  test('setRot turns stairs only', () => {
    const w = place(place(w0, 'stairs', 10, 1, 10), 'house', 12, 1, 10);
    expect(applyEdit(w, flat, { type: 'setRot', cell: key(10, 1, 10), rot: S }).blocks.get(key(10, 1, 10))!.rot).toBe(S);
    expect(canApply(w, flat, { type: 'setRot', cell: key(12, 1, 10), rot: S }).ok).toBe(false);
  });
});

describe('edits at bounds are refused (Review Focus 3)', () => {
  test('top level, the map border and malformed edits never throw', () => {
    // A 31-block stack reaches y = 31; nothing goes above it.
    let w = w0;
    for (let y = 1; y < 32; y++) w = place(w, 'house', 10, y, 10, { color: 0 });
    expect(w.blocks.size).toBe(31);
    expect(tryPlace(w, 'house', 10, 32, 10).ok).toBe(false);
    expect(canApply(w, flat, { type: 'placeFloor', cell: key(10, 31, 10) + (1 << 12), floor: 'path' }).ok).toBe(false);
    for (const [x, z] of [[0, 0], [47, 47], [0, 47]] as const) expect(tryPlace(w0, 'house', x, 0, z).ok).toBe(true);
    const bad: unknown[] = [
      null,
      {},
      { type: 'nope' },
      { type: 'placeBlock', cell: 'x', kind: 'house', color: 0, from: null },
      { type: 'placeBlock', cell: key(10, 1, 10), kind: 'castle', color: 0, from: null },
      { type: 'placeBlock', cell: key(10, 1, 10), kind: 'stairs', color: 0, from: null, rot: 7 },
      { type: 'placeEdge', edge: -5, kind: 'fence' },
      { type: 'placeEdge', edge: edgeKey(10, 1, 10, 'E'), kind: 'hedge' },
      { type: 'placeFloor', cell: key(10, 1, 10), floor: 'lawn' },
      { type: 'eraseEdge', edge: Number.NaN },
      { type: 'setKind', cell: 1 << 20, kind: 'house' },
    ];
    for (const e of bad) {
      const r = canApply(w, flat, e as Edit);
      expect(r.ok).toBe(false);
      expect(() => applyEdit(w, flat, e as Edit)).toThrow();
    }
  });

  test('every cell of a column edge can be tried without throwing', () => {
    let count = 0;
    for (let y = 0; y < 34; y++) {
      for (const x of [-1, 0, 47, 48]) {
        const cell: CellKey = x < 0 || x > 47 ? -1 : key(x, Math.min(y, 31), 0) + (y > 31 ? 1 << 12 : 0);
        const r = canApply(w0, flat, { type: 'placeBlock', cell, kind: 'pillar', color: 0, from: null });
        if (r.ok) count++;
      }
    }
    expect(count).toBeGreaterThan(0);
  });
});
