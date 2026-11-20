// The bandstand (R-M11) as a park pavilion: a many-sided plinth with steps, a
// ring of slender columns with a low rail between them, a light entablature
// following the ring, and a tented roof in facets with a roll on every hip,
// rising to a lantern and a finial.
//
// One layout, worked out from the footprint alone, is shared by the two
// generators that draw it: the marble generator draws the plinth, the rail,
// the entablature and the roof (the marble block becomes the roof); each
// placed pillar draws the columns that stand in its own cell (src/gen/pillar),
// so a broken pillar breaks its own columns and nothing is drawn twice.
//
// The plan. Every footprint the rule accepts is four cells at one level:
//   2 × 2       a regular octagon (inradius 1) with eight columns, a tented
//               roof to a lantern: the classic bandstand.
//   1 × 4, L, T, S   cells one wide: each convex corner is cut at 45° so that
//               every end is half an octagon (inradius 0.5), the roof is
//               hipped with equal pitch on every facet (ridges along the
//               arms, hips to every corner, valleys at inner corners), with
//               a finial at each end of a ridge: a long garden shelter, an
//               L- or T-shaped one, or a cranked one.
// Everything else (the plinth's steps, the column ring, the entablature, the
// eave) is the same outline offset in or out, so it all follows the plan.

import { CELL_H, DIR4, type Dir4 } from '@/core/grid';
import { rotationY, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type ColorInput } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

type V2 = [number, number];
type V3 = [number, number, number];

const TAN8 = Math.tan(Math.PI / 8);

export interface PavilionInput {
  /** The footprint: (x, z) of each cell. */
  cells: readonly V2[];
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

interface Hub {
  c: V2;
  r: number;
  /** For a one-wide plan: which sides of the cell join another cell (N, E, S, W). */
  joined: boolean[];
}

/** The signed area (positive: counter-clockwise in x, z). */
function area(p: readonly V2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i]!, r = p[(i + 1) % p.length]!;
    a += q[0] * r[1] - r[0] * q[1];
  }
  return a / 2;
}

/** The outward normal of edge i (from p[i] to p[i + 1]) of a counter-clockwise polygon. */
function normalOf(p: readonly V2[], i: number): V2 {
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
function traceCells(cells: readonly V2[]): V2[] {
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
  const back = round ? 0.07 : 0.05;
  const steps = Array.from({ length: nSteps }, (_, i) => ({ offset: -0.03 - back * i, top: g + rise * (i + 1) }));
  const floor = steps[steps.length - 1]!.top;
  // The columns grow by less than the stack does (a pavilion, not a birdcage); what is left of the height
  // goes into a second tier of roof over a clerestory drum.
  const extra = Math.min(storeys - 2, 3);
  const architrave = floor + (round ? 1.1 : 1.0) + 0.3 * extra;
  const eave = architrave + 0.15;
  const tier = storeys >= 3 ? { inset: round ? 0.56 : 0.27, drum: (round ? 0.2 : 0.15) + 0.07 * (extra - 1), eave: round ? 0.1 : 0.07 } : null;
  const ring = round ? -0.2 : -0.15;
  const radius = (round ? 0.05 : 0.042) + 0.006 * Math.min(storeys - 2, 3);

  // Columns: one at every corner of the ring, and more along its long sides so no bay is wider than ~0.8.
  const ringPoly = offset(outline, ring);
  const columns: V2[] = [];
  for (let i = 0; i < ringPoly.length; i++) {
    const a = ringPoly[i]!, b = ringPoly[(i + 1) % ringPoly.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / 0.72));
    for (let j = 0; j < n; j++) columns.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
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
    eaveOut: 0.11,
    columns,
    radius,
    pitch: round ? 0.82 : 1.05,
    storeys,
    tier,
  };
}

/** The cell (x, z) a point lies in. */
export const cellOf = (p: V2): V2 => [Math.floor(p[0] + 1e-6), Math.floor(p[1] + 1e-6)];

// ─────────────────────────────────────────────────────────── columns ──

