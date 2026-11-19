// The running town the generator builds into (design section 15a).
//
// Every edit goes through canApply against a world that is updated as the
// town grows, so the list growTown returns is exactly a sequence a player
// could have made. The world here is mutated in place (a copy per edit, as
// applyEdit makes, would cost too much for a few thousand edits); `mutate`
// mirrors applyEdit's side effects for the edits the generator makes, and
// the tests replay every list through the real applyEdit to prove it.
//
// Beside the world it keeps a claim map over the 48 × 48 columns, so the
// districts do not build over each other and the street router knows where
// it may go.

import {
  below,
  columnIndex,
  edgeCells,
  edgeOf,
  inBounds,
  inColumnBounds,
  key,
  keyX,
  keyY,
  keyZ,
  NO_CELL,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  type CellKey,
  type Dir4,
  type EdgeKey,
} from '@/core/grid';
import { KINDS, PALETTE_SIZE, placedInfo, type EdgeKind, type FloorKind, type PlacedKind } from '@/core/kinds';
import { rand } from '@/core/rand';
import type { Block, Edit, Rot, Terrain, World } from '@/core/world';
import { bareGroundColor, canApply, emptyWorld, isSolid, stairsUpDirs } from '@/world/world';

/** What a column is used for. Bits, so a column can be several. */
export const CLAIM = {
  /** A street runs here. */
  street: 1,
  /** A building, piece or district ground stands here: streets go round. */
  built: 2,
  /** Kept clear on purpose (a garden, a yard, a margin a role depends on): no streets, no infill. */
  keep: 4,
  /** Streets may pass, but nothing else may be built here (an approach, a quay edge). */
  open: 8,
} as const;

/** One recorded edit, with the district that made it (for the watching order). */
export interface Made {
  edit: Edit;
  district: number;
  /** The level it happens at (for ordering bottom-up). */
  y: number;
  /** True for a floor lying on the terrain: laid with the district's ground, before its buildings. */
  ground: boolean;
}

interface MutableWorld extends World {
  blocks: Map<CellKey, Block>;
  floors: Map<CellKey, FloorKind>;
  edges: Map<EdgeKey, EdgeKind>;
}

export class Grower {
  readonly world: MutableWorld;
  readonly made: Made[] = [];
  /** CLAIM bits per column. */
  readonly claim = new Uint8Array(SIZE_X * SIZE_Z);
  /** The district that owns each column (0 = none). */
  readonly owner = new Int16Array(SIZE_X * SIZE_Z);
  /** The district whose street was laid on each column first (0 = none). */
  readonly streetOf = new Int16Array(SIZE_X * SIZE_Z);
  /** The district being built: every edit is recorded against it. */
  district = 0;
  /** How many edits were refused (the generator adapts; tests watch this stays small). */
  refused = 0;
  /** Goes up whenever a claim changes (the summed-area tables below are cached by it). */
  private claimVersion = 0;
  private sats = new Map<number, { version: number; table: Int32Array }>();
  /** Summed-area tables of terrain height and its square, for O(1) flatness questions. */
  readonly sumH: Float64Array;
  readonly sumH2: Float64Array;

  constructor(
    readonly terrain: Terrain,
    readonly seed: number,
  ) {
    const w = emptyWorld(terrain.seed);
    this.world = { ...w, blocks: new Map(), floors: new Map(), edges: new Map() };
    this.sumH = sat((x, z) => this.h(x, z), Float64Array);
    this.sumH2 = sat((x, z) => this.h(x, z) ** 2, Float64Array);
  }

  /** How many columns of the world rectangle (inclusive) are water, off the map, or claimed with any of `bits`. */
  blockedIn(x0: number, z0: number, x1: number, z1: number, bits: number, water = true): number {
    const all = (x1 - x0 + 1) * (z1 - z0 + 1);
    const cx0 = Math.max(0, x0), cz0 = Math.max(0, z0), cx1 = Math.min(SIZE_X - 1, x1), cz1 = Math.min(SIZE_Z - 1, z1);
    if (cx0 > cx1 || cz0 > cz1) return water ? all : 0;
    const id = bits | (water ? 0x100 : 0);
    let cached = this.sats.get(id);
    if (!cached || cached.version !== this.claimVersion) {
      const blocked = (x: number, z: number): number => ((water && this.h(x, z) === 0) || (this.claim[columnIndex(x, z)]! & bits) !== 0 ? 1 : 0);
      cached = { version: this.claimVersion, table: sat(blocked, Int32Array) };
      this.sats.set(id, cached);
    }
    const inside = (cx1 - cx0 + 1) * (cz1 - cz0 + 1);
    return (water ? all - inside : 0) + query(cached.table, cx0, cz0, cx1, cz1);
  }
  /** The one terrain height of the world rectangle, or −1 if it is not flat land (or leaves the map). */
  flatIn(x0: number, z0: number, x1: number, z1: number): number {
    if (x0 < 0 || z0 < 0 || x1 >= SIZE_X || z1 >= SIZE_Z) return -1;
    const n = (x1 - x0 + 1) * (z1 - z0 + 1);
    const s = query(this.sumH, x0, z0, x1, z1), s2 = query(this.sumH2, x0, z0, x1, z1);
    const h = this.h(x0, z0);
    return h > 0 && s === n * h && s2 === n * h * h ? h : -1;
  }

