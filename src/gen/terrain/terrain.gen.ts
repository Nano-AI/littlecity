// The terrain layer (Look, Stage 1): the floating slab, the sea and the
// island, one mesh per 16 × 16 chunk (design section 6, "Look").
//
// The island is stepped terraces, one per height level, and their outlines
// are ROUNDED, not stair-stepped squares. How:
//
//   Level L's terrace is the set of columns with height >= L. Its outline
//   runs along cell borders, so rounding it only changes the picture near
//   grid vertices. Each cell is therefore cut into four quarter tiles (one
//   per corner), and a quarter's shape depends only on which of the four
//   cells around its grid vertex are in the terrace:
//
//     one cell in, alone      a convex corner: the cell's corner is rounded off
//     three in, one out       a concave corner: a fillet grows into the empty cell
//     anything else           the plain square (or nothing)
//
//   That is all there is to it, it is local (a chunk needs only its cells
//   and a one-cell border), and tiles meet without T-junctions. Outline
//   points then wander a little (seeded, smooth) so no edge is ruler-straight.
//
// A corner radius of 0.5 turns a one-cell stair into an S-curve. Where a
// block or floor stands on a corner cell the corner is squared (a small
// radius), so nothing overhangs a rounded edge: the ground follows the town.
//
// Sides: a bank one level high is earth with a grass lip; a drop of two or
// more is rock; sand slopes into the water as a beach. Tops: grass and sand
// share one surface (the shader draws the wobbly border between them from
// the `edge` attribute, see PATTERN.grass), so beaches have no grid in them.
//
// The sea is one flat sheet at SEA_Y whose `edge` attribute is the distance
// to the shore: the water pattern draws shallows and foam rings from it.

import { CELL_H, columnIndex, inColumnBounds, key, SEA_Y, SIZE_X, SIZE_Z, type Chunk } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import { hashCombine, rand } from '@/core/rand';
import { MAT, type Terrain, type World } from '@/core/world';
import type { ShapePlan } from '@/resolve/plan';
import { PALETTE } from '@/style/palette';
import { terraceGrass, TERRAIN } from '@/style/terrain';
import { defineLayer } from '../api';
import { EDGE_FAR, MeshBuilder, parseColor, PATTERN } from '../mesh';

/** Segments in a quarter-circle of outline. */
const ARC = 6;
/** Sea vertices per cell side near the shore. */
const SEA_GRID = 4;
/** `edge` on open water: far beyond the reach of the shore marks. */
const SEA_FAR = 4;
/** Terrain never rises above this level (design section 6: 6 on generator 1, 10 on a steep island of generator 2). */
const MAX_LEVEL = 10;
/** The shore's foot ends this far under the surface. */
const UNDER_SEA = 0.12;

type Pt = readonly [number, number];
type Shore = 'rock' | 'earth' | 'sand';
/** What a stretch of bank is like. The numbers blend from one stretch to the next round a corner. */
interface BankMix {
  /** How far the foot of the bank stands out from its top. */
  run: number;
  /** 0 earth to 1 rock. The shader draws the wandering border between them (PATTERN.rock reads `edge`). */
  rock: number;
  /** 0 to 1: a grass lip caps it. */
  lip: number;
  /** 0 to 1: a ledge may jut out at the top of this level (a tall face carries one or two). */
  shelf: number;
}
interface EdgeKind extends BankMix {
  shore: Shore;
}
const HARDNESS: Record<Shore, number> = { sand: 0, earth: 1, rock: 2 };
const blend = (a: BankMix, b: BankMix, t: number): BankMix => ({
  run: a.run + (b.run - a.run) * t,
  rock: a.rock + (b.rock - a.rock) * t,
  lip: a.lip + (b.lip - a.lip) * t,
  shelf: a.shelf + (b.shelf - a.shelf) * t,
});

interface Ground {
  seed: number;
  h(x: number, z: number): number;
  mat(x: number, z: number): number;
  /** Corner radius of the level-L outline at grid vertex (vx, vz). */
  radius(vx: number, vz: number, level: number): number;
  /** Moves an outline point off the grid a little. */
  warp(x: number, z: number): Pt;
  /** True if a block or floor stands in column (x, z) anywhere from level `lo` up to below `hi`. */
  built(x: number, z: number, lo: number, hi: number): boolean;
  /** How far a ledge juts out at the top of a level at an outline point, where one is allowed (0 to 1). */
  shelf(x: number, z: number, level: number): number;
}