/** The columns of the pavilion that stand in cell (cx, cz): drawn by that cell's pillar. */
export function drawPavilionColumns(b: MeshBuilder, pv: Pavilion, cx: number, cz: number, color: ColorInput, shade: ColorInput): number {
  let n = 0;
  const r = pv.radius;
  const y0 = pv.floor, y1 = pv.architrave;
  for (const p of pv.columns) {
    const [x, z] = cellOf(p);
    if (x !== cx || z !== cz) continue;
    n++;
    b.at(translation(p[0], 0, p[1]), () => {
      // A square plinth and a round moulding, one object; the shaft with a little entasis; a bell capital
      // and a thin abacus, whose top is hidden against the architrave.
      b.with({ color: shade, pattern: PATTERN.none, ink: 'col-base' }, () => {
        b.boxAt([0, y0, 0], [r * 2 + 0.06, 0.05, r * 2 + 0.06], { skip: ['bottom'] });
        b.lathe([[r + 0.022, y0 + 0.05], [r + 0.026, y0 + 0.075], [r + 0.004, y0 + 0.1]], { segments: 8 });
      });
      const neck = y1 - 0.11;
      b.with({ color, pattern: PATTERN.marble, ink: 'col-shaft' }, () =>
        b.lathe([[r + 0.006, y0 + 0.1], [r + 0.004, y0 + 0.1 + (neck - y0) * 0.35], [r - 0.006, neck]], { segments: 8 }),
      );
      b.with({ color: shade, pattern: PATTERN.none, ink: 'col-cap' }, () => {
        b.lathe([[r - 0.006, neck], [r + 0.012, neck + 0.02], [r + 0.012, neck + 0.035], [r + 0.04, y1 - 0.035]], { segments: 8 });
        b.boxAt([0, y1 - 0.035, 0], [r * 2 + 0.1, 0.035, r * 2 + 0.1], { skip: ['top'] });
      });
    });
  }
  return n;
}

// ─────────────────────────────────────────────────────────── the rest ──

export interface PavilionColours {
  stone: ColorInput;
  shade: ColorInput;
  roof: ColorInput;
}

