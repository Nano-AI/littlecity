// STUB (Stage 0). Owner: Logic (Stage 1). Final signature.
//
// Pass 3: group pieces into structures. The stub makes one structure per
// block, per floor cell and per edge piece. The Logic owner implements the
// merge table (design section 6, KINDS[kind].merge) for blocks, connected
// regions for floors, and runs for fences and walls (cell and edge pieces
// together), keeping the id rules documented on StructureId in ../plan.ts.

import type { CellKey, EdgeKey } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import { hash } from '@/core/rand';
import type { Terrain, World } from '@/core/world';
import { EDGE_ID_BASE, FLOOR_ID_BASE, type Structure, type StructureId } from './plan';

export interface StructureSet {
  structures: Map<StructureId, Structure>;
  structureAt: Map<CellKey, StructureId>;
  floorAt: Map<CellKey, StructureId>;
  edgeAt: Map<EdgeKey, StructureId>;
}

/** The personality seed of a structure. */
export function structureSeed(worldSeed: number, id: StructureId): number {
  return hash(worldSeed, 'structure', id);
}

export function buildStructures(w: World, _t: Terrain, kinds: ReadonlyMap<CellKey, Kind>): StructureSet {
  const structures = new Map<StructureId, Structure>();
  const structureAt = new Map<CellKey, StructureId>();
  const floorAt = new Map<CellKey, StructureId>();
  const edgeAt = new Map<EdgeKey, StructureId>();
  const add = (s: Omit<Structure, 'seed' | 'hash'>): void => {
    structures.set(s.id, { ...s, seed: structureSeed(w.seed, s.id), hash: 0 });
  };
  for (const cell of [...w.blocks.keys()].sort((a, b) => a - b)) {
    const block = w.blocks.get(cell)!;
    add({ id: block.seq, kind: kinds.get(cell)!, color: block.color, cells: [cell], edges: [] });
    structureAt.set(cell, block.seq);
  }
  for (const cell of [...w.floors.keys()].sort((a, b) => a - b)) {
    const id = FLOOR_ID_BASE + cell;
    add({ id, kind: w.floors.get(cell)!, color: 0, cells: [cell], edges: [] });
    floorAt.set(cell, id);
  }
  for (const edge of [...w.edges.keys()].sort((a, b) => a - b)) {
    const id = EDGE_ID_BASE + edge;
    add({ id, kind: w.edges.get(edge)!, color: 0, cells: [], edges: [edge] });
    edgeAt.set(edge, id);
  }
  return { structures, structureAt, floorAt, edgeAt };
}