/** Smooth seeded noise in [0, 1]. */
function vnoise(seed: number, x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = rand(seed, ix, iz), b = rand(seed, ix + 1, iz), c = rand(seed, ix, iz + 1), d = rand(seed, ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/** True if something rests on, or stands in the way of, this cell's corner at a level. */
function mustSquare(t: Terrain, w: World, x: number, z: number, level: number): boolean {
  if (!inColumnBounds(x, z)) return false;
  const here = t.height[columnIndex(x, z)]!;
  if (here === level) return w.blocks.has(key(x, level, z)) || w.floors.has(key(x, level, z));
  if (here < level) {
    // A lower cell: a fillet of the higher terrace would grow into it.
    for (let y = here; y < level; y++) if (w.blocks.has(key(x, y, z))) return true;
  }
  return false;
}

function groundOf(plan: ShapePlan): Ground {
  const t = plan.terrain;
  const w = plan.world;
  const seed = t.seed;
  const h = (x: number, z: number): number => (inColumnBounds(x, z) ? t.height[columnIndex(x, z)]! : 0);
  return {
    seed,
    h,
    mat: (x, z) => (inColumnBounds(x, z) ? t.material[columnIndex(x, z)]! : MAT.water),
    radius(vx, vz, level) {
      if (mustSquare(t, w, vx - 1, vz - 1, level) || mustSquare(t, w, vx, vz - 1, level) || mustSquare(t, w, vx - 1, vz, level) || mustSquare(t, w, vx, vz, level)) {
        return Math.min(TERRAIN.radiusBuilt, TERRAIN.radius);
      }
      return Math.max(0.05, TERRAIN.radius - TERRAIN.radiusVary * rand(seed, 'r', vx, vz));
    },
    warp(x, z) {
      const a = TERRAIN.wobble * 2;
      return [x + (vnoise(seed ^ 0x51, x * 0.83, z * 0.83) - 0.5) * a, z + (vnoise(seed ^ 0xa7, x * 0.83, z * 0.83) - 0.5) * a];
    },
    built(x, z, lo, hi) {
      if (!inColumnBounds(x, z)) return false;
      if (w.floors.has(key(x, lo, z))) return true;
      for (let y = lo; y < hi; y++) if (w.blocks.has(key(x, y, z))) return true;
      return false;
    },
    shelf(x, z, level) {
      // Ledges come and go along a face: a slow noise, cut so that about a third of a face has one.
      const n = vnoise(seed ^ (0x1ed + level * 977), x * 0.5, z * 0.5);
      const t = Math.min(1, Math.max(0, (n - 0.5) / 0.2));
      return t * t * (3 - 2 * t);
    },
  };
}

/** What the bank between a higher cell and a lower one is made of, at one level. */
function edgeKind(g: Ground, hx: number, hz: number, lx: number, lz: number, level: number): EdgeKind {
  const hi = g.h(hx, hz), lo = g.h(lx, lz);
  const m = g.mat(hx, hz);
  const shore: Shore = hi - lo >= 2 || m === MAT.rock ? 'rock' : m === MAT.sand ? 'sand' : 'earth';
  const atWater = level === 1 && lo === 0;
  // A grass bank one level above the water (a river bank; generator 1 always puts sand there) slopes in gently.
  const grassBank = atWater && hi === 1 && m === MAT.grass;
  const run = shore === 'sand' ? TERRAIN.beachRun : grassBank ? TERRAIN.bankRun : atWater ? TERRAIN.shoreRun : shore === 'earth' ? TERRAIN.earthRun : TERRAIN.rockRun;
  // A ledge partway up: only where the face carries on above this level, never at the waterline, and
  // never where something is built against the foot of the face.
  // A tall face carries one ledge, partway up, not one at every level: it reads as one cliff, not a stack.
  const ledgeLevel = lo + Math.max(1, Math.floor((hi - lo) / 2));
  const shelf = hi > level && level === ledgeLevel && !atWater && !g.built(lx, lz, lo, hi) ? 1 : 0;
  return { shore, run, rock: shore === 'rock' ? 1 : 0, lip: shore !== 'sand' && m === MAT.grass && hi === level ? 1 : 0, shelf };
}
const harder = (a: EdgeKind, b: EdgeKind): Shore => (HARDNESS[b.shore] > HARDNESS[a.shore] ? b.shore : a.shore);

// ───────────────────────────────────────────────────────────── emitters ──

/** A triangle that faces up, whatever order its corners come in. */
function upTri(b: MeshBuilder, p0: Vec3, p1: Vec3, p2: Vec3, e0: number, e1: number, e2: number): void {
  const cross = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
  if (cross >= 0) b.tri(p0, p1, p2, { edge: [e0, e1, e2] });
  else b.tri(p0, p2, p1, { edge: [e0, e2, e1] });
}

/** A point of a terrace top: where it is, its "distance from sand" (the grass pattern's `edge`), and how rocky the ground is there. */
interface TopVert {
  p: Vec3;
  e: number;
  r: number;
}
const mixRgb = (a: readonly number[], c: readonly number[], t: number): [number, number, number] => [
  Math.round(a[0]! + (c[0]! - a[0]!) * t),
  Math.round(a[1]! + (c[1]! - a[1]!) * t),
  Math.round(a[2]! + (c[2]! - a[2]!) * t),
];
const lerpTop = (a: TopVert, c: TopVert, t: number): TopVert => ({
  p: [a.p[0] + (c.p[0] - a.p[0]) * t, a.p[1], a.p[2] + (c.p[2] - a.p[2]) * t],
  e: a.e + (c.e - a.e) * t,
  r: a.r + (c.r - a.r) * t,
});
/** Deepest split of a top triangle on its way to the rock border (0.5 / 2^n of a cell). */
const ROCK_DEPTH = 3;

/**
 * Rock or grass at a point of a terrace top: the rock field from the columns (0 to 1, smooth across
 * cells) moved by a wandering noise, less where a tuft of grass holds on. Rock where this is 0.5 or more.
 */
function rockiness(g: Ground, v: TopVert): number {
  const [x, , z] = v.p;
  const wander = (vnoise(g.seed ^ 0x3c1, x * 1.6, z * 1.6) - 0.5) + (vnoise(g.seed ^ 0x77d, x * 4.3, z * 4.3) - 0.5) * 0.35;
  const t = vnoise(g.seed ^ 0x5a9, x * 2.9, z * 2.9);
  const tuft = t > 0.74 ? (t - 0.74) * 4 * TERRAIN.rockTufts * 4 : 0;
  return v.r + wander * TERRAIN.rockWander - tuft;
}

/**
 * One triangle of a terrace top where rock meets grass: split finer near the border (only there),
 * then cut along it. Rock and grass are one ink group, so no line is drawn round a rock patch: the
 * border is a change of surface, rock going mossy and grass going dry toward it.
 */
function splitTop(b: MeshBuilder, g: Ground, level: number, a: TopVert, c: TopVert, d: TopVert, depth: number): void {
  const ra = rockiness(g, a), rc = rockiness(g, c), rd = rockiness(g, d);
  const lo = Math.min(ra, rc, rd), hi = Math.max(ra, rc, rd);
  // How much the noise can move inside a triangle this size.
  const margin = 1.1 * TERRAIN.rockWander * (0.5 / (1 << depth)) + 0.03;
  if (depth < ROCK_DEPTH && lo < 0.5 + margin && hi > 0.5 - margin) {
    const ac = lerpTop(a, c, 0.5), cd = lerpTop(c, d, 0.5), da = lerpTop(d, a, 0.5);
    splitTop(b, g, level, a, ac, da, depth + 1);
    splitTop(b, g, level, ac, c, cd, depth + 1);
    splitTop(b, g, level, da, cd, d, depth + 1);
    splitTop(b, g, level, ac, cd, da, depth + 1);
    return;
  }
  const vs = [a, c, d], rs = [ra, rc, rd];
  const rockPoly: [TopVert, number][] = [], grassPoly: [TopVert, number][] = [];
  for (let i = 0; i < 3; i++) {
    const p = vs[i]!, q = vs[(i + 1) % 3]!, rp = rs[i]!, rq = rs[(i + 1) % 3]!;
    (rp >= 0.5 ? rockPoly : grassPoly).push([p, rp]);
    if (rp >= 0.5 !== rq >= 0.5) {
      const cut = lerpTop(p, q, (0.5 - rp) / (rq - rp));
      rockPoly.push([cut, 0.5]);
      grassPoly.push([cut, 0.5]);
    }
  }
  const grass = terraceGrass(level), dry = parseColor(TERRAIN.grassDry), stone = parseColor(TERRAIN.rockTop), moss = parseColor(TERRAIN.rockMoss);
  const fan = (poly: [TopVert, number][], rock: boolean): void => {
    if (poly.length < 3) return;
    if (rock) b.setPattern(PATTERN.rock).setInk(`ground${level}`);
    else b.setPattern(PATTERN.grass).setInk(`ground${level}`);
    const col = ([v, r]: [TopVert, number]): [number, number, number] =>
      rock ? mixRgb(stone, moss, Math.min(1, Math.max(0, (0.78 - r) / 0.28)) * 0.55) : mixRgb(grass, dry, Math.min(1, Math.max(0, (r - 0.12) / 0.38)) * 0.8 * Math.min(1, v.e));
    for (let i = 1; i + 1 < poly.length; i++) {
      const p0 = poly[0]!, p1 = poly[i]!, p2 = poly[i + 1]!;
      const e = rock ? [EDGE_FAR, EDGE_FAR, EDGE_FAR] : [p0[0].e, p1[0].e, p2[0].e];
      const cross = (p1[0].p[2] - p0[0].p[2]) * (p2[0].p[0] - p0[0].p[0]) - (p1[0].p[0] - p0[0].p[0]) * (p2[0].p[2] - p0[0].p[2]);
      if (cross >= 0) b.tri(p0[0].p, p1[0].p, p2[0].p, { edge: e, colors: [col(p0), col(p1), col(p2)] });
      else b.tri(p0[0].p, p2[0].p, p1[0].p, { edge: [e[0]!, e[2]!, e[1]!], colors: [col(p0), col(p2), col(p1)] });
    }
  };
  fan(rockPoly, true);
  fan(grassPoly, false);
}

/** A wall strip between two outline points, facing along the given normals. */
function wallQuad(b: MeshBuilder, lo0: Vec3, lo1: Vec3, hi1: Vec3, hi0: Vec3, n0lo: Vec3, n1lo: Vec3, n1hi: Vec3, n0hi: Vec3, e0 = EDGE_FAR, e1 = EDGE_FAR): void {
  const ux = lo1[0] - lo0[0], uy = lo1[1] - lo0[1], uz = lo1[2] - lo0[2];
  const vx = hi0[0] - lo0[0], vy = hi0[1] - lo0[1], vz = hi0[2] - lo0[2];
  const facing = (uy * vz - uz * vy) * n0lo[0] + (uz * vx - ux * vz) * n0lo[1] + (ux * vy - uy * vx) * n0lo[2];
  // `edge` carries a per-point value up the wall (the bank's rockiness): e0 at the first point, e1 at the second.
  if (facing >= 0) b.quad(lo0, lo1, hi1, hi0, { normals: [n0lo, n1lo, n1hi, n0hi], edge: [e0, e1, e1, e0] });
  else b.quad(lo1, lo0, hi0, hi1, { normals: [n1lo, n0lo, n0hi, n1hi], edge: [e1, e0, e0, e1] });
}

interface WallPoint extends BankMix {
  /** The outline point (already warped), world x and z. */
  x: number;
  z: number;
  /** Outward unit normal in the ground plane. */
  nx: number;
  nz: number;
  /** How far a ledge juts out at the top of this level here (world units). */
  out: number;
}

/**
 * One stretch of bank: the strip from the foot up to the outline, its grass lip, and, on a tall
 * face, a ledge. Earth and rock are one surface (one ink group): each point says how rocky it is and
 * the rock pattern draws the border between them, so they interleave instead of meeting on a line.
 */
function emitBank(b: MeshBuilder, pts: readonly WallPoint[], shore: Shore, yb: number, yt: number, level: number): void {
  if (pts.length < 2) return;
  const sand = shore === 'sand';
  const lipOf = (w: WallPoint): number => {
    if (sand) return 0;
    const ledge = Math.min(1, w.out / 0.05);
    return Math.min(TERRAIN.turf * (1 - 0.4 * w.rock), (yt - yb) * 0.4) * Math.max(w.lip, ledge);
  };
  if (sand) b.setColor(PALETTE.sand).setPattern(PATTERN.sand).setInk(`ground${level}`);
  else b.setColor(PALETTE.rock).setPattern(PATTERN.rock).setInk('bank');
  const top = (w: WallPoint, y: number, extra = 0): Vec3 => [w.x + w.nx * (w.out + extra), y, w.z + w.nz * (w.out + extra)];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i]!, q = pts[i + 1]!;
    const slope = (w: WallPoint): Vec3 => {
      const rise = yt - lipOf(w) - yb;
      const len = Math.hypot(rise, w.run) || 1;
      return [(w.nx * rise) / len, w.run / len, (w.nz * rise) / len];
    };
    // A beach meets its top softly: the normal eases to "up" there, so no crease is inked.
    const crown = (w: WallPoint): Vec3 => (sand ? norm([w.nx * 0.5, 1, w.nz * 0.5]) : slope(w));
    wallQuad(b, top(p, yb, p.run), top(q, yb, q.run), top(q, yt - lipOf(q)), top(p, yt - lipOf(p)), slope(p), slope(q), crown(q), crown(p), sand ? EDGE_FAR : p.rock, sand ? EDGE_FAR : q.rock);
  }
  if (sand) return;
  b.setColor(PALETTE.grassSide).setPattern(PATTERN.none).setInk('turf');
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i]!, q = pts[i + 1]!;
    const lp = lipOf(p), lq = lipOf(q);
    if (lp < 0.004 && lq < 0.004) continue;
    const np: Vec3 = [p.nx, 0, p.nz], nq: Vec3 = [q.nx, 0, q.nz];
    const over = (l: number): number => TERRAIN.turfOut * Math.min(1, l / 0.03);
    wallQuad(b, top(p, yt - lp, over(lp)), top(q, yt - lq, over(lq)), top(q, yt), top(p, yt), np, nq, nq, np);
  }
  // The ledge's own top: a strip of grass between the face above and the lip.
  b.setColor(terraceGrass(level)).setPattern(PATTERN.grass).setInk(`ground${level}`);
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i]!, q = pts[i + 1]!;
    if (p.out < 0.004 && q.out < 0.004) continue;
    const p0: Vec3 = [p.x, yt, p.z], q0: Vec3 = [q.x, yt, q.z];
    upTri(b, p0, q0, top(q, yt), EDGE_FAR, EDGE_FAR, EDGE_FAR);
    upTri(b, p0, top(q, yt), top(p, yt), EDGE_FAR, EDGE_FAR, EDGE_FAR);
  }
}

