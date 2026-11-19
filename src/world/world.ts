// STUB (Stage 0). Owner: Logic (Stage 1). Final signatures, placeholder rules.
//
// The stub checks only bounds, occupancy and terrain collision. The Logic
// owner replaces the bodies with every placement rule in design section 7
// (walkable tops, docks on water, floors, edge pieces, colour, side effects
// of erase) without changing the signatures.

import { inBounds, columnIndex, keyX, keyY, keyZ, unedge, type CellKey } from '@/core/grid';
import { PALETTE_SIZE, placedInfo } from '@/core/kinds';
import { hash } from '@/core/rand';
import type { Block, Edit, EditResult, Terrain, World } from '@/core/world';

export type { Block, Edit, EditResult, Rot, World } from '@/core/world';

export function emptyWorld(seed: number): World {
  return { version: 1, seed, nextSeq: 1, blocks: new Map(), floors: new Map(), edges: new Map() };
}

function cellInGrid(cell: CellKey): boolean {
  return Number.isInteger(cell) && cell >= 0 && inBounds(keyX(cell), keyY(cell), keyZ(cell));
}

function insideTerrain(t: Terrain, cell: CellKey): boolean {
  return keyY(cell) < t.height[columnIndex(keyX(cell), keyZ(cell))]!;
}

const no = (reason: string): EditResult => ({ ok: false, reason });
const yes: EditResult = { ok: true };

/** Would this edit be legal? Never throws; an illegal edit comes back with a plain reason. */
export function canApply(w: World, t: Terrain, e: Edit): EditResult {
  switch (e.type) {
    case 'placeBlock':
      if (!cellInGrid(e.cell)) return no('outside the map');
      if (insideTerrain(t, e.cell)) return no('inside the ground');
      if (w.blocks.has(e.cell)) return no('something is already there');
      return yes;
    case 'placeFloor':
      if (!cellInGrid(e.cell)) return no('outside the map');
      if (insideTerrain(t, e.cell)) return no('inside the ground');
      return yes;
    case 'placeEdge': {
      const { cell } = unedge(e.edge);
      if (!cellInGrid(cell)) return no('outside the map');
      return yes;
    }
    case 'eraseBlock':
    case 'setKind':
    case 'setRot':
    case 'paint':
      return w.blocks.has(e.cell) ? yes : no('nothing there');
    case 'eraseFloor':
      return w.floors.has(e.cell) ? yes : no('nothing there');
    case 'eraseEdge':
      return w.edges.has(e.edge) ? yes : no('nothing there');
  }
}

/** Applies a legal edit and returns a new World; the input is untouched. Throws if canApply says no. */
export function applyEdit(w: World, t: Terrain, e: Edit): World {
  const verdict = canApply(w, t, e);
  if (!verdict.ok) throw new Error(`applyEdit(${e.type}): ${verdict.reason}`);
  switch (e.type) {
    case 'placeBlock': {
      const blocks = new Map(w.blocks);
      let color: number;
      if (e.color !== 'auto') color = e.color;
      else if (e.from !== null && w.blocks.has(e.from)) color = w.blocks.get(e.from)!.color;
      else color = placedInfo(e.kind).variedColor ? hash(w.seed, 'color', e.cell) % PALETTE_SIZE : 0;
      blocks.set(e.cell, { kind: e.kind, color, rot: e.rot ?? 0, seq: w.nextSeq });
      const floors = new Map(w.floors);
      if (!placedInfo(e.kind).keepsFloor) floors.delete(e.cell);
      return { ...w, blocks, floors, nextSeq: w.nextSeq + 1 };
    }
    case 'placeFloor': {
      const floors = new Map(w.floors);
      floors.set(e.cell, e.floor);
      return { ...w, floors };
    }
    case 'placeEdge': {
      const edges = new Map(w.edges);
      edges.set(e.edge, e.kind);
      return { ...w, edges };
    }
    case 'eraseBlock': {
      const blocks = new Map(w.blocks);
      blocks.delete(e.cell);
      return { ...w, blocks };
    }
    case 'eraseFloor': {
      const floors = new Map(w.floors);
      floors.delete(e.cell);
      return { ...w, floors };
    }
    case 'eraseEdge': {
      const edges = new Map(w.edges);
      edges.delete(e.edge);
      return { ...w, edges };
    }
    case 'setKind':
    case 'setRot':
    case 'paint': {
      const blocks = new Map(w.blocks);
      const old = blocks.get(e.cell)!;
      const next: Block =
        e.type === 'setKind' ? { ...old, kind: e.kind } : e.type === 'setRot' ? { ...old, rot: e.rot } : { ...old, color: e.color };
      blocks.set(e.cell, next);
      return { ...w, blocks };
    }
  }
}
