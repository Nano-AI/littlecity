// How every arch structure spans (design section 9, S1, and catalogue J15):
// the axis of each arch cell, the runs they form, and for each run the
// openings and piers.
//
// Terms. A cell's AXIS is the direction its arch spans ('x' or 'z'); people
// and water pass through along the other one. A RUN is a line of cells of
// one structure along their shared axis at one level. A cell is STANDING if
// the cell below it is solid; otherwise it is a span cell. Inside a run, each
// unbroken stretch of span cells is a STRETCH, and is shaped by S1:
//
//   anchored at both ends   one arch up to `archMax` (3) cells long; longer
//                           ones are split by piers into equal arches
//   anchored at one end     a half arch for up to `hangMax` (2) cells, and a
//                           pier under every cell beyond that
//   anchored at neither     a pier under each end cell
//
// An end is anchored if the cell beyond it is solid (terrain, a solid block,
// or a standing cell of the same run). A span cell where another run of the
// same structure meets this one at a right angle gets a pier too (the corner
// pier of J15). Standing cells each have their own small arch on two legs.
//
// Positions along a run are in cells from its low (west or north) end.

import { above, below, columnIndex, E, key, keyX, keyY, keyZ, N, neighbor, NO_CELL, S, W, type CellKey, type Dir4 } from '@/core/grid';
import { defineFact, type Facts } from '@/resolve/facts/api';
import { solid } from '@/resolve/facts/lib';
import type { StructureId } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';

export type Axis = 'x' | 'z';

export interface ArchOpening {
  /** Along the run, in cells from its low end. May start before 0 or end past the run (a half arch). */
  lo: number;
  hi: number;
  /** A half arch hanging from one springer: which end of the opening is in the air. */
  half?: 'lo' | 'hi';
  /** The opening is over the sea at level 0, so it springs from the waterline. */
  overWater: boolean;
  /** Anchored on solid at both ends, with no pier of its own making either end. */
  fromWall: boolean;
  toWall: boolean;
}

export interface ArchPier {
  /** Along the run: n + 0.5 is under the middle of cell n; a whole number is on the boundary before cell n. */
  at: number;
  /** The cell that carries it (for a boundary pier: the cell on its low side). */
  cell: CellKey;
  /** For a boundary pier: the side of `cell` it is centred on. */
  side?: Dir4;
  /** Cells down from the arch cell's foot to the first solid top, or to the seabed. */
  depth: number;
  /** It stands in the sea. */
  water: boolean;
}

export interface ArchStretch {
  /** First and last span cell, as indexes into the run. */
  from: number;
  to: number;
  anchoredLo: boolean;
  anchoredHi: boolean;
  /** Open water lies under at least one of its cells. */
  overWater: boolean;
}

export interface ArchRun {
  structure: StructureId;
  axis: Axis;
  /** The cells, low end first. */
  cells: readonly CellKey[];
  standing: readonly boolean[];
  stretches: readonly ArchStretch[];
  openings: readonly ArchOpening[];
  piers: readonly ArchPier[];
}

export interface ArchCell {
  cell: CellKey;
  axis: Axis;
  run: ArchRun;
  /** Index of the cell in its run. */
  index: number;
  standing: boolean;
}

export interface ArchRuns {
  runs: readonly ArchRun[];
  byStructure: ReadonlyMap<StructureId, readonly ArchRun[]>;
  at(cell: CellKey): ArchCell | undefined;
}

const LOW: Record<Axis, Dir4> = { x: W, z: N };
const HIGH: Record<Axis, Dir4> = { x: E, z: S };

