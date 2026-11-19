// Park and paddock props (U01, U02, D03): bench, hedge, shrub, worn track,
// espalier, trough, grazing animal. Several parts in one file; each is
// discovered by its own export.

import { compose, rotationY, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { bush, dab, flowerColors, localTone, lump, mixColor, rngOf, roundedRect, tube, vary, TONE } from './kit';
import type { Dir4 } from '@/core/grid';

const LINE = -(0.5 - SLOT_INSET);
/** Raw ink ids shared across pieces so a run reads as one surface. */
const INK_HEDGE = 61010, INK_TRACK = 61011;

/**
 * Bench. 'wood': slatted seat and back on two cast-iron ends; 'stone': a
 * slab on two blocks (squares, churchyards). Frame: a floor slot, +Z the way
 * the sitters face. Sockets 'seat-0' and 'seat-1' on the seat.
 */
export const bench = definePart({
  prop: 'bench',
  build(item, ctx) {
    const b = ctx.mesh();
    const w = 0.48, seatY = 0.13;
    b.rotateY((ctx.rand('askew') - 0.5) * 0.08);
    if (item.variant === 'stone') {
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'legs' }, () => {
        for (const x of [-0.15, 0.15]) b.boxAt([x, 0, 0], [0.07, seatY - 0.03, 0.13], { skip: ['bottom', 'top'] });
      });
      b.with({ color: PALETTE.stone, pattern: PATTERN.none, ink: 'seat' }, () => b.box([-w / 2, seatY - 0.03, -0.085], [w / 2, seatY + 0.015, 0.085]));
    } else {
      b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'ends' }, () => {
        for (const x of [-w / 2 + 0.035, w / 2 - 0.035]) {
          b.box([x - 0.016, 0, -0.075], [x + 0.016, seatY, 0.075], { skip: ['bottom', 'top'] });
          b.box([x - 0.016, seatY, -0.095], [x + 0.016, 0.3, -0.06]);
        }
      });
      b.with({ color: vary(PALETTE.wood, ctx.rand('wood')), pattern: PATTERN.planks, ink: 'seat' }, () => {
        b.box([-w / 2, seatY, -0.08], [w / 2, seatY + 0.028, 0.09]);
        b.box([-w / 2, 0.2, -0.1], [w / 2, 0.31, -0.072]);
      });
    }
    const y = seatY + 0.028;
    return { mesh: b.build(), anchors: { 'seat-0': translation(-0.11, y, 0.01), 'seat-1': translation(0.11, y, 0.01) } };
  },
});

/**
 * Hedge: a low clipped hedge along one side of a cell, on the cell line.
 * Frame: an edge slot, +Z into the cell, +X along the hedge.
 */
export const hedge = definePart({
  prop: 'hedge',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 911));
    const from = item.params?.from ?? 1, to = item.params?.to ?? 1;
    const h = 0.2, t = 0.085;
    const x0 = from === 1 ? -0.44 : -0.5, x1 = to === 1 ? 0.44 : 0.5;
    const piece = (a: number, c: number, ra: boolean, rc: boolean): void => {
      const rad = t * 0.95;
      const outline = roundedRect(a, LINE - t, c, LINE + t, [ra ? rad : 0, rc ? rad : 0, rc ? rad : 0, ra ? rad : 0], 3);
      b.extrude(outline, 0, h + (r('h', a) - 0.5) * 0.02, { cap: 'top', smooth: true });
    };
    b.setColor(vary(mixColor(PALETTE.bush, PALETTE.leafDark, 0.35), 0.5 + (r('c') - 0.5) * 0.4)).setPattern(PATTERN.leaves).setInkId(INK_HEDGE);
    if (item.variant === 'gap') {
      piece(x0, -0.2, from === 1, true);
      piece(0.2, x1, true, to === 1);
    } else piece(x0, x1, from === 1, to === 1);
    return { mesh: b.build() };
  },
});

