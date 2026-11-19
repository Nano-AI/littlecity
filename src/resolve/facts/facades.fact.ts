// Facades (design section 10, "Per structure"): one exposed side of one
// storey, and what it faces within 3 cells.

import { columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { EdgeKind, Kind, StructureKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import { FACTS } from '@/style/facts';
import { alleys } from './alleys.fact';
import { defineFact, type Facts } from './api';
import { contentKeys, regionKey, RegionMemo, registerMemo, saltKey } from './content-keys.fact';
import { DIRS, edgeBetween } from './lib';
import { BULKY, KIND_CODES, occupancy, SOLID, TERRAIN, type Occupancy } from './occupancy.fact';
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
function surfaceUnder(occ: Occupancy, cell: CellKey, out: { drop: number }): number {
  const y = cell >> 12;
  for (let c = cell; ; c -= 1 << 12) {
    const fl = occ.floor[c]!;
    if (fl) {
      out.drop = y - (c >> 12);
      return fl;
    }
    if (c >> 12 === 0) {
      out.drop = y;
      return 4; // at sea level and not in the ground: the sea
    }
    const below = occ.flags[c - (1 << 12)]!;
    if (below & SOLID) {
      out.drop = y - (c >> 12);
      return below & TERRAIN ? 5 : ROOF;
    }
  }
}

// A structure's facades, all but their alley flags, read the columns within
// facadeReach of it and straight down each of them: they are kept across
// resolves by the content of those columns (see content-keys.fact.ts). The
// alley flags come from the alleys fact every time.
const memo = registerMemo(new RegionMemo<Facade[]>());

export const facades = defineFact<Facades>('facades', (f) => {
  const list: Facade[] = [];
  const byStructure = new Map<StructureId, Facade[]>();
  const digests = new Map<StructureId, number>();
  const keys = contentKeys(f);
  const k = regionKey();
  memo.begin();
  let env: Env | null = null;
  const alleyCells = alleys(f).byCell;
  const ids = [...f.structures.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const s = f.structures.get(id)!;
    if (!FACADE_KINDS.has(s.kind) || !s.cells.length) continue;
    saltKey(keys.around(s.cells, FACTS.facadeReach, k), FACTS.facadeReach);
    let mine = memo.get(id, k);
    if (!mine) {
      mine = facadesOf(f, id, (env ??= envOf(f)));
      for (const fc of mine) fc.alley = alleyCells.has(neighbor(fc.cell, fc.dir));
      memo.put(id, k, mine);
    }
    // The alley flags, from the alleys fact: a remembered list whose flags differ is copied.
    let digest = 0x2f;
    for (let i = 0; i < mine.length; i++) {
      const fc = mine[i]!;
      const alley = alleyCells.has(neighbor(fc.cell, fc.dir));
      if (alley !== fc.alley) {
        mine = mine.map((x) => ({ ...x, alley: alleyCells.has(neighbor(x.cell, x.dir)) }));
        memo.put(id, k, mine);
      }
      if (alley) digest = (Math.imul(digest, 31) + i + 1) | 0;
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

interface Env {
  occ: Occupancy;
  sun: ReturnType<typeof sunnySide>;
}

function envOf(f: Facts): Env {
  return { occ: occupancy(f), sun: sunnySide(f) };
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
      if (out === NO_CELL || occ.flags[out]! & SOLID || occ.structure[out] === id) continue;
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
        alley: false, // set by the fact, from the alleys fact
        sunny: sun.isSunny(dir),
      };
      const outKind = occ.kind[out]!;
      if (outKind && !(occ.flags[out]! & BULKY)) fc.touching = KIND_CODES[outKind - 1];
      let c = cell;
      for (let k = 1; k <= reach; k++) {
        c = neighbor(c, dir);
        if (c === NO_CELL) break;
        const fl = occ.flags[c]!;
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
          const other = occ.structure[c]!;
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
