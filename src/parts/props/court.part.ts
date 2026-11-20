// Court furniture (D40): a basketball hoop on its post, a tennis net, a
// football goal, an umpire's high chair. Several parts in one file; each is
// discovered by its own export.
//
// Each stands at the centre slot of a court cell, moved off it by the
// world offset (dx, dz) to where the court puts it. Frame: +Z faces the
// court (the hoop's board, the goal's mouth, the chair's sitter), or runs
// along the court (the net, whose +X is across it).
//
// Sizes match what life plays with (field.lib.ts: hoopOf, goalOf, tennisOf).

import { DIR4, type Dir4 } from '@/core/grid';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { COURT } from '@/style/field';
import { PALETTE } from '@/style/palette';

/** A world offset (dx, dz) in the frame of a slot facing `face`. */
function local(face: Dir4 | undefined, dx: number, dz: number): [number, number] {
  const [zx, zz] = face !== undefined ? DIR4[face]! : [0, 1];
  return [dx * zz - dz * zx, dx * zx + dz * zz];
}
function faceOf(at: unknown): Dir4 | undefined {
  return (at as { face?: Dir4 }).face;
}

const RIM = '#e8743f';
const POST = '#4b5a6b';

/** A ring of `seg` short boxes: a hoop's rim, lying flat at height y. */
function ring(b: MeshBuilder, cx: number, y: number, cz: number, r: number, t: number, seg = 10): void {
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    b.push().translate(x, y, z).rotateY(-a);
    b.box([-t / 2, -t / 2, -((Math.PI * r) / seg) - 0.002], [t / 2, t / 2, (Math.PI * r) / seg + 0.002]);
    b.pop();
  }
}

/**
 * Basketball hoop: a square post at the origin, an arm out over the court, a white board with a red
 * square, an orange rim 0.27 out at 0.74 high and a white net hanging under it.
 */
export const courtHoop = definePart({
  prop: 'court-hoop',
  build(item, ctx) {
    const b = ctx.mesh();
    const [ox, oz] = local(faceOf(item.at), item.params?.dx ?? 0, item.params?.dz ?? 0);
    b.translate(ox, 0, oz);
    const top = 0.9, reach = 0.27, rimY = 0.74;
    b.with({ color: POST, pattern: PATTERN.metal, ink: 'post' }, () => {
      b.box([-0.022, 0, -0.022], [0.022, top, 0.022], { skip: ['bottom'] });
      b.box([-0.016, top - 0.05, 0.02], [0.016, top - 0.02, reach - 0.12]);
    });
    // The board: white, its red square over the rim.
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'board' }, () => b.box([-0.17, rimY - 0.04, reach - 0.13], [0.17, rimY + 0.2, reach - 0.11]));
    b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'square' }, () => b.box([-0.06, rimY + 0.005, reach - 0.11], [0.06, rimY + 0.085, reach - 0.106]));
    b.with({ color: RIM, pattern: PATTERN.metal, ink: 'rim' }, () => {
      ring(b, 0, rimY, reach, 0.07, 0.012);
      b.box([-0.012, rimY - 0.006, reach - 0.11], [0.012, rimY + 0.006, reach - 0.065]);
    });
    // The net: strands from the rim gathering below it.
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'net' }, () => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x0 = Math.cos(a) * 0.066, z0 = reach + Math.sin(a) * 0.066;
        const x1 = Math.cos(a) * 0.04, z1 = reach + Math.sin(a) * 0.04;
        const t = 0.004;
        b.quad([x0 - t, rimY, z0], [x0 + t, rimY, z0], [x1 + t, rimY - 0.11, z1], [x1 - t, rimY - 0.11, z1]);
        b.quad([x0 + t, rimY, z0], [x0 - t, rimY, z0], [x1 - t, rimY - 0.11, z1], [x1 + t, rimY - 0.11, z1]);
      }
    });
    return { mesh: b.build() };
  },
});