/** Shrub: a rounded bush, 'flowering' with blossom. Frame: a floor slot, square to the world. */
export const shrub = definePart({
  prop: 'shrub',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 733));
    const rad = 0.13 + r('rad') * 0.04;
    b.setInk('shrub');
    bush(b, 0, 0, 0, rad, r, 'a', PALETTE.bush, 0.25);
    if (item.variant === 'flowering') {
      const colors = flowerColors();
      const c = colors[(((item.params?.flowers ?? Math.floor(r('fc') * 5)) % 5) + 5) % 5]!;
      b.with({ color: c, pattern: PATTERN.none, sway: 0.25 }, () => {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6 + r('fa', i) * 0.1) * Math.PI * 2, up = 0.35 + r('fu', i) * 0.5;
          const rr = rad * Math.sqrt(1 - up * up * 0.8);
          dab(b, Math.cos(a) * rr * 0.9, rad * 0.95 * up + 0.01, Math.sin(a) * rr * 0.9, 0.03, TONE.lit, 5, 0.02);
        }
      });
    }
    return { mesh: b.build() };
  },
});

/** Worn track: one cell of a path trodden into the grass. Frame: the cell's centre slot, square to the world. */
export const wornTrack = definePart({
  prop: 'worn-track',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 577));
    const mask = item.params?.mask ?? 0;
    const y = 0.012, w = 0.12;
    const up: Vec3 = [0, 1, 0];
    const n = [up, up, up, up] as const;
    b.setColor(PALETTE.dirt).setPattern(PATTERN.dirt).setInkId(INK_TRACK);
    // A worn patch in the middle, and an arm to each side the track runs on to.
    const hub: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rad = w * (1.25 + r('hub', i) * 0.3);
      hub.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    b.extrude(hub, y, y, { cap: 'top' });
    const arms: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      const [dx, dz] = arms[d]!;
      const px = -dz, pz = dx;
      // The half-width at the cell edge is fixed, so two cells agree where they meet.
      const P = (along: number, side: number, half: number): Vec3 => [dx * along + px * side * half, y, dz * along + pz * side * half];
      const mid = w * (0.85 + r('arm', d) * 0.3);
      b.quad(P(0.08, -1, w), P(0.08, 1, w), P(0.3, 1, mid), P(0.3, -1, mid), { normals: n });
      b.quad(P(0.3, -1, mid), P(0.3, 1, mid), P(0.5, 1, w), P(0.5, -1, w), { normals: n });
    }
    return { mesh: b.build() };
  },
});

/** Espalier: a fruit tree trained flat against a wall. Frame: an edge slot, +Z away from the wall. */
export const espalier = definePart({
  prop: 'espalier',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 431));
    const tone = localTone((item.params?.face ?? 2) as Dir4);
    const z = LINE + 0.16;
    b.with({ color: PALETTE.trunk, pattern: PATTERN.bark, ink: 'tree' }, () => {
      tube(b, [[0, 0, z], [0, 0.34, z]], [0.022, 0.014], { seg: 4 });
      for (const y of [0.14, 0.27]) tube(b, [[-0.3, y + 0.02, z], [0, y, z], [0.3, y + 0.02, z]], 0.011, { seg: 3 });
    });
    const leaf = vary(PALETTE.leaf, r('leaf'));
    b.with({ pattern: PATTERN.leaves, ink: 'tree', sway: 0.15 }, () => {
      for (const [i, y] of [0.16, 0.29].entries()) {
        for (const side of [-1, 1]) {
          b.with({ color: side > 0 ? leaf : mixColor(leaf, PALETTE.leafDark, 0.3) }, () =>
            lump(b, side * 0.17, y + 0.02, z + 0.01, 0.15, 0.055, 0.04, { seg: 7, rings: 4, normal: side > 0 ? tone.lit : tone.mid, twist: i }),
          );
        }
      }
      b.with({ color: leaf }, () => lump(b, 0, 0.37, z + 0.01, 0.09, 0.06, 0.04, { seg: 7, rings: 4, normal: tone.lit }));
    });
    b.with({ color: r('fruit') < 0.5 ? PALETTE.red : PALETTE.yellow, pattern: PATTERN.none, ink: 'tree' }, () => {
      for (let i = 0; i < 5; i++) dab(b, (r('fx', i) - 0.5) * 0.52, 0.15 + (i % 2) * 0.13 + r('fy', i) * 0.03, z + 0.052, 0.022, tone.lit, 5, 0.014);
    });
    return { mesh: b.build() };
  },
});