/** The plinth, floor, rail, entablature, ceiling, roof, lantern and finials: drawn by the marble. */
export function drawPavilion(b: MeshBuilder, pv: Pavilion, col: PavilionColours, door: Dir4 | -1): void {
  const P = pv.outline;
  const up = (pts: readonly V2[], y: number): V3[] => pts.map((p) => [p[0], y, p[1]] as V3);

  // ── plinth: steps all round, the top one is the floor ──
  b.with({ color: col.shade, pattern: PATTERN.stone, ink: 'plinth' }, () => {
    let y = pv.foot;
    pv.steps.forEach((s, i) => {
      const last = i === pv.steps.length - 1;
      const plan = i === 0 ? offset(pv.cellsOutline, -0.02) : offset(P, s.offset);
      b.with(last ? { color: col.stone, pattern: PATTERN.marble, ink: 'floor' } : {}, () => b.extrude(plan, y, s.top, { cap: 'top' }));
      y = s.top;
    });
  });

  // ── a low rail between the columns, open in the doorway ──
  const cols = pv.columns;
  const dir = door >= 0 ? DIR4[door]! : null;
  // The doorway: the bay whose outward normal points most nearly at the door, nearest the middle of that side.
  let open = -1;
  if (dir) {
    let best = -Infinity;
    for (let i = 0; i < cols.length; i++) {
      const a = cols[i]!, c = cols[(i + 1) % cols.length]!;
      const m: V2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const face = (dz / l) * dir[0] + (-dx / l) * dir[1];
      const side = (m[0] - pv.centre[0]) * dir[0] + (m[1] - pv.centre[1]) * dir[1];
      const across = Math.abs((m[0] - pv.centre[0]) * dir[1] - (m[1] - pv.centre[1]) * dir[0]);
      const score = face * 10 + side - across * 0.6;
      if (score > best) {
        best = score;
        open = i;
      }
    }
  }
  const railH = 0.24, railW = 0.05;
  b.with({ color: col.stone, pattern: PATTERN.none, ink: 'rail' }, () => {
    for (let i = 0; i < cols.length; i++) {
      if (i === open) continue;
      const a = cols[i]!, c = cols[(i + 1) % cols.length]!;
      const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
      const span = len - pv.radius * 2 + 0.01;
      if (span <= 0.04) continue;
      // Built along +x from the bay's middle; turned to the bay.
      const m: V2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      b.at(translation(m[0], 0, m[1]), () =>
        b.at(rotationY(-Math.atan2(dz, dx)), () => {
          const y = pv.floor;
          b.box([-span / 2, y, -0.035], [span / 2, y + 0.035, 0.035], { skip: ['bottom'] }); // the sill
          b.box([-span / 2, y + railH - 0.04, -railW / 2], [span / 2, y + railH, railW / 2]); // the handrail
          const n = Math.max(1, Math.round(span / 0.13));
          for (let j = 0; j < n; j++) {
            const x = -span / 2 + (span * (j + 0.5)) / n;
            b.box([x - 0.017, y + 0.035, -0.017], [x + 0.017, y + railH - 0.04, 0.017], { skip: ['top', 'bottom'] });
          }
        }),
      );
    }
  });

  // ── entablature: an architrave on the columns and a cornice over it, following the ring ──
  const band = (inner: number, outer: number, y0: number, y1: number, ink: string, color: ColorInput): void => {
    const o = offset(P, pv.ring + outer), n = offset(P, pv.ring + inner);
    b.with({ color, pattern: PATTERN.none, ink }, () => {
      for (let i = 0; i < o.length; i++) {
        const j = (i + 1) % o.length;
        const a = o[i]!, c = o[j]!, ai = n[i]!, ci = n[j]!;
        b.quad([c[0], y0, c[1]], [a[0], y0, a[1]], [a[0], y1, a[1]], [c[0], y1, c[1]]); // outer face
        b.quad([ai[0], y0, ai[1]], [ci[0], y0, ci[1]], [ci[0], y1, ci[1]], [ai[0], y1, ai[1]]); // inner face
        b.quad([a[0], y0, a[1]], [c[0], y0, c[1]], [ci[0], y0, ci[1]], [ai[0], y0, ai[1]]); // soffit
      }
    });
  };
  const archTop = pv.architrave + 0.1;
  band(-0.075, 0.075, pv.architrave, archTop, 'architrave', col.stone);
  band(-0.09, 0.11, archTop, pv.eave, 'cornice', col.shade);

  // ── the ceiling under the roof and its eaves, one flat face looking down ──
  const eaveLine = offset(P, pv.eaveOut);
  b.with({ color: col.stone, pattern: PATTERN.none, ink: 'soffit' }, () => b.polygon(up(eaveLine, pv.eave)));

  // ── the roof: one tier, or over a taller stack two, with a clerestory drum between them ──
  const t = 0.045;
  const base = pv.eave + t;
  if (!pv.tier) {
    const top = roofTier(b, pv, pv.eaveOut, base, null, col.roof, 'roof');
    crown(b, pv, pv.eaveOut, top, col);
  } else {
    const { inset, drum, eave: e2 } = pv.tier;
    const cut = inset + pv.eaveOut;
    roofTier(b, pv, pv.eaveOut, base, cut, col.roof, 'roof');
    const y0 = base + pv.pitch * cut - 0.03, y1 = y0 + 0.03 + drum;
    const Q = offset(P, -inset);
    b.with({ color: col.stone, pattern: PATTERN.marble, ink: 'drum' }, () => b.extrude(Q, y0, y1, { cap: 'none' }));
    // A window in each face of the drum: it lights up at dusk.
    b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'drum-glass' }, () => {
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i]!, c = Q[(i + 1) % Q.length]!;
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const w = Math.min(len * 0.5, 0.2);
        if (w < 0.06) continue;
        const n = normalOf(Q, i), m: V2 = [(a[0] + c[0]) / 2 + n[0] * 0.012, (a[1] + c[1]) / 2 + n[1] * 0.012];
        const ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len;
        const wy0 = y0 + 0.03 + drum * 0.25, wy1 = y1 - drum * 0.2;
        faceOut(b, [[m[0] - ux * w / 2, wy0, m[1] - uz * w / 2], [m[0] + ux * w / 2, wy0, m[1] + uz * w / 2], [m[0] + ux * w / 2, wy1, m[1] + uz * w / 2], [m[0] - ux * w / 2, wy1, m[1] - uz * w / 2]], [n[0], 0, n[1]]);
      }
    });
    const e = e2 - inset;
    b.with({ color: col.stone, pattern: PATTERN.none, ink: 'soffit2' }, () => b.polygon(up(offset(P, e), y1)));
    const top = roofTier(b, pv, e, y1 + t, null, col.roof, 'roof2');
    crown(b, pv, e, top, col);
  }

}

