// The bits a ruin adds to what was there (Mischief): charred beams and
// rafters, studs and rafters of new timber, soot streaks and cracks, a heap
// of rubble, ash on the floor, scorched ground. Owner: Mischief. Pure.

import { frame, type Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { CELL_H } from '@/core/grid';
import { MAT } from '@/core/world';
import { RUIN } from '@/style/damage';
import { PALETTE } from '@/style/palette';
import { heapHeight } from './debris';
import type { Column } from './field';
import { normalOf, type Poly, vert } from './poly';

/** A beam from a to b pulled in by `by` at each end, so its end faces never lie flush in the face it meets. */
function inset(b: MeshBuilder, a: Vec3, c: Vec3, by: number, w: number, h: number): void {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len <= by * 2 + 1e-3) return;
  const k = by / len;
  beam(b, [a[0] + dx * k, a[1] + dy * k, a[2] + dz * k], [c[0] - dx * k, c[1] - dy * k, c[2] - dz * k], w, h);
}

/** A square-section beam from a to b (`w` wide, `h` deep), level side up. */
export function beam(b: MeshBuilder, a: Vec3, c: Vec3, w: number, h: number): void {
  const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  const x: Vec3 = [dx / len, dy / len, dz / len];
  // A "side" axis that is level, then up = x × side ... ok for any non-vertical beam.
  let sx = -x[2], sz = x[0];
  let sl = Math.hypot(sx, sz);
  if (sl < 1e-4) {
    sx = 1;
    sz = 0;
    sl = 1;
  }
  const z: Vec3 = [sx / sl, 0, sz / sl];
  const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  b.at(frame(a, x, y, z), () => b.box([0, -h / 2, -w / 2], [len, h / 2, w / 2]));
}

/** Rafters along a removed (or rebuilt) roof face: lines down the slope every `gap`, just under its surface. */
export function raftersOn(b: MeshBuilder, roof: Poly, gap: number, size: number): void {
  const [nx, ny, nz] = normalOf(roof);
  if (ny < 0.2) return;
  // Down the slope: the level part of the normal; along the ridge: across it.
  let lx = nx, lz = nz;
  let l = Math.hypot(lx, lz);
  if (l < 0.05) {
    // A flat roof: joists along x.
    lx = 0;
    lz = 1;
    l = 1;
  }
  lx /= l;
  lz /= l;
  const rx = -lz, rz = lx; // along the ridge
  const pts = roof.v.map((p) => [p[0]!, p[1]!, p[2]!] as const);
  const along = pts.map((p) => p[0] * rx + p[2] * rz);
  const lo = Math.min(...along);
  const hi = Math.max(...along);
  for (let s = Math.ceil(lo / gap) * gap; s <= hi; s += gap) {
    // Where the line along = s crosses the polygon's edges.
    const hits: Vec3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % pts.length]!;
      const ap = along[i]!;
      const aq = along[(i + 1) % pts.length]!;
      if ((ap - s) * (aq - s) > 0 || ap === aq) continue;
      const t = (s - ap) / (aq - ap);
      hits.push([p[0] + (q[0] - p[0]) * t - nx * size * 0.6, p[1] + (q[1] - p[1]) * t - ny * size * 0.6, p[2] + (q[2] - p[2]) * t - nz * size * 0.6]);
    }
    if (hits.length >= 2) inset(b, hits[0]!, hits[1]!, 0.025, size, size);
  }
}

/** Upright studs on a removed (or rebuilt) stretch of wall, with a plate along its top. */
export function studsOn(b: MeshBuilder, wall: Poly, gap: number, size: number): void {
  const [nx, ny, nz] = normalOf(wall);
  if (Math.abs(ny) > 0.3) return;
  const tx = -nz, tz = nx;
  const pts = wall.v.map((p) => [p[0]!, p[1]!, p[2]!] as const);
  const along = pts.map((p) => p[0] * tx + p[2] * tz);
  const lo = Math.min(...along);
  const hi = Math.max(...along);
  const inward = (p: Vec3): Vec3 => [p[0] - nx * size, p[1], p[2] - nz * size];
  for (let s = Math.ceil(lo / gap) * gap; s <= hi; s += gap) {
    const hits: Vec3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % pts.length]!;
      const ap = along[i]!;
      const aq = along[(i + 1) % pts.length]!;
      if ((ap - s) * (aq - s) > 0 || ap === aq) continue;
      const t = (s - ap) / (aq - ap);
      hits.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
    }
    if (hits.length >= 2) {
      hits.sort((a, c) => a[1] - c[1]);
      inset(b, inward(hits[0]!), inward(hits[hits.length - 1]!), 0.02, size, size);
    }
  }
}