export const archRuns = defineFact<ArchRuns>('archRuns', (f: Facts) => {
  const runs: ArchRun[] = [];
  const byStructure = new Map<StructureId, ArchRun[]>();
  const byCell = new Map<CellKey, ArchCell>();
  const ids = [...f.structures.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const s = f.structures.get(id)!;
    if (s.kind !== 'arch') continue;
    const mine = new Set(s.cells);
    const has = (c: CellKey): boolean => c !== NO_CELL && mine.has(c);
    const runLength = (cell: CellKey, axis: Axis): number => {
      let n = 1;
      for (let c = neighbor(cell, LOW[axis]); has(c); c = neighbor(c, LOW[axis])) n++;
      for (let c = neighbor(cell, HIGH[axis]); has(c); c = neighbor(c, HIGH[axis])) n++;
      return n;
    };

    // ── the axis of every cell (J15) ──
    const axis = new Map<CellKey, Axis>();
    const alone: CellKey[] = [];
    for (const cell of s.cells) {
      const lx = runLength(cell, 'x'), lz = runLength(cell, 'z');
      if (lx >= 2 || lz >= 2) axis.set(cell, lx >= lz ? 'x' : 'z');
      else alone.push(cell);
    }
    const bearing = (c: CellKey): boolean => c !== NO_CELL && (solid(f, c) || f.kinds.get(c) === 'wall');
    const floorOn = (c: CellKey): boolean => c !== NO_CELL && f.world.floors.has(c);
    for (const cell of alone) {
      // A lone arch in a stack follows the tier it stands on (or the one it carries).
      const under = below(cell), over = above(cell);
      const inherited = (has(under) ? axis.get(under) : undefined) ?? (has(over) ? axis.get(over) : undefined);
      if (inherited) axis.set(cell, inherited);
      else if (bearing(neighbor(cell, W)) && bearing(neighbor(cell, E))) axis.set(cell, 'x');
      else if (bearing(neighbor(cell, N)) && bearing(neighbor(cell, S))) axis.set(cell, 'z');
      else if (floorOn(cell) && (floorOn(neighbor(cell, N)) || floorOn(neighbor(cell, S)))) axis.set(cell, 'x');
      else if (floorOn(cell) && (floorOn(neighbor(cell, W)) || floorOn(neighbor(cell, E)))) axis.set(cell, 'z');
      else axis.set(cell, 'x');
    }
    // (Cells are in ascending key order, so a stack of lone arches resolves bottom-up.)

    // ── runs ──
    const seen = new Set<CellKey>();
    for (const start of s.cells) {
      if (seen.has(start)) continue;
      const ax = axis.get(start)!;
      let first = start;
      for (let c = neighbor(first, LOW[ax]); has(c) && axis.get(c) === ax; c = neighbor(c, LOW[ax])) first = c;
      const cells: CellKey[] = [];
      for (let c = first; has(c) && axis.get(c) === ax; c = neighbor(c, HIGH[ax])) {
        cells.push(c);
        seen.add(c);
      }
      const run = shapeRun(f, id, ax, cells, (c) => has(c) && axis.get(c) !== ax);
      runs.push(run);
      let list = byStructure.get(id);
      if (!list) byStructure.set(id, (list = []));
      list.push(run);
      cells.forEach((cell, index) => byCell.set(cell, { cell, axis: ax, run, index, standing: run.standing[index]! }));
    }
  }
  return { runs, byStructure, at: (cell) => byCell.get(cell) };
});

/** Levels from the foot of `cell` down to the first solid top in its column, or to the seabed. */
function dropUnder(f: Facts, cell: CellKey): { depth: number; water: boolean } {
  const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
  for (let yy = y - 1; yy >= 0; yy--) if (solid(f, key(x, yy, z))) return { depth: y - yy - 1, water: false };
  return { depth: y, water: f.terrain.height[columnIndex(x, z)] === 0 };
}