/** A flat face, wound so that it faces `out`. */
function faceOut(b: MeshBuilder, pts: V3[], out: V3): void {
  const [a, c, d] = pts as [V3, V3, V3];
  const u: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v: V3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const p = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0 ? pts : [...pts].reverse();
  if (p.length === 3) b.tri(p[0]!, p[1]!, p[2]!);
  else b.quad(p[0]!, p[1]!, p[2]!, p[3]!);
}

/** One triangle of the roof's fan: points in plan, and how high each is above the eave line (in units of pitch). */
interface FanTri {
  p: [V2, V2, V2];
  h: [number, number, number];
}

/**
 * The roof as a fan of triangles in plan: from each hub's centre to the points round it. The height of the
 * roof over a point is pitch × its distance in from the eave; within one triangle it is planar.
 */
function roofFan(pv: Pavilion, e: number): FanTri[] {
  const E = offset(pv.outline, e);
  const P = pv.outline;
  const tris: FanTri[] = [];
  if (pv.round) {
    const c = pv.centre;
    for (let i = 0; i < E.length; i++) tris.push({ p: [c, E[i]!, E[(i + 1) % E.length]!], h: [1 + e, 0, 0] });
    return tris;
  }
  // A one-wide plan. Each cell's ring of points, counter-clockwise from its NW corner: a corner, the side's
  // middle, the next corner… A corner on the outline moves out to the eave with the outline; a cut corner is
  // its two cut points; a joined side's middle lies on the ridge (height r).
  const where = (p: V2): V2 => {
    // The eave point of a point on the outline: a vertex moves with its mitre, a point on a side along its normal.
    for (let i = 0; i < P.length; i++) if (Math.abs(P[i]![0] - p[0]) < 1e-6 && Math.abs(P[i]![1] - p[1]) < 1e-6) return E[i]!;
    for (let i = 0; i < P.length; i++) {
      const a = P[i]!, c = P[(i + 1) % P.length]!;
      const cross = (c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0]);
      const dot = (p[0] - a[0]) * (c[0] - a[0]) + (p[1] - a[1]) * (c[1] - a[1]);
      const l2 = (c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2;
      if (Math.abs(cross) < 1e-6 && dot > -1e-6 && dot < l2 + 1e-6) {
        const n = normalOf(P, i);
        return [p[0] + n[0] * e, p[1] + n[1] * e];
      }
    }
    return p;
  };
  const cut = 0.5 * (1 - TAN8);
  for (const hub of pv.hubs) {
    const [cx, cz] = hub.c;
    const x = cx - 0.5, z = cz - 0.5;
    const corners: V2[] = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]]; // NW NE SE SW: corner k starts side k
    const ring: { p: V2; h: number }[] = [];
    for (let k = 0; k < 4; k++) {
      const v = corners[k]!;
      const prevOpen = !hub.joined[(k + 3) & 3], thisOpen = !hub.joined[k];
      if (prevOpen && thisOpen) {
        // A cut corner: a point back along the previous side, a point on along this one.
        const a = corners[(k + 3) & 3]!, n = corners[(k + 1) & 3]!;
        const back: V2 = [v[0] + Math.sign(a[0] - v[0]) * cut, v[1] + Math.sign(a[1] - v[1]) * cut];
        const on: V2 = [v[0] + Math.sign(n[0] - v[0]) * cut, v[1] + Math.sign(n[1] - v[1]) * cut];
        ring.push({ p: where(back), h: 0 }, { p: where(on), h: 0 });
      } else ring.push({ p: where(v), h: 0 });
      const m: V2 = [(v[0] + corners[(k + 1) & 3]![0]) / 2, (v[1] + corners[(k + 1) & 3]![1]) / 2];
      ring.push(thisOpen ? { p: where(m), h: 0 } : { p: m, h: 0.5 + e });
    }
    // Points on the outline are at the eave (0); a joined side's middle and the centre are on the ridge.
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!, c = ring[(i + 1) % ring.length]!;
      tris.push({ p: [hub.c, a.p, c.p], h: [0.5 + e, a.h, c.h] });
    }
  }
  return tris;
}

