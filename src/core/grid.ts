// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// The grid. A cell (x, y, z) has y up and occupies the world-space box
//   [x, x + 1] × [y * CELL_H, (y + 1) * CELL_H] × [z, z + 1].
// A terrain column of height h fills cells y < h, so its top is at h * CELL_H.

export const SIZE_X = 48;
export const SIZE_Z = 48;
export const SIZE_Y = 32;
/** World height of one cell (one storey). */
export const CELL_H = 0.8;
/** World y of the sea surface: partway up level 0, below a beach top (h = 1). */
export const SEA_Y = 0.5 * CELL_H;
/** Geometry is chunked by column in CHUNK × CHUNK squares. */
export const CHUNK = 16;

export interface Cell {
  x: number;
  y: number;
  z: number;
}

/** x | z << 6 | y << 12. Sorting keys ascending sorts by y, then z, then x. */
export type CellKey = number;
/** Returned by neighbour helpers when the neighbour is outside the grid. */
export const NO_CELL: CellKey = -1;

export function key(x: number, y: number, z: number): CellKey {
  return x | (z << 6) | (y << 12);
}
export function unkey(k: CellKey): Cell {
  return { x: k & 63, y: k >> 12, z: (k >> 6) & 63 };
}
export function keyX(k: CellKey): number {
  return k & 63;
}
export function keyY(k: CellKey): number {
  return k >> 12;
}
export function keyZ(k: CellKey): number {
  return (k >> 6) & 63;
}
export function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < SIZE_X && z >= 0 && z < SIZE_Z && y >= 0 && y < SIZE_Y;
}
export function inColumnBounds(x: number, z: number): boolean {
  return x >= 0 && x < SIZE_X && z >= 0 && z < SIZE_Z;
}
/** Index into per-column arrays (Terrain.height, Terrain.material). */
export function columnIndex(x: number, z: number): number {
  return x + z * SIZE_X;
}

/** 0 N (−z), 1 E (+x), 2 S (+z), 3 W (−x). Quarter turns clockwise seen from above. */
export type Dir4 = 0 | 1 | 2 | 3;
export const N: Dir4 = 0;
export const E: Dir4 = 1;
export const S: Dir4 = 2;
export const W: Dir4 = 3;
/** [dx, dz] per Dir4. */
export const DIR4: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const DIR4_NAMES = ['n', 'e', 's', 'w'] as const;
export function opposite(d: Dir4): Dir4 {
  return ((d + 2) & 3) as Dir4;
}
export function turn(d: Dir4, quarterTurns: number): Dir4 {
  return ((((d + quarterTurns) % 4) + 4) % 4) as Dir4;
}

/** The side neighbour of a cell at the same level, or NO_CELL outside the grid. */
export function neighbor(k: CellKey, d: Dir4): CellKey {
  const x = (k & 63) + DIR4[d]![0];
  const z = ((k >> 6) & 63) + DIR4[d]![1];
  if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) return NO_CELL;
  return key(x, k >> 12, z);
}
/** The cell above, or NO_CELL at the top of the grid. */
export function above(k: CellKey): CellKey {
  return k >> 12 >= SIZE_Y - 1 ? NO_CELL : k + (1 << 12);
}
/** The cell below, or NO_CELL at y = 0. */
export function below(k: CellKey): CellKey {
  return k >> 12 <= 0 ? NO_CELL : k - (1 << 12);
}

/**
 * An edge piece sits on the boundary between two columns at one level.
 * Canonical form: the cell on the west or north of the boundary, plus which
 * of its sides: EdgeKey = CellKey * 2 + (0 = its E side, 1 = its S side).
 */
export type EdgeKey = number;
export function edgeKey(x: number, y: number, z: number, side: 'E' | 'S'): EdgeKey {
  return key(x, y, z) * 2 + (side === 'S' ? 1 : 0);
}
export function unedge(e: EdgeKey): { cell: CellKey; side: 'E' | 'S' } {
  return { cell: e >> 1, side: e & 1 ? 'S' : 'E' };
}
/**
 * The canonical edge on side `d` of a cell (N and W sides belong to the
 * neighbour's S and E). NO_CELL if that would name a cell outside the grid.
 */
export function edgeOf(cell: CellKey, d: Dir4): EdgeKey {
  if (d === E) return cell * 2;
  if (d === S) return cell * 2 + 1;
  const n = neighbor(cell, d);
  if (n === NO_CELL) return NO_CELL;
  return d === W ? n * 2 : n * 2 + 1;
}
/** The two cells an edge separates: [west or north cell, east or south cell (NO_CELL if outside)]. */
export function edgeCells(e: EdgeKey): readonly [CellKey, CellKey] {
  const cell = e >> 1;
  return [cell, neighbor(cell, e & 1 ? S : E)];
}

/** World-space position of a cell's minimum corner. */
export function cellOrigin(k: CellKey): [number, number, number] {
  return [k & 63, (k >> 12) * CELL_H, (k >> 6) & 63];
}
/** World-space centre of a cell's floor (bottom face). */
export function cellFloorCenter(k: CellKey): [number, number, number] {
  return [(k & 63) + 0.5, (k >> 12) * CELL_H, ((k >> 6) & 63) + 0.5];
}

export interface Chunk {
  /** Chunk coordinates (column / CHUNK). */
  cx: number;
  cz: number;
  /** Inclusive column range. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
export const CHUNKS_X = Math.ceil(SIZE_X / CHUNK);
export const CHUNKS_Z = Math.ceil(SIZE_Z / CHUNK);
export function chunkOf(x: number, z: number): Chunk {
  return chunkAt(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
}
export function chunkAt(cx: number, cz: number): Chunk {
  return {
    cx,
    cz,
    x0: cx * CHUNK,
    z0: cz * CHUNK,
    x1: Math.min(SIZE_X, (cx + 1) * CHUNK) - 1,
    z1: Math.min(SIZE_Z, (cz + 1) * CHUNK) - 1,
  };
}
export function allChunks(): Chunk[] {
  const out: Chunk[] = [];
  for (let cz = 0; cz < CHUNKS_Z; cz++) for (let cx = 0; cx < CHUNKS_X; cx++) out.push(chunkAt(cx, cz));
  return out;
}
