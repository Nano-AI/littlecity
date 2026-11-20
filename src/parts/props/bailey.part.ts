// Castle bailey props (U21): a lean-to stable with a horse looking out, a
// practice dummy, an archery butt, a stack of hay. Several parts in one file;
// each is discovered by its own export.

import { compose, rotationX, rotationY, rotationZ, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { lump, mixColor, rngOf, vary } from './kit';

const LINE = -(0.5 - SLOT_INSET);

/**
 * Stable: a lean-to against the curtain wall, a plank back and sides under a
 * sloping shingle roof on two posts, a half door, and a horse's head looking
 * out over it. Frame: an edge slot against the wall, +Z out of it.
 */
export const stable = definePart({
  prop: 'stable',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 523));
    const w = 0.42, z0 = LINE + 0.02, z1 = z0 + 0.5, hb = 0.62, hf = 0.44;
    const wood = vary(mixColor(PALETTE.wood, PALETTE.trunk, 0.3), r('wood'));
    b.with({ color: wood, pattern: PATTERN.planks, ink: 'walls' }, () => {
      for (const s of [-1, 1]) b.box([s * w - 0.02, 0, z0], [s * w + 0.02, hf, z1 - 0.02], { skip: ['bottom'] });
      // The half door across the front, low enough to look over.
      b.box([-w + 0.02, 0, z1 - 0.05], [w - 0.02, 0.22, z1 - 0.02], { skip: ['bottom'] });
    });
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'posts' }, () => {
      for (const s of [-1, 1]) b.box([s * w - 0.03, 0, z1 - 0.06], [s * w + 0.03, hf, z1], { skip: ['bottom'] });
    });
    b.with({ color: PALETTE.redDark, pattern: PATTERN.shingles, ink: 'roof' }, () => {
      const o = 0.06;
      b.quad([-w - o, hf - 0.01, z1 + o], [w + o, hf - 0.01, z1 + o], [w + o, hb, z0], [-w - o, hb, z0]);
      b.quad([w + o, hf - 0.04, z1 + o], [-w - o, hf - 0.04, z1 + o], [-w - o, hb - 0.03, z0], [w + o, hb - 0.03, z0]);
      b.quad([-w - o, hf - 0.04, z1 + o], [w + o, hf - 0.04, z1 + o], [w + o, hf - 0.01, z1 + o], [-w - o, hf - 0.01, z1 + o]);
    });
    // The horse: a head and neck leaning out over the half door.
    const coat = r('coat') < 0.5 ? mixColor(PALETTE.trunk, PALETTE.metal, 0.2) : vary(PALETTE.wood, r('c2'));
    b.with({ color: coat, pattern: PATTERN.none, ink: 'horse' }, () => {
      b.at(compose(translation(-0.1 + r('hx') * 0.2, 0.26, z1 - 0.1), rotationZ(0)), () => {
        lump(b, 0, 0.06, 0, 0.06, 0.1, 0.06, { seg: 7, rings: 4 }); // the neck
        lump(b, 0, 0.14, 0.09, 0.045, 0.05, 0.09, { seg: 7, rings: 4 }); // the head, out over the door
        for (const x of [-0.025, 0.025]) b.boxAt([x, 0.19, 0.04], [0.015, 0.04, 0.015]); // ears
      });
    });
    return { mesh: b.build() };
  },
});

/** Practice dummy: a straw man on a post with a crossbar for arms and a shield. Frame: a floor slot. */
export const practiceDummy = definePart({
  prop: 'practice-dummy',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 337));
    b.rotateY(r('turn') * Math.PI * 2);
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'post' }, () => {
      b.boxAt([0, 0, 0], [0.04, 0.55, 0.04], { skip: ['bottom'] });
      b.box([-0.16, 0.38, -0.015], [0.16, 0.41, 0.015]);
    });
    b.with({ color: mixColor(PALETTE.yellow, PALETTE.wood, 0.4), pattern: PATTERN.thatch, ink: 'straw' }, () => {
      lump(b, 0, 0.36, 0, 0.07, 0.12, 0.06, { seg: 7, rings: 4 });
      lump(b, 0, 0.55, 0, 0.05, 0.05, 0.05, { seg: 6, rings: 4 });
    });
    b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'shield' }, () => b.box([-0.065, 0.26, 0.06], [0.065, 0.42, 0.08]));
    return { mesh: b.build() };
  },
});

/** Archery butt: a round straw target with painted rings on a wooden stand. Frame: a floor slot, +Z the face. */
export const archeryButt = definePart({
  prop: 'archery-butt',
  build(_item, ctx) {
    const b = ctx.mesh();
    void ctx;
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'stand' }, () => {
      for (const x of [-0.12, 0.12]) b.box([x - 0.015, 0, -0.06], [x + 0.015, 0.36, -0.03], { skip: ['bottom'] });
      b.at(compose(translation(0, 0, -0.05), rotationY(0)), () => b.box([-0.015, 0, -0.18], [0.015, 0.3, -0.15], { skip: ['bottom'] }));
    });
    b.with({ color: mixColor(PALETTE.yellow, PALETTE.wood, 0.4), pattern: PATTERN.thatch, ink: 'butt' }, () => {
      b.at(compose(translation(0, 0.26, -0.02), rotationX(Math.PI / 2 - 0.2)), () => b.lathe([[0.16, -0.03], [0.16, 0.03], [0, 0.03]], { segments: 14, capBottom: true }));
    });
    // Painted rings on the face: white, red, and a gold centre.
    for (const [rad, color, lift] of [[0.12, PALETTE.white, 0.035], [0.08, PALETTE.red, 0.038], [0.035, PALETTE.yellow, 0.041]] as const) {
      b.with({ color, pattern: PATTERN.none, ink: 'rings' }, () => {
        b.at(compose(translation(0, 0.26, -0.02), rotationX(Math.PI / 2 - 0.2)), () => b.lathe([[rad, lift], [0, lift]], { segments: 14 }));
      });
    }
    return { mesh: b.build() };
  },
});

/** Hay: a few square bales stacked against a wall, a fork stuck in the top one. Frame: an edge slot, +Z out. */
export const hay = definePart({
  prop: 'hay',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 241));
    const z0 = LINE + 0.02;
    const straw = vary(mixColor(PALETTE.yellow, PALETTE.wood, 0.35), r('straw'));
    b.with({ color: straw, pattern: PATTERN.thatch, ink: 'bales' }, () => {
      b.box([-0.3, 0, z0], [-0.02, 0.14, z0 + 0.2], { skip: ['bottom'] });
      b.box([0.0, 0, z0], [0.28, 0.14, z0 + 0.2], { skip: ['bottom'] });
      b.box([-0.16, 0.14, z0 + 0.01], [0.12, 0.28, z0 + 0.19], { skip: ['bottom'] });
    });
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'fork' }, () => b.at(compose(translation(0, 0.28, z0 + 0.1), rotationZ(0.3)), () => b.box([-0.01, 0, -0.01], [0.01, 0.3, 0.01])));
    return { mesh: b.build() };
  },
});