function shapeRun(f: Facts, structure: StructureId, axis: Axis, cells: CellKey[], crossing: (c: CellKey) => boolean): ArchRun {
  const n = cells.length;
  const standing = cells.map((c) => {
    const under = below(c);
    return under !== NO_CELL && solid(f, under);
  });
  const leg = MONUMENTS.archLeg, ph = MONUMENTS.pierHalf;
  const maxArch = Math.max(1, MONUMENTS.archMax), hang = Math.max(1, Math.round(MONUMENTS.hangMax));
  const openings: ArchOpening[] = [];
  const piers: ArchPier[] = [];
  const stretches: ArchStretch[] = [];
  const sides: Dir4[] = axis === 'x' ? [N, S] : [W, E];

  for (let i = 0; i < n; i++) {
    if (standing[i]) {
      openings.push({ lo: i + leg, hi: i + 1 - leg, overWater: false, fromWall: false, toWall: false });
      continue;
    }
    // A stretch of span cells: [i, j].
    let j = i;
    while (j + 1 < n && !standing[j + 1]) j++;
    const beyondLo = i > 0 ? cells[i - 1]! : neighbor(cells[0]!, LOW[axis]);
    const beyondHi = j < n - 1 ? cells[j + 1]! : neighbor(cells[n - 1]!, HIGH[axis]);
    const anchoredLo = beyondLo !== NO_CELL && solid(f, beyondLo);
    const anchoredHi = beyondHi !== NO_CELL && solid(f, beyondHi);
    const drops = [];
    for (let k = i; k <= j; k++) drops.push(dropUnder(f, cells[k]!));
    const allLevelZero = keyY(cells[i]!) === 0;
    stretches.push({ from: i, to: j, anchoredLo, anchoredHi, overWater: drops.some((d) => d.water) });

    // Springers: walls at anchored ends, piers elsewhere.
    type Springer = { at: number; pier: boolean };
    const springers: Springer[] = [];
    if (anchoredLo) springers.push({ at: i, pier: false });
    if (anchoredHi) springers.push({ at: j + 1, pier: false });
    const addPier = (at: number): void => {
      if (springers.some((sp) => Math.abs(sp.at - at) < 0.75)) return;
      springers.push({ at, pier: true });
    };
    for (let k = i; k <= j; k++) {
      if (sides.some((d) => crossing(neighbor(cells[k]!, d)))) addPier(k + 0.5); // the corner pier
    }
    // An end is held if it is anchored or a corner pier already stands under its end cell.
    const heldLo = anchoredLo || springers.some((sp) => sp.pier && sp.at < i + 1);
    const heldHi = anchoredHi || springers.some((sp) => sp.pier && sp.at > j);
    if (heldLo && !heldHi) for (let k = i + hang; k <= j; k++) addPier(k + 0.5);
    else if (heldHi && !heldLo) for (let k = j - hang; k >= i; k--) addPier(k + 0.5);
    else if (!heldLo && !heldHi) {
      addPier(i + 0.5);
      addPier(j + 0.5);
    }
    springers.sort((a, b) => a.at - b.at);
    // No arch longer than archMax: split long gaps evenly, on half-cell positions.
    for (let k = 0; k + 1 < springers.length; k++) {
      const a = springers[k]!, b = springers[k + 1]!;
      const parts = Math.ceil((b.at - a.at - 1e-6) / maxArch);
      if (parts <= 1) continue;
      const extra: Springer[] = [];
      for (let p = 1; p < parts; p++) {
        const at = Math.round((a.at + ((b.at - a.at) * p) / parts) * 2) / 2;
        if (at - a.at >= 1 && b.at - at >= 1 && !extra.some((e) => e.at === at)) extra.push({ at, pier: true });
      }
      springers.splice(k + 1, 0, ...extra);
      k += extra.length;
    }
    // Piers.
    for (const sp of springers) {
      if (!sp.pier) continue;
      if (Number.isInteger(sp.at)) {
        const lo = dropUnder(f, cells[sp.at - 1]!), hi = dropUnder(f, cells[sp.at]!);
        piers.push({ at: sp.at, cell: cells[sp.at - 1]!, side: HIGH[axis], depth: Math.min(lo.depth, hi.depth), water: lo.water && hi.water });
      } else {
        const k = Math.floor(sp.at);
        const d = drops[k - i]!;
        piers.push({ at: sp.at, cell: cells[k]!, depth: d.depth, water: d.water });
      }
    }
    // Openings between springers, and half arches past the last one at a free end.
    const face = (sp: Springer, toward: 1 | -1): number => sp.at + (sp.pier ? toward * ph : 0);
    const water = allLevelZero && drops.every((d) => d.water);
    for (let k = 0; k + 1 < springers.length; k++) {
      const a = springers[k]!, b = springers[k + 1]!;
      openings.push({ lo: face(a, 1), hi: face(b, -1), overWater: water, fromWall: !a.pier, toWall: !b.pier });
    }
    const firstSp = springers[0], lastSp = springers[springers.length - 1];
    if (firstSp && !anchoredLo) {
      const hi = face(firstSp, -1);
      if (hi - i > 1e-6) openings.push({ lo: i - (hi - i), hi, half: 'lo', overWater: water, fromWall: false, toWall: !firstSp.pier });
    }
    if (lastSp && !anchoredHi) {
      const lo = face(lastSp, 1);
      if (j + 1 - lo > 1e-6) openings.push({ lo, hi: j + 1 + (j + 1 - lo), half: 'hi', overWater: water, fromWall: !lastSp.pier, toWall: false });
    }
    i = j;
  }
  openings.sort((a, b) => a.lo - b.lo);
  return { structure, axis, cells, standing, stretches, openings, piers };
}