function norm(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * One quarter of one cell at one level: its piece of the terrace top and the
 * banks along its piece of the outline. (sx, sz) picks the corner: +1 is the
 * east or south one. Local coordinates (u, v) run 0–0.5 from the corner's
 * grid vertex into the cell.
 */
function emitQuarter(b: MeshBuilder, g: Ground, x: number, z: number, sx: number, sz: number, level: number): void {
  const hA = g.h(x, z), hB = g.h(x + sx, z), hC = g.h(x, z + sz), hD = g.h(x + sx, z + sz);
  const inA = hA >= level, inB = hB >= level, inC = hC >= level, inD = hD >= level;
  const fillet = !inA && inB && inC && inD;
  if (!inA && !fillet) return;
  if (hA > level && hB > level && hC > level && hD > level) return; // buried under the next terrace
  const vx = x + (sx > 0 ? 1 : 0), vz = z + (sz > 0 ? 1 : 0);
  const r = Math.min(0.5, g.radius(vx, vz, level));
  const yt = level * CELL_H;
  const world = (u: number, v: number, onOutline: boolean): Pt => {
    const px = vx - sx * u, pz = vz - sz * v;
    return onOutline ? g.warp(px, pz) : [px, pz];
  };

  // ── the top ────────────────────────────────────────────────────────────
  // "Distance from sand" at the quarter's four corners, for the grass pattern: 0 on sand, 1 on grass.
  const val = (hh: number, m: number): number | null => (hh < level ? null : hh === level && m === MAT.sand ? 0 : 1);
  const vA = val(hA, g.mat(x, z)), vB = val(hB, g.mat(x + sx, z)), vC = val(hC, g.mat(x, z + sz)), vD = val(hD, g.mat(x + sx, z + sz));
  const avg = (...vs: (number | null)[]): number => {
    let sum = 0, n = 0;
    for (const v of vs) if (v !== null) { sum += v; n++; }
    return n ? sum / n : 1;
  };
  const f00 = avg(vA, vB, vC, vD);
  const f11 = vA ?? f00, f10 = vA === null ? f00 : avg(vA, vC), f01 = vA === null ? f00 : avg(vA, vB);
  const field = (u: number, v: number): number => {
    const s = u * 2, t = v * 2;
    return f00 * (1 - s) * (1 - t) + f10 * s * (1 - t) + f01 * (1 - s) * t + f11 * s * t;
  };
  // Rock on this terrace top: 1 on a rock column, 0 on grass or sand, null where the column's top is elsewhere.
  const rk = (hh: number, m: number): number | null => (hh === level ? (m === MAT.rock ? 1 : 0) : null);
  const rA = rk(hA, g.mat(x, z)), rB = rk(hB, g.mat(x + sx, z)), rC = rk(hC, g.mat(x, z + sz)), rD = rk(hD, g.mat(x + sx, z + sz));
  const rocky = rA === 1 || rB === 1 || rC === 1 || rD === 1;
  const r00 = avg(rA, rB, rC, rD);
  const r11 = rA ?? r00, r10 = rA === null ? r00 : avg(rA, rC), r01 = rA === null ? r00 : avg(rA, rB);
  const rockField = (u: number, v: number): number => {
    const s = u * 2, t = v * 2;
    return r00 * (1 - s) * (1 - t) + r10 * s * (1 - t) + r01 * (1 - s) * t + r11 * s * t;
  };
  b.setColor(terraceGrass(level)).setPattern(PATTERN.grass).setInk(`ground${level}`);
  const arc = (i: number): [number, number] => {
    const phi = (i / ARC) * (Math.PI / 2);
    return [r - r * Math.sin(phi), r - r * Math.cos(phi)];
  };
  // The polygon, as a fan: [u, v, on the outline?]. `hub` is a point every corner can see.
  let hub: [number, number] = [0.5, 0.5];
  const poly: [number, number, boolean][] = [];
  const convex = inA && !inB && !inC;
  if (fillet) {
    hub = [0, 0];
    for (let i = 0; i <= ARC; i++) poly.push([...arc(i), true]);
  } else if (convex) {
    for (let i = 0; i <= ARC; i++) poly.push([...arc(i), true]); // (r, 0) round to (0, r)
    if (r < 0.5) poly.push([0, 0.5, true]);
    poly.push([0.5, 0.5, false]);
    if (r < 0.5) poly.push([0.5, 0, true]);
  } else {
    // A straight outline, or none. A neighbouring fillet joins this square part-way along an edge.
    const filletInB = !inB && inC && inD, filletInC = inB && !inC && inD;
    poly.push([0, 0, !(inB && inC) && !filletInB && !filletInC]);
    if (filletInC) poly.push([r, 0, true]);
    poly.push([0.5, 0, !inC]);
    poly.push([0.5, 0.5, false]);
    poly.push([0, 0.5, !inB]);
    if (filletInB) poly.push([0, r, true]);
  }
  const at = (p: readonly [number, number, boolean]): Vec3 => {
    const [px, pz] = world(p[0], p[1], p[2]);
    return [px, yt, pz];
  };
  const hubAt: Vec3 = [vx - sx * hub[0], yt, vz - sz * hub[1]];
  const hubField = field(hub[0], hub[1]);
  const isHub = (p: readonly [number, number, boolean]): boolean => p[0] === hub[0] && p[1] === hub[1];
  const topV = (p: readonly [number, number, boolean] | readonly [number, number]): TopVert => {
    const onOutline = p.length === 3 && p[2];
    const [px, pz] = world(p[0], p[1], onOutline);
    return { p: [px, yt, pz], e: field(p[0], p[1]), r: rockField(p[0], p[1]) };
  };
  const hubV: TopVert = { p: hubAt, e: hubField, r: rockField(hub[0], hub[1]) };
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    if (isHub(p) || isHub(q)) continue;
    if (fillet && i === poly.length - 1) continue; // the fan closes on the hub itself
    if (rocky) splitTop(b, g, level, hubV, topV(p), topV(q), 0);
    else upTri(b, hubAt, at(p), at(q), hubField, field(p[0], p[1]), field(q[0], q[1]));
  }
  if (rocky) b.setColor(terraceGrass(level)).setPattern(PATTERN.grass).setInk(`ground${level}`);

  // ── the banks ──────────────────────────────────────────────────────────
  const yb = level === 1 ? SEA_Y - UNDER_SEA : (level - 1) * CELL_H;
  const point = (u: number, v: number, nu: number, nv: number, k: BankMix, cap = Infinity): WallPoint => {
    const [px, pz] = world(u, v, true);
    const run = Math.min(cap, k.run);
    const out = Math.min(Math.max(0, cap - run), k.shelf * TERRAIN.ledge * g.shelf(px, pz, level));
    return { ...k, run, x: px, z: pz, nx: -sx * nu, nz: -sz * nv, out };
  };
  if (fillet) {
    const kB = edgeKind(g, x + sx, z, x, z, level), kC = edgeKind(g, x, z + sz, x, z, level);
    const pts: WallPoint[] = [];
    for (let i = 0; i <= ARC; i++) {
      const phi = (i / ARC) * (Math.PI / 2);
      const [u, v] = arc(i);
      // The foot and any ledge stay inside the fillet's own curve.
      pts.push(point(u, v, Math.sin(phi), Math.cos(phi), blend(kC, kB, i / ARC), r * 0.8));
    }
    emitBank(b, pts, harder(kB, kC), yb, yt, level);
    return;
  }
  const kB = !inB ? edgeKind(g, x, z, x + sx, z, level) : null;
  const kC = !inC ? edgeKind(g, x, z, x, z + sz, level) : null;
  if (kB && kC) {
    const pts: WallPoint[] = [];
    for (let i = 0; i <= ARC; i++) {
      const phi = (i / ARC) * (Math.PI / 2);
      const [u, v] = arc(i);
      pts.push(point(u, v, -Math.sin(phi), -Math.cos(phi), blend(kC, kB, i / ARC)));
    }
    emitBank(b, pts, harder(kB, kC), yb, yt, level);
  }
  if (kB) {
    // Along u = 0, from where the corner ends to the middle of the cell's edge. Where the outline
    // runs straight on into the next cell, the two cells' banks meet half-way between their kinds.
    const straightOn = inC && !inD;
    const t = straightOn ? 0 : r;
    if (t < 0.5) {
      const atCorner = straightOn ? blend(kB, edgeKind(g, x, z + sz, x + sx, z + sz, level), 0.5) : kB;
      emitBank(b, [point(0, t, -1, 0, atCorner), point(0, 0.5, -1, 0, kB)], kB.shore, yb, yt, level);
    }
  }
  if (kC) {
    const straightOn = inB && !inD;
    const t = straightOn ? 0 : r;
    if (t < 0.5) {
      const atCorner = straightOn ? blend(kC, edgeKind(g, x + sx, z, x + sx, z + sz, level), 0.5) : kC;
      emitBank(b, [point(t, 0, 0, -1, atCorner), point(0.5, 0, 0, -1, kC)], kC.shore, yb, yt, level);
    }
  }
}

