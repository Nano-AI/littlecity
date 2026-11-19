// The hull kit (Animation owner): boats drawn the way a boatbuilder lays
// them out, lofted from stations, not extruded from a profile.
//
// A hull is described by a few numbers (HullSpec) and built as a grid of
// points: STATIONS from the transom (t = 0) to the stem (t = 1), and ROWS up
// each station from the keel to the sheer. From those numbers come the
// things that make a boat read as a boat:
//
//   sheer      the gunwale line dips amidships and rises to the bow (and a
//              little to the stern)
//   plan       beam widest a little aft of the middle, a flat transom, a
//              pointed bow
//   sections   round and full amidships, a V toward the bow
//   stem       raked: it leans forward above the water and is cut away below
//   waterline  local y = 0. The hull goes down to −draft; the sea is opaque,
//              so that part is hidden, and a band of bottom paint shows just
//              above the water as a boot stripe
//   inside     hollow: an inner skin, a sole (floor) and a gunwale between
//              the two skins that closes into a breasthook at the bow
//
// Frame: +Z is forward (the bow), +Y up, y = 0 the waterline, x = 0 the
// centreline. The outer skin has smooth normals, so it shades in soft bands
// and is inked only round its outline, along the stem and round the transom.
//
// Nothing here uses a world-space pattern: a boat moves, and a pattern that
// is drawn in world space would swim across it.

import type { Vec3 } from '@/core/mat4';
import type { ColorInput, MeshBuilder } from '@/gen/mesh';

export interface HullSpec {
  /** Length overall, stem head to transom top. */
  length: number;
  /** Greatest breadth, outside the skin. */
  beam: number;
  /** Height of the sheer above the water at its lowest. */
  freeboard: number;
  /** How much higher the sheer is at the bow, and at the stern. */
  bowRise: number;
  sternRise: number;
  /** Depth of the keel below the water amidships. */
  draft: number;
  /** Where the beam is greatest, 0 (stern) to 1 (bow). */
  widest: number;
  /** Breadth of the transom's top as a fraction of the beam. */
  transom: number;
  /** How fine the bow is in plan: 1 is a parabola's point, less is bluffer, more is sharper. */
  bowPoint: number;
  /** How far the stem leans forward, and the transom aft, per unit of height. */
  stemRake: number;
  transomRake: number;
  /** Section shape amidships (0.3 is a round, full bilge) and at the bow (1 is a straight V). */
  round: number;
  vee: number;
  /** Thickness of the side at the gunwale. */
  skin: number;
  /** Height of the sheer strake (the painted band under the gunwale). */
  strake: number;
  /** How far the bottom paint shows above the water. */
  boot: number;
  /** Height of the sole (the floor inside) above the water. */
  sole: number;
  /** Stations from stern to bow (default 10). */
  stations?: number;
}

export interface HullColors {
  /** Bottom paint: below the water and the boot stripe. */
  bottom: ColorInput;
  topsides: ColorInput;
  strake: ColorInput;
  /** The gunwale's top. */
  rail: ColorInput;
  /** The inner skin and the inside of the transom. */
  inside: ColorInput;
  sole: ColorInput;
}

export interface Hull {
  spec: HullSpec;
  /** Fore-and-aft position of station t at height y (the stem and transom rake). */
  z(t: number, y: number): number;
  /** The station that lies at z on the waterline. */
  t(z: number): number;
  /** Height of the sheer at station t, and depth of the keel below the water there. */
  sheer(t: number): number;
  keel(t: number): number;
  /** Half-breadth of the outside of the hull, and of the inside, at station t and height y. */
  outer(t: number, y: number): number;
  inner(t: number, y: number): number;
  /** The top of the stem and the middle of the transom's top. */
  stemHead: Vec3;
  sternHead: Vec3;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function unit(v: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len < 1e-9 ? fallback : [v[0] / len, v[1] / len, v[2] / len];
}
const UP: Vec3 = [0, 1, 0];

/**
 * A triangle or quad with a normal at each corner. The winding is taken from the normals (the face
 * looks the way they point), and slivers of no area are left out, so callers can loft grids that
 * collapse to a line (a stem, a keel) without thinking about either.
 */
export function face(b: MeshBuilder, pts: readonly Vec3[], normals: readonly Vec3[]): void {
  const tri = (i: number, j: number, k: number): void => {
    const g = cross(sub(pts[j]!, pts[i]!), sub(pts[k]!, pts[i]!));
    if (Math.hypot(g[0], g[1], g[2]) < 1e-8) return;
    const want: Vec3 = [normals[i]![0] + normals[j]![0] + normals[k]![0], normals[i]![1] + normals[j]![1] + normals[k]![1], normals[i]![2] + normals[j]![2] + normals[k]![2]];
    if (dot(g, want) >= 0) b.tri(pts[i]!, pts[j]!, pts[k]!, { normals: [normals[i]!, normals[j]!, normals[k]!] });
    else b.tri(pts[i]!, pts[k]!, pts[j]!, { normals: [normals[i]!, normals[k]!, normals[j]!] });
  };
  tri(0, 1, 2);
  if (pts.length === 4) tri(0, 2, 3);
}

/** The mirror image (across x = 0) of a face, leaving out any triangle lying on the centreline: it is its own mirror. */
export function faceMirror(b: MeshBuilder, pts: readonly Vec3[], normals: readonly Vec3[]): void {
  const m = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];
  const tris = pts.length === 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
  for (const t of tris) {
    if (t.every((i) => Math.abs(pts[i]![0]) < 1e-6)) continue;
    face(b, t.map((i) => m(pts[i]!)), t.map((i) => m(normals[i]!)));
  }
}

