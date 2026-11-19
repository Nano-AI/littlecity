// The big ships' hull kit (L38–L41). Like the small boats' kit
// (../boats/hull.ts) a hull is lofted from stations, transom (t = 0) to stem
// (t = 1), and rows up each station from the keel to the rail. What is new:
//
//   tumblehome  the sides are widest a little above the water and lean in
//               toward the rail, the way a galleon's do
//   decks       stepped: a waist, and raised castles fore and aft, each its
//               own flat deck, with a bulkhead (the castle's front, with a
//               door) where one deck steps up to the next
//   bulwarks    an inner skin from each deck up to the rail
//   bands       the outer skin is painted in bands by height (bottom, boot,
//               the wood of the hull, the livery of the upper works), and a
//               wale runs proud along it as a moulding with a pen line
//
// Frame: +Z the bow, +Y up, y = 0 the waterline, x = 0 the centreline. No
// world-space pattern anywhere: a ship moves and a pattern would swim.

import type { Vec3 } from '@/core/mat4';
import type { ColorInput, MeshBuilder } from '@/gen/mesh';
import { face, flat, unit } from '../boats/hull';

export interface DeckSpan {
  /** Stations [t0, t1] and the deck's height above the water. */
  t0: number;
  t1: number;
  y: number;
}

export interface ShipHullSpec {
  /** Length on the rail, stem head to stern. */
  length: number;
  beam: number;
  draft: number;
  /** Where the beam is greatest, 0 (stern) to 1 (bow), and at what height. */
  widest: number;
  widestY: number;
  /** Breadth of the stern at the rail as a fraction of the beam. */
  transom: number;
  /** How fine the bow is in plan: 1 a parabola's point, less is bluffer. */
  bowPoint: number;
  /** Lean of the stem forward and the stern aft, per unit of height. */
  stemRake: number;
  transomRake: number;
  /** Sections: round amidships (low) to a V at the bow (high). */
  round: number;
  vee: number;
  /** How much the sides lean in above the widest, per unit of height (0.15 is a galleon's). */
  tumble: number;
  /** Height of the rail above the water at station t. */
  rail(t: number): number;
  /** The decks, stern to bow, covering [0, 1] without gaps. */
  decks: readonly DeckSpan[];
  /** Thickness of the bulwark. */
  skin: number;
  /** Stations, ascending from 0 to 1: put one at every deck step and where the rail turns. */
  stations: readonly number[];
}

