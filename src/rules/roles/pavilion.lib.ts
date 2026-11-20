// The bandstand pavilion's plan (R-M11), as plain numbers: the outline, the
// columns, the heights, and which floor cells are the way in. Shared by the
// rule (which pins the way in and the floor height for the walking graph), the
// marble generator (plinth, rail, entablature, roof) and the pillar generator
// (the columns in its cell): src/gen/marble/pavilion.ts draws it.

import { CELL_H, DIR4, type Dir4 } from '@/core/grid';

export type V2 = [number, number];


export const TAN8 = Math.tan(Math.PI / 8);

export interface PavilionInput {
  /** The footprint: (x, z) of each cell. */
  cells: readonly (readonly [number, number])[];
  /** Terrain height (in cells) under the footprint: the highest and the lowest. */
  ground: number;
  low: number;
  /** The level (keyY) of the marble cells: the roof's storey. */
  level: number;
}

export interface Pavilion {
  /** The plan outline at the cell edges (corners cut), counter-clockwise in (x, z). */
  outline: V2[];
  /** The footprint's own outline (square corners): the lowest step follows it, so the plinth fills its cells. */
  cellsOutline: V2[];
  /** True for the 2 × 2 octagon. */
  round: boolean;
  /** Centre of the plan (of its bounding box). */
  centre: V2;
  /** Roof hubs: the octagon's centre, or each cell's centre of a one-wide plan. */
  hubs: Hub[];
  /** World heights: foot of the plinth, each step's top (the last is the floor), the architrave's foot, the eave line. */
  foot: number;
  steps: { offset: number; top: number }[];
  floor: number;
  architrave: number;
  eave: number;
  /** Offsets of the outline (negative is inward). */
  ring: number;
  eaveOut: number;
  /** Column positions (x, z) round the ring, in order, and their radius. */
  columns: V2[];
  radius: number;
  pitch: number;
  storeys: number;
  /** Over a taller stack, a second tier: a drum set in by `inset` and `drum` tall, under a roof with eaves `eave` out from it. */
  tier: { inset: number; drum: number; eave: number } | null;
}

export interface Hub {
  c: V2;
  r: number;
  /** For a one-wide plan: which sides of the cell join another cell (N, E, S, W). */
  joined: boolean[];
}

/** The signed area (positive: counter-clockwise in x, z). */
export function area(p: readonly V2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!, r = p[(i + 1) % p.length]!;
    a += q[0] * r[1] - r[0] * q[1];
  }
  return a / 2;
}

/** The outward normal of edge i (from p[i] to p[i + 1]) of a counter-clockwise polygon. */
export function normalOf(p: readonly V2[], i: number): V2 {
  const a = p[i]!, b = p[(i + 1) % p.length]!;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return [dz / l, -dx / l];
}

/** The polygon with every edge moved out by d (in by −d), corners mitred. */
export function offset(p: readonly V2[], d: number): V2[] {
  const n = p.length;
  return p.map((v, i) => {
    const n1 = normalOf(p, (i + n - 1) % n), n2 = normalOf(p, i);
    const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [v[0] + (n1[0] + n2[0]) * k, v[1] + (n1[1] + n2[1]) * k];
  });
}

/** The outline of a set of unit cells, counter-clockwise, collinear points merged. */
function traceCells(cells: readonly (readonly [number, number])[]): V2[] {
  const has = new Set(cells.map(([x, z]) => `${x},${z}`));
  const next = new Map<string, V2>();
  const k = (p: V2): string => `${p[0]},${p[1]}`;
  for (const [x, z] of cells) {
    if (!has.has(`${x},${z - 1}`)) next.set(k([x, z]), [x + 1, z]);
    if (!has.has(`${x + 1},${z}`)) next.set(k([x + 1, z]), [x + 1, z + 1]);
    if (!has.has(`${x},${z + 1}`)) next.set(k([x + 1, z + 1]), [x, z + 1]);
    if (!has.has(`${x - 1},${z}`)) next.set(k([x, z + 1]), [x, z]);
  }
  const start = [...next.keys()].sort()[0]!;
  const loop: V2[] = [];
  let at = start;
  for (let guard = 0; guard < 64; guard++) {
    const [x, z] = at.split(',').map(Number) as V2;
    loop.push([x, z]);
    at = k(next.get(at)!);
    if (at === start) break;
  }
  // Drop points in the middle of a straight run.
  return loop.filter((v, i) => {
    const a = loop[(i + loop.length - 1) % loop.length]!, b = loop[(i + 1) % loop.length]!;
    return (v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0]) !== 0;
  });
}

/** Cuts every convex corner at 45°, `cut` along each side. */
function chamfer(p: readonly V2[], cut: number): V2[] {
  const out: V2[] = [];
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n]!, v = p[i]!, b = p[(i + 1) % n]!;
    const d1: V2 = [v[0] - a[0], v[1] - a[1]], d2: V2 = [b[0] - v[0], b[1] - v[1]];
    const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
    if (d1[0] * d2[1] - d1[1] * d2[0] > 0) {
      out.push([v[0] - (d1[0] / l1) * cut, v[1] - (d1[1] / l1) * cut], [v[0] + (d2[0] / l2) * cut, v[1] + (d2[1] / l2) * cut]);
    } else out.push(v);
  }
  return out;
}