/** A flat face through `pts` that looks along `toward` (whichever way round the points are given). */
export function flat(b: MeshBuilder, pts: readonly Vec3[], toward: Vec3): void {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    nx += (p[1] - q[1]) * (p[2] + q[2]);
    ny += (p[2] - q[2]) * (p[0] + q[0]);
    nz += (p[0] - q[0]) * (p[1] + q[1]);
  }
  if (Math.hypot(nx, ny, nz) < 1e-9) return;
  b.polygon(nx * toward[0] + ny * toward[1] + nz * toward[2] >= 0 ? pts : [...pts].reverse());
}

/** The shape functions of a hull, with nothing drawn. */
export function hullShape(spec: HullSpec): Hull {
  const half = spec.beam / 2;
  const sheer = (t: number): number => {
    const f = Math.max(0, (t - 0.4) / 0.6), a = Math.max(0, (0.4 - t) / 0.4);
    return spec.freeboard + spec.bowRise * f * f + spec.sternRise * a * a;
  };
  const keel = (t: number): number => {
    const f = clamp01((t - 0.55) / 0.45), a = clamp01((0.3 - t) / 0.3);
    return spec.draft * (1 - 0.78 * f * f) * (1 - 0.35 * a * a);
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
    const s = sheer(t), k = keel(t);
    const h = clamp01((y + k) / (s + k));
    const p = spec.round + (spec.vee - spec.round) * smooth((t - 0.45) / 0.55);
    return plan(t) * h ** p;
  };
  // The waterline length: what is left of the length overall once the rakes are taken off.
  const l0 = spec.length - spec.stemRake * sheer(1) - spec.transomRake * sheer(0);
  const z = (t: number, y: number): number => (t - 0.5) * l0 + spec.stemRake * y * t * t * t - spec.transomRake * y * (1 - t) ** 3;
  return {
    spec,
    z,
    t: (zz) => zz / l0 + 0.5,
    sheer,
    keel,
    outer,
    inner: (t, y) => Math.max(0, outer(t, y) - spec.skin),
    stemHead: [0, sheer(1), z(1, sheer(1))],
    sternHead: [0, sheer(0), z(0, sheer(0))],
  };
}

