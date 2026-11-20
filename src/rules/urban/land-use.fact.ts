// Land use: what each patch of bare ground inside the town IS. This is the
// heart of urban fill (catalogue part U): the game looks at an empty patch
// and knows what a real town would have there.
//
// It is a fact, not just the urban rules' own find(), for two reasons. The
// uses exclude each other (a cell is a front garden OR part of a pocket
// park, never both), so they are decided in one place, in this order:
//
//   front garden (U03)   the one grass cell between a main door and a street
//   orchard (U18)        the grass between trees planted on a grid (the
//                        orchards fact), before any field it stands in
//   bailey (U21)         a leftover shut in by a castle: two or more of its
//                        keep, gatehouse, curtain walls and turrets, one of
//                        them a keep or gatehouse
//   burgage plots (U14)  more than DRESSING.yardMax cells of grass shut in by
//                        placed fences or walls and the backs (no main door)
//                        of two or more houses in a row: one long garden per
//                        house (discovery round 1, UF-01)
//   field (U02)          6+ cells of grass shut in by placed fences or walls:
//                        a park if 3+ trees stand in it, a walled garden if
//                        walls alone enclose it, else a paddock
//   courtyard (D17)      a leftover of 4 to 16 cells, two or more across both
//                        ways, shut in by buildings alone (no fence, wall,
//                        floor, cliff, water or tree on its bounds): cobbles,
//                        and a tree or a well in the middle
//   back yard (U04)      a leftover of up to 6 cells that touches houses and
//                        no street or square
//   drying green (U17)   a leftover of more than DRESSING.yardMax and up to 20
//                        cells, unfenced, off every street, touching 3+ houses
//   pocket park (U01)    a leftover of 2 to DRESSING.parkMax cells that
//                        touches a street or a square
//   village green (U15) open grass (after all the above) holding a 3 × 3,
//                        looked across from opposite sides by a ring of 4+ houses,
//                        touching a street; see below
//
// And the decoration rules, which run BEFORE the urban rules, must know
// which ground is spoken for: wild grass (D24) does not grow in a front
// garden. `byCell` answers that.
//
// Each urban rule reads its own list from here and only dresses it.
//
// Reads the finished shape (door features), so it serves dressing-stage
// rules only.

import { keyY, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact } from '@/resolve/facts/api';
import { facades } from '@/resolve/facts/facades.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { wildGrass } from '@/resolve/facts/grass.fact';
import { leftovers } from '@/resolve/facts/leftovers.fact';
import { edgeBetween } from '@/resolve/facts/lib';
import type { StructureId } from '@/resolve/plan';
import { DRESSING } from '@/style/dressing';
import { heightAt, onGround } from '../decoration/lib';
import { orchards, type Orchard } from './orchards.fact';

/** U03: the one grass cell between a house's main door and a street. */
export interface FrontGarden {
  cell: CellKey;
  /** The way the door looks: from the house, across the garden, to the street. */
  dir: Dir4;
  house: StructureId;
  door: CellKey;
  /**
   * Whether a fence closes each flank. In the order of the street fence's frame: [−X, +X], which
   * are the sides (dir + 3) % 4 and (dir + 1) % 4 of the garden cell.
   */
  closed: readonly [boolean, boolean];
}

/** U02: grass shut in by placed fences or walls. */
export interface Field {
  kind: 'park' | 'walled-garden' | 'paddock';
  cells: readonly CellKey[];
  /** Trees standing in or against it. */
  trees: number;
}

/** U01, U04: a leftover patch (less any front gardens in it). */
export interface Patch {
  cells: readonly CellKey[];
  /** The houses it touches. */
  houses: readonly StructureId[];
}

/**
 * U14 (discovery round 1, UF-01): fenced land behind a row of houses, to be
 * split into one long garden per house.
 */
export interface Burgage {
  cells: readonly CellKey[];
  /** The way from the land to the row of houses. */
  dir: Dir4;
  /** The houses of the row, each with the coordinates along the row (x, or z) of its back wall's cells facing the land. */
  houses: readonly { id: StructureId; along: readonly number[] }[];
}