// ──────────────────────────────────────────────────────────── the scree ──

/**
 * Stones fallen from a tall rock face, lying on the ground at its foot: a few per side of column
 * (x, z) where a neighbour stands TERRAIN.screeDrop or more above it with a rock top. Not where
 * anything is built at the foot. Each stone is a low, lumpy, faceted heap with its own outline.
 */
function emitScree(b: MeshBuilder, g: Ground, x: number, z: number): void {
  const lo = g.h(x, z);
  if (lo < 1 || g.built(x, z, lo, lo + 1)) return;
  const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let d = 0; d < 4; d++) {
    const [dx, dz] = sides[d]!;
    const hi = g.h(x + dx, z + dz);
    if (hi - lo < TERRAIN.screeDrop || g.mat(x + dx, z + dz) !== MAT.rock) continue;
    const n = 1 + Math.floor(rand(g.seed, 'scree', x, z, d) * Math.min(4, hi - lo));
    for (let k = 0; k < n; k++) {
      const along = 0.12 + 0.76 * rand(g.seed, 'screeA', x, z, d, k);
      const out = 0.1 + 0.32 * rand(g.seed, 'screeO', x, z, d, k) ** 1.5;
      // The face is the side of this column toward the neighbour; the stone lies inside this column.
      const cx = x + 0.5 + dx * (0.5 - out) + (dz !== 0 ? along - 0.5 : 0);
      const cz = z + 0.5 + dz * (0.5 - out) + (dx !== 0 ? along - 0.5 : 0);
      const r = 0.05 + 0.08 * rand(g.seed, 'screeR', x, z, d, k) * (1.2 - out);
      const tone = 0.9 + 0.14 * rand(g.seed, 'screeT', x, z, d, k);
      const base = parseColor(PALETTE.rock);
      b.setColor([Math.round(base[0] * tone), Math.round(base[1] * tone), Math.round(base[2] * tone)]).setPattern(PATTERN.rock).setEdge(EDGE_FAR).setInk(`scree${x},${z},${d},${k}`);
      b.push();
      b.translate(cx, lo * CELL_H - 0.01, cz);
      b.rotateY(rand(g.seed, 'screeY', x, z, d, k) * Math.PI * 2);
      b.scale(1, 1, 0.7 + 0.5 * rand(g.seed, 'screeS', x, z, d, k));
      b.lathe([[r, 0], [r * 0.85, r * 0.55], [r * 0.4, r * 0.95], [0, r * 1.05]], { segments: 5, smooth: false });
      b.pop();
    }
  }
}

