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
  /**
   * House style 1–6 (design section 7, "House style"); absent or 0 = Random,
   * the look rolled from the structure's seed. A structure takes the style of
   * its lowest-seq block. (Added 2026-11-19, docs/swarm/requests/house-styles.md.)
   */
  style?: number;
}

/** Everything that is saved. Immutable: applyEdit returns a new World. */
export interface World {
  version: 1;
  /** Terrain and all seeded chance. */
  seed: number;
  /**
   * Which island generator made the terrain from the seed: absent or 1 = the
   * first, 2 = the second (design section 6, "Terrain, second generation").
   * (Added 2026-11-19, docs/swarm/requests/terrain2.md.)
   */
  terrainGen?: 1 | 2;
  /**
   * Shaping the land (design section 6): the columns whose terrain height the
   * player changed, column index (x + z * 48) → height 0–10, laid over the
   * island the seed and generator make. Absent when the island is as
   * generated. (Added 2026-11-19, docs/swarm/requests/landshaping.md.)
   */
  terrainEdits?: ReadonlyMap<number, number>;
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
      /** House style 1–6; absent or 0 = Random. Stored only on a house. */
      style?: number;
    }
  | { type: 'placeFloor'; cell: CellKey; floor: FloorKind }
  | { type: 'placeEdge'; edge: EdgeKey; kind: EdgeKind }
  | { type: 'eraseBlock'; cell: CellKey }
  | { type: 'eraseFloor'; cell: CellKey }
  | { type: 'eraseEdge'; edge: EdgeKey }
  | { type: 'setKind'; cell: CellKey; kind: PlacedKind }
  | { type: 'setRot'; cell: CellKey; rot: Rot }
  | { type: 'paint'; cell: CellKey; color: number }
  /**
   * Shaping the land (added 2026-11-19, docs/swarm/requests/landshaping.md):
   * the columns (column index x + z * 48) in `up` rise one level and those in
   * `down` drop one, carrying what stands on them. Columns that cannot move
   * are skipped; the edit is refused only if none can.
   */
  | { type: 'land'; up: readonly number[]; down: readonly number[] };

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
