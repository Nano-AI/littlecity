// Pass 3: group pieces into structures (design sections 6 and 10). Owner: Logic.
//
// Blocks merge by their RESOLVED kind, per KINDS[kind].merge:
//   house, marble        touching (all six faces), same colour; a house also
//                        joins a same-colour house one level up or down in a
//                        side-adjacent column, when the higher one rests on
//                        terrain or on a solid block that is not a building
//                        (a step: they would touch if the ground were level)
//   dock                 touching
//   tower                directly above/below, same colour
//   lighthouse, pillar,  directly above/below
//   windmill
//   arch                 touching arches: the same run (side by side) or tier (stacked)
//   stairs               beside (same rot, side by side across the flight) or
//                        continuing the flight (same rot, one up and one forward)
//   fence, wall          runs: cell pieces side by side, edge pieces meeting at a
//                        corner, and an edge piece on a side of a cell piece
//   tree, fountain, stall  never merge
// Floors: connected cells of one floor kind, side by side at one level, or
// one level apart where both lie on terrain (a path up a terrace is one path;
// a playing field is the exception: it stays on one level, see R-G03).
//
// Ids (see StructureId in ./plan.ts): the lowest seq among member blocks, so
// growing a structure never re-rolls it and a split-off part takes the id of
// its own lowest seq; FLOOR_ID_BASE + lowest cell for floor regions;
// EDGE_ID_BASE + lowest edge for runs made only of edge pieces.

import {
  above,
  columnIndex,
  E,
  edgeCells,
  keyX,
  keyY,
  keyZ,
  neighbor,
  NO_CELL,
  S,
  turn,
  unedge,
  type CellKey,
  type Dir4,
  type EdgeKey,
} from '@/core/grid';
import { KINDS, type Kind, type StructureKind } from '@/core/kinds';
import { hash } from '@/core/rand';
import type { Terrain, World } from '@/core/world';
import { EDGE_ID_BASE, FLOOR_ID_BASE, type Structure, type StructureId } from './plan';

export interface StructureSet {
  structures: Map<StructureId, Structure>;
  structureAt: Map<CellKey, StructureId>;
  floorAt: Map<CellKey, StructureId>;
  edgeAt: Map<EdgeKey, StructureId>;
}

const seeds = new Map<number, number>();
let seedsFor = NaN;
/** The personality seed of a structure. */
export function structureSeed(worldSeed: number, id: StructureId): number {
  // Remembered per world seed: every resolve asks again for every structure.
  if (worldSeed !== seedsFor) {
    seeds.clear();
    seedsFor = worldSeed;
  }
  let s = seeds.get(id);
  if (s === undefined) {
    if (seeds.size > 1 << 16) seeds.clear();
    seeds.set(id, (s = hash(worldSeed, 'structure', id)));
  }
  return s;
}

const styles = new WeakMap<Structure, number>();

/**
 * A block structure's house style (design section 7, "House style"): the
 * style of its lowest-seq block, whose seq is the structure's id. 0 (Random)
 * when that block has none, and for floor regions and edge-only runs.
 */
export function structureStyle(w: World, s: Structure): number {
  let style = styles.get(s);
  if (style === undefined) {
    style = 0;
    for (const c of s.cells) {
      const b = w.blocks.get(c);
      if (b?.seq === s.id) {
        style = b.style ?? 0;
        break;
      }
    }
    styles.set(s, style);
  }
  return style;
}