// ────────────────────────────────────────────────────────────── the sea ──

/** Pulls a point inside the slab's rounded outline (identity away from the four corners). */
function intoSlab(x: number, z: number): Pt {
  const R = TERRAIN.slabRadius;
  const cx = x < R ? R : x > SIZE_X - R ? SIZE_X - R : x;
  const cz = z < R ? R : z > SIZE_Z - R ? SIZE_Z - R : z;
  const dx = x - cx, dz = z - cz;
  const d = Math.hypot(dx, dz);
  return d <= R || d === 0 ? [x, z] : [cx + (dx / d) * R, cz + (dz / d) * R];
}

/** Distance from a point on the water to the waterline (0 on or under land). */
function shoreDistance(g: Ground, px: number, pz: number): number {
  const bx = Math.floor(px), bz = Math.floor(pz);
  let best = SEA_FAR;
  const wet = (CELL_H - SEA_Y) / (CELL_H - SEA_Y + UNDER_SEA); // how much of a bank's run is above water
  for (let cz = bz - 2; cz <= bz + 2; cz++) {
    for (let cx = bx - 2; cx <= bx + 2; cx++) {
      if (g.h(cx, cz) < 1) continue;
      const qx = px - (cx + 0.5), qz = pz - (cz + 0.5);
      const ex = qx >= 0 ? 1 : -1, ez = qz >= 0 ? 1 : -1;
      // This cell's corner on the point's side is rounded only if it is a convex corner of the island.
      const round = g.h(cx + ex, cz) < 1 && g.h(cx, cz + ez) < 1 ? Math.min(0.5, g.radius(cx + (ex > 0 ? 1 : 0), cz + (ez > 0 ? 1 : 0), 1)) : 0;
      const ax = Math.abs(qx) - 0.5 + round, az = Math.abs(qz) - 0.5 + round;
      const d = Math.hypot(Math.max(ax, 0), Math.max(az, 0)) + Math.min(Math.max(ax, az), 0) - round;
      const low = g.h(cx, cz) === 1;
      const run = (low && g.mat(cx, cz) === MAT.sand ? TERRAIN.beachRun : low && g.mat(cx, cz) === MAT.grass ? TERRAIN.bankRun : TERRAIN.shoreRun) * wet;
      if (d - run < best) best = d - run;
    }
  }
  return Math.max(0, best);
}