/** Draws the hull: outer skin with its paint bands, gunwale, inner skin, sole and transom. */
export function drawHull(b: MeshBuilder, spec: HullSpec, colors: HullColors, ink: { hull: string; inside: string } = { hull: 'hull', inside: 'inside' }): Hull {
  const hull = hullShape(spec);
  const n = Math.max(4, Math.round(spec.stations ?? 10));
  // A few more stations toward the bow, where the plan curves most.
  const ts: number[] = [];
  for (let i = 0; i <= n; i++) ts.push(1 - (1 - i / n) ** 1.2);
  // ── the outer skin: rows from the keel to the sheer ──
  const rowsOf = (t: number): number[] => {
    const s = hull.sheer(t), k = -hull.keel(t);
    const strakeFoot = Math.max(spec.boot + 0.012, s - spec.strake);
    return [k, k * 0.5, 0, spec.boot, (spec.boot + strakeFoot) / 2, strakeFoot, s];
  };
  const ROWS = 7;
  const grid: Vec3[][] = ts.map((t) => rowsOf(t).map((y): Vec3 => [hull.outer(t, y), y, hull.z(t, y)]));
  const normalAt = (g: Vec3[][], i: number, j: number, rows: number, inward: boolean): Vec3 => {
    const along = sub(g[Math.min(n, i + 1)]![j]!, g[Math.max(0, i - 1)]![j]!);
    const up = sub(g[i]![Math.min(rows - 1, j + 1)]!, g[i]![Math.max(0, j - 1)]!);
    const c = unit(cross(up, along), [1, 0, 0]);
    return inward ? [-c[0], -c[1], -c[2]] : c;
  };
  const outerN: Vec3[][] = grid.map((row, i) =>
    row.map((_, j) => {
      const nn = normalAt(grid, i, j, ROWS, false);
      // The top edge rolls over into the gunwale: no crease is inked along the sheer.
      return j === ROWS - 1 ? unit([nn[0], nn[1] + 0.9, nn[2]]) : nn;
    }),
  );
  const mirror = (p: Vec3): Vec3 => [-p[0], p[1], p[2]];
  const bandColor = [colors.bottom, colors.bottom, colors.bottom, colors.topsides, colors.topsides, colors.strake];
  b.with({ ink: ink.hull }, () => {
    for (let j = 0; j + 1 < ROWS; j++) {
      b.setColor(bandColor[j]!);
      for (let i = 0; i < n; i++) {
        const p = [grid[i]![j]!, grid[i + 1]![j]!, grid[i + 1]![j + 1]!, grid[i]![j + 1]!];
        const q = [outerN[i]![j]!, outerN[i + 1]![j]!, outerN[i + 1]![j + 1]!, outerN[i]![j + 1]!];
        face(b, p, q);
        faceMirror(b, p, q);
      }
    }
    // The gunwale: from the outer sheer in to the inner skin. Where the hull is narrower than two
    // skins (the bow) it closes right across: the breasthook.
    b.setColor(colors.rail);
    for (let i = 0; i < n; i++) {
      const a = grid[i]![ROWS - 1]!, c = grid[i + 1]![ROWS - 1]!;
      const ai: Vec3 = [Math.max(0, a[0] - spec.skin), a[1], a[2]], ci: Vec3 = [Math.max(0, c[0] - spec.skin), c[1], c[2]];
      const p = [a, c, ci, ai];
      const q = [outerN[i]![ROWS - 1]!, outerN[i + 1]![ROWS - 1]!, UP, UP];
      face(b, p, q);
      faceMirror(b, p, q);
    }
    // The transom: a flat board across the stern, and its top edge.
    const stern = grid[0]!;
    const outline: Vec3[] = [...stern.slice(1).map(mirror), ...stern.slice(1).reverse()];
    const keelPoint = stern[0]!;
    b.setColor(colors.topsides);
    flat(b, [keelPoint, ...outline], [0, 0, -1]);
    const top = stern[ROWS - 1]!;
    const tx = Math.max(0, top[0] - spec.skin);
    b.setColor(colors.rail);
    flat(b, [[-tx, top[1], top[2]], [tx, top[1], top[2]], [tx, top[1], top[2] + spec.skin], [-tx, top[1], top[2] + spec.skin]], UP);
  });

  // ── the inside: inner skin, sole, the inner face of the transom ──
  const insideRows = (t: number): number[] => {
    const s = hull.sheer(t);
    const lo = Math.min(spec.sole, s - 0.01);
    return [lo, (lo + s) / 2, s];
  };
  const inner: Vec3[][] = ts.map((t) => insideRows(t).map((y): Vec3 => [hull.inner(t, y), y, hull.z(t, y)]));
  const innerN: Vec3[][] = inner.map((row, i) => row.map((_, j) => normalAt(inner, i, j, 3, true)));
  b.with({ ink: ink.inside, color: colors.inside }, () => {
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < n; i++) {
        const p = [inner[i]![j]!, inner[i + 1]![j]!, inner[i + 1]![j + 1]!, inner[i]![j + 1]!];
        const q = [innerN[i]![j]!, innerN[i + 1]![j]!, innerN[i + 1]![j + 1]!, innerN[i]![j + 1]!];
        face(b, p, q);
        faceMirror(b, p, q);
      }
    }
    const back = inner[0]!;
    const dz = spec.skin;
    flat(b, [mirror(back[0]!), back[0]!, back[1]!, back[2]!, mirror(back[2]!), mirror(back[1]!)].map((p): Vec3 => [p[0], p[1], p[2] + dz]), [0, 0, 1]);
    b.setColor(colors.sole);
    for (let i = 0; i < n; i++) {
      const a = inner[i]![0]!, c = inner[i + 1]![0]!;
      face(b, [mirror(a), a, c, mirror(c)], [UP, UP, UP, UP]);
    }
  });
  return hull;
}

