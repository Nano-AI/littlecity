// Country props (U13 country lanes): milestone and field gate. Several parts
// in one file; each is discovered by its own export. The hedgerow is the
// hedge prop's 'wild' variant (park.part.ts).

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { mixColor, rngOf, vary } from './kit';

/** The cell line, in an edge slot's frame (+Z into the cell). */
const LINE = -(0.5 - SLOT_INSET);

/**
 * A slab cut to a profile: `profile` is an outline in the XY plane,
 * counter-clockwise seen from +Z, starting at the bottom left and ending at
 * the top left (its bottom edge, the first two points, sits on the ground
 * and is left open). Extruded `t` thick, centred on z = 0.
 */
export function slab(b: MeshBuilder, profile: readonly (readonly [number, number])[], t: number): void {
  const f = profile.map(([x, y]): Vec3 => [x, y, t / 2]);
  const k = profile.map(([x, y]): Vec3 => [x, y, -t / 2]);
  b.polygon(f);
  b.polygon([...k].reverse());
  for (let i = 1; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    if (j === 0 && profile[0]![1] === 0 && profile[i]![1] === 0) continue;
    b.quad(f[i]!, k[i]!, k[j]!, f[j]!);
  }
}

/** A round-headed profile `w` wide and `h` tall to the top of its arch. */
export function roundHead(w: number, h: number, steps = 6): [number, number][] {
  const r = w / 2;
  const out: [number, number][] = [[-r, 0], [r, 0]];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    out.push([Math.cos(a) * r, h - r + Math.sin(a) * r]);
  }
  return out;
}

/**
 * Milestone: a squat round-headed stone at the edge of a country lane, white
 * with a dark carved band where the miles would be. Frame: a floor slot, +Z
 * toward the lane.
 */
export const milestone = definePart({
  prop: 'milestone',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 811));
    b.rotateY((r('turn') - 0.5) * 0.3).rotateZ((r('lean') - 0.5) * 0.06);
    const w = 0.15, h = 0.24, t = 0.085;
    b.with({ color: vary(PALETTE.stone, r('c'), 0.5), pattern: PATTERN.stone, ink: 'stone' }, () => slab(b, roundHead(w, h), t));
    // The carved face: a dark band across the front, standing a little proud so it gets its line.
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'band' }, () => b.box([-0.05, 0.1, t / 2], [0.05, 0.135, t / 2 + 0.012], { skip: ['n'] }));
    // Grass grows up round its foot: a darker skirt of turf.
    b.with({ color: mixColor(PALETTE.grass, PALETTE.leafDark, 0.35), pattern: PATTERN.grass, ink: 'turf' }, () => b.box([-0.1, 0, -0.07], [0.1, 0.025, 0.07], { skip: ['bottom'] }));
    return { mesh: b.build() };
  },
});

/**
 * Field gate: a five-bar gate with a diagonal brace, hung between two stout
 * posts on the cell line. Shut, or standing open into the field. Frame: an
 * edge slot, +Z into the field cell, +X along the line.
 */
export const fieldGate = definePart({
  prop: 'field-gate',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 617));
    const wood = vary(mixColor(PALETTE.wood, PALETTE.stoneShade, 0.35), r('wood'));
    const hinge = -0.38, latch = 0.38, top = 0.33;
    b.with({ color: mixColor(PALETTE.trunk, PALETTE.wood, 0.3), pattern: PATTERN.none, ink: 'posts' }, () => {
      for (const x of [hinge - 0.04, latch + 0.04]) b.box([x - 0.035, 0, LINE - 0.035], [x + 0.035, top + 0.07, LINE + 0.035], { skip: ['bottom'] });
    });
    const open = item.params?.open === 1;
    const swing = open ? -(1.0 + r('swing') * 0.35) : 0; // into the field (+Z)
    const len = latch - hinge;
    b.push().translate(hinge, 0, LINE).rotateY(swing);
    b.with({ color: wood, pattern: PATTERN.none, ink: 'gate' }, () => {
      const t = 0.022;
      // Stiles at each end, five rails, and the brace from the bottom of the hinge to the top of the latch.
      b.box([0, 0.04, -t], [0.035, top, t]);
      b.box([len - 0.03, 0.04, -t], [len, top, t]);
      for (let i = 0; i < 5; i++) {
        const y = 0.06 + (i * (top - 0.08)) / 4;
        b.box([0.035, y - 0.012, -t * 0.8], [len - 0.03, y + 0.012, t * 0.8], { skip: ['e', 'w'] });
      }
      const dx = len - 0.07, dy = top - 0.1, a = Math.atan2(dy, dx), l = Math.hypot(dx, dy);
      b.push().translate(0.035, 0.06, 0).rotateZ(a);
      b.box([0, -0.012, -t * 0.7], [l, 0.012, t * 0.7]);
      b.pop();
    });
    b.pop();
    return { mesh: b.build() };
  },
});
