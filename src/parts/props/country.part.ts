// Country props (U13 country lanes, D36 shrine, U22 ford): milestone, field gate, wayside shrine,
// stepping stones. Several parts
// in one file; each is discovered by its own export. The hedgerow is the
// hedge prop's 'wild' variant (park.part.ts).

import { SEA_Y } from '@/core/grid';
import { translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { dab, flowerColors, lump, mixColor, rngOf, vary, TONE } from './kit';

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

/**
 * Wayside shrine (D36) at a country crossroads: a stone calvary (a tall
 * cross on three stepped stones, 'calvary') or a little roofed niche on a
 * post with a painted figure in it ('niche'), with fresh flowers at its foot.
 * Frame: a floor slot, +Z toward `face` (the crossing).
 */
export const waysideShrine = definePart({
  prop: 'wayside-shrine',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 983));
    const stone = vary(PALETTE.stone, r('stone'), 0.4);
    b.rotateY((r('turn') - 0.5) * 0.2);
    if (item.variant === 'niche') {
      b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'post' }, () => b.boxAt([0, 0, 0], [0.06, 0.5, 0.06], { skip: ['bottom'] }));
      b.with({ color: PALETTE.white, pattern: PATTERN.plaster, ink: 'box' }, () => b.box([-0.09, 0.5, -0.07], [0.09, 0.72, 0.07]));
      b.with({ color: mixColor(PALETTE.glass, PALETTE.metal, 0.3), pattern: PATTERN.none, ink: 'inside' }, () => b.box([-0.06, 0.53, 0.07], [0.06, 0.68, 0.075], { skip: ['n'] }));
      b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'figure' }, () => lump(b, 0, 0.6, 0.08, 0.022, 0.05, 0.012, { seg: 5, rings: 3 }));
      b.with({ color: PALETTE.redDark, pattern: PATTERN.shingles, ink: 'roof' }, () => {
        const y = 0.72, rise = 0.1, w = 0.12, d = 0.1;
        b.quad([-w, y, d], [0, y + rise, d], [0, y + rise, -d], [-w, y, -d]);
        b.quad([0, y + rise, d], [w, y, d], [w, y, -d], [0, y + rise, -d]);
        b.tri([-w, y, d], [w, y, d], [0, y + rise, d]);
        b.tri([w, y, -d], [-w, y, -d], [0, y + rise, -d]);
        b.quad([-w, y, -d], [w, y, -d], [w, y, d], [-w, y, d]);
      });
    } else {
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'steps' }, () => {
        b.box([-0.2, 0, -0.2], [0.2, 0.06, 0.2], { skip: ['bottom'] });
        b.box([-0.14, 0.06, -0.14], [0.14, 0.12, 0.14], { skip: ['bottom'] });
        b.box([-0.08, 0.12, -0.08], [0.08, 0.18, 0.08], { skip: ['bottom'] });
      });
      b.with({ color: stone, pattern: PATTERN.stone, ink: 'cross' }, () => {
        b.box([-0.03, 0.18, -0.03], [0.03, 0.95, 0.03], { skip: ['bottom'] });
        b.box([-0.15, 0.72, -0.028], [-0.03, 0.78, 0.028], { skip: ['e'] });
        b.box([0.03, 0.72, -0.028], [0.15, 0.78, 0.028], { skip: ['w'] });
      });
    }
    // Fresh flowers at its foot.
    const colors = flowerColors();
    for (let i = 0; i < 2; i++) {
      const x = (i ? 1 : -1) * (item.variant === 'niche' ? 0.09 : 0.13), z = 0.15;
      b.with({ color: PALETTE.brick, pattern: PATTERN.none, ink: `pot${i}` }, () => b.at(translation(x, item.variant === 'niche' ? 0 : 0.06, z), () => b.lathe([[0.025, 0], [0.04, 0.06], [0.045, 0.065]], { segments: 6 })));
      b.with({ color: colors[Math.floor(r('fc', i) * colors.length)]!, pattern: PATTERN.none, ink: `pot${i}`, sway: 0.2 }, () => {
        for (let k = 0; k < 3; k++) dab(b, x + (k - 1) * 0.02, (item.variant === 'niche' ? 0 : 0.06) + 0.08 + (k % 2) * 0.015, z, 0.022, TONE.lit, 5, 0.015);
      });
    }
    return { mesh: b.build() };
  },
});

/**
 * Stepping stones (U22 ford): three flat stones across one cell of river
 * water, their tops just clear of the surface, a white ripple ring round each
 * where the current breaks. Frame: the water cell's centre slot (on the river
 * bed, y = 0 of the cell at sea level); +X along the crossing.
 */
export const steppingStones = definePart({
  prop: 'stepping-stones',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 613));
    const surface = SEA_Y;
    for (let i = 0; i < 3; i++) {
      const x = -0.33 + i * 0.33 + (r('x', i) - 0.5) * 0.06, z = (r('z', i) - 0.5) * 0.14;
      const rad = 0.11 + r('r', i) * 0.03;
      b.with({ color: vary(mixColor(PALETTE.stoneShade, PALETTE.rock, 0.4), r('c', i)), pattern: PATTERN.rock, ink: `stone${i}` }, () => {
        // A squat column from the bed to just above the water, with a rounded top.
        b.at(translation(x, 0, z), () => b.lathe([[rad * 0.9, surface - 0.25], [rad, surface - 0.02], [rad * 0.92, surface + 0.04], [rad * 0.55, surface + 0.065], [0, surface + 0.07]], { segments: 7 }));
      });
      b.with({ color: PALETTE.foam, pattern: PATTERN.foam, ink: `ripple${i}` }, () => {
        b.at(translation(x, 0, z), () => b.lathe([[rad + 0.05, surface + 0.006], [rad + 0.005, surface + 0.006]], { segments: 9 }));
      });
    }
    return { mesh: b.build() };
  },
});
