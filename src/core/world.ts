// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// The saved world and the terrain, as plain data. The functions that work on
// them live with their owners: src/world/world.ts (canApply, applyEdit) and
// src/terrain/terrain.ts (generateTerrain, initialWorld). Both re-export
// these types, so `import type { World } from '@/world/world'` also works.

import type { CellKey, EdgeKey } from './grid';
import type { EdgeKind, FloorKind, PlacedKind } from './kinds';

export type Rot = 0 | 1 | 2 | 3;

export interface Block {
  kind: PlacedKind;
  /** Palette index 0–7. */
  color: number;
  /** Quarter turns; only stairs use it. */
  rot: Rot;
  /** Placement counter: unique, increasing, starts at 1. */
  seq: number;
}

/** Everything that is saved. Immutable: applyEdit returns a new World. */
export interface World {
  version: 1;
  /** Terrain and all seeded chance. */
  seed: number;
  nextSeq: number;
  blocks: ReadonlyMap<CellKey, Block>;
  /** Key = the cell the floor lies in (the cell above the walkable top). */
  floors: ReadonlyMap<CellKey, FloorKind>;
  edges: ReadonlyMap<EdgeKey, EdgeKind>;
}

export type Edit =
  | {
      type: 'placeBlock';
      cell: CellKey;
      kind: PlacedKind;
      /** 'auto' = copy the colour of the block at `from`, or the kind's bare-ground colour. */
      color: number | 'auto';
      /** The block whose face was clicked, or null for terrain or water. */
      from: CellKey | null;
      rot?: Rot;
    }
  | { type: 'placeFloor'; cell: CellKey; floor: FloorKind }
  | { type: 'placeEdge'; edge: EdgeKey; kind: EdgeKind }
  | { type: 'eraseBlock'; cell: CellKey }
  | { type: 'eraseFloor'; cell: CellKey }
  | { type: 'eraseEdge'; edge: EdgeKey }
  | { type: 'setKind'; cell: CellKey; kind: PlacedKind }
  | { type: 'setRot'; cell: CellKey; rot: Rot }
  | { type: 'paint'; cell: CellKey; color: number };

export type EditResult = { ok: true } | { ok: false; reason: string };

/** Top material of a terrain column. */
export const MAT = { water: 0, sand: 1, grass: 2, rock: 3 } as const;
export type TerrainMaterial = (typeof MAT)[keyof typeof MAT];

/** Generated from the seed; never saved, never edited. Arrays are indexed x + z * 48 (columnIndex). */
export interface Terrain {
  seed: number;
  /** Column height 0–6. 0 is open water; terrain fills cells y < height. */
  height: Uint8Array;
  /** A MAT value per column. */
  material: Uint8Array;
}