  // ── chance ──────────────────────────────────────────────────────────────

  rand(...parts: (number | string)[]): number {
    return rand(this.seed, 'townmaker', ...parts);
  }
  int(min: number, max: number, ...parts: (number | string)[]): number {
    return min + Math.floor(this.rand(...parts) * (max - min + 1));
  }
  chance(p: number, ...parts: (number | string)[]): boolean {
    return this.rand(...parts) < p;
  }

  // ── looking ─────────────────────────────────────────────────────────────

  /** Terrain height of a column; 0 (water) off the map. */
  h(x: number, z: number): number {
    return inColumnBounds(x, z) ? this.terrain.height[columnIndex(x, z)]! : 0;
  }
  inMap(x: number, z: number): boolean {
    return inColumnBounds(x, z);
  }
  /** The first level of a column with no block in it or above it. */
  top(x: number, z: number): number {
    const y = this.h(x, z);
    for (let level = SIZE_Y - 1; level >= y; level--) {
      if (this.world.blocks.has(key(x, level, z))) return level + 1;
    }
    return y;
  }
  block(x: number, y: number, z: number): Block | undefined {
    return inBounds(x, y, z) ? this.world.blocks.get(key(x, y, z)) : undefined;
  }
  /** Something stands on the terrain top of this column (a block in its ground cell). */
  groundTaken(x: number, z: number): boolean {
    return this.world.blocks.has(key(x, this.h(x, z), z));
  }
  claimed(x: number, z: number, bits: number): boolean {
    return inColumnBounds(x, z) && (this.claim[columnIndex(x, z)]! & bits) !== 0;
  }
  free(x: number, z: number): boolean {
    return inColumnBounds(x, z) && this.claim[columnIndex(x, z)] === 0;
  }
  mark(x: number, z: number, bits: number): void {
    if (!inColumnBounds(x, z)) return;
    const i = columnIndex(x, z);
    if ((this.claim[i]! | bits) !== this.claim[i]) this.claimVersion++;
    this.claim[i] = this.claim[i]! | bits;
    if (this.owner[i] === 0 && bits !== CLAIM.street) this.owner[i] = this.district;
    if (this.streetOf[i] === 0 && (bits & CLAIM.street) !== 0) this.streetOf[i] = this.district;
  }

  // ── making ──────────────────────────────────────────────────────────────

  /** Tries one edit; records it and returns true when it is legal. */
  edit(e: Edit): boolean {
    if (!canApply(this.world, this.terrain, e).ok) {
      this.refused++;
      return false;
    }
    this.mutate(e);
    let y = 0;
    let ground = false;
    if (e.type === 'placeBlock' || e.type === 'placeFloor') {
      y = keyY(e.cell);
      if (e.type === 'placeFloor') {
        ground = y === this.h(keyX(e.cell), keyZ(e.cell));
      }
    } else if (e.type === 'placeEdge') y = keyY(edgeCells(e.edge)[0]);
    this.made.push({ edit: e, district: this.district, y, ground });
    return true;
  }

  /** Places a block at an exact cell with a set colour (or 'auto'). */
  put(kind: PlacedKind, x: number, y: number, z: number, color: number | 'auto' = 'auto', rot?: Rot): boolean {
    if (!inBounds(x, y, z)) return false;
    const cell = key(x, y, z);
    const under = y > 0 ? key(x, y - 1, z) : NO_CELL;
    const from = under !== NO_CELL && this.world.blocks.has(under) ? under : null;
    return this.edit({ type: 'placeBlock', cell, kind, color, from, rot });
  }
  /** `floors` blocks of one kind and colour on top of the column. Returns how many went down. */
  stack(kind: PlacedKind, x: number, z: number, floors: number, color: number | 'auto' = 'auto'): number {
    let n = 0;
    const base = this.top(x, z);
    for (let f = 0; f < floors; f++) if (this.put(kind, x, base + f, z, color)) n++;
    return n;
  }
  /** A floor on the walkable top of a column (or in the cell of a floor-keeping piece standing there). */
  floor(kind: FloorKind, x: number, z: number, y?: number): boolean {
    if (!inColumnBounds(x, z)) return false;
    let level = y ?? this.top(x, z);
    if (y === undefined && level > 0) {
      const b = this.world.blocks.get(key(x, level - 1, z));
      if (b && b.kind !== 'auto' && b.kind !== 'arch' && KINDS[b.kind].keepsFloor) level -= 1;
    }
    if (!inBounds(x, level, z)) return false;
    const cell = key(x, level, z);
    if (this.world.floors.get(cell) === kind) return true;
    return this.edit({ type: 'placeFloor', cell, floor: kind });
  }
  /** An edge piece on one side of the cell (x, y, z). */
  edgePiece(x: number, y: number, z: number, side: Dir4, kind: EdgeKind): boolean {
    if (!inBounds(x, y, z)) return false;
    const e = edgeOf(key(x, y, z), side);
    if (e === NO_CELL) return false;
    if (this.world.edges.get(e) === kind) return true;
    return this.edit({ type: 'placeEdge', edge: e, kind });
  }
  /** Stairs on the walkable top of a column, climbing towards `dir`. */
  stairs(x: number, z: number, dir: Dir4): boolean {
    const y = this.top(x, z);
    if (!inBounds(x, y, z)) return false;
    if (!stairsUpDirs(this.world, this.terrain, key(x, y, z)).includes(dir)) return false;
    return this.put('stairs', x, y, z, 0, dir);
  }