export function pavilionLayout(input: PavilionInput): Pavilion {
  const cells = input.cells;
  const has = new Set(cells.map(([x, z]) => `${x},${z}`));
  const xs = cells.map((c) => c[0]), zs = cells.map((c) => c[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
  const round = cells.length === 4 && x1 - x0 === 2 && z1 - z0 === 2;
  const r = round ? 1 : 0.5;
  const cellsOutline = traceCells(cells);
  if (area(cellsOutline) < 0) cellsOutline.reverse();
  const outline = chamfer(cellsOutline, r * (1 - TAN8));
  const hubs: Hub[] = round
    ? [{ c: [x0 + 1, z0 + 1], r: 1, joined: [false, false, false, false] }]
    : cells.map(([x, z]) => ({
        c: [x + 0.5, z + 0.5] as V2,
        r: 0.5,
        joined: [has.has(`${x},${z - 1}`), has.has(`${x + 1},${z}`), has.has(`${x},${z + 1}`), has.has(`${x - 1},${z}`)],
      }));

  // Heights. A taller stack stands the pavilion on a higher plinth and gives it longer columns.
  const storeys = Math.max(2, input.level - input.ground);
  const nSteps = storeys >= 3 ? 3 : 2;
  const rise = storeys >= 4 ? 0.1 : storeys === 3 ? 0.085 : 0.075;
  const foot = input.low * CELL_H;
  const g = input.ground * CELL_H;
  // The lowest step fills the cells (square); the top one, the floor, is set back just enough to carry the
  // columns' bases; any step between lies half-way.
  const topBack = round ? -0.06 : -0.07;
  const steps = Array.from({ length: nSteps }, (_, i) => ({ offset: -0.02 + ((topBack + 0.02) * i) / (nSteps - 1), top: g + rise * (i + 1) }));
  const floor = steps[steps.length - 1]!.top;
  // The columns grow by less than the stack does (a pavilion, not a birdcage); what is left of the height
  // goes into a second tier of roof over a clerestory drum.
  const extra = Math.min(storeys - 2, 3);
  const architrave = floor + (round ? 1.1 : 1.0) + 0.3 * extra;
  const eave = architrave + 0.15;
  const tier = storeys >= 3 ? { inset: round ? 0.56 : 0.27, drum: (round ? 0.2 : 0.15) + 0.07 * (extra - 1), eave: round ? 0.1 : 0.07 } : null;
  const ring = -0.15;
  const radius = (round ? 0.05 : 0.042) + 0.006 * Math.min(storeys - 2, 3);

  // Columns: one at every corner of the ring, and more along its long sides.
  const ringPoly = offset(outline, ring);
  const columns: V2[] = [];
  for (let i = 0; i < ringPoly.length; i++) {
    const a = ringPoly[i]!, b = ringPoly[(i + 1) % ringPoly.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    columns.push(a);
    // Along a long straight side, one more on every cell line: then the line through the middle of each
    // cell, which is how people walk in (src/resolve/nav.ts), passes through the middle of a bay.
    const alongX = Math.abs(b[1] - a[1]) < 1e-6, alongZ = Math.abs(b[0] - a[0]) < 1e-6;
    if (len < 0.75 || !(alongX || alongZ)) continue;
    const u0 = alongX ? a[0] : a[1], u1 = alongX ? b[0] : b[1];
    const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
    const lines: number[] = [];
    for (let k = Math.ceil(lo + 0.25); k <= hi - 0.25; k++) lines.push(k);
    if (u1 < u0) lines.reverse();
    for (const k of lines) columns.push(alongX ? [k, a[1]] : [a[0], k]);
  }
  return {
    outline,
    cellsOutline,
    round,
    centre: [(x0 + x1) / 2, (z0 + z1) / 2],
    hubs,
    foot,
    steps,
    floor,
    architrave,
    eave,
    ring,
    eaveOut: 0.1,
    columns,
    radius,
    pitch: round ? 0.82 : 1.05,
    storeys,
    tier,
  };
}

/** The cell (x, z) a point lies in. */
export const cellOf = (p: V2): V2 => [Math.floor(p[0] + 1e-6), Math.floor(p[1] + 1e-6)];

/**
 * The floor cells a person comes in by, from the side `door`: the front cells on that side (both of a 2 × 2;
 * of a one-wide plan the one nearest the middle of that side, the lower key on a tie).
 */
export function pavilionEntries(cells: readonly (readonly [number, number])[], door: Dir4): [number, number][] {
  const has = new Set(cells.map(([x, z]) => `${x},${z}`));
  const [dx, dz] = DIR4[door]!;
  const open = cells.filter(([x, z]) => !has.has(`${x + dx},${z + dz}`));
  const front = Math.max(...open.map(([x, z]) => x * dx + z * dz));
  const row = open.filter(([x, z]) => x * dx + z * dz === front).map(([x, z]) => [x, z] as [number, number]);
  const xs = cells.map((c) => c[0]), zs = cells.map((c) => c[1]);
  const round = cells.length === 4 && Math.max(...xs) - Math.min(...xs) === 1 && Math.max(...zs) - Math.min(...zs) === 1;
  if (round) return row;
  const mx = cells.reduce((a, c) => a + c[0], 0) / cells.length, mz = cells.reduce((a, c) => a + c[1], 0) / cells.length;
  const across = ([x, z]: [number, number]): number => Math.abs((x - mx) * dz - (z - mz) * dx);
  row.sort((a, b) => across(a) - across(b) || a[1] - b[1] || a[0] - b[0]);
  return [row[0]!];
}