/** Trough: a wooden drinking trough with water in it. Frame: a floor slot; it lies along X. */
export const trough = definePart({
  prop: 'trough',
  build(_item, ctx) {
    const b = ctx.mesh();
    const wood = vary(PALETTE.wood, ctx.rand('wood'));
    b.with({ color: wood, pattern: PATTERN.planks, ink: 'trough' }, () => {
      b.box([-0.24, 0.03, -0.09], [0.24, 0.16, 0.09], { skip: ['top'] });
      for (const x of [-0.19, 0.19]) b.box([x - 0.03, 0, -0.1], [x + 0.03, 0.03, 0.1], { skip: ['bottom', 'top'] });
    });
    b.with({ color: PALETTE.sea, pattern: PATTERN.water, ink: 'trough' }, () => b.quad([-0.215, 0.135, 0.065], [0.215, 0.135, 0.065], [0.215, 0.135, -0.065], [-0.215, 0.135, -0.065]));
    b.with({ color: mixColor(wood, PALETTE.trunk, 0.4), pattern: PATTERN.none, ink: 'trough' }, () => b.box([-0.25, 0.16, -0.1], [0.25, 0.175, -0.07]));
    return { mesh: b.build() };
  },
});

/**
 * Grazer: a sheep or a cow with its head down in the grass. It stands
 * still; `turn` (eighths of a turn) faces it. Frame: a floor slot.
 */
export const grazer = definePart({
  prop: 'grazer',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 269));
    const cow = item.variant === 'cow';
    const k = cow ? 1.35 : 1;
    b.at(compose(translation((r('ox') - 0.5) * 0.2, 0, (r('oz') - 0.5) * 0.2), rotationY(((item.params?.turn ?? 0) * Math.PI) / 4)), () => {
      const coat = cow ? (r('coat') < 0.5 ? PALETTE.trunk : PALETTE.white) : mixColor(PALETTE.white, PALETTE.stoneShade, r('coat') * 0.5);
      const dark = cow ? mixColor(PALETTE.trunk, PALETTE.metal, 0.4) : PALETTE.metal;
      b.with({ color: dark, pattern: PATTERN.none, ink: 'legs' }, () => {
        for (const [x, z] of [[-0.075, -0.04], [-0.075, 0.04], [0.07, -0.04], [0.07, 0.04]] as const) b.boxAt([x * k, 0, z * k], [0.026 * k, 0.09 * k, 0.026 * k], { skip: ['bottom', 'top'] });
      });
      b.with({ color: coat, pattern: PATTERN.none, ink: 'body' }, () => {
        lump(b, 0, 0.135 * k, 0, 0.125 * k, 0.075 * k, 0.07 * k, { seg: 8, rings: 5 });
        if (cow) b.with({ color: coat === PALETTE.white ? PALETTE.trunk : PALETTE.white }, () => lump(b, -0.03, 0.17 * k, 0.045, 0.06, 0.05, 0.04, { seg: 6, rings: 4 }));
      });
      // The head, down at the grass.
      b.with({ color: cow ? coat : dark, pattern: PATTERN.none, ink: 'head' }, () => lump(b, 0.155 * k, 0.07 * k, 0, 0.05 * k, 0.04 * k, 0.036 * k, { seg: 6, rings: 4 }));
    });
    return { mesh: b.build() };
  },
});
