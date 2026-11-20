// Props that hollow a long blank wall into a street front (U16 shops in the
// wall): the arched booth, the storeroom door, the bench in a niche; and the
// paving prop that lays a derived apron, forecourt or quay (U16, U19, U20).
//
// The marble generator draws a wall flush with the cell line and cannot leave
// a recess, so these stand against the wall's face and draw their own arch
// and opening a few centimetres proud of it. Frame (all but paving): an edge
// slot of the ground cell outside the wall, +Z away from the wall; the wall
// face is at z = LINE minus `inset` (0 for marble, 0.07 for a house wall).

import { compose, rotationX, rotationY, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { roundHead } from './country.part';
import { dab, lantern, lump, mixColor, rngOf, vary, TONE } from './kit';

const LINE = -(0.5 - SLOT_INSET);
/** Raw ink ids: an apron's slabs read as one paved surface. */
const INK_PAVING = 61040;

/**
 * An arched surround standing `depth` proud of the wall: two piers and a
 * round head, `w` wide inside and `h` tall to the crown of the opening.
 * Drawn in one ink group, so it reads as one carved frame.
 */
function archFrame(b: MeshBuilder, z0: number, w: number, h: number, depth: number, pier: number, color: ColorInput, ink: string): void {
  const ri = w / 2, ro = ri + pier, spring = h - ri, z1 = z0 + depth;
  b.with({ color, pattern: PATTERN.stone, ink }, () => {
    for (const s of [-1, 1]) b.box([s > 0 ? ri : -ro, 0, z0], [s > 0 ? ro : -ri, spring, z1], { skip: ['bottom', 'n'] });
    // The head: a ring of segments from one springing to the other.
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
      const p = (r: number, a: number, z: number): Vec3 => [Math.cos(a) * r, spring + Math.sin(a) * r, z];
      b.quad(p(ri, a0, z1), p(ro, a0, z1), p(ro, a1, z1), p(ri, a1, z1)); // the face
      b.quad(p(ro, a0, z1), p(ro, a0, z0), p(ro, a1, z0), p(ro, a1, z1)); // the extrados
      b.quad(p(ri, a1, z1), p(ri, a1, z0), p(ri, a0, z0), p(ri, a0, z1)); // the soffit
    }
    // A keystone.
    b.box([-0.035, h - 0.02, z0], [0.035, h + pier + 0.02, z1 + 0.015], { skip: ['n'] });
  });
}

/** The opening inside an arch: a panel a hair proud of the wall, round-headed. */
function opening(b: MeshBuilder, z: number, w: number, h: number, color: ColorInput, ink: string): void {
  b.with({ color, pattern: PATTERN.planks, ink }, () => {
    const prof = roundHead(w, h, 8);
    b.polygon(prof.map(([x, y]): Vec3 => [x, y, z]));
  });
}

const GOODS = ['wine', 'bread', 'pots', 'cobbler', 'fruit'] as const;

/**
 * Wall booth: a shop let into a blank wall, Roman taberna fashion. An arched
 * stone surround round a dark wooden opening with shelves, a counter board
 * out front with the day's goods on it (`variant`: wine, bread, pots,
 * cobbler, fruit), and the top shutter propped out as a little canopy.
 * Anchors 'vend' (behind the counter, facing out) and 'browse' (in front of
 * it, facing in).
 */