function emitSea(b: MeshBuilder, g: Ground, x: number, z: number): void {
  // Water shows wherever this cell or a neighbour is water (rounded corners uncover a little of it).
  let open = false, near = false;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const land = g.h(x + dx, z + dz) > 0;
      if (land) near = true;
      else if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) open = true;
    }
  }
  if (!open) return;
  const y = SEA_Y;
  const vert = (px: number, pz: number): { p: Vec3; e: number } => {
    const [sx, sz] = intoSlab(px, pz);
    return { p: [sx, y, sz], e: near ? shoreDistance(g, sx, sz) : SEA_FAR };
  };
  if (near) {
    const n = SEA_GRID;
    const grid: { p: Vec3; e: number }[] = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) grid.push(vert(x + i / n, z + j / n));
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = grid[j * (n + 1) + i]!, c = grid[j * (n + 1) + i + 1]!, d = grid[(j + 1) * (n + 1) + i + 1]!, e = grid[(j + 1) * (n + 1) + i]!;
        upTri(b, a.p, c.p, d.p, a.e, c.e, d.e);
        upTri(b, a.p, d.p, e.p, a.e, d.e, e.e);
      }
    }
    return;
  }
  // Open water: a fan with the same edge vertices as a gridded neighbour, so the sheet has no pinholes.
  const n = SEA_GRID;
  const hub = vert(x + 0.5, z + 0.5);
  const rim: { p: Vec3; e: number }[] = [];
  for (let i = 0; i < n; i++) rim.push(vert(x + i / n, z));
  for (let i = 0; i < n; i++) rim.push(vert(x + 1, z + i / n));
  for (let i = 0; i < n; i++) rim.push(vert(x + 1 - i / n, z + 1));
  for (let i = 0; i < n; i++) rim.push(vert(x, z + 1 - i / n));
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i]!, c = rim[(i + 1) % rim.length]!;
    upTri(b, hub.p, a.p, c.p, hub.e, a.e, c.e);
  }
}

