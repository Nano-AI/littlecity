// Legal edits picked by seeded chance, for any town (Polish). The benchmark
// tools use `benchEdit` (one block on top of a column, as a player would
// place it); the incremental-resolve test uses `randomEdit` (any kind of
// edit). Both only return edits that canApply accepts.

import { edgeOf, key, keyX, keyY, keyZ, SIZE_X, SIZE_Y, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { ALL_KINDS, EDGE_KINDS, FLOOR_KINDS, type PlacedKind } from '@/core/kinds';
import { hash } from '@/core/rand';
import type { Edit, Rot, Terrain, World } from '@/core/world';
import { canApply, groundAt } from '@/world/world';

/** The level a block placed on top of column (x, z) would take. */
export function topOf(w: World, t: Terrain, x: number, z: number): number {
  for (let y = SIZE_Y - 1; y >= 0; y--) if (w.blocks.has(key(x, y, z))) return y + 1;
  return groundAt(t, x, z);
}

/** The columns holding blocks, grown by `margin`, clamped to the map. */
function townBox(w: World, margin: number): { x0: number; z0: number; x1: number; z1: number } {
  let x0 = SIZE_X,
    z0 = SIZE_Z,
    x1 = -1,
    z1 = -1;
  for (const c of w.blocks.keys()) {
    x0 = Math.min(x0, keyX(c));
    x1 = Math.max(x1, keyX(c));
    z0 = Math.min(z0, keyZ(c));
    z1 = Math.max(z1, keyZ(c));
  }
  if (x1 < 0) return { x0: 0, z0: 0, x1: SIZE_X - 1, z1: SIZE_Z - 1 };
  return { x0: Math.max(0, x0 - margin), z0: Math.max(0, z0 - margin), x1: Math.min(SIZE_X - 1, x1 + margin), z1: Math.min(SIZE_Z - 1, z1 + margin) };
}

/**
 * The i-th benchmark edit for a town: a `kind` block on top of some column
 * inside the town, chosen by seeded chance among the columns where that is
 * legal. Null if no column takes one.
 */
export function benchEdit(w: World, t: Terrain, i: number, kind: PlacedKind = 'auto'): Edit | null {
  const box = townBox(w, 0);
  for (let attempt = 0; attempt < 400; attempt++) {
    const x = box.x0 + (hash(77, 'bench-x', i, attempt) % (box.x1 - box.x0 + 1));
    const z = box.z0 + (hash(77, 'bench-z', i, attempt) % (box.z1 - box.z0 + 1));
    const y = topOf(w, t, x, z);
    if (y >= SIZE_Y) continue;
    const cell = key(x, y, z);
    const below = y > 0 && w.blocks.has(key(x, y - 1, z)) ? key(x, y - 1, z) : null;
    const e: Edit = { type: 'placeBlock', cell, kind, color: 'auto', from: below };
    if (canApply(w, t, e).ok) return e;
  }
  return null;
}

const BLOCK_WEIGHTS: readonly [PlacedKind, number][] = [
  ['auto', 6],
  ['house', 6],
  ...ALL_KINDS.filter((k) => k !== 'house').map((k) => [k, 1] as [PlacedKind, number]),
];

/**
 * Any legal edit near the town, by seeded chance (`seed`, `i`): placing,
 * erasing, changing, turning and painting blocks; laying and lifting floors
 * and edge pieces. Null if nothing legal was found in a few hundred tries.
 */
export function randomEdit(w: World, t: Terrain, seed: number, i: number): Edit | null {
  const box = townBox(w, 3);
  const r = (what: string, n: number, attempt: number): number => hash(seed, what, i, attempt) % n;
  const blocks = [...w.blocks.keys()];
  const floors = [...w.floors.keys()];
  const edges = [...w.edges.keys()];
  for (let attempt = 0; attempt < 400; attempt++) {
    const x = box.x0 + r('x', box.x1 - box.x0 + 1, attempt);
    const z = box.z0 + r('z', box.z1 - box.z0 + 1, attempt);
    const y = topOf(w, t, x, z);
    const top: CellKey = y < SIZE_Y ? key(x, y, z) : -1;
    const roll = r('type', 100, attempt);
    let e: Edit | null = null;
    if (roll < 40 && top >= 0) {
      let pick = r('kind', BLOCK_WEIGHTS.reduce((s, [, n]) => s + n, 0), attempt);
      let kind: PlacedKind = 'auto';
      for (const [k, n] of BLOCK_WEIGHTS) {
        if (pick < n) {
          kind = k;
          break;
        }
        pick -= n;
      }
      const below = y > 0 && w.blocks.has(key(x, y - 1, z)) ? key(x, y - 1, z) : null;
      const color = r('same', 3, attempt) === 0 ? r('color', 8, attempt) : 'auto';
      e = { type: 'placeBlock', cell: top, kind, color, from: below, rot: r('rot', 4, attempt) as Rot };
    } else if (roll < 55 && blocks.length) {
      const cell = blocks[r('pick', blocks.length, attempt)]!;
      // Mostly the top of a column, as a player would.
      e = { type: 'eraseBlock', cell: r('deep', 4, attempt) === 0 ? cell : key(keyX(cell), topOf(w, t, keyX(cell), keyZ(cell)) - 1, keyZ(cell)) };
    } else if (roll < 65 && top >= 0) {
      e = { type: 'placeFloor', cell: top, floor: FLOOR_KINDS[r('floor', FLOOR_KINDS.length, attempt)]! };
    } else if (roll < 70 && floors.length) {
      e = { type: 'eraseFloor', cell: floors[r('pick', floors.length, attempt)]! };
    } else if (roll < 80 && top >= 0) {
      const edge = edgeOf(top, r('dir', 4, attempt) as Dir4);
      if (edge >= 0) e = { type: 'placeEdge', edge, kind: EDGE_KINDS[r('edge', EDGE_KINDS.length, attempt)]! };
    } else if (roll < 84 && edges.length) {
      e = { type: 'eraseEdge', edge: edges[r('pick', edges.length, attempt)]! };
    } else if (roll < 92 && blocks.length) {
      const cell = blocks[r('pick', blocks.length, attempt)]!;
      e = { type: 'paint', cell, color: r('color', 8, attempt) };
    } else if (roll < 97 && blocks.length) {
      const cell = blocks[r('pick', blocks.length, attempt)]!;
      e = { type: 'setKind', cell, kind: BLOCK_WEIGHTS[r('kind', BLOCK_WEIGHTS.length, attempt)]![0] };
    } else if (blocks.length) {
      const cell = blocks[r('pick', blocks.length, attempt)]!;
      e = { type: 'setRot', cell, rot: r('rot', 4, attempt) as Rot };
    }
    if (e && (e.type !== 'eraseBlock' || keyY(e.cell) >= 0) && canApply(w, t, e).ok) return e;
  }
  return null;
}