/** A flat polygon lying on a wall (soot, a crack), offset a hair off its face. Points are (u along the wall, v up). */
export function decalOn(wall: Poly, origin: Vec3, uv: readonly (readonly [number, number])[], color: readonly number[], lift = 0.008): Poly {
  const [nx, , nz] = normalOf(wall);
  const tx = -nz, tz = nx;
  const v = uv.map(([u, w]) =>
    vert([origin[0] + tx * u + nx * lift, origin[1] + w, origin[2] + tz * u + nz * lift], [nx, 0, nz], color),
  );
  return { v, pattern: PATTERN.none, ink: wall.ink };
}

/** A tongue of soot rising from the top of an opening: wide at the bottom, a ragged tip. */
export function sootShape(seed: number, width: number, height: number): [number, number][] {
  const lean = (rand(seed, 'lean') - 0.5) * width * 0.6;
  const pts: [number, number][] = [
    [-width / 2, 0],
    [width / 2, 0],
    [width * (0.38 + rand(seed, 'a') * 0.12), height * 0.35],
    [width * 0.18 + lean * 0.5, height * (0.6 + rand(seed, 'b') * 0.1)],
    [lean, height],
    [-width * 0.2 + lean * 0.5, height * (0.55 + rand(seed, 'c') * 0.15)],
    [-width * (0.4 + rand(seed, 'd') * 0.12), height * 0.3],
  ];
  return pts;
}

/** A crack: a zigzag of thin strips. Returns quads (u, v) for decalOn. */
export function crackShape(seed: number, length: number): [number, number][][] {
  const out: [number, number][][] = [];
  let u = 0, v = 0;
  const steps = 3 + Math.floor(rand(seed, 'n') * 3);
  let a = -Math.PI / 2 + (rand(seed, 'a') - 0.5) * 1.2;
  for (let i = 0; i < steps; i++) {
    a += (rand(seed, 'turn', i) - 0.5) * 1.6;
    const l = (length / steps) * (0.7 + rand(seed, 'len', i) * 0.6);
    const u2 = u + Math.cos(a) * l;
    const v2 = v + Math.sin(a) * l;
    const w = 0.014 * (1 - i / (steps + 1)) + 0.006;
    const px = -Math.sin(a) * w, py = Math.cos(a) * w;
    out.push([[u - px, v - py], [u2 - px, v2 - py], [u2 + px, v2 + py], [u + px, v + py]]);
    u = u2;
    v = v2;
  }
  return out;
}

/** A low heap of broken stuff over a destroyed column: an irregular dome of rubble. */
export function heap(b: MeshBuilder, col: Column, seed: number, color: readonly number[], left = 1): void {
  if (left <= 0.02) return;
  const cx = col.x + 0.5, cz = col.z + 0.5;
  const rings = 3, segs = 9;
  const R = 0.62;
  const pt = (i: number, j: number): Vec3 => {
    const r = (i / rings) * R * (i === 0 ? 0 : 0.85 + 0.3 * rand(seed, 'hr', i, j % segs));
    const a = ((j % segs) / segs) * Math.PI * 2 + rand(seed, 'ha', i) * 0.4;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const bump = i === 0 || i === rings ? 0 : (rand(seed, 'hh', i, j % segs) - 0.4) * 0.07;
    return [x, col.wreckBase + Math.max(0, (heapHeight(col, x, z) + bump) * left) + (i === rings ? 0.01 : 0), z];
  };
  b.setColor(color as [number, number, number]).setPattern(PATTERN.cobbles).setInk('heap');
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = pt(i, j), c = pt(i, j + 1), d = pt(i + 1, j + 1), e = pt(i + 1, j);
      if (i === 0) b.tri(a, d, e);
      else b.quad(a, c, d, e);
    }
  }
}

/** #rrggbb as 0–255, as MeshBuilder colours are. */
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
/** Burnt earth on its way back: between black and the ground's own colour. */
const EARTH = hex('#9b7a57');

/** The colour of open ground of a terrain material (what a scorch mark recovers to). */
export function groundColour(material: number): [number, number, number] {
  return hex(material === MAT.sand ? PALETTE.sand : material === MAT.rock ? PALETTE.rock : PALETTE.grass);
}

/**
 * Scorched ground on its way back (the owner: scorch marks fade over time): k = 0 the scorch itself, then
 * brown earth by 0.5, then the ground's own colour at 1. Null when it is all the way back (draw nothing).
 */