/** The roof's hips and ridges in plan, with their heights (in fan units): the lines that get a roll. */
function roofLines(pv: Pavilion, e: number): [V2, V2, number, number][] {
  const lines: [V2, V2, number, number][] = [];
  const E = offset(pv.outline, e);
  const P = pv.outline;
  if (pv.round) {
    for (const v of E) lines.push([pv.centre, v, 1 + e, 0]);
    return lines;
  }
  for (const hub of pv.hubs) {
    // Hips: from the cell's centre to each outline vertex in the cell that is a convex corner.
    for (let i = 0; i < P.length; i++) {
      const v = P[i]!, a = P[(i + P.length - 1) % P.length]!, c = P[(i + 1) % P.length]!;
      const convex = (v[0] - a[0]) * (c[1] - v[1]) - (v[1] - a[1]) * (c[0] - v[0]) > 0;
      if (!convex) continue;
      if (Math.abs(v[0] - hub.c[0]) > 0.5 + 1e-6 || Math.abs(v[1] - hub.c[1]) > 0.5 + 1e-6) continue;
      lines.push([hub.c, E[i]!, 0.5 + e, 0]);
    }
    // Ridges: to each joined side's middle (half of the ridge to the next cell's centre).
    ([[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]] as const).forEach(([dx, dz], k) => {
      if (hub.joined[k]) lines.push([hub.c, [hub.c[0] + dx, hub.c[1] + dz], 0.5 + e, 0.5 + e]);
    });
  }
  return lines;
}

/**
 * One tier of roof: its eave `e` out from the outline (in, when negative) with the fascia's top at `base`;
 * cut off level where it reaches `cut` (in fan units: distance in from its eave) when a drum stands there.
 * Returns the height of its top.
 */
function roofTier(b: MeshBuilder, pv: Pavilion, e: number, base: number, cut: number | null, roofColor: ColorInput, ink: string): number {
  const t = 0.045; // the roof's thickness at the eave: its fascia
  const Y = (h: number): number => base + h * pv.pitch;
  const lim = cut ?? Infinity;
  b.with({ color: roofColor, pattern: PATTERN.shingles, ink }, () => {
    for (const f of roofFan(pv, e)) {
      if (Math.abs(f.h[0] - f.h[1]) < 1e-9 && Math.abs(f.h[1] - f.h[2]) < 1e-9 && f.h[0] > 0.01) continue; // flat on the ridge: a sliver
      // Keep the part at or below the cut (the height is linear over the triangle).
      const kept: V3[] = [];
      for (let i = 0; i < 3; i++) {
        const p = f.p[i]!, hp = f.h[i]!, q = f.p[(i + 1) % 3]!, hq = f.h[(i + 1) % 3]!;
        if (hp <= lim + 1e-9) kept.push([p[0], Y(hp), p[1]]);
        if ((hp - lim) * (hq - lim) < -1e-12) {
          const k = (lim - hp) / (hq - hp);
          kept.push([p[0] + (q[0] - p[0]) * k, Y(lim), p[1] + (q[1] - p[1]) * k]);
        }
      }
      if (kept.length === 3) faceOut(b, kept, [0, 1, 0]);
      else if (kept.length === 4) faceOut(b, kept, [0, 1, 0]);
    }
    // The fascia round the eave.
    const E = offset(pv.outline, e);
    for (let i = 0; i < E.length; i++) {
      const a = E[i]!, c = E[(i + 1) % E.length]!;
      b.quad([c[0], base - t, c[1]], [a[0], base - t, a[1]], [a[0], base, a[1]], [c[0], base, c[1]]);
    }
  });

  // A roll on every hip and ridge (the lines between facets that are not valleys).
  const w = 0.03, lift = 0.028;
  b.with({ color: roofColor, pattern: PATTERN.none, ink: `${ink}-hips` }, () => {
    for (const [a0, c, ha0, hc] of roofLines(pv, e)) {
      // Clip at the cut (from the high end, a, down to the eave end, c).
      let a = a0, ha = ha0;
      if (ha > lim) {
        if (hc >= lim) continue;
        const k = (ha - lim) / (ha - hc);
        a = [a0[0] + (c[0] - a0[0]) * k, a0[1] + (c[1] - a0[1]) * k];
        ha = lim;
      }
      const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const sx = (-dz / l) * w, sz = (dx / l) * w;
      const ya = Y(ha), yc = Y(hc);
      const drop = w * pv.pitch * 0.9 + 0.004;
      const A: V3 = [a[0], ya + lift, a[1]], C: V3 = [c[0], yc + lift, c[1]];
      const Al: V3 = [a[0] + sx, ya - drop, a[1] + sz], Cl: V3 = [c[0] + sx, yc - drop, c[1] + sz];
      const Ar: V3 = [a[0] - sx, ya - drop, a[1] - sz], Cr: V3 = [c[0] - sx, yc - drop, c[1] - sz];
      faceOut(b, [Al, Cl, C, A], [sx, w, sz]);
      faceOut(b, [Cr, Ar, A, C], [-sx, w, -sz]);
      // The end at the eave.
      if (hc === 0) faceOut(b, [Cl, Cr, C], [dx, 0, dz]);
    }
  });
  return Y((pv.round ? 1 : 0.5) + e);
}

