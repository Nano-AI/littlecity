// Facades (design section 10, "Per structure"): one exposed side of one
// storey, and what it faces within 3 cells.

import { columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { EdgeKind, Kind, StructureKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import { FACTS } from '@/style/facts';
import { defineFact, type Facts } from './api';
import { contentKeys, memosOn, regionKey, RegionMemo, registerMemo, saltKey } from './content-keys.fact';
import { DIRS, edgeBetween } from './lib';
import { KINDS } from '@/core/kinds';
import { BULKY, FLOOR_CODES, SOLID, TERRAIN } from './occupancy.fact';
import { sunnySide } from './sun.fact';

/** The kinds that have facades: the building kinds. */
export const FACADE_KINDS: ReadonlySet<StructureKind> = new Set(['house', 'tower', 'lighthouse', 'marble', 'windmill']);

/**
 * What a facade faces: 'street' (path), 'plaza', 'garden', 'water', 'cliff'
 * (terrain rising in front of it), 'structure' (another structure's block),
 * 'ground' (bare terrain top), or 'open' (nothing within reach: air over a
 * drop, or a roof below).
 */
export type Faced = 'street' | 'plaza' | 'garden' | 'water' | 'cliff' | 'structure' | 'ground' | 'open';

export interface Facade {
  structure: StructureId;
  kind: StructureKind;
  cell: CellKey;
  dir: Dir4;
  /** 1 = the structure's lowest level. */
  storey: number;
  /** The first thing met stepping straight out, within facadeReach (3) cells. */
  faces: Faced;
  /** Steps to it (1 = the cell right outside); 0 when 'open'. */
  dist: number;
  /** Steps to the first cell of each kind, if one is met before something blocks the view. */
  street?: number;
  plaza?: number;
  garden?: number;
  water?: number;
  cliff?: number;
  ground?: number;
  /** The structure faced across the gap, and the gap: the empty cells between (0 = touching). */
  other?: StructureId;
  gap?: number;
  /** Terrain rise above this facade's level where the cliff is met (cliff only). */
  cliffRise?: number;
  /** A non-solid piece (tree, fence, stall…) standing right outside. */
  touching?: Kind;
  /** An edge piece on this side of the cell. */
  edge?: EdgeKind;
  /** Levels from this storey's floor down to the surface right outside (0 = level with the ground). */
  drop: number;
  /** The cell right outside is part of an alley. */
  alley: boolean;
  sunny: boolean;
}

export interface Facades {
  /** Every facade, by structure id, then cell, then side. */
  list: readonly Facade[];
  byStructure: ReadonlyMap<StructureId, readonly Facade[]>;
  at(cell: CellKey, dir: Dir4): Facade | undefined;
  /**
   * A digest of which of a structure's facades look onto an alley. The one
   * part of a facade that can depend on cells far away (an alley run is
   * found from its first cell), for keys that cover a structure's
   * neighbourhood (RuleDef.localAlso).
   */
  alleyDigest(s: StructureId): number;
}

const SURFACE: readonly (Faced | null)[] = [null, 'street', 'plaza', 'garden', 'water', 'ground'];
const ROOF = 6;

/**
 * What lies at or below a free cell, as a code: 1–3 a floor (path, plaza,
 * garden), 4 the sea, 5 the terrain top, 6 the top of a solid block. The
 * levels down to it go in `drop`.
 */
function surfaceUnder(occ: Look, cell: CellKey, out: { drop: number }): number {
  const y = cell >> 12;
  for (let c = cell; ; c -= 1 << 12) {
    const fl = occ.floor(c);
    if (fl) {
      out.drop = y - (c >> 12);
      return fl;
    }
    if (c >> 12 === 0) {
      out.drop = y;
      return 4; // at sea level and not in the ground: the sea
    }
    const below = occ.flags(c - (1 << 12));
    if (below & SOLID) {
      out.drop = y - (c >> 12);
      return below & TERRAIN ? 5 : ROOF;
    }
  }
}

// A structure's facades, all but their alley flags, read the columns within
// facadeReach of it and straight down each of them: they are kept across
// resolves by the content of those columns (see content-keys.fact.ts). The
// alley flags are worked out the way alleys.fact.ts finds runs (from a run's
// first cell, which may lie far away) and kept by the columns that walk read.
const memo = registerMemo(new RegionMemo<Facade[]>());

/** A structure's alley flags (set on `list`), with the columns the corridor walks read and their key. */
interface AlleyEntry {
  list: Facade[];
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  a: number;
  b: number;
  digest: number;
}
/** Alley flags across resolves; the key is checked over the very columns that were read. */
class AlleyMemo {
  private cur = new Map<StructureId, AlleyEntry>();
  private prev = new Map<StructureId, AlleyEntry>();
  private prev2 = new Map<StructureId, AlleyEntry>();
  begin(): void {
    if (!memosOn()) return;
    this.prev2 = this.prev;
    this.prev = this.cur;
    this.cur = new Map();
  }
  /** The last entry for the structure, if any (the caller checks its key). */
  get(id: StructureId): AlleyEntry | undefined {
    if (!memosOn()) return undefined;
    const e = this.prev.get(id) ?? this.prev2.get(id);
    if (e) this.cur.set(id, e);
    return e;
  }
  put(id: StructureId, e: AlleyEntry): void {
    if (memosOn()) this.cur.set(id, e);
  }
  clear(): void {
    this.cur = new Map();
    this.prev = new Map();
    this.prev2 = new Map();
  }
}
const alleyMemo = registerMemo(new AlleyMemo());

export const facades = defineFact<Facades>('facades', (f) => {
  const list: Facade[] = [];
  const byStructure = new Map<StructureId, Facade[]>();
  const digests = new Map<StructureId, number>();
  const keys = contentKeys(f);
  const k = regionKey();
  const k2 = regionKey();
  memo.begin();
  alleyMemo.begin();
  let env: Env | null = null;
  const look = lookOf(f);
  const ids = [...f.structures.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const s = f.structures.get(id)!;
    if (!FACADE_KINDS.has(s.kind) || !s.cells.length) continue;
    saltKey(keys.around(s.cells, FACTS.facadeReach, k), FACTS.facadeReach);
    let mine = memo.get(id, k);
    if (!mine) {
      mine = facadesOf(f, id, (env ??= envOf(f, look)));
      memo.put(id, k, mine);
    }
    // The alley flags: kept while the columns the corridor walks read are unchanged.
    let digest = 0x2f;
    const kept = alleyMemo.get(id);
    if (kept && kept.list === mine && keys.region(kept.x0, kept.z0, kept.x1, kept.z1, k2) && saltKey(k2, FACTS.alleyMin).a === kept.a && k2.b === kept.b) {
      digest = kept.digest;
    } else {
      const box = { x0: 99, z0: 99, x1: -1, z1: -1 };
      const flags = mine.map((fc) => inAlley(look, neighbor(fc.cell, fc.dir), box));
      if (flags.some((v, i) => v !== mine![i]!.alley)) {
        mine = mine.map((x, i) => ({ ...x, alley: flags[i]! }));
        memo.put(id, k, mine);
      }
      flags.forEach((v, i) => {
        if (v) digest = (Math.imul(digest, 31) + i + 1) | 0;
      });
      saltKey(keys.region(box.x0, box.z0, box.x1, box.z1, k2), FACTS.alleyMin);
      alleyMemo.put(id, { list: mine, ...box, a: k2.a, b: k2.b, digest });
    }
    digests.set(id, digest);
    if (!mine.length) continue;
    byStructure.set(id, mine);
    for (const fc of mine) list.push(fc);
  }
  let index: Map<number, Facade> | null = null;
  const at = (cell: CellKey, dir: Dir4): Facade | undefined => {
    if (!index) {
      index = new Map();
      for (const fc of list) index.set(fc.cell * 4 + fc.dir, fc);
    }
    return index.get(cell * 4 + dir);
  };
  return { list, byStructure, at, alleyDigest: (s) => digests.get(s) ?? 0 };
});

/**
 * The occupancy fact's questions, answered from the maps: a facade fact that
 * finds almost every structure remembered need not fill the dense arrays.
 */
interface Look {
  /** SOLID, TERRAIN and BULKY bits, as in occupancy. */
  flags(c: CellKey): number;
  kind(c: CellKey): Kind | undefined;
  /** FLOOR_CODES index (0 = none). */
  floor(c: CellKey): number;
  /** The block structure in the cell, or −1. */
  structure(c: CellKey): number;
}

function lookOf(f: Facts): Look {
  return {
    flags(c) {
      if (c < 0) return 0;
      // As occupancy fills them: the terrain first, then any block overwrites its cell.
      const k = f.kinds.get(c);
      if (k !== undefined) {
        const info = KINDS[k];
        return (info.solid ? SOLID : 0) | (info.solid || info.building ? BULKY : 0);
      }
      return c >> 12 < f.terrain.height[columnIndex(c & 63, (c >> 6) & 63)]! ? SOLID | TERRAIN : 0;
    },
    kind: (c) => f.kinds.get(c),
    floor(c) {
      const k = f.world.floors.get(c);
      return k === undefined ? 0 : FLOOR_CODES.indexOf(k);
    },
    structure: (c) => f.structureAt.get(c) ?? -1,
  };
}

/**
 * The cell is in an alley (alleys.fact.ts, exactly: a run of 2+ corridor
 * cells, found from its first cell, which must not hold a building).
 */
function inAlley(look: Look, c: CellKey, box: { x0: number; z0: number; x1: number; z1: number }): boolean {
  const wall = (n: CellKey): boolean => n !== NO_CELL && look.kind(n) !== undefined && (look.flags(n) & BULKY) !== 0;
  const standable = (n: CellKey): boolean => n !== NO_CELL && !(look.flags(n) & SOLID) && n >> 12 > 0 && (look.flags(n - (1 << 12)) & SOLID) !== 0;
  const along = (n: CellKey, axis: 'x' | 'z'): boolean => {
    if (n !== NO_CELL) {
      // Everything along() reads lies in this column and the four beside it.
      const x = n & 63, z = (n >> 6) & 63;
      if (x - 1 < box.x0) box.x0 = x - 1;
      if (x + 1 > box.x1) box.x1 = x + 1;
      if (z - 1 < box.z0) box.z0 = z - 1;
      if (z + 1 > box.z1) box.z1 = z + 1;
    }
    if (!standable(n)) return false;
    const [a, b, c1, c2] = axis === 'x' ? ([0, 2, 1, 3] as const) : ([1, 3, 0, 2] as const);
    if (!wall(neighbor(n, a)) || !wall(neighbor(n, b))) return false;
    return !wall(neighbor(n, c1)) || !wall(neighbor(n, c2));
  };
  for (const axis of ['x', 'z'] as const) {
    if (!along(c, axis)) continue;
    const fwd = axis === 'x' ? 1 : 2;
    const back = axis === 'x' ? 3 : 0;
    let start = c;
    for (let p = neighbor(start, back); along(p, axis); p = neighbor(p, back)) start = p;
    if (wall(start)) continue; // a run whose first cell holds a building is never found
    let n = 0;
    for (let p = start; p !== NO_CELL && along(p, axis) && n < FACTS.alleyMin; p = neighbor(p, fwd)) n++;
    if (n >= FACTS.alleyMin) return true;
  }
  return false;
}

interface Env {
  occ: Look;
  sun: ReturnType<typeof sunnySide>;
}

function envOf(f: Facts, look: Look): Env {
  return { occ: look, sun: sunnySide(f) };
}

function facadesOf(f: Facts, id: StructureId, env: Env): Facade[] {
  const { occ, sun } = env;
  const reach = FACTS.facadeReach;
  const under = { drop: 0 };
  const s = f.structures.get(id)!;
  let minY = 99;
  for (const c of s.cells) minY = Math.min(minY, keyY(c));
  const mine: Facade[] = [];
  for (const cell of s.cells) {
    for (const dir of DIRS) {
      const out = neighbor(cell, dir);
      if (out === NO_CELL || occ.flags(out) & SOLID || occ.structure(out) === id) continue;
      const fc: Facade = {
        structure: id,
        kind: s.kind,
        cell,
        dir,
        storey: keyY(cell) - minY + 1,
        faces: 'open',
        dist: 0,
        street: undefined,
        plaza: undefined,
        garden: undefined,
        water: undefined,
        cliff: undefined,
        ground: undefined,
        other: undefined,
        gap: undefined,
        cliffRise: undefined,
        touching: undefined,
        edge: edgeBetween(f, cell, dir),
        drop: 0,
        alley: false, // set by the fact
        sunny: sun.isSunny(dir),
      };
      const outKind = occ.kind(out);
      if (outKind !== undefined && !(occ.flags(out) & BULKY)) fc.touching = outKind;
      let c = cell;
      for (let k = 1; k <= reach; k++) {
        c = neighbor(c, dir);
        if (c === NO_CELL) break;
        const fl = occ.flags(c);
        if (fl & TERRAIN) {
          if (fc.faces === 'open') {
            fc.faces = 'cliff';
            fc.dist = k;
          }
          fc.cliff = k;
          fc.cliffRise = f.terrain.height[columnIndex(keyX(c), keyZ(c))]! - keyY(cell);
          break;
        }
        if (fl & BULKY) {
          const other = occ.structure(c);
          if (other !== id) {
            if (fc.faces === 'open') {
              fc.faces = 'structure';
              fc.dist = k;
            }
            fc.other = other;
            fc.gap = k - 1;
          }
          break;
        }
        const what = surfaceUnder(occ, c, under);
        if (k === 1) fc.drop = under.drop;
        if (what === ROOF) continue;
        const name = SURFACE[what]!;
        if (fc.faces === 'open') {
          fc.faces = name;
          fc.dist = k;
        }
        if (what === 1) fc.street ??= k;
        else if (what === 2) fc.plaza ??= k;
        else if (what === 3) fc.garden ??= k;
        else if (what === 4) fc.water ??= k;
        else fc.ground ??= k;
      }
      mine.push(fc);
    }
  }
  return mine;
}
