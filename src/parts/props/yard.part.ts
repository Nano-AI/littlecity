// Yard and nook props (U04, U06, U08): what gathers behind houses, beside
// stairs and under decks. Goods stack, wall fountain, handcart, kiosk, shed,
// vegetable patch, washing pole, woodpile. Several parts in one file; each
// is discovered by its own export.
//
// Frames. Things that stand against a wall or a boundary ('wall-fountain',
// 'shed', 'woodpile') take an edge slot with +Z pointing away from the wall:
// the cell line is at z = LINE (−0.15); a house wall stands 0.07 behind it.

import { compose, rotationX, rotationY, rotationZ, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN } from '@/gen/mesh';
import { barrel, crate } from '@/parts/ground/dock-goods.part';
import { PALETTE } from '@/style/palette';
import { cloth, clothColors, lump, mixColor, rngOf, tube, vary, type Rgb } from './kit';

const LINE = -(0.5 - SLOT_INSET);

/**
 * Goods stack: crates, barrels, or a crate with a cat asleep on it. Frame: a
 * floor slot; the stack sits round the origin.
 */
export const goodsStack = definePart({
  prop: 'goods-stack',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 613));
    const tone = (k: string): Rgb => vary(PALETTE.wood, r(k), 1.3);
    const put = (x: number, y: number, z: number, turn: number, fn: () => void): void => void b.at(compose(translation(x, y, z), rotationY(turn)), fn);
    const j = (k: string, a: number): number => (r(k) - 0.5) * 2 * a;
    if (item.variant === 'barrels') {
      put(-0.1, 0, -0.03, 0, () => barrel(b, 0.09, 0.27, tone('a'), 'a'));
      put(0.11, 0, -0.06, 0, () => barrel(b, 0.085, 0.25, tone('b'), 'b'));
      put(0.02, 0, 0.13, j('ct', 0.4), () => crate(b, 0.17, tone('c'), 'c'));
    } else if (item.variant === 'cat') {
      put(0, 0, 0, j('at', 0.2), () => crate(b, 0.26, tone('a'), 'a'));
      // The cat: curled up, head on its paws, tail round its side.
      const coats = [PALETTE.brick, PALETTE.metal, PALETTE.white, PALETTE.stoneShade, PALETTE.yellow];
      const coat = coats[Math.floor(r('coat') * coats.length)]!;
      const y = 0.26 * 0.86;
      b.at(compose(translation(j('cx', 0.03), y, j('cz', 0.03)), rotationY(r('turn') * 6.3)), () => {
        b.with({ color: coat, pattern: PATTERN.none, ink: 'cat' }, () => {
          lump(b, 0, 0.03, 0, 0.075, 0.04, 0.055, { seg: 7, rings: 4 });
          lump(b, 0.07, 0.035, 0.02, 0.036, 0.032, 0.034, { seg: 6, rings: 4 });
          b.tri([0.06, 0.06, 0.035], [0.075, 0.06, 0.045], [0.066, 0.085, 0.042]);
          b.tri([0.085, 0.06, 0.02], [0.095, 0.06, 0.035], [0.092, 0.085, 0.026]);
          tube(b, [[-0.07, 0.02, 0], [-0.06, 0.018, 0.06], [0, 0.016, 0.075]], [0.014, 0.012, 0.008], { seg: 4, capEnd: true });
        });
      });
    } else {
      put(-0.1, 0, -0.04, j('at', 0.15), () => crate(b, 0.24, tone('a'), 'a'));
      put(0.15, 0, 0.02, j('bt', 0.2), () => crate(b, 0.2, tone('b'), 'b'));
      put(-0.07 + j('cx', 0.03), 0.24 * 0.86, -0.04, 0.4 + j('ct', 0.3), () => crate(b, 0.18, tone('c'), 'c'));
    }
    return { mesh: b.build() };
  },
});

