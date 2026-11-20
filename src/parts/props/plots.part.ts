// Garden-plot props (U14 burgage plots, U23 orchard): a small fruit tree, a
// compost heap. Several parts in one file; each is discovered by its own export.

import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { dab, lump, mixColor, rngOf, tube, vary, TONE } from './kit';

const LINE = -(0.5 - SLOT_INSET);

/**
 * Fruit tree: a small apple or pear tree at the end of a garden, a crooked
 * trunk and a round low crown dotted with fruit. Smaller than a placed tree
 * (the player's trees stay the landmarks). Frame: a floor slot, square to the
 * world (its tones are world tones). `fruit`: 0 apples (red), 1 pears (yellow).
 */
export const fruitTree = definePart({
  prop: 'fruit-tree',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 353));
    const h = 0.22 + r('h') * 0.05, rad = 0.2 + r('rad') * 0.04;
    const lean = (r('lean') - 0.5) * 0.1;
    b.with({ color: PALETTE.trunk, pattern: PATTERN.bark, ink: 'trunk' }, () => {
      tube(b, [[0, 0, 0], [lean * 0.3, h * 0.5, 0.01], [lean, h + 0.05, 0]], [0.035, 0.027, 0.02], { seg: 5 });
      // Two low boughs, the shape of an old pruned tree.
      tube(b, [[lean * 0.6, h * 0.8, 0], [lean + 0.09, h + 0.06, 0.03]], [0.016, 0.01], { seg: 4 });
      tube(b, [[lean * 0.6, h * 0.8, 0], [lean - 0.08, h + 0.05, -0.04]], [0.016, 0.01], { seg: 4 });
    });
    const leaf = vary(mixColor(PALETTE.leaf, PALETTE.bush, 0.4), r('leaf'));
    const cy = h + rad * 0.62;
    b.with({ pattern: PATTERN.leaves, ink: 'crown' }, () => {
      b.setSway((_x, y) => Math.min(1, Math.max(0, (y - h) / (rad * 1.5))) * 0.7);
      b.with({ color: leaf }, () => {
        lump(b, lean, cy, 0, rad, rad * 0.7, rad, { seg: 9, rings: 5, normal: TONE.lit });
        lump(b, lean - rad * 0.45, cy - rad * 0.12, rad * 0.25, rad * 0.55, rad * 0.45, rad * 0.55, { seg: 7, rings: 4, normal: TONE.lit, twist: 1 });
      });
      b.with({ color: mixColor(leaf, PALETTE.leafDark, 0.45) }, () => lump(b, lean + rad * 0.25, cy - rad * 0.1, -rad * 0.6, rad * 0.6, rad * 0.48, rad * 0.45, { seg: 7, rings: 4, normal: TONE.shade }));
      b.setSway(0);
    });
    const fruit = (item.params?.fruit ?? (r('kind') < 0.6 ? 0 : 1)) === 0 ? PALETTE.red : PALETTE.yellow;
    b.with({ color: fruit, pattern: PATTERN.none, ink: 'crown', sway: 0.5 }, () => {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9 + r('fa', i) * 0.08) * Math.PI * 2, e = 0.15 + r('fe', i) * 0.75;
        dab(b, lean + Math.cos(a) * Math.cos(e) * rad * 0.98, cy + Math.sin(e) * rad * 0.68, Math.sin(a) * Math.cos(e) * rad * 0.98, 0.026, TONE.lit, 5, 0.018);
      }
    });
    // A few windfalls in the grass under it.
    b.with({ color: fruit, pattern: PATTERN.none, ink: 'windfall' }, () => {
      for (let i = 0; i < 3; i++) {
        const a = r('wa', i) * Math.PI * 2, d = 0.1 + r('wd', i) * 0.12;
        lump(b, Math.cos(a) * d, 0.016, Math.sin(a) * d, 0.022, 0.018, 0.022, { seg: 5, rings: 3, normal: TONE.lit });
      }
    });
    return { mesh: b.build() };
  },
});

/**
 * Compost heap: a slatted wooden bin against the far fence, heaped with
 * dark earth and green cuttings. Frame: an edge slot, +Z away from the fence.
 */
export const compost = definePart({
  prop: 'compost',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 211));
    const w = 0.17, z0 = LINE + 0.04, z1 = z0 + 0.26, h = 0.17;
    const wood = vary(mixColor(PALETTE.wood, PALETTE.trunk, 0.35), r('wood'));
    b.with({ color: wood, pattern: PATTERN.planks, ink: 'bin' }, () => {
      // Three slatted sides, open toward the garden; slats with gaps between.
      for (let i = 0; i < 3; i++) {
        const y0 = 0.01 + i * 0.055, y1 = y0 + 0.04;
        b.box([-w, y0, z0], [w, y1, z0 + 0.02], { skip: ['e', 'w'] });
        for (const x of [-w, w - 0.02]) b.box([x, y0, z0 + 0.02], [x + 0.02, y1, z1], { skip: ['n'] });
      }
      for (const x of [-w, w - 0.02]) for (const z of [z0, z1 - 0.025]) b.box([x - 0.005, 0, z], [x + 0.025, h + 0.02, z + 0.025], { skip: ['bottom'] });
    });
    b.with({ color: vary(PALETTE.dirtDark, r('earth')), pattern: PATTERN.dirt, ink: 'heap' }, () => lump(b, 0, 0.05, (z0 + z1) / 2, w * 0.85, 0.12, 0.12, { seg: 7, rings: 3, normal: TONE.mid }));
    b.with({ color: vary(PALETTE.leafDark, r('green')), pattern: PATTERN.none, ink: 'heap' }, () => {
      for (let i = 0; i < 3; i++) dab(b, (r('gx', i) - 0.5) * w, 0.13 + r('gy', i) * 0.03, (z0 + z1) / 2 + (r('gz', i) - 0.5) * 0.1, 0.04, TONE.lit, 5, 0.02);
    });
    return { mesh: b.build() };
  },
});