/** The crown: over the octagon a lantern (one tier) or a finial (two); a finial at each end of a one-wide roof's ridges. */
function crown(b: MeshBuilder, pv: Pavilion, e: number, top: number, col: PavilionColours): void {
  const finial = (x: number, y: number, z: number, s: number): void => {
    b.at(translation(x, y, z), () => b.lathe([[0.025 * s, -0.03], [0.04 * s, 0.03 * s], [0.012 * s, 0.07 * s], [0.022 * s, 0.1 * s], [0, 0.15 * s]], { segments: 6 }));
  };
  if (pv.round) {
    const [cx, cz] = pv.centre;
    if (pv.tier) {
      b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'finial' }, () => finial(cx, top, cz, 1.15));
      return;
    }
    const r = 0.15;
    const yb = top - pv.pitch * (r + 0.04);
    b.at(translation(cx, 0, cz), () =>
      b.at(rotationY(Math.PI / 8), () => {
        b.with({ color: col.shade, pattern: PATTERN.none, ink: 'lantern' }, () => b.lathe([[r, yb], [r, top + 0.1], [r + 0.03, top + 0.1], [r + 0.03, top + 0.13]], { segments: 8, smooth: false }));
        // A small window in each face: the lantern lights up at dusk.
        b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'lantern-glass' }, () => {
          const ap = r * Math.cos(Math.PI / 8) + 0.008, hw = 0.045;
          for (let k = 0; k < 8; k++) {
            const a = ((k + 0.5) * Math.PI) / 4, nx = Math.cos(a), nz = Math.sin(a);
            const m: V2 = [nx * ap, nz * ap];
            faceOut(b, [[m[0] - nz * hw, top + 0.015, m[1] + nx * hw], [m[0] + nz * hw, top + 0.015, m[1] - nx * hw], [m[0] + nz * hw, top + 0.085, m[1] - nx * hw], [m[0] - nz * hw, top + 0.085, m[1] + nx * hw]], [nx, 0, nz]);
          }
        });
        b.with({ color: col.roof, pattern: PATTERN.shingles, ink: 'lantern-roof' }, () =>
          b.lathe([[r + 0.06, top + 0.13], [0.02, top + 0.13 + (r + 0.04) * 1.15]], { segments: 8, smooth: false, capBottom: true }),
        );
      }),
    );
    b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'finial' }, () => finial(cx, top + 0.13 + (r + 0.04) * 1.15, cz, 1));
    return;
  }
  void e;
  b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'finial' }, () => {
    for (const hub of pv.hubs) {
      const n = hub.joined.filter(Boolean).length;
      if (n !== 1 && !(n === 2 && hub.joined[0] !== hub.joined[2]) && n !== 3) continue;
      finial(hub.c[0], top + 0.01, hub.c[1], 0.85);
    }
  });
}