/** Wall fountain: a stone back with a spout over a half-round basin. Frame: an edge slot against a wall, +Z out. */
export const wallFountain = definePart({
  prop: 'wall-fountain',
  build(_item, ctx) {
    const b = ctx.mesh();
    const z0 = LINE - 0.06;
    b.with({ color: PALETTE.stone, pattern: PATTERN.stone, ink: 'back' }, () => {
      b.box([-0.17, 0, z0], [0.17, 0.44, z0 + 0.07], { skip: ['bottom', 'n'] });
      b.box([-0.2, 0.44, z0], [0.2, 0.49, z0 + 0.09], { skip: ['n'] });
    });
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'basin' }, () => {
      b.at(translation(0, 0, z0 + 0.07), () => b.lathe([[0.15, 0], [0.19, 0.14], [0.19, 0.17], [0.15, 0.17]], { segments: 6, start: 0, sweep: Math.PI }));
    });
    b.with({ color: PALETTE.sea, pattern: PATTERN.water, ink: 'basin' }, () => b.at(translation(0, 0, z0 + 0.07), () => b.lathe([[0.15, 0.15], [0, 0.15]], { segments: 6, start: 0, sweep: Math.PI })));
    // The spout and its thread of water.
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'spout' }, () => b.box([-0.025, 0.3, z0 + 0.07], [0.025, 0.34, z0 + 0.12]));
    b.with({ color: PALETTE.foam, pattern: PATTERN.foam, ink: 'spout' }, () => b.box([-0.01, 0.15, z0 + 0.1], [0.01, 0.3, z0 + 0.12], { skip: ['top', 'bottom'] }));
    void ctx;
    return { mesh: b.build(), anchors: { 'water-surface': translation(0, 0.15, z0 + 0.14) } };
  },
});

/** Handcart: two wheels, a flat bed with a few sacks, its shafts resting on the ground. Frame: a floor slot. */
export const cart = definePart({
  prop: 'cart',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 389));
    const wood = vary(PALETTE.wood, r('wood'));
    b.at(compose(rotationY((r('turn') - 0.5) * 0.8), rotationZ(-0.16)), () => {
      b.with({ color: wood, pattern: PATTERN.planks, ink: 'bed' }, () => {
        b.box([-0.2, 0.13, -0.12], [0.2, 0.16, 0.12]);
        b.box([-0.2, 0.16, -0.12], [-0.17, 0.25, 0.12], { skip: ['bottom'] });
        for (const z of [-0.12, 0.1]) b.box([-0.2, 0.16, z], [0.2, 0.21, z + 0.02], { skip: ['bottom'] });
        for (const z of [-0.1, 0.1]) tube(b, [[0.2, 0.145, z], [0.44, 0.15, z]], 0.012, { seg: 4, capEnd: true });
      });
      b.with({ color: mixColor(wood, PALETTE.trunk, 0.6), pattern: PATTERN.none, ink: 'wheels' }, () => {
        for (const z of [-0.15, 0.15]) b.at(compose(translation(-0.02, 0.1, z), rotationX(Math.PI / 2)), () => b.lathe([[0.1, -0.012], [0.1, 0.012]], { segments: 9, capTop: true, capBottom: true }));
      });
      b.with({ color: mixColor(PALETTE.sand, PALETTE.dirt, 0.4), pattern: PATTERN.cloth, ink: 'load' }, () => {
        b.at(translation(-0.07, 0.16, -0.02), () => b.lathe([[0.07, 0], [0.08, 0.06], [0.05, 0.12], [0, 0.13]], { segments: 7 }));
        b.at(translation(0.07, 0.16, 0.03), () => b.lathe([[0.06, 0], [0.07, 0.05], [0.04, 0.1], [0, 0.11]], { segments: 7 }));
      });
    });
    return { mesh: b.build() };
  },
});

