// Scaffolding round a building being mended, and the builders' materials
// stacked beside it (Mischief). Owner: Mischief. Pure.
//
// Poles stand just outside the walls (past the eaves), with a plank walk at
// every storey, a brace, a ladder up one side, a canvas sheet hung on
// another, and a hoist with a bucket on a rope at one corner. On open ground
// beside the building: a stack of new timber, a pallet of bricks, roof tiles
// in the building's own roof colour, a mortar tub.

import { CELL_H } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { DAMAGE_COLORS, rgb } from '@/style/damage';
import { PALETTE } from '@/style/palette';
import { beam } from './extras';
import type { Column, Profile } from './field';

const OUT = 0.17; // poles stand this far outside the cell edge (just past a 0.12 eave)
const POLE = 0.045;

export interface Side {
  col: Column;
  /** Outward direction. */
  dx: number;
  dz: number;
}

/** The outside faces of the mending columns. */
export function outsideSides(prof: Profile): Side[] {
  const sides: Side[] = [];
  for (const col of prof.columns.values()) {
    if (!col.mending) continue;
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      if (prof.columns.has(prof.colKey(col.x + dx, col.z + dz))) continue;
      sides.push({ col, dx, dz });
    }
  }
  return sides;
}

/** The ends of a side's run of poles: [left corner, right corner] at the base, looking out. */
export function sideEnds(s: Side): [Vec3, Vec3] {
  const { col, dx, dz } = s;
  const cx = col.x + 0.5 + dx * (0.5 + OUT);
  const cz = col.z + 0.5 + dz * (0.5 + OUT);
  // Along the side (perpendicular to the outward direction), reaching the corner poles.
  const tx = -dz, tz = dx;
  const half = 0.5 + OUT;
  return [
    [cx - tx * half, col.base, cz - tz * half],
    [cx + tx * half, col.base, cz + tz * half],
  ];
}

/** Where the ladder stands: its side, the middle of its foot line, its rails' half-spacing, its top and how far its foot is out. */
export function ladderOf(prof: Profile, sides: Side[] = outsideSides(prof)): { side: Side; mx: number; mz: number; ux: number; uz: number; topY: number; foot: number } | null {
  if (sides.length === 0) return null;
  const seed = prof.s.seed;
  const side = sides[Math.floor(rand(seed, 'ladder') * sides.length)]!;
  const [a, c] = sideEnds(side);
  const t = 0.3 + rand(seed, 'ladder-at') * 0.4;
  const tx = c[0] - a[0], tz = c[2] - a[2];
  const tl = Math.hypot(tx, tz) || 1;
  return {
    side,
    mx: a[0] + tx * t,
    mz: a[2] + tz * t,
    ux: (tx / tl) * 0.12,
    uz: (tz / tl) * 0.12,
    topY: side.col.base + CELL_H + 0.25,
    foot: 0.42,
  };
}