export function recovering(scorch: readonly number[], ground: readonly number[], k: number): [number, number, number] | null {
  if (k >= 1) return null;
  const mix = (a: readonly number[], c: readonly number[], t: number): [number, number, number] => [a[0]! + (c[0]! - a[0]!) * t, a[1]! + (c[1]! - a[1]!) * t, a[2]! + (c[2]! - a[2]!) * t];
  const u = Math.max(0, k);
  return u < 0.5 ? mix(scorch, EARTH, u * 2) : mix(EARTH, ground, (u - 0.5) * 2);
}

/** How far a band of a mark this far in from its edge (0 edge, 1 middle) has recovered, when the whole is `p` (0–1) of the way. */
export const bandRecovery = (p: number, inward: number): number => Math.min(1, Math.max(0, (p - inward * 0.45) / 0.55));

/**
 * A flat, ragged patch of scorched ground round a column (a hair above whatever lies on the ground). With
 * `recover` above 0 (the building being mended) it is going back to the ground's colour, the ragged edge
 * first and the middle last, gone by the time the mending is done.
 */
export function scorchRing(b: MeshBuilder, col: Column, ground: number, seed: number, color: readonly number[], recover = 0, groundRgb: readonly number[] = hex(PALETTE.grass)): void {
  const cx = col.x + 0.5, cz = col.z + 0.5;
  const segs = 14;
  const y = ground + 0.046;
  b.setPattern(PATTERN.dirt).setInk('scorch');
  const outer = (j: number): Vec3 => {
    const a = (j / segs) * Math.PI * 2;
    const r = 0.62 + 0.2 * rand(seed, 'sr', j % segs);
    // Square-ish: reach the cell corners, then a ragged lip past the walls.
    const k = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const rr = Math.min(r * k, 0.5 * k + 0.22 * rand(seed, 'sq', j % segs));
    return [cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr];
  };
  const mid: Vec3 = [cx, y, cz];
  const at = (j: number, f: number): Vec3 => {
    const o = outer(j);
    return [cx + (o[0] - cx) * f, y, cz + (o[2] - cz) * f];
  };
  // Bands from the edge in: each recovers a little after the one outside it.
  const bands: [number, number, number][] = [[0.72, 1, 0], [0.42, 0.72, 0.5], [0, 0.42, 1]];
  for (const [f0, f1, inward] of bands) {
    const c = recovering(color, groundRgb, bandRecovery(recover, inward));
    if (!c) continue;
    b.setColor(c);
    for (let j = 0; j < segs; j++) {
      if (f0 === 0) b.tri(mid, at(j + 1, f1), at(j, f1));
      else b.quad(at(j + 1, f0), at(j + 1, f1), at(j, f1), at(j, f0));
    }
  }
}

/** Charred timbers fallen into a burnt-out shell: a few beams leaning from the wall tops to the floor. */
export function fallenBeams(b: MeshBuilder, col: Column, seed: number, top: number): void {
  const n = 2 + Math.floor(rand(seed, 'beams', col.x, col.z) * 3);
  for (let i = 0; i < n; i++) {
    const r = (k: string): number => rand(seed, 'beam', col.x, col.z, i, k);
    const a = r('a') * Math.PI * 2;
    const cx = col.x + 0.5, cz = col.z + 0.5;
    const len = 0.55 + r('len') * 0.35;
    const lo: Vec3 = [cx + Math.cos(a) * (0.15 + r('o') * 0.15), col.wreckBase + 0.05, cz + Math.sin(a) * (0.15 + r('o') * 0.15)];
    const hiY = Math.min(top, col.wreckBase + 0.15 + r('h') * CELL_H * 0.6);
    const hi: [number, number, number] = [lo[0] - Math.cos(a) * len, hiY, lo[2] - Math.sin(a) * len];
    hi[0] = Math.min(col.x + 0.9, Math.max(col.x + 0.1, hi[0]));
    hi[2] = Math.min(col.z + 0.9, Math.max(col.z + 0.1, hi[2]));
    beam(b, lo, hi, 0.06, 0.06);
  }
}

/** Ash and cinders on the floor of a burnt-out column, inside its walls. */
export function ashFloor(b: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, color: readonly number[]): void {
  b.setColor(color as [number, number, number]).setPattern(PATTERN.dirt).setInk('ash');
  b.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
}

/** The thickness of a broken wall's inside face, by style. */
export const wallThickness = (): number => RUIN.wallThickness;