/** Kiosk: a little boarded stand with a striped canopy and a counter. Frame: a floor slot, +Z toward the customer. */
export const kiosk = definePart({
  prop: 'kiosk',
  build(item, ctx) {
    const b = ctx.mesh();
    const colors = [PALETTE.leafDark, PALETTE.glass, PALETTE.redDark, PALETTE.trunk];
    const paint = colors[(((item.params?.color ?? 0) % colors.length) + colors.length) % colors.length]!;
    const w = 0.26, h = 0.52;
    b.with({ color: paint, pattern: PATTERN.planks, ink: 'body' }, () => b.box([-w, 0, -w], [w, h, w], { skip: ['bottom', 'top'] }));
    // The hatch: a dark opening with a pale counter under it.
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'body' }, () => b.quad([-0.17, 0.25, w + 0.004], [0.17, 0.25, w + 0.004], [0.17, 0.44, w + 0.004], [-0.17, 0.44, w + 0.004]));
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'counter' }, () => b.box([-0.21, 0.22, w], [0.21, 0.25, w + 0.07], { skip: ['n'] }));
    b.with({ color: PALETTE.red, pattern: PATTERN.stripes, ink: 'roof' }, () => {
      const e = w + 0.07;
      const tip: Vec3 = [0, h + 0.2, 0];
      const c: Vec3[] = [[-e, h, e], [e, h, e], [e, h, -e], [-e, h, -e]];
      for (let i = 0; i < 4; i++) b.tri(c[i]!, c[(i + 1) % 4]!, tip);
      b.quad(c[3]!, c[2]!, c[1]!, c[0]!);
    });
    b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'roof' }, () => b.at(translation(0, h + 0.2, 0), () => b.lathe([[0, -0.01], [0.025, 0.02], [0, 0.05]], { segments: 5 })));
    void ctx;
    return { mesh: b.build() };
  },
});

/** Shed: a boarded lean-to with a tarred roof and a door. Frame: an edge slot with its back to the boundary, +Z into the yard. */
export const shed = definePart({
  prop: 'shed',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 151));
    const w = 0.24 + r('w') * 0.04, z0 = LINE + 0.03, z1 = z0 + 0.36, hb = 0.52, hf = 0.42;
    const wood = vary(mixColor(PALETTE.wood, PALETTE.trunk, 0.25), r('wood'));
    b.with({ color: wood, pattern: PATTERN.planks, ink: 'walls' }, () => {
      b.quad([-w, 0, z1], [w, 0, z1], [w, hf, z1], [-w, hf, z1]);
      b.quad([w, 0, z0], [-w, 0, z0], [-w, hb, z0], [w, hb, z0]);
      b.quad([w, 0, z1], [w, 0, z0], [w, hb, z0], [w, hf, z1]);
      b.quad([-w, 0, z0], [-w, 0, z1], [-w, hf, z1], [-w, hb, z0]);
    });
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'roof' }, () => {
      const o = 0.04;
      b.quad([-w - o, hf - 0.012, z1 + o], [w + o, hf - 0.012, z1 + o], [w + o, hb + 0.02, z0 - o], [-w - o, hb + 0.02, z0 - o]);
      b.quad([w + o, hf - 0.04, z1 + o], [-w - o, hf - 0.04, z1 + o], [-w - o, hb - 0.01, z0 - o], [w + o, hb - 0.01, z0 - o]);
      b.quad([-w - o, hf - 0.04, z1 + o], [w + o, hf - 0.04, z1 + o], [w + o, hf - 0.012, z1 + o], [-w - o, hf - 0.012, z1 + o]);
    });
    b.with({ color: mixColor(wood, PALETTE.trunk, 0.5), pattern: PATTERN.planks, ink: 'door' }, () => b.box([-0.08, 0, z1], [0.08, 0.32, z1 + 0.012], { skip: ['bottom', 'n'] }));
    return { mesh: b.build() };
  },
});

