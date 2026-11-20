// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// The one table every kind-specific behaviour reads (design sections 5 to 7).

/** A resolved block kind. */
export type Kind =
  | 'house'
  | 'tower'
  | 'lighthouse'
  | 'arch'
  | 'dock' // Auto can become these five
  | 'marble'
  | 'pillar'
  | 'stairs'
  | 'windmill'
  | 'tree'
  | 'fountain'
  | 'stall'
  | 'fence'
  | 'wall';
/** What is stored in the save: a kind, or 'auto' ("decide for me"). */
export type PlacedKind = Kind | 'auto';
export type FloorKind = 'path' | 'plaza' | 'garden' | 'field';
export type EdgeKind = 'fence' | 'wall';
/**
 * What a Structure can be. Floor regions are structures of a FloorKind;
 * fence and wall runs (cell pieces and edge pieces together) are structures
 * of kind 'fence' or 'wall'.
 */
export type StructureKind = Kind | FloorKind;

export interface KindInfo {
  /** Can carry other blocks (design section 5, "Solid"). */
  solid: boolean;
  /** Counts as a building block for the Auto rules (section 5, "Building block"). */
  building: boolean;
  /** Auto can resolve to it; it is in the Change tool's cycle. */
  autoTarget: boolean;
  /**
   * How blocks of this kind merge into one structure (section 6 table):
   * 'vertical' = directly above/below; 'touching' = any shared face;
   * 'run' = the kind's own run rule (arch runs and tiers, stair flights,
   * fence and wall runs including edge pieces).
   */
  merge: 'none' | 'vertical' | 'touching' | 'run';
  /** Merging also needs equal colour. */
  mergeNeedsColor: boolean;
  /** May only be placed onto a walkable top (terrain top or the top of a solid block). */
  needsWalkableTop: boolean;
  /** May only be placed at y = 0 over open water. */
  waterOnly: boolean;
  /** A floor already in the cell stays when this is placed (arch: only if the cell below is solid). */
  keepsFloor: boolean;
  /** Placed on bare terrain or water it gets palette index hash(seed, cell) mod 8; otherwise index 0. */
  variedColor: boolean;
  /** Which palette ramp its colour index selects from (src/style/palette.ts). */
  ramp: 'wall' | 'stone' | 'wood' | 'none';
}

const base: KindInfo = {
  solid: false,
  building: false,
  autoTarget: false,
  merge: 'none',
  mergeNeedsColor: false,
  needsWalkableTop: false,
  waterOnly: false,
  keepsFloor: false,
  variedColor: false,
  ramp: 'none',
};

export const KINDS: Record<Kind, KindInfo> = {
  house: { ...base, solid: true, building: true, autoTarget: true, merge: 'touching', mergeNeedsColor: true, variedColor: true, ramp: 'wall' },
  tower: { ...base, solid: true, building: true, autoTarget: true, merge: 'vertical', mergeNeedsColor: true, variedColor: true, ramp: 'stone' },
  lighthouse: { ...base, solid: true, building: true, autoTarget: true, merge: 'vertical' },
  arch: { ...base, solid: true, autoTarget: true, merge: 'run', keepsFloor: true, ramp: 'stone' },
  dock: { ...base, solid: true, autoTarget: true, merge: 'touching', waterOnly: true, ramp: 'wood' },
  marble: { ...base, solid: true, building: true, merge: 'touching', mergeNeedsColor: true, ramp: 'stone' },
  pillar: { ...base, solid: true, merge: 'vertical', ramp: 'stone' },
  stairs: { ...base, merge: 'run', needsWalkableTop: true, ramp: 'stone' },
  windmill: { ...base, building: true, merge: 'vertical', needsWalkableTop: true },
  tree: { ...base, needsWalkableTop: true, keepsFloor: true },
  fountain: { ...base, needsWalkableTop: true, keepsFloor: true },
  stall: { ...base, needsWalkableTop: true, keepsFloor: true },
  fence: { ...base, merge: 'run', needsWalkableTop: true, keepsFloor: true },
  wall: { ...base, merge: 'run', needsWalkableTop: true, keepsFloor: true, ramp: 'stone' },
};

/** The same facts for an unresolved Auto block: solid, a building block, varied colour. */
export const AUTO_INFO: KindInfo = { ...base, solid: true, building: true, variedColor: true, ramp: 'wall' };

export function placedInfo(kind: PlacedKind): KindInfo {
  return kind === 'auto' ? AUTO_INFO : KINDS[kind];
}

export const ALL_KINDS = Object.keys(KINDS) as Kind[];
/** The kinds Auto can become, in Change-tool order (Auto → these → Auto). */
export const AUTO_KINDS: readonly Kind[] = ['house', 'tower', 'lighthouse', 'arch', 'dock'];
export const FLOOR_KINDS: readonly FloorKind[] = ['path', 'plaza', 'garden', 'field'];
export const EDGE_KINDS: readonly EdgeKind[] = ['fence', 'wall'];
/** Number of colours in every palette ramp; Block.color is 0 … PALETTE_SIZE − 1. */
export const PALETTE_SIZE = 8;

export function isFloorKind(k: StructureKind): k is FloorKind {
  return k === 'path' || k === 'plaza' || k === 'garden' || k === 'field';
}
