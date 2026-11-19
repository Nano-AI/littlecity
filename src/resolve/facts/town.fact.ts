// Town-wide facts (design section 10, "Town"): counts, the tallest
// structure, the highest walkable point, total street length. Rules that
// read these are town-wide (catalogue): a far edit may change them.
//
// Counts per role are rule output, so they live in `townRoles`, which only
// decoration, urban and life rules can read (it uses facts.shape).

import { columnIndex, key, keyY, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { isFloorKind, KINDS, type StructureKind } from '@/core/kinds';
import type { Role } from '@/core/vocab';
import type { StructureId } from '../plan';
import { defineFact } from './api';
import { standable } from './lib';

export interface TownFacts {
  /** Number of structures of each kind (floor regions and fence/wall runs included). */
  structuresByKind: ReadonlyMap<StructureKind, number>;
  /** Number of block cells of each resolved kind. */
  cellsByKind: ReadonlyMap<StructureKind, number>;
  /** Highest level any block occupies, or −1 in an empty town. */
  topLevel: number;
  /** Total blocks placed. */
  blocks: number;
  /** The block structure reaching highest (its top level; ties: lowest id), or null. */
  tallest: { id: StructureId; top: number } | null;
  /** Per block kind: the structure with the most storeys (ties: lowest id) and its storeys. */
  tallestByKind: ReadonlyMap<StructureKind, { id: StructureId; storeys: number }>;
  /** The highest cell a person can stand in (terrain tops and solid block tops; ties: lowest key), or null. */
  highestWalkable: CellKey | null;
  /** Path cells in town. */
  streetLength: number;
  /** Floor cells of each kind. */
  floorCells: ReadonlyMap<StructureKind, number>;
}

export const townFacts = defineFact<TownFacts>('townFacts', (f) => {
  const structuresByKind = new Map<StructureKind, number>();
  const cellsByKind = new Map<StructureKind, number>();
  const floorCells = new Map<StructureKind, number>();
  let topLevel = -1;
  for (const s of f.structures.values()) structuresByKind.set(s.kind, (structuresByKind.get(s.kind) ?? 0) + 1);
  for (const [cell, kind] of f.kinds) {
    cellsByKind.set(kind, (cellsByKind.get(kind) ?? 0) + 1);
    topLevel = Math.max(topLevel, keyY(cell));
  }
  for (const k of f.world.floors.values()) floorCells.set(k, (floorCells.get(k) ?? 0) + 1);

  let tallest: { id: StructureId; top: number } | null = null;
  const tallestByKind = new Map<StructureKind, { id: StructureId; storeys: number }>();
  for (const id of [...f.structures.keys()].sort((a, b) => a - b)) {
    const s = f.structures.get(id)!;
    if (!s.cells.length || isFloorKind(s.kind)) continue;
    let lo = 99;
    let hi = -1;
    for (const c of s.cells) {
      lo = Math.min(lo, keyY(c));
      hi = Math.max(hi, keyY(c));
    }
    if (!tallest || hi + 1 > tallest.top) tallest = { id, top: hi + 1 };
    const best = tallestByKind.get(s.kind);
    if (!best || hi - lo + 1 > best.storeys) tallestByKind.set(s.kind, { id, storeys: hi - lo + 1 });
  }

  // Highest walkable point: terrain tops, and the cell above every solid block.
  let highestWalkable: CellKey | null = null;
  const better = (c: CellKey): void => {
    if (!standable(f, c)) return;
    if (highestWalkable === null || keyY(c) > keyY(highestWalkable) || (keyY(c) === keyY(highestWalkable) && c < highestWalkable)) highestWalkable = c;
  };
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const h = f.terrain.height[columnIndex(x, z)]!;
      if (h > 0) better(key(x, h, z));
    }
  }
  for (const [c, k] of f.kinds) if (KINDS[k].solid && keyY(c) < 31) better(c + (1 << 12));

  return {
    structuresByKind,
    cellsByKind,
    topLevel,
    blocks: f.kinds.size,
    tallest,
    tallestByKind,
    highestWalkable,
    streetLength: floorCells.get('path') ?? 0,
    floorCells,
  };
});

/** Structures per role. Reads the finished shape: decoration, urban and life rules only. */
export const townRoles = defineFact<ReadonlyMap<Role, number>>('townRoles', (f) => {
  const out = new Map<Role, number>();
  for (const { role } of f.shape.roles.values()) out.set(role, (out.get(role) ?? 0) + 1);
  return out;
});