/** Vegetable patch: a dug bed with rows of cabbages and bean sticks. Frame: a floor slot, square to the world. */
export const vegPatch = definePart({
  prop: 'veg-patch',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 823));
    const w = 0.3, d = 0.22;
    b.with({ color: vary(PALETTE.dirtDark, r('earth')), pattern: PATTERN.crops, ink: 'earth' }, () => b.box([-w, 0, -d], [w, 0.03, d], { skip: ['bottom'] }));
    b.setInk('plants');
    for (let i = 0; i < 4; i++) {
      const x = -w + 0.09 + (i * (w * 2 - 0.18)) / 3;
      b.with({ color: vary(i % 2 ? PALETTE.leaf : PALETTE.bush, r('c', i)), pattern: PATTERN.none }, () => lump(b, x, 0.055, d - 0.1, 0.05, 0.04, 0.05, { seg: 6, rings: 3 }));
    }
    // A row of bean sticks along the back.
    for (let i = 0; i < 3; i++) {
      const x = -w + 0.12 + i * 0.18;
      b.with({ color: PALETTE.trunk, pattern: PATTERN.none }, () => tube(b, [[x, 0.03, -d + 0.08], [x + 0.02, 0.3, -d + 0.08]], 0.008, { seg: 3 }));
      b.with({ color: vary(PALETTE.leafDark, r('b', i)), pattern: PATTERN.none, sway: 0.2 }, () => lump(b, x + 0.01, 0.17, -d + 0.08, 0.04, 0.09, 0.04, { seg: 6, rings: 4 }));
    }
    return { mesh: b.build() };
  },
});

/** Washing pole: two posts with a line of washing between them. Frame: a floor slot; the line runs along X. Anchor 'hang-washing': where someone stands to peg out. */
export const washingPole = definePart({
  prop: 'washing-pole',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 947));
    const half = 0.34, h = 0.44;
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'posts' }, () => {
      for (const x of [-half, half]) b.boxAt([x, 0, 0], [0.035, h, 0.035], { skip: ['bottom'] });
    });
    b.with({ color: PALETTE.ink, pattern: PATTERN.none, ink: 'line' }, () => tube(b, [[-half, h - 0.03, 0], [0, h - 0.06, 0], [half, h - 0.03, 0]], 0.008, { seg: 3 }));
    const colors = clothColors();
    const n = 3;
    for (let i = 0; i < n; i++) {
      const x = -half + 0.14 + i * 0.2 + (r('x', i) - 0.5) * 0.04;
      const y = h - 0.055, w = 0.06 + r('w', i) * 0.03, drop = 0.16 + r('d', i) * 0.07;
      b.with({ color: r('white', i) < 0.4 ? PALETTE.white : colors[Math.floor(r('c', i) * colors.length)]!, pattern: PATTERN.cloth, ink: `c${i}` }, () => {
        b.setSway((_px, py) => Math.min(1, Math.max(0, (y - py) / drop)) * 0.8);
        cloth(b, [[x - w, y - drop], [x + w, y - drop], [x + w, y], [x - w, y]]);
        b.setSway(0);
      });
    }
    // Where someone stands to peg out the washing: in front of the line, facing it.
    return { mesh: b.build(), anchors: { 'hang-washing': compose(translation(0, 0, 0.17), rotationY(Math.PI)) } };
  },
});

/** Woodpile: split logs stacked against a wall, ends outward. Frame: an edge slot against the wall, +Z out. */
export const woodpile = definePart({
  prop: 'woodpile',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 211));
    const z0 = LINE - 0.04, z1 = z0 + 0.2, rad = 0.045;
    b.setPattern(PATTERN.none).setInk('logs');
    for (let row = 0; row < 3; row++) {
      const count = 5 - row;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * rad * 2.05 + (r('x', row, i) - 0.5) * 0.01;
        const y = rad + row * rad * 1.75;
        b.with({ color: vary(mixColor(PALETTE.wood, PALETTE.trunk, 0.35), r('c', row, i), 1.6) }, () =>
          tube(b, [[x, y, z0], [x, y, z1 + (r('z', row, i) - 0.5) * 0.03]], rad, { seg: 6, capEnd: true }),
        );
      }
    }
    return { mesh: b.build() };
  },
});