export interface ShipHull {
  spec: ShipHullSpec;
  z(t: number, y: number): number;
  /** The station at z on the waterline. */
  t(z: number): number;
  keel(t: number): number;
  /** Half-breadth of the outside at station t and height y; of the inside of the bulwark. */
  outer(t: number, y: number): number;
  inner(t: number, y: number): number;
  deck(t: number): number;
  rail(t: number): number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const UP: Vec3 = [0, 1, 0];
const mirror = (p: Vec3): Vec3 => [-p[0], p[1], p[2]];

export function shipShape(spec: ShipHullSpec): ShipHull {
  const half = spec.beam / 2;
  const keel = (t: number): number => {
    const f = clamp01((t - 0.6) / 0.4), a = clamp01((0.25 - t) / 0.25);
    return spec.draft * (1 - 0.7 * f * f) * (1 - 0.3 * a * a);
  };
  const plan = (t: number): number => {
    if (t <= spec.widest) {
      const a = (spec.widest - t) / spec.widest;
      return half * (spec.transom + (1 - spec.transom) * (1 - a * a));
    }
    const u = clamp01((t - spec.widest) / (1 - spec.widest));
    return half * Math.max(0, 1 - u * u) ** spec.bowPoint;
  };
  const outer = (t: number, y: number): number => {
    const k = keel(t);
    const p = spec.round + (spec.vee - spec.round) * smooth((t - 0.5) / 0.5);
    if (y <= spec.widestY) return plan(t) * clamp01((y + k) / (spec.widestY + k)) ** p;
    // Above the widest the side leans in (tumblehome), a little more toward the ends.
    return plan(t) * Math.max(0.55, 1 - spec.tumble * (y - spec.widestY) ** 1.15);
  };
  const deck = (t: number): number => {
    for (const d of spec.decks) if (t >= d.t0 - 1e-9 && t <= d.t1 + 1e-9) return d.y;
    return spec.decks[spec.decks.length - 1]!.y;
  };
  const l0 = spec.length - spec.stemRake * spec.rail(1) - spec.transomRake * spec.rail(0);
  const z = (t: number, y: number): number => (t - 0.5) * l0 + spec.stemRake * y * t * t * t - spec.transomRake * y * (1 - t) ** 3;
  return {
    spec,
    z,
    t: (zz) => zz / l0 + 0.5,
    keel,
    outer,
    inner: (t, y) => Math.max(0, outer(t, y) - spec.skin),
    deck,
    rail: spec.rail,
  };
}

export interface ShipColors {
  bottom: ColorInput;
  /** The dark band at the waterline. */
  boot: ColorInput;
  /** The hull's wood, from the boot to the wale. */
  hull: ColorInput;
  /** The painted upper works, from the wale to the rail, inside and out. */
  upper: ColorInput;
  wale: ColorInput;
  rail: ColorInput;
  deck: ColorInput;
  /** The castles' fronts. */
  bulkhead: ColorInput;
}

export interface HullBands {
  /** Height of the top of the boot stripe. */
  boot: number;
  /** The wale: a moulding standing proud between these heights. */
  wale: readonly [number, number];
  /** How far the wale stands out. */
  waleOut: number;
}

/** Where along the hull the wale runs (it stops short of the stem and the stern). */
const WALE_T: readonly [number, number] = [0.015, 0.97];

/**
 * Draws the hull: outer skin in bands, the proud wale, rail cap, stern, decks, bulwarks and the
 * bulkheads at each deck step. Ink groups: 'hull' (outer skin and stern), 'wale', 'rail', 'deck',
 * 'bulwark', and one 'bulkhead<i>' per step.
 */
export function drawShipHull(b: MeshBuilder, spec: ShipHullSpec, colors: ShipColors, bands: HullBands): ShipHull {
  const hull = shipShape(spec);
  const ts = spec.stations;
  const n = ts.length - 1;
  const rowsOf = (t: number): number[] => {
    const top = hull.rail(t), k = -hull.keel(t);
    const cap = (y: number): number => Math.min(top, y);
    return [k, k * 0.45, 0, cap(bands.boot), cap(bands.wale[0]), cap(bands.wale[1]), cap((bands.wale[1] + top) / 2), top];
  };
  const ROWS = 8;
  const grid: Vec3[][] = ts.map((t) => rowsOf(t).map((y): Vec3 => [hull.outer(t, y), y, hull.z(t, y)]));
  const normalAt = (g: Vec3[][], i: number, j: number, rows: number): Vec3 => {
    let up = sub(g[i]![Math.min(rows - 1, j + 1)]!, g[i]![Math.max(0, j - 1)]!);
    // Rows squeezed together under a low rail: look further for an upward direction.
    for (let k = 2; Math.hypot(up[0], up[1], up[2]) < 1e-6 && k < rows; k++) up = sub(g[i]![Math.min(rows - 1, j + k)]!, g[i]![Math.max(0, j - k)]!);
    const along = sub(g[Math.min(n, i + 1)]![j]!, g[Math.max(0, i - 1)]![j]!);
    return unit(cross(up, along), [1, 0, 0]);
  };
  const outerN = grid.map((row, i) => row.map((_, j) => normalAt(grid, i, j, ROWS)));
  const bandColor = [colors.bottom, colors.bottom, colors.boot, colors.hull, colors.hull, colors.upper, colors.upper];
  b.with({ ink: 'hull' }, () => {
    for (let j = 0; j + 1 < ROWS; j++) {
      b.setColor(bandColor[j]!);
      for (let i = 0; i < n; i++) {
        const p = [grid[i]![j]!, grid[i + 1]![j]!, grid[i + 1]![j + 1]!, grid[i]![j + 1]!];
        const q = [outerN[i]![j]!, outerN[i + 1]![j]!, outerN[i + 1]![j + 1]!, outerN[i]![j + 1]!];
        face(b, p, q);
        face(b, p.map(mirror), q.map(mirror));
      }
    }
    // The stern: a flat board across, its outline the stern station of the skin, painted like the sides.
    const stern = grid[0]!;
    b.setColor(colors.upper);
    const outline: Vec3[] = [...stern.slice(2).map(mirror), ...stern.slice(2).reverse()];
    flat(b, [[0, 0, stern[2]![2]], ...outline], [0, 0, -1]);
    b.setColor(colors.bottom);
    flat(b, [stern[0]!, stern[1]!, stern[2]!, mirror(stern[2]!), mirror(stern[1]!)], [0, 0, -1]);
  });

  // ── the wale: a moulding standing proud along each side ──
  wale(b, hull, bands.wale[0], bands.wale[1], bands.waleOut, WALE_T[0], WALE_T[1], colors.wale, 'wale');

  // ── the rail cap: from the outer skin's top in across the bulwark ──
  b.with({ ink: 'rail', color: colors.rail }, () => {
    for (let i = 0; i < n; i++) {
      const a = grid[i]![ROWS - 1]!, c = grid[i + 1]![ROWS - 1]!;
      const ai: Vec3 = [Math.max(0, a[0] - spec.skin), a[1], a[2]], ci: Vec3 = [Math.max(0, c[0] - spec.skin), c[1], c[2]];
      face(b, [a, c, ci, ai], [UP, UP, UP, UP]);
      face(b, [a, c, ci, ai].map(mirror), [UP, UP, UP, UP]);
    }
    // Across the stern's top.
    const top = grid[0]![ROWS - 1]!;
    const tx = Math.max(0, top[0] - spec.skin);
    face(b, [[-top[0], top[1], top[2]], [top[0], top[1], top[2]], [tx, top[1], top[2] + spec.skin], [-tx, top[1], top[2] + spec.skin]], [UP, UP, UP, UP]);
  });

  // ── decks, each with its bulwarks ──
  const decks = spec.decks;
  decks.forEach((d) => {
    const dts = ts.filter((t) => t >= d.t0 - 1e-9 && t <= d.t1 + 1e-9);
    // The inner face of the bulwark: from the deck up to the rail.
    b.with({ ink: 'bulwark', color: colors.upper }, () => {
      for (let i = 0; i + 1 < dts.length; i++) {
        const a = dts[i]!, c = dts[i + 1]!;
        const p: Vec3[] = [[hull.inner(a, d.y), d.y, hull.z(a, d.y)], [hull.inner(c, d.y), d.y, hull.z(c, d.y)], [hull.inner(c, hull.rail(c)), hull.rail(c), hull.z(c, hull.rail(c))], [hull.inner(a, hull.rail(a)), hull.rail(a), hull.z(a, hull.rail(a))]];
        const nIn = unit([-1, 0.08, 0]);
        face(b, p, [nIn, nIn, nIn, nIn]);
        face(b, p.map(mirror), [nIn, nIn, nIn, nIn].map(mirror));
      }
      // At the stern: the inside of the stern board above this deck.
      if (d.t0 <= 1e-9) {
        const y0 = d.y, y1 = hull.rail(0);
        const x0 = hull.inner(0, y0), x1 = hull.inner(0, y1);
        const z0 = hull.z(0, y0) + spec.skin, z1 = hull.z(0, y1) + spec.skin;
        flat(b, [[-x0, y0, z0], [x0, y0, z0], [x1, y1, z1], [-x1, y1, z1]], [0, 0, 1]);
      }
    });
    b.with({ ink: 'deck', color: colors.deck }, () => {
      for (let i = 0; i + 1 < dts.length; i++) {
        const a = dts[i]!, c = dts[i + 1]!;
        const xa = hull.inner(a, d.y) + 0.002, xc = hull.inner(c, d.y) + 0.002;
        const za = hull.z(a, d.y) + (a <= 1e-9 ? spec.skin : 0), zc = hull.z(c, d.y);
        face(b, [[-xa, d.y, za], [xa, d.y, za], [xc, d.y, zc], [-xc, d.y, zc]], [UP, UP, UP, UP]);
      }
    });
  });
  // ── bulkheads where a deck steps up ──
  for (let i = 0; i + 1 < decks.length; i++) {
    const a = decks[i]!, c = decks[i + 1]!;
    if (Math.abs(a.y - c.y) < 1e-6) continue;
    const t = a.t1;
    const lo = Math.min(a.y, c.y), hi = Math.max(a.y, c.y);
    // It faces the lower deck.
    const toward = a.y > c.y ? 1 : -1;
    const x0 = hull.inner(t, lo), x1 = hull.inner(t, hi);
    const z0 = hull.z(t, lo), z1 = hull.z(t, hi);
    b.with({ ink: `bulkhead${i}`, color: colors.bulkhead }, () => flat(b, [[-x0, lo, z0], [x0, lo, z0], [x1, hi, z1], [-x1, hi, z1]], [0, 0, toward]));
  }
  return hull;
}

/** A moulding standing `out` proud along each side between heights y0 and y1, from station t0 to t1. */
export function wale(b: MeshBuilder, hull: ShipHull, y0: number, y1: number, out: number, t0: number, t1: number, color: ColorInput, ink: string): void {
  b.with({ ink, color }, () => {
    const wt = hull.spec.stations.filter((t) => t > t0 && t < t1);
    wt.unshift(t0);
    wt.push(t1);
    const pt = (t: number, y: number, o: number): Vec3 => [hull.outer(t, y) + o, y, hull.z(t, y)];
    for (const side of [1, -1]) {
      const s = (p: Vec3): Vec3 => (side > 0 ? p : mirror(p));
      for (let i = 0; i + 1 < wt.length; i++) {
        const a = wt[i]!, c = wt[i + 1]!;
        const nOut: Vec3 = [side, 0, 0];
        face(b, [s(pt(a, y0, out)), s(pt(c, y0, out)), s(pt(c, y1, out)), s(pt(a, y1, out))], [nOut, nOut, nOut, nOut]);
        face(b, [s(pt(a, y1, 0)), s(pt(a, y1, out)), s(pt(c, y1, out)), s(pt(c, y1, 0))], [UP, UP, UP, UP]);
        const dn: Vec3 = [0, -1, 0];
        face(b, [s(pt(a, y0, 0)), s(pt(a, y0, out)), s(pt(c, y0, out)), s(pt(c, y0, 0))], [dn, dn, dn, dn]);
      }
      for (const [t, dir] of [[wt[0]!, -1], [wt[wt.length - 1]!, 1]] as const) {
        flat(b, [s(pt(t, y0, 0)), s(pt(t, y0, out)), s(pt(t, y1, out)), s(pt(t, y1, 0))], [0, 0, dir]);
      }
    }
  });
}

/** A point on the outside of the hull at station t, height y, on side `side` (±1), standing `out` proud. */
export function onSide(hull: ShipHull, t: number, y: number, side: number, out = 0): Vec3 {
  return [side * (hull.outer(t, y) + out), y, hull.z(t, y)];
}

/**
 * A flat rectangle laid on the hull's side, centred on station t at height y, `w` long and `h` tall,
 * standing `out` proud, facing outward: windows, gun ports, painted eyes.
 */
export function sidePanel(b: MeshBuilder, hull: ShipHull, t: number, y: number, w: number, h: number, side: number, out: number): void {
  const zc = hull.z(t, y);
  const ta = hull.t(zc - w / 2), tc = hull.t(zc + w / 2);
  const p = (tt: number, yy: number): Vec3 => [side * (hull.outer(tt, yy) + out), yy, hull.z(tt, yy) + (hull.z(t, y) - hull.z(t, yy))];
  flat(b, [p(ta, y - h / 2), p(tc, y - h / 2), p(tc, y + h / 2), p(ta, y + h / 2)], [side, 0, 0]);
}