class UnionFind {
  readonly parent: Int32Array;
  constructor(n: number) {
    this.parent = new Int32Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }
  find(i: number): number {
    let r = i;
    while (this.parent[r] !== r) r = this.parent[r]!;
    while (this.parent[i] !== r) {
      const next = this.parent[i]!;
      this.parent[i] = r;
      i = next;
    }
    return r;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

/** Should two blocks of the same resolved kind, `b` lying in direction `dir` from `a`, merge? */
function blocksMerge(w: World, kind: Kind, a: CellKey, b: CellKey, dir: Dir4 | 'up'): boolean {
  const info = KINDS[kind];
  const ba = w.blocks.get(a)!;
  const bb = w.blocks.get(b)!;
  if (info.mergeNeedsColor && ba.color !== bb.color) return false;
  switch (info.merge) {
    case 'none':
      return false;
    case 'touching':
      return true;
    case 'vertical':
      return dir === 'up';
    case 'run':
      if (kind === 'arch') return true;
      if (kind === 'fence' || kind === 'wall') return dir !== 'up';
      if (kind === 'stairs') {
        if (ba.rot !== bb.rot || dir === 'up') return false;
        // Side by side across the flight.
        return dir === turn(ba.rot, 1) || dir === turn(ba.rot, 3);
      }
      return false;
  }
}

/** Kinds whose blocks are buildings of their own: a house never joins another house through one. */
const BUILDINGS: ReadonlySet<Kind> = new Set<Kind>(['house', 'tower', 'lighthouse', 'windmill']);

/**
 * The cell under the higher half of a split-level house is a step it can
 * stand on: terrain, or a solid block that is not another building (marble,
 * an arch, a dock, a pillar are steps; a house or a tower is a building, and
 * the two do not join through it).
 */
function restsOnStep(w: World, t: Terrain, kinds: ReadonlyMap<CellKey, Kind>, cell: CellKey): boolean {
  if (keyY(cell) < t.height[columnIndex(keyX(cell), keyZ(cell))]!) return true;
  if (!w.blocks.has(cell)) return false;
  const k = kinds.get(cell);
  return k !== undefined && KINDS[k].solid && !BUILDINGS.has(k);
}

export function buildStructures(w: World, t: Terrain, kinds: ReadonlyMap<CellKey, Kind>): StructureSet {
  const structures = new Map<StructureId, Structure>();
  const structureAt = new Map<CellKey, StructureId>();
  const floorAt = new Map<CellKey, StructureId>();
  const edgeAt = new Map<EdgeKey, StructureId>();

  // ── blocks and edge pieces: one union-find over both ──
  const cells = [...w.blocks.keys()].sort((a, b) => a - b);
  const edges = [...w.edges.keys()].sort((a, b) => a - b);
  const index = new Map<CellKey, number>();
  cells.forEach((c, i) => index.set(c, i));
  const uf = new UnionFind(cells.length + edges.length);
  const tryMerge = (i: number, cell: CellKey, kind: Kind, n: CellKey, dir: Dir4 | 'up'): void => {
    if (n === NO_CELL || kinds.get(n) !== kind) return;
    if (blocksMerge(w, kind, cell, n, dir)) uf.union(i, index.get(n)!);
  };
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const kind = kinds.get(cell)!;
    if (KINDS[kind].merge === 'none') continue;
    tryMerge(i, cell, kind, neighbor(cell, E), E);
    tryMerge(i, cell, kind, neighbor(cell, S), S);
    tryMerge(i, cell, kind, above(cell), 'up');
    if (kind === 'house') {
      // A split-level house: the block beside this one, one level up, standing on the step.
      for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
        const side = neighbor(cell, d);
        if (side === NO_CELL) continue;
        const up = above(side);
        if (up === NO_CELL || kinds.get(up) !== 'house' || w.blocks.get(up)!.color !== w.blocks.get(cell)!.color) continue;
        if (!restsOnStep(w, t, kinds, side)) continue;
        uf.union(i, index.get(up)!);
      }
    }
    if (kind === 'stairs') {
      // Continuing the flight: one level up, one step forward, same rot.
      const rot = w.blocks.get(cell)!.rot;
      const fwd = neighbor(cell, rot);
      const next = fwd === NO_CELL ? NO_CELL : above(fwd);
      if (next !== NO_CELL && kinds.get(next) === 'stairs' && w.blocks.get(next)!.rot === rot) uf.union(i, index.get(next)!);
    }
  }
  // Edge pieces: with each other at shared corners, and with cell pieces of their kind on either side.
  const corners = new Map<number, number[]>();
  const cornerKey = (x: number, z: number, y: number, kind: string): number => ((y * 64 + z) * 64 + x) * 2 + (kind === 'wall' ? 1 : 0);
  for (let j = 0; j < edges.length; j++) {
    const e = edges[j]!;
    const kind = w.edges.get(e)!;
    const { cell, side } = unedge(e);
    const x = keyX(cell);
    const z = keyZ(cell);
    const y = keyY(cell);
    const ends = side === 'E' ? [[x + 1, z], [x + 1, z + 1]] : [[x, z + 1], [x + 1, z + 1]];
    for (const [cx, cz] of ends) {
      const k = cornerKey(cx!, cz!, y, kind);
      const list = corners.get(k);
      if (list) {
        uf.union(cells.length + j, cells.length + list[0]!);
        list.push(j);
      } else corners.set(k, [j]);
    }
    for (const c of edgeCells(e)) {
      if (c !== NO_CELL && kinds.get(c) === kind) uf.union(cells.length + j, index.get(c)!);
    }
  }
  // Collect components.
  const groups = new Map<number, { cells: CellKey[]; edges: EdgeKey[] }>();
  const groupOf = (root: number): { cells: CellKey[]; edges: EdgeKey[] } => {
    let g = groups.get(root);
    if (!g) groups.set(root, (g = { cells: [], edges: [] }));
    return g;
  };
  for (let i = 0; i < cells.length; i++) groupOf(uf.find(i)).cells.push(cells[i]!);
  for (let j = 0; j < edges.length; j++) groupOf(uf.find(cells.length + j)).edges.push(edges[j]!);
  for (const g of groups.values()) {
    let id: StructureId;
    let kind: StructureKind;
    let color = 0;
    if (g.cells.length) {
      let lowest = w.blocks.get(g.cells[0]!)!;
      for (const c of g.cells) {
        const b = w.blocks.get(c)!;
        if (b.seq < lowest.seq) lowest = b;
      }
      id = lowest.seq;
      color = lowest.color;
      kind = kinds.get(g.cells[0]!)!;
    } else {
      id = EDGE_ID_BASE + g.edges[0]!;
      kind = w.edges.get(g.edges[0]!)!;
    }
    structures.set(id, { id, kind, color, seed: structureSeed(w.seed, id), cells: g.cells, edges: g.edges, hash: 0 });
    for (const c of g.cells) structureAt.set(c, id);
    for (const e of g.edges) edgeAt.set(e, id);
  }