/** A plank across the boat at station t: a thwart, a seat. Its ends are let into the skin. */
export function thwart(b: MeshBuilder, hull: Hull, t: number, width: number, top: number, thick = 0.02): void {
  const zc = hull.z(t, top);
  const x = Math.min(hull.inner(hull.t(zc - width / 2), top), hull.inner(hull.t(zc + width / 2), top)) + hull.spec.skin * 0.4;
  if (x <= 0.01) return;
  b.box([-x, top - thick, zc - width / 2], [x, top, zc + width / 2], { skip: ['w', 'e'] });
}

/**
 * A deck from station t0 to t1 a little below the sheer, cambered (higher along the middle), with a
 * bulkhead closing its open ends down to the sole. Its edges are let into the skin.
 */
export function deck(b: MeshBuilder, hull: Hull, t0: number, t1: number, drop = 0.012, camber = 0.012, steps = 5): void {
  const pts: { l: Vec3; m: Vec3; r: Vec3 }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const y = hull.sheer(t) - drop;
    const x = hull.inner(t, y) + hull.spec.skin * 0.5;
    const z = hull.z(t, y);
    pts.push({ l: [-x, y, z], m: [0, y + camber * Math.min(1, x / 0.08), z], r: [x, y, z] });
  }
  const tilt = (side: number): Vec3 => unit([side * 0.18, 1, 0]);
  for (let i = 0; i < steps; i++) {
    const a = pts[i]!, c = pts[i + 1]!;
    face(b, [a.m, a.r, c.r, c.m], [UP, tilt(1), tilt(1), UP]);
    face(b, [a.l, a.m, c.m, c.l], [tilt(-1), UP, UP, tilt(-1)]);
  }
  const bulkhead = (t: number, toward: number): void => {
    const y = hull.sheer(t) - drop, lo = Math.min(hull.spec.sole, y - 0.005);
    const x1 = hull.inner(t, y) + hull.spec.skin * 0.5, x0 = hull.inner(t, lo) + hull.spec.skin * 0.5;
    if (x1 < 0.012) return;
    const zt = hull.z(t, y), zb = hull.z(t, lo);
    flat(b, [[-x0, lo, zb], [x0, lo, zb], [x1, y, zt], [0, y + camber * Math.min(1, x1 / 0.08), zt], [-x1, y, zt]], [0, 0, toward]);
  };
  if (t0 > 0.02) bulkhead(t0, -1);
  if (t1 < 0.98) bulkhead(t1, 1);
}

/** A round spar standing at (x, z) from y0 to y1, tapering from r0 to r1. */
export function spar(b: MeshBuilder, x: number, z: number, y0: number, y1: number, r0: number, r1 = r0, segments = 6): void {
  b.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1], () => b.lathe([[r0, y0], [r1, y1]], { segments, capTop: true }));
}

/** A stick of square section from a to b, `w` thick, with one soft normal round it. For oars, booms, tillers. */
export function stick(b: MeshBuilder, a: Vec3, c: Vec3, w: number, h = w): void {
  const d = unit(sub(c, a), [0, 0, 1]);
  // Two directions across the stick: sideways (level) and the one square to both.
  const side = unit(cross(UP, d), [1, 0, 0]);
  const up = unit(cross(d, side));
  const corner = (p: Vec3, sx: number, sy: number): Vec3 => [p[0] + side[0] * sx * w * 0.5 + up[0] * sy * h * 0.5, p[1] + side[1] * sx * w * 0.5 + up[1] * sy * h * 0.5, p[2] + side[2] * sx * w * 0.5 + up[2] * sy * h * 0.5];
  const ring: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = ring[i]!, [x1, y1] = ring[(i + 1) % 4]!;
    const nn = unit([side[0] * (x0 + x1) + up[0] * (y0 + y1), side[1] * (x0 + x1) + up[1] * (y0 + y1), side[2] * (x0 + x1) + up[2] * (y0 + y1)]);
    face(b, [corner(a, x0, y0), corner(a, x1, y1), corner(c, x1, y1), corner(c, x0, y0)], [nn, nn, nn, nn]);
  }
  flat(b, ring.map(([x, y]) => corner(a, x, y)), [-d[0], -d[1], -d[2]]);
  flat(b, ring.map(([x, y]) => corner(c, x, y)), d);
}
