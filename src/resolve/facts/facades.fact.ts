// Facades (design section 10, "Per structure"): one exposed side of one
// storey, and what it faces within 3 cells.

import { columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS, type EdgeKind, type Kind, type StructureKind } from '@/core/kinds';
import type { StructureId } from '../plan';
import { FACTS } from '@/style/facts';
import { alleys } from './alleys.fact';
import { defineFact, type Facts } from './api';
import { bulky, DIRS, edgeBetween, inTerrain } from './lib';
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
}

type Surface = 'street' | 'plaza' | 'garden' | 'water' | 'ground' | 'roof';

/** What lies at or below a free cell: the first floor, terrain top, block top or the sea. Also how far down. */
function surfaceUnder(f: Facts, cell: CellKey): { what: Surface; drop: number } {
  const y = keyY(cell);
  for (let c = cell; c !== NO_CELL; c = keyY(c) > 0 ? c - (1 << 12) : NO_CELL) {
    const fl = f.world.floors.get(c);
    if (fl) return { what: fl === 'path' ? 'street' : fl, drop: y - keyY(c) };
    const below = keyY(c) > 0 ? c - (1 << 12) : NO_CELL;
    if (below === NO_CELL) return { what: f.terrain.height[columnIndex(keyX(c), keyZ(c))]! > 0 ? 'ground' : 'water', drop: y };
    if (inTerrain(f, below)) return { what: 'ground', drop: y - keyY(c) };
    const k = f.kinds.get(below);
    if (k !== undefined && KINDS[k].solid) return { what: 'roof', drop: y - keyY(c) };
  }
  return { what: 'water', drop: y };
}

export const facades = defineFact<Facades>('facades', (f) => {
  const list: Facade[] = [];
  const byStructure = new Map<StructureId, Facade[]>();
  const index = new Map<number, Facade>();
  const sun = sunnySide(f);
  const reach = FACTS.facadeReach;
  const ids = [...f.structures.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const s = f.structures.get(id)!;
    if (!FACADE_KINDS.has(s.kind) || !s.cells.length) continue;
    let minY = 99;
    for (const c of s.cells) minY = Math.min(minY, keyY(c));
    const mine: Facade[] = [];
    for (const cell of s.cells) {
      for (const dir of DIRS) {
        const out = neighbor(cell, dir);
        if (out === NO_CELL || inTerrain(f, out)) continue;
        const ok = f.kinds.get(out);
        if (f.structureAt.get(out) === id || (ok !== undefined && KINDS[ok].solid)) continue;
        const fc: Facade = {
          structure: id,
          kind: s.kind,
          cell,
          dir,
          storey: keyY(cell) - minY + 1,
          faces: 'open',
          dist: 0,
          drop: 0,
          alley: false,
          sunny: sun.isSunny(dir),
        };
        if (ok !== undefined && !KINDS[ok].building) fc.touching = ok;
        const edge = edgeBetween(f, cell, dir);
        if (edge) fc.edge = edge;
        const note = (what: Faced, k: number): void => {
          if (fc.faces === 'open') {
            fc.faces = what;
            fc.dist = k;
          }
          if (what === 'street' || what === 'plaza' || what === 'garden' || what === 'water' || what === 'cliff' || what === 'ground') {
            fc[what] ??= k;
          }
        };
        let c = cell;
        for (let k = 1; k <= reach; k++) {
          c = neighbor(c, dir);
          if (c === NO_CELL) break;
          if (inTerrain(f, c)) {
            note('cliff', k);
            fc.cliffRise ??= f.terrain.height[columnIndex(keyX(c), keyZ(c))]! - keyY(cell);
            break;
          }
          if (bulky(f, c)) {
            const other = f.structureAt.get(c)!;
            if (other !== id) {
              note('structure', k);
              fc.other = other;
              fc.gap = k - 1;
            }
            break;
          }
          const under = surfaceUnder(f, c);
          if (k === 1) fc.drop = under.drop;
          if (under.what !== 'roof') note(under.what, k);
        }
        mine.push(fc);
        list.push(fc);
        index.set(cell * 4 + dir, fc);
      }
    }
    if (mine.length) byStructure.set(id, mine);
  }
  if (list.length) {
    const al = alleys(f);
    for (const fc of list) fc.alley = al.byCell.has(neighbor(fc.cell, fc.dir));
  }
  return { list, byStructure, at: (cell, dir) => index.get(cell * 4 + dir) };
});