  // ── floors ──
  const fcells = [...w.floors.keys()].sort((a, b) => a - b);
  const findex = new Map<CellKey, number>();
  fcells.forEach((c, i) => findex.set(c, i));
  const fu = new UnionFind(fcells.length);
  const onTerrain = (c: CellKey): boolean => keyY(c) === t.height[columnIndex(keyX(c), keyZ(c))];
  for (let i = 0; i < fcells.length; i++) {
    const cell = fcells[i]!;
    const kind = w.floors.get(cell)!;
    for (const d of [E, S] as const) {
      const n = neighbor(cell, d);
      if (n === NO_CELL) continue;
      if (w.floors.get(n) === kind) fu.union(i, findex.get(n)!);
      // A playing field never climbs a step: each level is a field of its own (a court must be flat).
      if (!onTerrain(cell) || kind === 'field') continue;
      // One terrain level up or down: a path climbing a terrace.
      for (const dy of [1, -1]) {
        const y = keyY(n) + dy;
        if (y < 0 || y > 31) continue;
        const m = n + dy * (1 << 12);
        if (w.floors.get(m) === kind && onTerrain(m)) fu.union(i, findex.get(m)!);
      }
    }
  }
  const fgroups = new Map<number, CellKey[]>();
  for (let i = 0; i < fcells.length; i++) {
    const r = fu.find(i);
    const list = fgroups.get(r);
    if (list) list.push(fcells[i]!);
    else fgroups.set(r, [fcells[i]!]);
  }
  for (const list of fgroups.values()) {
    const id = FLOOR_ID_BASE + list[0]!;
    structures.set(id, { id, kind: w.floors.get(list[0]!)!, color: 0, seed: structureSeed(w.seed, id), cells: list, edges: [], hash: 0 });
    for (const c of list) floorAt.set(c, id);
  }
  return { structures, structureAt, floorAt, edgeAt };
}