export function scaffold(b: MeshBuilder, prof: Profile, roofColor: readonly number[] | null): void {
  const sides = outsideSides(prof);
  if (sides.length === 0) return;
  const seed = prof.s.seed;
  const wood = rgb(DAMAGE_COLORS.scaffold);
  const poles = new Map<string, Vec3 & { top: number }>();
  const key = (p: Vec3): string => `${Math.round(p[0] * 100)},${Math.round(p[2] * 100)}`;
  for (const s of sides) {
    for (const p of sideEnds(s)) {
      const k = key(p);
      const top = s.col.top + 0.42;
      const had = poles.get(k);
      if (!had || had.top < top) poles.set(k, Object.assign([p[0], Math.min(p[1], had?.[1] ?? Infinity), p[2]] as Vec3, { top }));
    }
  }
  b.setColor(wood).setPattern(PATTERN.planks).setInk('scaffold-poles');
  for (const p of poles.values()) {
    b.boxAt([p[0], p[1], p[2]], [POLE, p.top - p[1], POLE]);
  }
  // Plank walks at every storey, and a ledger under each.
  b.setInk('scaffold-planks');
  for (const s of sides) {
    const [a, c] = sideEnds(s);
    for (let y = s.col.base + CELL_H; y <= s.col.top + 1e-6; y += CELL_H) {
      const lift = y - 0.005;
      const inX = -s.dx * 0.06, inZ = -s.dz * 0.06;
      // The walk: 0.16 wide, laid from pole to pole.
      const minX = Math.min(a[0], c[0]) - 0.02 + inX, maxX = Math.max(a[0], c[0]) + 0.02 + inX;
      const minZ = Math.min(a[2], c[2]) - 0.02 + inZ, maxZ = Math.max(a[2], c[2]) + 0.02 + inZ;
      const wide = 0.08;
      b.box(
        [s.dx !== 0 ? minX - wide : minX, lift, s.dz !== 0 ? minZ - wide : minZ],
        [s.dx !== 0 ? maxX + wide : maxX, lift + 0.03, s.dz !== 0 ? maxZ + wide : maxZ],
      );
    }
  }
  b.setInk('scaffold-braces');
  sides.forEach((s, i) => {
    const [a, c] = sideEnds(s);
    const flip = rand(seed, 'brace', i) < 0.5;
    const lo = flip ? a : c;
    const hi = flip ? c : a;
    const top = Math.min(s.col.top, s.col.base + CELL_H * 2);
    beam(b, [lo[0], lo[1] + 0.05, lo[2]], [hi[0], top - 0.02, hi[2]], 0.03, 0.03);
  });

  // A ladder up one side, leaning out from the first plank walk.
  const lad = ladderOf(prof, sides)!;
  const ls = lad.side;
  {
    const { mx, mz, ux, uz, topY, foot } = lad;
    b.setColor(rgb(DAMAGE_COLORS.fresh)).setPattern(PATTERN.none).setInk('ladder');
    const lo1: Vec3 = [mx - ux + ls.dx * foot, ls.col.base, mz - uz + ls.dz * foot];
    const lo2: Vec3 = [mx + ux + ls.dx * foot, ls.col.base, mz + uz + ls.dz * foot];
    const hi1: Vec3 = [mx - ux + ls.dx * 0.03, topY, mz - uz + ls.dz * 0.03];
    const hi2: Vec3 = [mx + ux + ls.dx * 0.03, topY, mz + uz + ls.dz * 0.03];
    beam(b, lo1, hi1, 0.03, 0.03);
    beam(b, lo2, hi2, 0.03, 0.03);
    for (let k = 1; k < 7; k++) {
      const f = k / 7;
      const p: Vec3 = [lo1[0] + (hi1[0] - lo1[0]) * f, lo1[1] + (hi1[1] - lo1[1]) * f, lo1[2] + (hi1[2] - lo1[2]) * f];
      const q: Vec3 = [lo2[0] + (hi2[0] - lo2[0]) * f, lo2[1] + (hi2[1] - lo2[1]) * f, lo2[2] + (hi2[2] - lo2[2]) * f];
      beam(b, p, q, 0.022, 0.022);
    }
  }

  // A canvas sheet hung from the top walk on another side.
  if (sides.length > 1) {
    const cs = sides[(sides.indexOf(ls) + 1 + Math.floor(rand(seed, 'canvas') * (sides.length - 1))) % sides.length]!;
    const [a, c] = sideEnds(cs);
    const topY = cs.col.top - 0.01;
    const drop = Math.min(CELL_H * 1.1, cs.col.top - cs.col.base - 0.1);
    const o = 0.02;
    const p0: Vec3 = [a[0] + cs.dx * o, topY, a[2] + cs.dz * o];
    const p1: Vec3 = [c[0] + cs.dx * o, topY, c[2] + cs.dz * o];
    // Hangs in a slight belly; both faces drawn.
    b.setColor(rgb(DAMAGE_COLORS.canvas)).setPattern(PATTERN.cloth).setInk('canvas');
    b.setSway((_x, y) => Math.max(0, Math.min(0.6, (topY - y) * 0.7)));
    const n = 4;
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n;
      const at = (f: number, d: number): Vec3 => {
        const belly = Math.sin(f * Math.PI) * 0.05 * (d / drop);
        return [p0[0] + (p1[0] - p0[0]) * f + cs.dx * belly, topY - d - Math.sin(f * Math.PI) * 0.04, p0[2] + (p1[2] - p0[2]) * f + cs.dz * belly];
      };
      const q0 = at(f0, 0), q1 = at(f1, 0), q2 = at(f1, drop), q3 = at(f0, drop);
      // Both faces (a sheet is seen from either side).
      b.quad(q0, q1, q2, q3);
      b.quad(q0, q3, q2, q1);
    }
    b.setSway(0);
  }

  // A hoist at one corner pole: an arm over the side, a rope, a bucket.
  {
    const list = [...poles.values()];
    const p = list[Math.floor(rand(seed, 'hoist') * list.length)]!;
    const s = sides.find((sd) => sideEnds(sd).some((e) => key(e) === key(p))) ?? sides[0]!;
    const armTop = p.top + 0.18;
    b.setColor(wood).setPattern(PATTERN.planks).setInk('hoist');
    b.boxAt([p[0], p.top, p[2]], [POLE, 0.18, POLE]);
    const ax = p[0] + s.dx * 0.32, az = p[2] + s.dz * 0.32;
    beam(b, [p[0], armTop, p[2]], [ax, armTop, az], 0.035, 0.035);
    const ropeLo = s.col.base + 0.55 + rand(seed, 'bucket') * Math.max(0, s.col.top - s.col.base - 0.8);
    b.setColor(rgb(DAMAGE_COLORS.rope)).setPattern(PATTERN.none).setInk('rope');
    b.boxAt([ax, ropeLo + 0.12, az], [0.015, armTop - ropeLo - 0.12, 0.015]);
    b.setColor(PALETTE.metal).setPattern(PATTERN.metal).setInk('bucket');
    b.at(
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ax, ropeLo, az, 1],
      () => b.lathe([[0.05, 0], [0.065, 0.12]], { segments: 8, capBottom: true }),
    );
  }

  materials(b, prof, sides, roofColor);
}