export const wallBooth = definePart({
  prop: 'wall-booth',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 733));
    const z0 = LINE - (item.params?.inset ?? 0);
    const w = 0.5, h = 0.66;
    const stone = mixColor(PALETTE.stone, PALETTE.stoneShade, 0.55);
    archFrame(b, z0, w, h, 0.07, 0.09, stone, 'arch');
    opening(b, z0 + 0.004, w, h, mixColor(PALETTE.trunk, PALETTE.metal, 0.35), 'inside');
    // Shelves inside, with jars on them.
    const wood = vary(PALETTE.wood, r('wood'));
    b.with({ color: wood, pattern: PATTERN.planks, ink: 'shelves' }, () => {
      for (const y of [0.42, 0.55]) b.box([-w / 2 + 0.03, y, z0 + 0.004], [w / 2 - 0.03, y + 0.02, z0 + 0.06], { skip: ['n'] });
    });
    b.with({ color: PALETTE.brick, pattern: PATTERN.none, ink: 'shelves' }, () => {
      for (const y of [0.44, 0.57]) for (let i = 0; i < 4; i++) lump(b, -0.16 + i * 0.105 + (r('jx', y, i) - 0.5) * 0.02, y + 0.035, z0 + 0.035, 0.022, 0.035, 0.022, { seg: 5, rings: 3, normal: TONE.lit });
    });
    // The counter: a board on two brackets, standing out from the opening.
    const cy = 0.27, cz1 = z0 + 0.24;
    b.with({ color: wood, pattern: PATTERN.planks, ink: 'counter' }, () => {
      b.box([-w / 2 - 0.02, cy, z0 + 0.004], [w / 2 + 0.02, cy + 0.035, cz1]);
      b.box([-w / 2 + 0.02, 0, z0 + 0.004], [w / 2 - 0.02, cy, z0 + 0.045], { skip: ['bottom', 'n'] }); // the counter's front panel, in the opening (clear of a wall's 0.03 base course)
      for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) b.box([x - 0.015, cy - 0.12, z0 + 0.045], [x + 0.015, cy, cz1 - 0.04], { skip: ['n'] });
    });
    // The goods.
    const goods = (GOODS as readonly string[]).includes(item.variant ?? '') ? item.variant : GOODS[Math.floor(r('goods') * GOODS.length)];
    const top = cy + 0.035;
    const zg = (z0 + 0.04 + cz1) / 2;
    if (goods === 'wine') {
      b.with({ color: mixColor(PALETTE.leafDark, PALETTE.metal, 0.5), pattern: PATTERN.none, ink: 'goods' }, () => {
        for (let i = 0; i < 5; i++) b.at(translation(-0.18 + i * 0.09, top, zg + (i % 2) * 0.04 - 0.02), () => b.lathe([[0.022, 0], [0.022, 0.07], [0.008, 0.1], [0.008, 0.12]], { segments: 6, capTop: true }));
      });
    } else if (goods === 'bread') {
      b.with({ color: mixColor(PALETTE.wood, PALETTE.yellow, 0.4), pattern: PATTERN.none, ink: 'goods' }, () => {
        for (let i = 0; i < 4; i++) lump(b, -0.16 + i * 0.105, top + 0.03, zg + (r('bz', i) - 0.5) * 0.06, 0.045, 0.03, 0.035, { seg: 6, rings: 3, normal: TONE.lit, twist: i });
      });
    } else if (goods === 'pots') {
      for (let i = 0; i < 3; i++) {
        b.with({ color: vary(PALETTE.brick, r('pc', i)), pattern: PATTERN.none, ink: 'goods' }, () =>
          b.at(translation(-0.15 + i * 0.15, top, zg), () => b.lathe([[0.03, 0], [0.05, 0.05], [0.035, 0.09], [0.04, 0.1]], { segments: 7 })),
        );
      }
    } else if (goods === 'cobbler') {
      b.with({ color: mixColor(PALETTE.trunk, PALETTE.metal, 0.3), pattern: PATTERN.none, ink: 'goods' }, () => {
        for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.box([-0.16 + i * 0.13 + s * 0.022 - 0.018, top, zg - 0.05], [-0.16 + i * 0.13 + s * 0.022 + 0.018, top + 0.035, zg + 0.04]);
      });
    } else {
      const fruit = [PALETTE.red, PALETTE.yellow, PALETTE.leaf];
      b.with({ color: wood, pattern: PATTERN.planks, ink: 'goods' }, () => {
        for (let i = 0; i < 3; i++) b.box([-0.2 + i * 0.14, top, zg - 0.06], [-0.08 + i * 0.14, top + 0.04, zg + 0.06]);
      });
      for (let i = 0; i < 3; i++) {
        b.with({ color: fruit[i]!, pattern: PATTERN.none, ink: 'goods' }, () => {
          for (let k = 0; k < 4; k++) dab(b, -0.17 + i * 0.14 + (k % 2) * 0.05, top + 0.045, zg - 0.03 + Math.floor(k / 2) * 0.05, 0.025, TONE.up, 5, 0.02);
        });
      }
    }
    // The top shutter, propped out as a canopy over the counter.
    b.with({ color: vary(mixColor(PALETTE.wood, PALETTE.redDark, 0.25), r('shutter')), pattern: PATTERN.planks, ink: 'shutter' }, () => {
      b.at(compose(translation(0, h + 0.12, z0 + 0.07), rotationX((22 * Math.PI) / 180)), () => b.box([-w / 2 - 0.04, 0, 0], [w / 2 + 0.04, 0.025, 0.26]));
    });
    // Two struts prop it from the arch's springing.
    b.with({ color: mixColor(PALETTE.trunk, PALETTE.wood, 0.3), pattern: PATTERN.none, ink: 'struts' }, () => {
      const tip: [number, number] = [h + 0.12 - Math.sin((22 * Math.PI) / 180) * 0.24, z0 + 0.07 + Math.cos((22 * Math.PI) / 180) * 0.24];
      for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) {
        const y0 = h - w / 2, z = z0 + 0.075;
        const dy = tip[0] - y0, dz = tip[1] - 0.02 - z, len = Math.hypot(dy, dz);
        b.at(compose(translation(x, y0, z), rotationX(-Math.atan2(dz, dy))), () => b.box([-0.012, 0, -0.012], [0.012, len, 0.012]));
      }
    });
    // A little lantern hangs under the canopy's corner: the booth's light after dark.
    const lx = (r('lamp') < 0.5 ? -1 : 1) * (w / 2 - 0.02);
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'lamp' }, () => b.box([lx - 0.004, h - 0.04, z0 + 0.2], [lx + 0.004, h + 0.04, z0 + 0.208]));
    b.at(translation(lx, h - 0.15, z0 + 0.204), () => lantern(b, 0.1, 'lamp'));
    return {
      mesh: b.build(),
      anchors: { vend: translation(0, 0, z0 + 0.08), browse: compose(translation(0, 0, z0 + 0.5), rotationY(Math.PI)) },
    };
  },
});