/** Tennis net: two posts `span` apart across the court, the net between them with a white tape along the top. */
export const courtNet = definePart({
  prop: 'court-net',
  build(item, ctx) {
    const b = ctx.mesh();
    const [ox, oz] = local(faceOf(item.at), item.params?.dx ?? 0, item.params?.dz ?? 0);
    b.translate(ox, 0, oz);
    const half = (item.params?.span ?? 2) / 2, h = 0.15, sag = 0.02;
    b.with({ color: POST, pattern: PATTERN.metal, ink: 'posts' }, () => {
      for (const s of [-1, 1]) b.box([s * half - 0.014, 0, -0.014], [s * half + 0.014, h + 0.02, 0.014], { skip: ['bottom'] });
    });
    // The net: dark mesh, sagging a little in the middle, both faces.
    b.with({ color: '#5b6070', pattern: PATTERN.cloth, ink: 'net' }, () => {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x0 = -half + (2 * half * i) / n, x1 = -half + (2 * half * (i + 1)) / n;
        const y0 = h - sag * (1 - (x0 / half) ** 2), y1 = h - sag * (1 - (x1 / half) ** 2);
        const lo = 0.012;
        b.quad([x0, lo, 0], [x1, lo, 0], [x1, y1, 0], [x0, y0, 0]);
        b.quad([x1, lo, 0], [x0, lo, 0], [x0, y0, 0], [x1, y1, 0]);
      }
    });
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'tape' }, () => {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x0 = -half + (2 * half * i) / n, x1 = -half + (2 * half * (i + 1)) / n;
        const y0 = h - sag * (1 - (x0 / half) ** 2), y1 = h - sag * (1 - (x1 / half) ** 2);
        b.quad([x0, y0, -0.008], [x1, y1, -0.008], [x1, y1 + 0.018, -0.008], [x0, y0 + 0.018, -0.008]);
        b.quad([x1, y1, 0.008], [x0, y0, 0.008], [x0, y0 + 0.018, 0.008], [x1, y1 + 0.018, 0.008]);
        b.quad([x0, y0 + 0.018, -0.008], [x1, y1 + 0.018, -0.008], [x1, y1 + 0.018, 0.008], [x0, y0 + 0.018, 0.008]);
      }
    });
    return { mesh: b.build() };
  },
});

/** Football goal: white posts and bar `span` wide across the goal line, a net sloping back behind. */
export const courtGoal = definePart({
  prop: 'court-goal',
  build(item, ctx) {
    const b = ctx.mesh();
    const [ox, oz] = local(faceOf(item.at), item.params?.dx ?? 0, item.params?.dz ?? 0);
    b.translate(ox, 0, oz);
    const half = (item.params?.span ?? 0.9) / 2;
    const h = item.variant === 'small' ? 0.26 : 0.32, deep = 0.16, t = 0.016;
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'frame' }, () => {
      for (const s of [-1, 1]) b.box([s * half - t, 0, -t], [s * half + t, h, t], { skip: ['bottom'] });
      b.box([-half - t, h, -t], [half + t, h + t * 2, t]);
    });
    // The net: the back and the two sides, sloping from the bar down to the ground behind.
    b.with({ color: mixNet(), pattern: PATTERN.cloth, ink: 'net' }, () => {
      const both = (p: [number, number, number][]): void => {
        b.quad(p[0]!, p[1]!, p[2]!, p[3]!);
        b.quad(p[1]!, p[0]!, p[3]!, p[2]!);
      };
      both([[-half, 0.006, -deep], [half, 0.006, -deep], [half, h, -t], [-half, h, -t]]);
      for (const s of [-1, 1]) {
        b.tri([s * half, 0.006, -t], [s * half, h, -t], [s * half, 0.006, -deep]);
        b.tri([s * half, h, -t], [s * half, 0.006, -t], [s * half, 0.006, -deep]);
      }
    });
    return { mesh: b.build() };
  },
});
const mixNet = (): string => '#e9e6dc';

/** Umpire's chair: a tall ladder-backed seat on four legs, +Z facing the court. */
export const umpireChair = definePart({
  prop: 'umpire-chair',
  build(item, ctx) {
    const b = ctx.mesh();
    const [ox, oz] = local(faceOf(item.at), item.params?.dx ?? 0, item.params?.dz ?? 0);
    b.translate(ox, 0, oz);
    const seat = 0.3, w = 0.07;
    b.with({ color: COURT.timber, pattern: PATTERN.planks, ink: 'chair' }, () => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box([sx * w - 0.01, 0, sz * w - 0.01], [sx * w + 0.01, seat, sz * w + 0.01], { skip: ['bottom'] });
      // Rungs up the back, the seat, the back rest.
      for (const y of [0.1, 0.2]) b.box([-w, y, -w - 0.008], [w, y + 0.014, -w + 0.008]);
      b.box([-w - 0.012, seat, -w - 0.012], [w + 0.012, seat + 0.02, w + 0.012]);
      b.box([-w - 0.012, seat + 0.02, -w - 0.012], [w + 0.012, seat + 0.13, -w + 0.006]);
    });
    return { mesh: b.build() };
  },
});
