// The scenario builders (Stage 0, real; treat as frozen): a town in a few
// lines of code. Every method goes through canApply/applyEdit, so a scenario
// can only contain what a player could build; an illegal step throws with
// the scenario name, the step and the reason.

import {
  columnIndex,
  edgeKey,
  inColumnBounds,
  key,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  type CellKey,
  type EdgeKey,
} from '@/core/grid';
import { KINDS, type EdgeKind, type FloorKind, type PlacedKind } from '@/core/kinds';
import type { Edit, Rot, Terrain, World } from '@/core/world';
import { terrainFromHeights } from '@/terrain/terrain';
import { applyEdit, canApply } from '@/world/world';

/** Hand-made terrain for a scenario. Starts as open water everywhere. */
export class TerrainBuilder {
  readonly height = new Uint8Array(SIZE_X * SIZE_Z);
  constructor(readonly seed: number) {}

  /** Sets one column's height (0 = water, up to 6). */
  set(x: number, z: number, h: number): this {
    if (inColumnBounds(x, z)) this.height[columnIndex(x, z)] = Math.max(0, Math.min(6, Math.round(h)));
    return this;
  }
  /** Sets a rectangle of columns (inclusive corners) to a height. */
  rect(x0: number, z0: number, x1: number, z1: number, h: number): this {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, z, h);
    }
    return this;
  }
  /** Sets a disc of columns to a height. */
  disc(cx: number, cz: number, radius: number, h: number): this {
    for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (Math.hypot(x - cx, z - cz) <= radius) this.set(x, z, h);
      }
    }
    return this;
  }
  /** Open water over a rectangle. */
  water(x0: number, z0: number, x1: number, z1: number): this {
    return this.rect(x0, z0, x1, z1, 0);
  }
  /** The standard flat ground: height 1 on columns 4–43. */
  flat(h = 1): this {
    return this.rect(4, 4, SIZE_X - 5, SIZE_Z - 5, h);
  }
  build(): Terrain {
    return terrainFromHeights(this.seed, this.height);
  }
}

export interface BlockOptions {
  /** Palette index 0–7, or 'auto' (the default): the game's own colour rule. */
  color?: number | 'auto';
  rot?: Rot;
}
export interface StackOptions extends BlockOptions {
  /** How many blocks tall. Default 1. */
  floors?: number;
  /** Footprint in columns (x by z). Default 1 × 1. */
  w?: number;
  d?: number;
}

export class TownBuilder {
  world: World;

  constructor(
    world: World,
    readonly terrain: Terrain,
    private readonly scenarioName = 'scenario',
  ) {
    this.world = world;
  }

  // ── looking ────────────────────────────────────────────────────────────

  cell(x: number, y: number, z: number): CellKey {
    return key(x, y, z);
  }
  /** Terrain height of a column (0 = water). */
  ground(x: number, z: number): number {
    return inColumnBounds(x, z) ? this.terrain.height[columnIndex(x, z)]! : 0;
  }
  /** The first free level of a column: above the terrain and above every block in it. */
  onTerrain(x: number, z: number): number {
    let y = this.ground(x, z);
    for (let level = SIZE_Y - 1; level >= y; level--) {
      if (this.world.blocks.has(key(x, level, z))) {
        y = level + 1;
        break;
      }
    }
    return y;
  }

  /**
   * The level a floor laid on this column lies in: the first free level, or
   * the cell of a tree, fountain, stall, cell fence or cell wall standing on
   * top (a floor shares their cell). For a floor inside an arch's own cell
   * (a gateway), use edit({ type: 'placeFloor', ... }) with the exact cell.
   */
  floorLevel(x: number, z: number): number {
    const y = this.onTerrain(x, z);
    const top = y > 0 ? this.world.blocks.get(key(x, y - 1, z)) : undefined;
    if (top && top.kind !== 'auto' && top.kind !== 'arch' && KINDS[top.kind].keepsFloor) return y - 1;
    return y;
  }

  // ── blocks ─────────────────────────────────────────────────────────────

  /** Applies any edit. The other helpers are shorthands for this. */
  edit(e: Edit, what: string = e.type): this {
    const verdict = canApply(this.world, this.terrain, e);
    if (!verdict.ok) throw new Error(`scenario '${this.scenarioName}': ${what}: ${verdict.reason}`);
    this.world = applyEdit(this.world, this.terrain, e);
    return this;
  }