// ───────────────────────────────────────────────────────────── the slab ──

/** The slab's outline, clockwise from the north-west corner: points one column apart, corners as arcs. */
function slabOutline(): { x: number; z: number; nx: number; nz: number }[] {
  const R = TERRAIN.slabRadius;
  const out: { x: number; z: number; nx: number; nz: number }[] = [];
  const side = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number): void => {
    const len = Math.round(Math.hypot(x1 - x0, z1 - z0));
    for (let i = 0; i < len; i++) out.push({ x: x0 + ((x1 - x0) * i) / len, z: z0 + ((z1 - z0) * i) / len, nx, nz });
  };
  const corner = (cx: number, cz: number, from: number): void => {
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const a = from + (i / steps) * (Math.PI / 2);
      out.push({ x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, nx: Math.cos(a), nz: Math.sin(a) });
    }
  };
  side(R, 0, SIZE_X - R, 0, 0, -1);
  corner(SIZE_X - R, R, -Math.PI / 2);
  side(SIZE_X, R, SIZE_X, SIZE_Z - R, 1, 0);
  corner(SIZE_X - R, SIZE_Z - R, 0);
  side(SIZE_X - R, SIZE_Z, R, SIZE_Z, 0, 1);
  corner(R, SIZE_Z - R, Math.PI / 2);
  side(0, SIZE_Z - R, 0, R, -1, 0);
  corner(R, R, Math.PI);
  return out;
}