/**
 * Storeroom door: a low arched door in a blank wall, planked, with iron
 * straps and a step. Frame as the booth.
 */
export const storeDoor = definePart({
  prop: 'store-door',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 271));
    const z0 = LINE - (item.params?.inset ?? 0);
    const w = 0.36, h = 0.56;
    archFrame(b, z0, w, h, 0.06, 0.08, mixColor(PALETTE.stone, PALETTE.stoneShade, 0.6), 'arch');
    opening(b, z0 + 0.012, w, h, vary(mixColor(PALETTE.wood, PALETTE.trunk, 0.4), r('door')), 'door');
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'straps' }, () => {
      for (const y of [0.14, 0.38]) b.box([-w / 2 + 0.02, y, z0 + 0.012], [w / 2 - 0.02, y + 0.025, z0 + 0.026], { skip: ['n'] });
      lump(b, w / 2 - 0.07, 0.27, z0 + 0.03, 0.015, 0.015, 0.012, { seg: 5, rings: 3 });
    });
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'step' }, () => b.box([-w / 2 - 0.04, 0, z0 + 0.06], [w / 2 + 0.04, 0.045, z0 + 0.17], { skip: ['bottom'] }));
    return { mesh: b.build() };
  },
});

/**
 * Niche bench: a round-headed niche let into the wall with a stone bench in
 * it, and a potted plant on its end. Frame as the booth. Sockets 'seat-0',
 * 'seat-1'.
 */
export const nicheBench = definePart({
  prop: 'niche-bench',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 199));
    const z0 = LINE - (item.params?.inset ?? 0);
    const w = 0.62, h = 0.6;
    archFrame(b, z0, w, h, 0.05, 0.07, mixColor(PALETTE.stone, PALETTE.stoneShade, 0.5), 'arch');
    opening(b, z0 + 0.004, w, h, mixColor(PALETTE.stoneShade, PALETTE.dirtDark, 0.35), 'niche');
    b.with({ color: PALETTE.stone, pattern: PATTERN.stone, ink: 'bench' }, () => {
      b.box([-w / 2, 0, z0 + 0.004], [w / 2, 0.12, z0 + 0.17], { skip: ['bottom', 'n'] });
      b.box([-w / 2 - 0.02, 0.12, z0 + 0.004], [w / 2 + 0.02, 0.15, z0 + 0.19], { skip: ['n'] });
    });
    b.with({ color: PALETTE.brick, pattern: PATTERN.none, ink: 'pot' }, () => b.at(translation(w / 2 - 0.06, 0.15, z0 + 0.09), () => b.lathe([[0.03, 0], [0.045, 0.07], [0.05, 0.08]], { segments: 7 })));
    b.with({ color: vary(PALETTE.leafDark, r('leaf')), pattern: PATTERN.leaves, ink: 'pot', sway: 0.2 }, () => lump(b, w / 2 - 0.06, 0.27, z0 + 0.09, 0.06, 0.06, 0.06, { seg: 6, rings: 3, normal: TONE.lit }));
    const y = 0.15;
    return { mesh: b.build(), anchors: { 'seat-0': translation(-0.14, y, z0 + 0.12), 'seat-1': translation(0.06, y, z0 + 0.12) } };
  },
});

/**
 * Paving: one cell of a derived apron, forecourt or quay laid on bare ground,
 * flush with the street: stone slabs ('slabs', the default) or cobbles
 * ('cobbles'). `mask` bit d set where the paving runs on past side d (no
 * kerb there). Frame: the cell's NORTH-WEST CORNER slot, facing south (square
 * to the world); the part steps back to the cell's centre. It stands in a
 * corner slot because the walking graph ignores corner slots: paving
 * underfoot is never clutter.
 */
export const paving = definePart({
  prop: 'paving',
  build(item, ctx) {
    const b = ctx.mesh();
    const mask = item.params?.mask ?? 0;
    const inset = (d: number): number => (mask & (1 << d) ? 0.5 : 0.47);
    const x0 = -inset(3), x1 = inset(1), z0 = -inset(0), z1 = inset(2);
    const y = 0.02;
    b.translate(SLOT_INSET, 0, SLOT_INSET);
    const cobbled = item.variant === 'cobbles';
    b.setColor(cobbled ? mixColor(PALETTE.stoneShade, PALETTE.dirt, 0.35) : mixColor(PALETTE.stone, PALETTE.stoneShade, 0.5)).setPattern(cobbled ? PATTERN.cobbles : PATTERN.paving).setInkId(INK_PAVING);
    b.box([x0, 0, z0], [x1, y, z1], { skip: ['bottom', ...(['n', 'e', 's', 'w'] as const).filter((_f, d) => mask & (1 << d))] });
    void ctx;
    return { mesh: b.build() };
  },
});