  /** One block at an exact cell. */
  block(kind: PlacedKind, x: number, y: number, z: number, opts: BlockOptions = {}): this {
    const below = y > 0 && this.world.blocks.has(key(x, y - 1, z)) ? key(x, y - 1, z) : null;
    return this.edit(
      { type: 'placeBlock', cell: key(x, y, z), kind, color: opts.color ?? 'auto', from: below, rot: opts.rot },
      `${kind} at (${x}, ${y}, ${z})`,
    );
  }
  /** One block on top of whatever is in the column. */
  put(kind: PlacedKind, x: number, z: number, opts: BlockOptions = {}): this {
    return this.block(kind, x, this.onTerrain(x, z), z, opts);
  }
  /** A stack of `floors` blocks on a `w` × `d` footprint whose north-west column is (x, z). */
  stack(kind: PlacedKind, x: number, z: number, opts: StackOptions = {}): this {
    const { floors = 1, w = 1, d = 1 } = opts;
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        // 'auto' colour: the first block follows the game's rule, the rest copy it, so the stack merges.
        const first = opts.color ?? 'auto';
        const base = this.onTerrain(x + dx, z + dz);
        for (let f = 0; f < floors; f++) {
          const color = first === 'auto' && (dx > 0 || dz > 0) ? this.colorAt(x, z) : first;
          this.block(kind, x + dx, base + f, z + dz, { color, rot: opts.rot });
        }
      }
    }
    return this;
  }
  /** A house: `floors` storeys on a `w` × `d` footprint, one colour, so it merges into one structure. */
  house(x: number, z: number, opts: StackOptions = {}): this {
    return this.stack('house', x, z, opts);
  }
  tower(x: number, z: number, opts: StackOptions = {}): this {
    return this.stack('tower', x, z, { floors: 3, ...opts });
  }
  /** Auto blocks: the game decides what they become. */
  auto(x: number, z: number, opts: StackOptions = {}): this {
    return this.stack('auto', x, z, opts);
  }
  /** Fills a rectangle of columns (inclusive corners) with `floors` blocks each. */
  fill(kind: PlacedKind, x0: number, z0: number, x1: number, z1: number, opts: Omit<StackOptions, 'w' | 'd'> = {}): this {
    const xa = Math.min(x0, x1), za = Math.min(z0, z1);
    return this.stack(kind, xa, za, { ...opts, w: Math.abs(x1 - x0) + 1, d: Math.abs(z1 - z0) + 1 });
  }

  private colorAt(x: number, z: number): number | 'auto' {
    for (let y = SIZE_Y - 1; y >= 0; y--) {
      const b = this.world.blocks.get(key(x, y, z));
      if (b) return b.color;
    }
    return 'auto';
  }

  // ── floors ─────────────────────────────────────────────────────────────

  /** A floor over a rectangle of columns (inclusive corners), on top of whatever is there. */
  floor(kind: FloorKind, x0: number, z0: number, x1 = x0, z1 = z0): this {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        this.edit({ type: 'placeFloor', cell: key(x, this.floorLevel(x, z), z), floor: kind }, `${kind} at (${x}, ${z})`);
      }
    }
    return this;
  }
  /**
   * A path. With four numbers: the rectangle between two corners (a line if
   * they share a row or column). With points: a walk through them, each leg
   * going along x first, then z.
   */
  path(x0: number, z0: number, x1?: number, z1?: number): this;
  path(...points: (readonly [number, number])[]): this;
  path(...args: (number | undefined | readonly [number, number])[]): this {
    if (typeof args[0] === 'number') {
      const [x0, z0, x1, z1] = args as [number, number, number | undefined, number | undefined];
      return this.floor('path', x0, z0, x1 ?? x0, z1 ?? z0);
    }
    const points = args as (readonly [number, number])[];
    const done = new Set<number>();
    const lay = (x: number, z: number): void => {
      if (done.has(x + z * 64)) return;
      done.add(x + z * 64);
      this.floor('path', x, z);
    };
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i]!;
      if (i === 0) {
        lay(x, z);
        continue;
      }
      let [px, pz] = points[i - 1]!;
      while (px !== x) lay((px += Math.sign(x - px)), pz);
      while (pz !== z) lay(px, (pz += Math.sign(z - pz)));
    }
    return this;
  }
  plaza(x0: number, z0: number, x1 = x0, z1 = z0): this {
    return this.floor('plaza', x0, z0, x1, z1);
  }
  garden(x0: number, z0: number, x1 = x0, z1 = z0): this {
    return this.floor('garden', x0, z0, x1, z1);
  }

  // ── edge pieces ────────────────────────────────────────────────────────

  /** The canonical edge key for a side of the cell on top of column (x, z). */
  edgeAt(x: number, z: number, side: 'N' | 'E' | 'S' | 'W', y = this.onTerrain(x, z)): EdgeKey {
    if (side === 'E') return edgeKey(x, y, z, 'E');
    if (side === 'S') return edgeKey(x, y, z, 'S');
    if (side === 'W') return edgeKey(x - 1, y, z, 'E');
    return edgeKey(x, y, z - 1, 'S');
  }
  /** A fence (or wall) on one side of the cell on top of column (x, z). */
  fenceEdge(x: number, z: number, side: 'N' | 'E' | 'S' | 'W', kind: EdgeKind = 'fence', y?: number): this {
    return this.edit({ type: 'placeEdge', edge: this.edgeAt(x, z, side, y), kind }, `${kind} edge ${side} of (${x}, ${z})`);
  }
  wallEdge(x: number, z: number, side: 'N' | 'E' | 'S' | 'W', y?: number): this {
    return this.fenceEdge(x, z, side, 'wall', y);
  }
  /** Edge pieces around the outside of a rectangle of columns (inclusive corners). */
  fenceAround(x0: number, z0: number, x1: number, z1: number, kind: EdgeKind = 'fence'): this {
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), za = Math.min(z0, z1), zb = Math.max(z0, z1);
    for (let x = xa; x <= xb; x++) this.fenceEdge(x, za, 'N', kind).fenceEdge(x, zb, 'S', kind);
    for (let z = za; z <= zb; z++) this.fenceEdge(xa, z, 'W', kind).fenceEdge(xb, z, 'E', kind);
    return this;
  }

  // ── changing ───────────────────────────────────────────────────────────

  erase(x: number, y: number, z: number): this {
    return this.edit({ type: 'eraseBlock', cell: key(x, y, z) }, `erase (${x}, ${y}, ${z})`);
  }
  eraseFloor(x: number, z: number, y = this.floorLevel(x, z)): this {
    return this.edit({ type: 'eraseFloor', cell: key(x, y, z) }, `erase floor (${x}, ${z})`);
  }
  setKind(x: number, y: number, z: number, kind: PlacedKind): this {
    return this.edit({ type: 'setKind', cell: key(x, y, z), kind }, `set kind (${x}, ${y}, ${z})`);
  }
  paint(x: number, y: number, z: number, color: number): this {
    return this.edit({ type: 'paint', cell: key(x, y, z), color }, `paint (${x}, ${y}, ${z})`);
  }
}