/** The builders' stack on open ground beside the building (the first open side, by the seed). */
function materials(b: MeshBuilder, prof: Profile, sides: Side[], roofColor: readonly number[] | null): void {
  const seed = prof.s.seed;
  const start = Math.floor(rand(seed, 'materials') * sides.length);
  for (let i = 0; i < sides.length; i++) {
    const s = sides[(start + i) % sides.length]!;
    const ground = prof.openGround(s.col.x + s.dx, s.col.z + s.dz, s.col.base);
    if (ground === null) continue;
    const y = ground + 0.045;
    // Centre of the pile: in the neighbour cell, near its far half so the scaffold foot stays clear.
    const cx = s.col.x + 0.5 + s.dx * 1.0;
    const cz = s.col.z + 0.5 + s.dz * 1.0;
    const tx = -s.dz, tz = s.dx;
    const at = (u: number, v: number): [number, number] => [cx + tx * u + s.dx * v, cz + tz * u + s.dz * v];
    // New timber: three layers of boards, crossing.
    b.setColor(rgb(DAMAGE_COLORS.fresh)).setPattern(PATTERN.planks).setInk('timber-stack');
    for (let layer = 0; layer < 3; layer++) {
      for (let k = -1; k <= 1; k++) {
        const [px, pz] = at(-0.18 + k * 0.07, 0.05);
        const along = layer % 2 === 0;
        const lx = along ? Math.abs(tx) * 0.42 + Math.abs(s.dx) * 0.05 : Math.abs(s.dx) * 0.3 + Math.abs(tx) * 0.05;
        const lz = along ? Math.abs(tz) * 0.42 + Math.abs(s.dz) * 0.05 : Math.abs(s.dz) * 0.3 + Math.abs(tz) * 0.05;
        if (!along && k !== 0) continue;
        b.boxAt([px, y + layer * 0.045, pz], [Math.max(lx, 0.05), 0.04, Math.max(lz, 0.05)]);
      }
    }
    // A pallet of bricks.
    {
      const [px, pz] = at(0.2, -0.1);
      b.setColor(PALETTE.wood).setPattern(PATTERN.planks).setInk('pallet');
      b.boxAt([px, y, pz], [0.26, 0.04, 0.26]);
      b.setColor(PALETTE.brick).setPattern(PATTERN.brick).setInk('bricks');
      b.boxAt([px, y + 0.04, pz], [0.22, 0.16, 0.22]);
    }
    // Roof tiles, stacked on edge, in the roof's colour.
    if (roofColor) {
      const [px, pz] = at(0.22, 0.2);
      b.setColor(roofColor as [number, number, number]).setPattern(PATTERN.shingles).setInk('tiles');
      b.boxAt([px, y, pz], [0.18, 0.12, 0.14]);
    }
    // A mortar tub.
    {
      const [px, pz] = at(-0.05, -0.22);
      b.setColor(PALETTE.wood).setPattern(PATTERN.planks).setInk('tub');
      b.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, px, y, pz, 1], () =>
        b.lathe([[0.08, 0], [0.1, 0.1]], { segments: 10, capBottom: true }),
      );
      b.setColor(rgb(DAMAGE_COLORS.dust)).setPattern(PATTERN.none).setInk('mortar');
      b.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, px, y + 0.085, pz, 1], () =>
        b.lathe([[0.09, 0], [0, 0.005]], { segments: 10 }),
      );
    }
    return;
  }
}