/** U18 (discovery round 1, RC-04): an orchard and the bare grass between its rows. */
export interface OrchardUse {
  orchard: Orchard;
  /** The bare grass cells of its box (no other use), ascending. */
  cells: readonly CellKey[];
}

/** U15 (discovery round 1, UF-02): the open grass a ring of houses looks across. */
export interface Green {
  /** Ascending. */
  cells: readonly CellKey[];
  /** The houses that look across it. */
  houses: readonly StructureId[];
}

export type LandUse =
  | { use: 'front-garden'; garden: FrontGarden }
  | { use: 'burgage'; burgage: Burgage }
  | { use: 'green'; green: Green }
  | { use: 'drying-green'; patch: Patch }
  | { use: 'orchard'; orchard: OrchardUse }
  | { use: 'bailey'; patch: Patch }
  | { use: 'field'; field: Field }
  | { use: 'courtyard'; patch: Patch }
  | { use: 'back-yard'; patch: Patch }
  | { use: 'pocket-park'; patch: Patch };

export interface LandUses {
  /** What a ground cell is used as; a cell with no entry is ordinary open ground. */
  byCell: ReadonlyMap<CellKey, LandUse>;
  frontGardens: readonly FrontGarden[];
  fields: readonly Field[];
  burgages: readonly Burgage[];
  courtyards: readonly Patch[];
  backYards: readonly Patch[];
  pocketParks: readonly Patch[];
  greens: readonly Green[];
  dryingGreens: readonly Patch[];
  orchards: readonly OrchardUse[];
  baileys: readonly Patch[];
}

/** U15: how far a house looks across a green, and the green's size and ring of houses. */
const GREEN_REACH = 8;
const GREEN_MIN = 9;
const GREEN_MAX = 100;
const GREEN_HOUSES = 4;

/** U21: the roles that make the ground they shut in a castle's bailey. */
const CASTLE_ROLES = new Set(['keep', 'gatehouse', 'curtain-wall', 'castle-turret']);

/** U17: a drying green is shut in by this many houses or more, and is at most DRYING_MAX cells. */
const DRYING_HOUSES = 3;
const DRYING_MAX = 20;

/** U14: the most cells a burgage patch may have (bigger fenced land is a field). */
const BURGAGE_MAX = 80;

/** D17: a courtyard is this many cells or more (and no more than COURT_MAX). */
const COURT_MIN = 4;
const COURT_MAX = 16;

/** At least two cells across both ways: a court, not a strip behind a row of houses. */
function wide(cells: readonly CellKey[]): boolean {
  const xs = new Set(cells.map((c) => c & 63)), zs = new Set(cells.map((c) => (c >> 6) & 63));
  return xs.size >= 2 && zs.size >= 2;
}