function emitSlab(b: MeshBuilder, chunk: Chunk): void {
  const outline = slabOutline();
  const y0 = SEA_Y, y1 = SEA_Y - TERRAIN.seaDepth, y2 = y1 - TERRAIN.earthDepth * 0.72, y3 = y1 - TERRAIN.earthDepth;
  const bands: [number, number, string, number, string][] = [
    [y1, y0, PALETTE.seaSide, PATTERN.none, 'seaside'],
    [y2, y1, PALETTE.dirt, PATTERN.earth, 'slab'],
    [y3, y2, PALETTE.dirtDark, PATTERN.earth, 'slabfoot'],
  ];
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i]!, q = outline[(i + 1) % outline.length]!;
    // Each stretch belongs to the chunk under its middle.
    const mx = Math.min(SIZE_X - 1, Math.max(0, Math.floor((p.x + q.x) / 2)));
    const mz = Math.min(SIZE_Z - 1, Math.max(0, Math.floor((p.z + q.z) / 2)));
    if (mx < chunk.x0 || mx > chunk.x1 || mz < chunk.z0 || mz > chunk.z1) continue;
    const np: Vec3 = [p.nx, 0, p.nz], nq: Vec3 = [q.nx, 0, q.nz];
    for (const [lo, hi, color, pattern, ink] of bands) {
      b.setColor(color).setPattern(pattern).setInk(ink);
      wallQuad(b, [p.x, lo, p.z], [q.x, lo, q.z], [q.x, hi, q.z], [p.x, hi, p.z], np, nq, nq, np);
    }
  }
}

// ──────────────────────────────────────────────────────────── the layer ──

/** The terrain mesh for one chunk. Exported for tests. */
export function buildTerrainChunk(chunk: Chunk, plan: ShapePlan): MeshBuilder {
  const g = groundOf(plan);
  // One ink namespace for the whole island: a lawn that crosses a chunk border is still one surface.
  const b = new MeshBuilder({ ink: 'terrain' });
  for (let z = chunk.z0; z <= chunk.z1; z++) {
    for (let x = chunk.x0; x <= chunk.x1; x++) {
      let top = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) top = Math.max(top, g.h(x + dx, z + dz));
      for (let level = 1; level <= Math.min(top, MAX_LEVEL); level++) {
        emitQuarter(b, g, x, z, -1, -1, level);
        emitQuarter(b, g, x, z, 1, -1, level);
        emitQuarter(b, g, x, z, -1, 1, level);
        emitQuarter(b, g, x, z, 1, 1, level);
      }
      emitScree(b, g, x, z);
      b.setColor(PALETTE.sea).setPattern(PATTERN.water).setInk('sea');
      emitSea(b, g, x, z);
    }
  }
  emitSlab(b, chunk);
  return b;
}

export const terrainLayer = defineLayer({
  layer: 'terrain',

  build(chunk, plan) {
    return { mesh: buildTerrainChunk(chunk, plan).build(), anchors: {} };
  },

  hash(chunk, plan) {
    const t = plan.terrain;
    const w = plan.world;
    let hsh = hashCombine(t.seed, chunk.cx, chunk.cz);
    // Heights and materials: the shore marks on the sea reach three columns.
    for (let z = chunk.z0 - 3; z <= chunk.z1 + 3; z++) {
      for (let x = chunk.x0 - 3; x <= chunk.x1 + 3; x++) {
        if (!inColumnBounds(x, z)) continue;
        const i = columnIndex(x, z);
        hsh = hashCombine(hsh, t.height[i]!, t.material[i]!);
      }
    }
    // What stands at a step in the ground squares its corner (mustSquare). Flat ground does not care.
    const h = (x: number, z: number): number => (inColumnBounds(x, z) ? t.height[columnIndex(x, z)]! : 0);
    for (let z = chunk.z0 - 2; z <= chunk.z1 + 2; z++) {
      for (let x = chunk.x0 - 2; x <= chunk.x1 + 2; x++) {
        if (!inColumnBounds(x, z)) continue;
        const here = h(x, z);
        let step = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) step = Math.max(step, Math.abs(h(x + dx, z + dz) - here), h(x + dx, z + dz) - here);
        if (step === 0) continue;
        let top = here;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) top = Math.max(top, h(x + dx, z + dz));
        let mask = w.floors.has(key(x, here, z)) ? 1 : 0;
        for (let y = here; y <= top; y++) if (w.blocks.has(key(x, y, z))) mask |= 2 << (y - here);
        if (mask) hsh = hashCombine(hsh, x, z, mask);
      }
    }
    return hsh;
  },
});
