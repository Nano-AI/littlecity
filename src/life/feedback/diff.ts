// What one edit changed, read off the two towns (pure). The feedback system
// turns this into motion; nothing here knows about the stage.
//
// It is worked out from the saved worlds themselves, not from the
// `blockLanded` event, so floors, edge pieces, the Change tool, paint, undo
// and redo all get their answer too.

import { CELL_H, keyX, keyY, keyZ, unedge, type CellKey, type EdgeKey } from '@/core/grid';
import type { World } from '@/core/world';
import { FLOOR_ID_BASE, type ShapePlan, type Structure, type StructureId } from '@/resolve/plan';

export interface EditDiff {
  /** Cells that gained a block. */
  placed: CellKey[];
  /** Cells whose block is gone. */
  erased: CellKey[];
  /** Cells whose block changed its kind, colour or turn in place (Change tool, paint). */
  altered: CellKey[];
  floorsLaid: CellKey[];
  floorsLifted: CellKey[];
  edgesPlaced: EdgeKey[];
  edgesErased: EdgeKey[];
  /** Auto blocks that were there before and now resolve to another kind (F03). */
  morphed: CellKey[];
  /** How many saved things changed (0: nothing the player did). */
  count: number;
  /** The middle of it all, in world units; null when count is 0. */
  centre: [number, number, number] | null;
}

function diffMaps<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>, added: K[], removed: K[], changed: K[] | null, same: (x: V, y: V) => boolean): void {
  if (a === b) return;
  for (const [k, v] of b) {
    const old = a.get(k);
    if (old === undefined) added.push(k);
    else if (changed && !same(old, v)) changed.push(k);
  }
  for (const k of a.keys()) if (!b.has(k)) removed.push(k);
}

export function cellCentre(c: CellKey): [number, number, number] {
  return [keyX(c) + 0.5, (keyY(c) + 0.5) * CELL_H, keyZ(c) + 0.5];
}
export function edgeCentre(e: EdgeKey): [number, number, number] {
  const { cell, side } = unedge(e);
  return [keyX(cell) + (side === 'E' ? 1 : 0.5), keyY(cell) * CELL_H, keyZ(cell) + (side === 'S' ? 1 : 0.5)];
}

export function diffTowns(prev: ShapePlan, next: ShapePlan): EditDiff {
  const a: World = prev.world, b: World = next.world;
  const d: EditDiff = { placed: [], erased: [], altered: [], floorsLaid: [], floorsLifted: [], edgesPlaced: [], edgesErased: [], morphed: [], count: 0, centre: null };
  diffMaps(a.blocks, b.blocks, d.placed, d.erased, d.altered, (x, y) => x.kind === y.kind && x.color === y.color && x.rot === y.rot);
  // A floor or an edge piece that changes kind in place is a fresh one.
  diffMaps(a.floors, b.floors, d.floorsLaid, d.floorsLifted, d.floorsLaid, (x, y) => x === y);
  diffMaps(a.edges, b.edges, d.edgesPlaced, d.edgesErased, d.edgesPlaced, (x, y) => x === y);
  d.count = d.placed.length + d.erased.length + d.altered.length + d.floorsLaid.length + d.floorsLifted.length + d.edgesPlaced.length + d.edgesErased.length;
  if (d.count === 0) return d;
  if (prev.kinds !== next.kinds) {
    for (const [c, block] of b.blocks) {
      if (block.kind !== 'auto' || a.blocks.get(c)?.kind !== 'auto') continue;
      const was = prev.kinds.get(c);
      if (was !== undefined && was !== next.kinds.get(c)) d.morphed.push(c);
    }
  }
  let x = 0, y = 0, z = 0, n = 0;
  const add = (p: [number, number, number]): void => {
    x += p[0]; y += p[1]; z += p[2]; n++;
  };
  for (const c of d.placed) add(cellCentre(c));
  for (const c of d.erased) add(cellCentre(c));
  for (const c of d.altered) add(cellCentre(c));
  for (const c of d.floorsLaid) add(cellCentre(c));
  for (const c of d.floorsLifted) add(cellCentre(c));
  for (const e of d.edgesPlaced) add(edgeCentre(e));
  for (const e of d.edgesErased) add(edgeCentre(e));
  d.centre = [x / n, y / n, z / n];
  return d;
}

/** The middle of a structure's foot: where it stands, for rocking it. */
export function footOf(s: Structure): [number, number, number] {
  if (s.cells.length === 0) {
    let x = 0, y = 0, z = 0;
    for (const e of s.edges) {
      const p = edgeCentre(e);
      x += p[0]; y += p[1]; z += p[2];
    }
    const n = Math.max(1, s.edges.length);
    return [x / n, y / n, z / n];
  }
  let low = Infinity;
  for (const c of s.cells) low = Math.min(low, keyY(c));
  let x = 0, z = 0, n = 0;
  for (const c of s.cells) {
    if (keyY(c) !== low) continue;
    x += keyX(c) + 0.5;
    z += keyZ(c) + 0.5;
    n++;
  }
  return [x / n, low * CELL_H, z / n];
}

/** Structures of `next` that are new or drawn differently from `prev` (their hash changed). */
export function changedStructures(prev: ShapePlan, next: ShapePlan): Structure[] {
  const out: Structure[] = [];
  for (const s of next.structures.values()) {
    if (prev.structures.get(s.id)?.hash !== s.hash) out.push(s);
  }
  return out;
}

export const isFloorStructure = (id: StructureId): boolean => id >= FLOOR_ID_BASE && id < FLOOR_ID_BASE * 2;