export const landUse = defineFact<LandUses>('landUse', (f) => {
  const byCell = new Map<CellKey, LandUse>();
  const grass = wildGrass(f);
  const shape = f.shape;

  // ── U03 front gardens ──
  const gardens: FrontGarden[] = [];
  for (const ft of shape.features) {
    if (ft.type !== 'door' || ft.cell === undefined || ft.dir === undefined) continue;
    if ((ft.params as { main?: number } | undefined)?.main !== 1) continue;
    if (f.kinds.get(ft.cell) !== 'house') continue;
    const dir = ft.dir as Dir4;
    const cell = neighbor(ft.cell, dir);
    if (cell === NO_CELL || !grass.has(cell) || keyY(cell) !== keyY(ft.cell)) continue;
    const street = neighbor(cell, dir);
    if (street === NO_CELL || f.world.floors.get(street) !== 'path' || !onGround(f, street)) continue;
    // A fence somebody placed already does the job.
    if (edgeBetween(f, cell, dir)) continue;
    if (byCell.has(cell)) continue;
    gardens.push({ cell, dir, house: ft.structure, door: ft.cell, closed: [false, false] });
    byCell.set(cell, { use: 'front-garden', garden: gardens[gardens.length - 1]! });
  }
  // A flank is fenced where the ground beside the garden is open and level: not against a wall,
  // not at a bank, not where a placed fence stands, and only once between two gardens side by side
  // (the garden to the west or north draws the fence they share).
  for (const g of gardens) {
    const flank = (d: Dir4): boolean => {
      const n = neighbor(g.cell, d);
      if (n === NO_CELL || edgeBetween(f, g.cell, d)) return false;
      if (f.kinds.has(n) || heightAt(f, n & 63, (n >> 6) & 63) !== keyY(g.cell)) return false;
      const other = byCell.get(n);
      if (other && other.use === 'front-garden' && other.garden.dir === g.dir) return d === 1 || d === 2;
      return true;
    };
    const minus = ((g.dir + 3) % 4) as Dir4, plus = ((g.dir + 1) % 4) as Dir4;
    (g as { closed: readonly [boolean, boolean] }).closed = [flank(minus), flank(plus)];
  }

  // ── U18 orchards: the grass between trees planted in rows ──
  const orchardUses: OrchardUse[] = [];
  for (const o of orchards(f).list) {
    const cells = o.cells.filter((c) => grass.has(c) && !byCell.has(c));
    if (!cells.length) continue;
    const use: OrchardUse = { orchard: o, cells };
    orchardUses.push(use);
    for (const c of cells) byCell.set(c, { use: 'orchard', orchard: use });
  }

  // ── leftovers: burgage plots, fields, back yards, pocket parks ──
  const mainDoors = new Set<string>();
  for (const ft of shape.features) {
    if (ft.type === 'door' && ft.cell !== undefined && ft.dir !== undefined && (ft.params as { main?: number } | undefined)?.main === 1) mainDoors.add(`${ft.cell}:${ft.dir}`);
  }
  const burgages: Burgage[] = [];
  const fields: Field[] = [];
  const courtyards: Patch[] = [];
  const backYards: Patch[] = [];
  const dryingGreens: Patch[] = [];
  const baileys: Patch[] = [];
  const pocketParks: Patch[] = [];
  for (const l of leftovers(f).list) {
    const cells = l.cells.filter((c) => !byCell.has(c));
    if (!cells.length) continue;
    const kinds = l.structures.map((id) => f.structures.get(id)?.kind);
    const trees = kinds.filter((k) => k === 'tree').length;
    const built = kinds.some((k) => k !== 'tree' && k !== 'fence' && k !== 'wall');
    const houses = l.structures.filter((id) => f.structures.get(id)?.kind === 'house');
    const fenced = l.bounds.has('fence') || l.bounds.has('wall');
    const open = l.bounds.has('floor') || l.bounds.has('cliff') || l.bounds.has('water');
    // U21: the ground inside a castle's walls is its bailey.
    const castleParts = l.structures.filter((id) => CASTLE_ROLES.has(shape.roles.get(id)?.role ?? '')).length;
    const castleBound = l.structures.some((id) => shape.roles.get(id)?.role === 'keep' || shape.roles.get(id)?.role === 'gatehouse');
    if (castleParts >= 2 && castleBound && !l.bounds.has('water') && cells.length >= 4 && cells.length === l.cells.length) {
      const patch: Patch = { cells, houses };
      baileys.push(patch);
      for (const c of cells) byCell.set(c, { use: 'bailey', patch });
      continue;
    }
    const burgage = fenced && !open && trees < DRESSING.parkTrees && cells.length > DRESSING.yardMax && cells.length <= BURGAGE_MAX && kinds.every((k) => k === 'house' || k === 'tree' || k === 'fence' || k === 'wall') ? burgageOf(cells) : null;
    if (burgage) {
      burgages.push(burgage);
      for (const c of cells) byCell.set(c, { use: 'burgage', burgage });
    } else if (fenced && !open && !built && cells.length >= DRESSING.fieldMin) {
      const kind = trees >= DRESSING.parkTrees ? 'park' : l.bounds.has('wall') && !l.bounds.has('fence') ? 'walled-garden' : 'paddock';
      const field: Field = { kind, cells, trees };
      fields.push(field);
      for (const c of cells) byCell.set(c, { use: 'field', field });
    } else if (!l.streets.length && !l.plazas.length && built && trees === 0 && cells.length === l.cells.length && cells.length >= COURT_MIN && cells.length <= COURT_MAX && wide(cells) && [...l.bounds].every((b) => b === 'structure')) {
      const patch: Patch = { cells, houses };
      courtyards.push(patch);
      for (const c of cells) byCell.set(c, { use: 'courtyard', patch });
    } else if (!l.streets.length && !l.plazas.length && houses.length && cells.length <= DRESSING.yardMax) {
      const patch: Patch = { cells, houses };
      backYards.push(patch);
      for (const c of cells) byCell.set(c, { use: 'back-yard', patch });
    } else if (!l.streets.length && !l.plazas.length && !fenced && !open && houses.length >= DRYING_HOUSES && trees < DRESSING.parkTrees && cells.length <= DRYING_MAX && cells.length === l.cells.length) {
      // U17: too big for a back yard, unfenced, shut in by the backs of three or more houses: the
      // common green the washing is laid out on.
      const patch: Patch = { cells, houses };
      dryingGreens.push(patch);
      for (const c of cells) byCell.set(c, { use: 'drying-green', patch });
    } else if ((l.streets.length || l.plazas.length) && cells.length >= DRESSING.parkMin && cells.length <= DRESSING.parkMax) {
      const patch: Patch = { cells, houses };
      pocketParks.push(patch);
      for (const c of cells) byCell.set(c, { use: 'pocket-park', patch });
    }
  }

  // ── U15 village greens: the open grass a ring of houses looks across ──
  // Each ground-storey house facade looks straight out across bare grass with no other use, up to
  // GREEN_REACH cells (stopping at anything else). Grass looked across from opposite sides by two or more houses is the
  // heart of a green; a connected heart of GREEN_MIN to GREEN_MAX cells, looked at by GREEN_HOUSES
  // or more houses and touching a street, is a green. Not near a square: that is the square's lawn.
  const greens: Green[] = [];
  const seers = new Map<CellKey, Set<StructureId>>();
  const sides = new Map<CellKey, Set<Dir4>>();
  const see = (c: CellKey, id: StructureId, d: Dir4): void => {
    let set = seers.get(c);
    if (!set) seers.set(c, (set = new Set()));
    set.add(id);
    let ds = sides.get(c);
    if (!ds) sides.set(c, (ds = new Set()));
    ds.add(d);
  };
  for (const fc of facades(f).list) {
    if (fc.kind !== 'house' || fc.storey !== 1) continue;
    // A house looks out across three columns: straight ahead, and a column either side.
    for (const side of [0, 1, 3]) {
      let c = side ? neighbor(fc.cell, ((fc.dir + side) % 4) as Dir4) : fc.cell;
      if (c === NO_CELL) continue;
      for (let k = 1; k <= GREEN_REACH; k++) {
        const back = ((fc.dir + 2) % 4) as Dir4;
        c = neighbor(c, fc.dir);
        if (c === NO_CELL || edgeBetween(f, c, back)) break;
        if (f.kinds.get(c) === 'tree') continue; // a tree does not block the view
        if (!grass.has(c) || byCell.has(c)) break;
        see(c, fc.structure, fc.dir);
      }
    }
  }
  const squares = plazas(f).list.filter((p) => p.square).flatMap((p) => p.cells);
  // Looked across from two opposite sides, by two different houses.
  const opposite = (ds: Set<Dir4>): boolean => (ds.has(0) && ds.has(2)) || (ds.has(1) && ds.has(3));
  // Not a gap between two houses (a building on both sides across it): that is a passage, not the green.
  const isHouse = (c: CellKey): boolean => c !== NO_CELL && f.kinds.get(c) === 'house';
  const gap = (c: CellKey): boolean => (isHouse(neighbor(c, 0)) && isHouse(neighbor(c, 2))) || (isHouse(neighbor(c, 1)) && isHouse(neighbor(c, 3)));
  const heart = new Set([...seers].filter(([c, s]) => s.size >= 2 && opposite(sides.get(c)!) && !gap(c)).map(([c]) => c));
  const seen = new Set<CellKey>();
  for (const start of [...heart].sort((a, b) => a - b)) {
    if (seen.has(start)) continue;
    const cells: CellKey[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      for (const d of [0, 1, 2, 3] as Dir4[]) {
        const n = neighbor(c, d);
        if (n !== NO_CELL && heart.has(n) && !seen.has(n) && !edgeBetween(f, c, d)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    // Trim strips and tendrils (along the front of a row, down a passage between houses): keep the
    // cells that lie in some 3 × 3 of the patch. What is left is open space.
    const inPatch = new Set(cells);
    const block = (x0: number, z0: number): boolean => {
      for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) if (!inPatch.has(cells[0]! - (cells[0]! & 63) - (((cells[0]! >> 6) & 63) << 6) + (x0 + dx) + ((z0 + dz) << 6))) return false;
      return true;
    };
    const kept = cells.filter((c) => {
      const x = c & 63, z = (c >> 6) & 63;
      for (let oz = -2; oz <= 0; oz++) for (let ox = -2; ox <= 0; ox++) if (block(x + ox, z + oz)) return true;
      return false;
    });
    cells.length = 0;
    cells.push(...kept);
    if (cells.length < GREEN_MIN || cells.length > GREEN_MAX) continue;
    const houses = new Set<StructureId>();
    for (const c of cells) for (const h of seers.get(c)!) houses.add(h);
    if (houses.size < GREEN_HOUSES) continue;
    const street = cells.some((c) => [0, 1, 2, 3].some((d) => f.world.floors.get(neighbor(c, d as Dir4)) === 'path'));
    if (!street) continue;
    const col = (c: CellKey): [number, number] => [c & 63, (c >> 6) & 63];
    if (squares.some((q) => cells.some((c) => Math.abs(col(q)[0] - col(c)[0]) + Math.abs(col(q)[1] - col(c)[1]) <= 4))) continue;
    cells.sort((a, b) => a - b);
    const green: Green = { cells, houses: [...houses].sort((a, b) => a - b) };
    greens.push(green);
    for (const c of cells) byCell.set(c, { use: 'green', green });
  }

  return { byCell, frontGardens: gardens, fields, burgages, courtyards, backYards, pocketParks, greens, dryingGreens, orchards: orchardUses, baileys };

  /** The row of houses whose backs (no main door) face the land on one side, if two or more. */
  function burgageOf(cells: readonly CellKey[]): Burgage | null {
    const rows = new Map<Dir4, Map<StructureId, Set<number>>>();
    for (const c of cells) {
      for (const d of [0, 1, 2, 3] as Dir4[]) {
        const n = neighbor(c, d);
        if (n === NO_CELL || f.kinds.get(n) !== 'house' || mainDoors.has(`${n}:${(d + 2) % 4}`)) continue;
        const id = f.structureAt.get(n)!;
        let row = rows.get(d);
        if (!row) rows.set(d, (row = new Map()));
        let along = row.get(id);
        if (!along) row.set(id, (along = new Set()));
        along.add(d === 0 || d === 2 ? c & 63 : (c >> 6) & 63);
      }
    }
    let best: [Dir4, Map<StructureId, Set<number>>] | null = null;
    for (const [d, row] of [...rows].sort((a, b) => a[0] - b[0])) if (!best || row.size > best[1].size) best = [d, row];
    if (!best || best[1].size < 2) return null;
    const houses = [...best[1]].map(([id, along]) => ({ id, along: [...along].sort((a, b) => a - b) })).sort((a, b) => a.along[0]! - b.along[0]! || a.id - b.id);
    return { cells, dir: best[0], houses };
  }
});