  /** A palette index for a new house (or tower, marble) cell that differs from every house touching it. */
  colorFor(kind: PlacedKind, cells: readonly (readonly [number, number, number])[], salt: string | number): number {
    const avoid = new Set<number>();
    const mine = new Set(cells.map(([x, y, z]) => key(x, y, z)));
    for (const [x, y, z] of cells) {
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 0, 1],
        [0, 0, -1],
        [0, 1, 0],
        [0, -1, 0],
      ] as const) {
        if (!inBounds(x + dx, y + dy, z + dz)) continue;
        const k = key(x + dx, y + dy, z + dz);
        if (mine.has(k)) continue;
        const b = this.world.blocks.get(k);
        if (b && (b.kind === kind || (kind === 'house' && b.kind === 'auto') || (kind === 'auto' && b.kind === 'house'))) avoid.add(b.color);
      }
    }
    const start = Math.floor(this.rand('colour', salt) * PALETTE_SIZE);
    for (let i = 0; i < PALETTE_SIZE; i++) {
      const c = (start + i) % PALETTE_SIZE;
      if (!avoid.has(c)) return c;
    }
    return start;
  }

  // ── mirroring applyEdit ─────────────────────────────────────────────────

  private mutate(e: Edit): void {
    const w = this.world;
    const t = this.terrain;
    switch (e.type) {
      case 'placeBlock': {
        let color: number;
        if (e.color !== 'auto') color = e.color;
        else if (e.from !== null && w.blocks.has(e.from)) color = w.blocks.get(e.from)!.color;
        else color = bareGroundColor(w.seed, e.cell, e.kind);
        let rot: Rot = 0;
        if (e.kind === 'stairs') rot = e.rot ?? stairsUpDirs(w, t, e.cell)[0] ?? 0;
        w.blocks.set(e.cell, { kind: e.kind, color, rot, seq: w.nextSeq });
        (w as { nextSeq: number }).nextSeq = w.nextSeq + 1;
        const keeps = e.kind === 'arch' ? isSolid(w, t, below(e.cell)) : e.kind !== 'auto' && KINDS[e.kind].keepsFloor;
        if (w.floors.has(e.cell) && !keeps) w.floors.delete(e.cell);
        if (placedInfo(e.kind).solid) {
          for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
            const edge = edgeOf(e.cell, d);
            if (edge === NO_CELL || !w.edges.has(edge)) continue;
            const [a, b] = edgeCells(edge);
            if (isSolid(w, t, a) && isSolid(w, t, b)) w.edges.delete(edge);
          }
        }
        return;
      }
      case 'placeFloor':
        w.floors.set(e.cell, e.floor);
        return;
      case 'placeEdge':
        w.edges.set(e.edge, e.kind);
        return;
      default:
        throw new Error(`townmaker: the generator does not make '${e.type}' edits`);
    }
  }
}

const W1 = SIZE_X + 1;

/** A summed-area table: t[(z + 1) * 49 + (x + 1)] = sum of value over columns ≤ x, ≤ z. */
function sat<T extends Int32Array | Float64Array>(value: (x: number, z: number) => number, Type: new (n: number) => T): T {
  const t = new Type(W1 * (SIZE_Z + 1));
  for (let z = 0; z < SIZE_Z; z++) {
    let row = 0;
    for (let x = 0; x < SIZE_X; x++) {
      row += value(x, z);
      t[(z + 1) * W1 + x + 1] = t[z * W1 + x + 1]! + row;
    }
  }
  return t;
}
function query(t: Int32Array | Float64Array, x0: number, z0: number, x1: number, z1: number): number {
  return t[(z1 + 1) * W1 + x1 + 1]! - t[z0 * W1 + x1 + 1]! - t[(z1 + 1) * W1 + x0]! + t[z0 * W1 + x0]!;
}
