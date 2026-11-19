// The town's commons (Stage 4, part D): what people leave and use in yards,
// gardens, streets and under trees. Cobbles and a well (D17), beehives, a
// wheelbarrow, a trellis rose, a scarecrow (D18), a fingerpost (D26), a
// mailbox and a pillar box (D27), terrace furniture (D28), pots on stairs
// (D30), a coin telescope (D31), a swing, a hammock and a picnic (D32), a
// hand pump (D33), a lost kite (D34). Several parts in one file; each is
// discovered by its own export.

import { CELL_H, DIR4, type Dir4 } from '@/core/grid';
import { compose, rotationX, rotationY, rotationZ, scaling, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { STAIRS } from '@/style/edges';
import { PALETTE } from '@/style/palette';
import { clothColors, dab, flowerColors, lump, mixColor, mound, pot, posy, rngOf, tube, vary, TONE } from './kit';

/** Raw ink id shared by every cobbled cell, so a courtyard is one surface. */
const INK_COBBLES = 61101;

function ball(b: MeshBuilder, x: number, y: number, z: number, r: number, squash = 1): void {
  b.at(compose(translation(x, y, z), scaling(r, r * squash, r)), () => b.lathe([[0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7], [0, 1]], { segments: 6 }));
}
function wheel(b: MeshBuilder, x: number, y: number, z: number, r: number, w: number): void {
  b.at(compose(translation(x, y, z), rotationZ(Math.PI / 2)), () => b.lathe([[r, -w / 2], [r, w / 2]], { segments: 10, capTop: true, capBottom: true }));
}

/**
 * Cobbles (D17): one cell of a cobbled courtyard, lying on the ground. A kerb
 * of larger setts finishes the sides where the cobbles stop (`mask` bit d
 * clear). Frame: the cell's centre slot, square to the world.
 */
export const cobbles = definePart({
  prop: 'cobbles',
  build(item, ctx) {
    const b = ctx.mesh();
    const mask = item.params?.mask ?? 0;
    const y = 0.012;
    const reach = (d: Dir4): number => (mask & (1 << d) ? 0.5 : 0.47);
    const x0 = -reach(3), x1 = reach(1), z0 = -reach(0), z1 = reach(2);
    b.setInkId(INK_COBBLES);
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.cobbles }, () => b.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]));
    // The sides where the cobbles stop: a thin edge face down to the grass.
    b.with({ color: mixColor(PALETTE.stoneShade, PALETTE.rock, 0.5), pattern: PATTERN.none }, () => {
      if (!(mask & 1)) b.quad([x1, 0, z0], [x0, 0, z0], [x0, y, z0], [x1, y, z0]);
      if (!(mask & 4)) b.quad([x0, 0, z1], [x1, 0, z1], [x1, y, z1], [x0, y, z1]);
      if (!(mask & 2)) b.quad([x1, 0, z1], [x1, 0, z0], [x1, y, z0], [x1, y, z1]);
      if (!(mask & 8)) b.quad([x0, 0, z0], [x0, 0, z1], [x0, y, z1], [x0, y, z0]);
    });
    return { mesh: b.build() };
  },
});

/**
 * Well (D17): a round stone curb, two posts and a little pitched roof over a
 * winch with its bucket. Frame: a floor slot. Owns 'water-surface'-like
 * nothing; a 'perch' on the roof ridge.
 */
export const well = definePart({
  prop: 'well',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 401));
    b.rotateY(Math.floor(r('turn') * 4) * (Math.PI / 2));
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'curb' }, () => {
      b.lathe([[0.2, 0], [0.2, 0.2], [0.21, 0.2], [0.21, 0.23], [0.15, 0.23], [0.15, 0.16]], { segments: 12 });
    });
    b.with({ color: PALETTE.sea, pattern: PATTERN.water, ink: 'well-water' }, () => b.lathe([[0.15, 0.16], [0, 0.16]], { segments: 12 }));
    b.with({ color: PALETTE.wood, pattern: PATTERN.none, ink: 'well-frame' }, () => {
      for (const x of [-0.17, 0.17]) b.boxAt([x, 0.2, 0], [0.04, 0.38, 0.04], { skip: ['bottom'] });
      b.at(compose(translation(0, 0.44, 0), rotationZ(Math.PI / 2)), () => b.lathe([[0.025, -0.17], [0.025, 0.17]], { segments: 6, capTop: true, capBottom: true }));
    });
    b.with({ color: PALETTE.redDark, pattern: PATTERN.shingles, ink: 'well-roof' }, () => {
      const y0 = 0.56, y1 = 0.7, w = 0.25, d = 0.17;
      b.quad([-w, y0, d], [w, y0, d], [w, y1, 0], [-w, y1, 0]);
      b.quad([w, y0, -d], [-w, y0, -d], [-w, y1, 0], [w, y1, 0]);
      b.tri([w, y0, d], [w, y0, -d], [w, y1, 0]);
      b.tri([-w, y0, -d], [-w, y0, d], [-w, y1, 0]);
      b.quad([-w, y0, -d], [w, y0, -d], [w, y0, d], [-w, y0, d]);
    });
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'bucket' }, () => b.at(translation(0.05, 0.27, 0.04), () => b.lathe([[0.04, 0], [0.05, 0.07]], { segments: 7, capBottom: true })));
    return { mesh: b.build(), anchors: { perch: translation(0, 0.7, 0) } };
  },
});

/**
 * Beehives (D18): two or three straw skeps on a plank bench. Frame: a floor
 * slot, +Z the way the entrances face.
 */
export const beehive = definePart({
  prop: 'beehive',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 353));
    const n = 2 + (r('n') < 0.5 ? 1 : 0);
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'hive-bench' }, () => {
      b.box([-0.25, 0.08, -0.08], [0.25, 0.11, 0.08]);
      for (const x of [-0.2, 0.2]) b.boxAt([x, 0, 0], [0.04, 0.08, 0.12], { skip: ['bottom', 'top'] });
    });
    for (let i = 0; i < n; i++) {
      const x = n === 2 ? (i - 0.5) * 0.22 : (i - 1) * 0.16;
      const s = 0.95 + r('s', i) * 0.15;
      b.with({ color: vary(PALETTE.yellow, r('c', i), 0.6), pattern: PATTERN.thatch, ink: `skep${i}` }, () => {
        b.at(compose(translation(x, 0.11, 0), scaling(s)), () => b.lathe([[0.075, 0], [0.078, 0.05], [0.065, 0.1], [0.04, 0.135], [0, 0.15]], { segments: 9 }));
      });
      b.with({ color: PALETTE.ink, pattern: PATTERN.none, ink: `skep${i}` }, () => b.polygon([[x - 0.018, 0.112, 0.077], [x + 0.018, 0.112, 0.077], [x, 0.14, 0.072]]));
    }
    return { mesh: b.build() };
  },
});

/**
 * Wheelbarrow (D18): a wooden tray on one wheel, two handles resting on legs,
 * a load of earth and greens. Frame: a floor slot.
 */
export const wheelbarrow = definePart({
  prop: 'wheelbarrow',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 571));
    b.rotateY(r('turn') * Math.PI * 2);
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'barrow' }, () => {
      b.quad([-0.08, 0.1, -0.1], [0.08, 0.1, -0.1], [0.11, 0.2, -0.14], [-0.11, 0.2, -0.14]);
      b.quad([0.08, 0.1, 0.12], [-0.08, 0.1, 0.12], [-0.11, 0.2, 0.16], [0.11, 0.2, 0.16]);
      b.quad([0.08, 0.1, -0.1], [0.08, 0.1, 0.12], [0.11, 0.2, 0.16], [0.11, 0.2, -0.14]);
      b.quad([-0.08, 0.1, 0.12], [-0.08, 0.1, -0.1], [-0.11, 0.2, -0.14], [-0.11, 0.2, 0.16]);
      b.quad([-0.08, 0.1, 0.12], [0.08, 0.1, 0.12], [0.08, 0.1, -0.1], [-0.08, 0.1, -0.1]);
      for (const x of [-0.07, 0.07]) {
        tube(b, [[x, 0.11, 0.15], [x * 1.2, 0.13, -0.32]], 0.012, { seg: 4 });
        b.box([x - 0.01, 0, -0.15], [x + 0.01, 0.11, -0.13], { skip: ['bottom'] });
      }
    });
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'barrow-wheel' }, () => wheel(b, 0, 0.065, 0.2, 0.065, 0.03));
    b.with({ color: PALETTE.dirtDark, pattern: PATTERN.dirt, ink: 'barrow-load' }, () => mound(b, 0, 0.18, 0.01, 0.1, 0.05, 0.13, { seg: 7, rings: 2 }));
    b.with({ color: vary(PALETTE.leafDark, r('g')), pattern: PATTERN.leaves, ink: 'barrow-load', sway: 0.2 }, () => lump(b, 0.03, 0.23, -0.03, 0.05, 0.035, 0.05, { seg: 6, rings: 3, normal: TONE.lit }));
    return { mesh: b.build() };
  },
});

/**
 * Trellis rose (D18): a white lattice against a wall with a climbing rose
 * over it. Frame: an edge slot, +Z away from the wall (the wall face is 0.22
 * behind the slot: 0.15 to the cell line, 0.07 to a house wall).
 */
export const trellis = definePart({
  prop: 'trellis',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 829));
    const z = -0.2, w = 0.2, h = 0.62;
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'lattice' }, () => {
      for (const x of [-w, w]) b.box([x - 0.012, 0, z], [x + 0.012, h, z + 0.02], { skip: ['n', 'bottom'] });
      for (let y = 0.12; y < h; y += 0.14) b.box([-w, y - 0.009, z], [w, y + 0.009, z + 0.016], { skip: ['n', 'e', 'w'] });
    });
    const leaf = vary(PALETTE.leafDark, r('g'));
    b.with({ color: leaf, pattern: PATTERN.leaves, ink: 'rose', sway: 0.25 }, () => {
      for (let i = 0; i < 4; i++) {
        const x = (r('x', i) - 0.5) * 0.3, y = 0.12 + i * 0.13 + r('y', i) * 0.05;
        lump(b, x, y, z + 0.04, 0.09, 0.08, 0.04, { seg: 7, rings: 3, normal: TONE.lit });
      }
    });
    const fl = flowerColors();
    const flower = fl[Math.floor(r('f') * 3)]!;
    b.with({ color: flower, pattern: PATTERN.none, ink: 'rose', sway: 0.25 }, () => {
      for (let i = 0; i < 7; i++) dab(b, (r('fx', i) - 0.5) * 0.34, 0.1 + r('fy', i) * 0.5, z + 0.085, 0.026, TONE.lit, 5, 0.012);
    });
    return { mesh: b.build() };
  },
});

/**
 * Scarecrow (D18): a cross of sticks in an old coat and a straw hat, arms
 * out. Frame: a floor slot.
 */
export const scarecrow = definePart({
  prop: 'scarecrow',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 241));
    b.rotateY(r('turn') * Math.PI * 2);
    b.rotateZ((r('lean') - 0.5) * 0.12);
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'stick' }, () => {
      b.box([-0.014, 0, -0.014], [0.014, 0.62, 0.014], { skip: ['bottom'] });
      b.box([-0.24, 0.43, -0.012], [0.24, 0.455, 0.012]);
    });
    const coat = [PALETTE.redDark, PALETTE.glass, PALETTE.leafDark][Math.floor(r('coat') * 3)]!;
    b.with({ color: coat, pattern: PATTERN.cloth, ink: 'coat', sway: 0.15 }, () => {
      b.box([-0.08, 0.24, -0.045], [0.08, 0.46, 0.045]);
      b.box([-0.2, 0.39, -0.035], [0.2, 0.46, 0.035]);
    });
    b.with({ color: PALETTE.sand, pattern: PATTERN.none, ink: 'head' }, () => ball(b, 0, 0.53, 0, 0.055));
    b.with({ color: PALETTE.yellow, pattern: PATTERN.thatch, ink: 'hat' }, () => {
      b.at(translation(0, 0.56, 0), () => b.lathe([[0.12, 0], [0.11, 0.015], [0.05, 0.02], [0.045, 0.07], [0, 0.08]], { segments: 9, capBottom: true }));
    });
    return { mesh: b.build(), anchors: { perch: translation(0.2, 0.47, 0) } };
  },
});

/**
 * Fingerpost (D26): a white post with an arm pointing down each street that
 * leaves the junction, each arm with a small picture of what lies that way.
 * Frame: a floor slot, square to the world (face 2): arm d points along DIR4[d].
 */
export const fingerpost = definePart({
  prop: 'fingerpost',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 433));
    const mask = item.params?.mask ?? 0b0101;
    const signs = item.params?.signs ?? 0;
    const h = 0.72;
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'finger-post' }, () => {
      b.boxAt([0, 0, 0], [0.045, h, 0.045], { skip: ['bottom'] });
      b.at(translation(0, h, 0), () => b.lathe([[0.035, 0], [0, 0.05]], { segments: 4, smooth: false }));
    });
    const pictures = [PALETTE.redDark, PALETTE.glass, PALETTE.yellow, PALETTE.leafDark];
    let k = 0;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      if (!(mask & (1 << d))) continue;
      const [dx, dz] = DIR4[d]!;
      const y = h - 0.08 - k * 0.085, len = 0.22 + r('len', d) * 0.04;
      const sign = (signs >> (d * 2)) & 3;
      // Build each arm along +X, then turn it to point along (dx, dz).
      b.at(compose(translation(0, y, 0), rotationY(Math.atan2(-dz, dx) + (r('tilt', d) - 0.5) * 0.08)), () => {
        b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: `finger${d}` }, () => {
          const t = 0.012;
          const pts = (z: number): Vec3[] => [[0.02, -0.032, z], [len, -0.032, z], [len + 0.045, 0, z], [len, 0.032, z], [0.02, 0.032, z]];
          b.polygon(pts(t));
          b.polygon([...pts(-t)].reverse());
          b.quad([0.02, 0.032, t], [len, 0.032, t], [len, 0.032, -t], [0.02, 0.032, -t]);
        });
        b.with({ color: pictures[sign]!, pattern: PATTERN.none, ink: `finger${d}` }, () => {
          for (const z of [0.0135, -0.0135]) {
            const s = z > 0 ? 1 : -1;
            const cx = len - 0.045;
            const tri: Vec3[] = [[cx - 0.025, -0.02, z], [cx + 0.025, -0.02, z], [cx, 0.022, z]];
            b.polygon(s > 0 ? tri : [...tri].reverse());
          }
        });
      });
      k++;
    }
    return { mesh: b.build(), anchors: { perch: translation(0, h + 0.05, 0) } };
  },
});

/**
 * Mailbox (D27): a little painted box with a flag on a wooden post. Frame: a
 * floor slot, +Z toward the street.
 */
export const mailbox = definePart({
  prop: 'mailbox',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 619));
    const colors = [PALETTE.red, PALETTE.glass, PALETTE.leafDark, PALETTE.yellow, PALETTE.white];
    b.rotateZ((r('lean') - 0.5) * 0.06);
    b.with({ color: PALETTE.wood, pattern: PATTERN.none, ink: 'mail-post' }, () => b.boxAt([0, 0, 0], [0.035, 0.3, 0.035], { skip: ['bottom'] }));
    b.with({ color: colors[Math.floor(r('c') * colors.length)]!, pattern: PATTERN.none, ink: 'mailbox' }, () => {
      b.box([-0.05, 0.3, -0.08], [0.05, 0.36, 0.09]);
      b.at(compose(translation(0, 0.36, 0.005), rotationX(Math.PI / 2)), () => b.lathe([[0.05, -0.085], [0.05, 0.085]], { segments: 8, start: Math.PI, sweep: Math.PI, capTop: true, capBottom: true }));
    });
    b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'mail-flag' }, () => {
      b.box([0.05, 0.33, -0.04], [0.058, 0.43, -0.025]);
      b.box([0.05, 0.4, -0.04], [0.058, 0.43, 0.02]);
    });
    return { mesh: b.build() };
  },
});

/** Pillar box (D27): a red round post box with a domed cap and a dark slot. Frame: a floor slot, +Z the slot side. */
export const postbox = definePart({
  prop: 'postbox',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'pillar-box' }, () => {
      b.lathe([[0.085, 0], [0.085, 0.03], [0.075, 0.04], [0.075, 0.36], [0.09, 0.37], [0.09, 0.39], [0.07, 0.42], [0.03, 0.445], [0, 0.45]], { segments: 8, capBottom: false });
    });
    b.with({ color: PALETTE.ink, pattern: PATTERN.none, ink: 'pillar-box' }, () => b.quad([-0.035, 0.29, 0.077], [0.035, 0.29, 0.077], [0.035, 0.31, 0.077], [-0.035, 0.31, 0.077]));
    b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'pillar-box' }, () => b.quad([-0.025, 0.2, 0.078], [0.025, 0.2, 0.078], [0.025, 0.25, 0.078], [-0.025, 0.25, 0.078]));
    return { mesh: b.build() };
  },
});

/**
 * Terrace furniture (D28): a parasol over a table and a chair, a striped
 * deck chair, or a cluster of pots. Frame: a floor slot on a roof terrace.
 */
export const terraceSet = definePart({
  prop: 'terrace-set',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 347));
    const colors = [PALETTE.red, PALETTE.glass, PALETTE.yellow, PALETTE.leafDark, PALETTE.pink];
    const color = colors[(((item.params?.color ?? 0) % colors.length) + colors.length) % colors.length]!;
    if (item.variant === 'pots') {
      const fl = flowerColors();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + r('a'), d = 0.09;
        const s = 0.85 + r('s', i) * 0.4;
        b.at(compose(translation(Math.cos(a) * d, 0, Math.sin(a) * d), scaling(s)), () => {
          pot(b, 0.055, 0.09, PALETTE.brick, `pot${i}`);
          posy(b, 0, 0.09, 0, 0.06, fl[Math.floor(r('f', i) * fl.length)]!, r, i, `pot${i}`);
        });
      }
      return { mesh: b.build() };
    }
    b.rotateY(r('turn') * Math.PI * 2);
    if (item.variant === 'lounger') {
      b.with({ color: PALETTE.wood, pattern: PATTERN.none, ink: 'lounger-frame' }, () => {
        for (const x of [-0.09, 0.09]) {
          tube(b, [[x, 0, 0.16], [x, 0.12, -0.02], [x, 0.26, -0.14]], 0.011, { seg: 4 });
          tube(b, [[x, 0, -0.1], [x, 0.12, 0.08]], 0.011, { seg: 4 });
        }
      });
      // The cloth slung along the frame: the seat, then the back.
      b.with({ color, pattern: PATTERN.stripes, ink: 'lounger-cloth', sway: 0.1 }, () => {
        const path: [number, number][] = [[0.15, 0.04], [0.0, 0.1], [-0.14, 0.27]];
        for (let i = 0; i + 1 < path.length; i++) {
          const [z0, y0] = path[i]!, [z1, y1] = path[i + 1]!;
          b.quad([-0.085, y0, z0], [0.085, y0, z0], [0.085, y1, z1], [-0.085, y1, z1]);
          b.quad([0.085, y0 - 0.008, z0], [-0.085, y0 - 0.008, z0], [-0.085, y1 - 0.008, z1], [0.085, y1 - 0.008, z1]);
        }
      });
      return { mesh: b.build() };
    }
    // parasol over a table and a chair
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'terrace-table' }, () => b.lathe([[0.02, 0], [0.02, 0.16], [0.09, 0.16], [0.09, 0.18]], { segments: 8, capTop: true }));
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'terrace-chair' }, () => {
      b.box([0.14, 0.09, -0.05], [0.24, 0.105, 0.05]);
      b.box([0.225, 0.105, -0.05], [0.24, 0.24, 0.05]);
      for (const [x, z] of [[0.15, -0.04], [0.23, -0.04], [0.15, 0.04], [0.23, 0.04]] as const) b.boxAt([x, 0, z], [0.012, 0.09, 0.012], { skip: ['bottom', 'top'] });
    });
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'parasol-pole' }, () => b.lathe([[0.01, 0.18], [0.01, 0.62]], { segments: 5 }));
    b.with({ color, pattern: PATTERN.stripes, ink: 'parasol', sway: (_x: number, y: number) => (y < 0.6 ? 0.35 : 0.1) }, () => {
      b.lathe([[0.3, 0.5], [0.16, 0.58], [0, 0.64]], { segments: 8, smooth: false, capBottom: true });
    });
    return { mesh: b.build(), anchors: { 'seat-0': compose(translation(0.19, 0.1, 0), rotationY(-Math.PI / 2)) } };
  },
});

/**
 * Pots on stairs (D30): flower pots standing on the steps against the wall
 * the flight climbs beside. Frame: the stairs cell's centre slot, +Z the way
 * the flight climbs; `side` 1 = the wall is at +X, −1 at −X; `steps` = which
 * of the treads (bit i, from the foot) carry a pot.
 */
export const stairPots = definePart({
  prop: 'stair-pots',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 997));
    const side = (item.params?.side ?? 1) < 0 ? -1 : 1;
    const n = Math.max(2, Math.round(STAIRS.steps));
    const mask = item.params?.steps ?? 0b0101;
    const fl = flowerColors();
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const z = -0.5 + (i + 0.5) / n, y = ((i + 1) * CELL_H) / n;
      const x = side * (0.37 - r('x', i) * 0.03);
      const s = 1.1 + r('s', i) * 0.35;
      b.at(compose(translation(x, y, z), scaling(s)), () => {
        pot(b, 0.05, 0.08, i % 2 ? PALETTE.brick : mixColor(PALETTE.brick, PALETTE.white, 0.25), `stair-pot${i}`);
        posy(b, 0, 0.08, 0, 0.055, fl[Math.floor(r('f', i) * fl.length)]!, r, i, `stair-pot${i}`);
      });
    }
    return { mesh: b.build() };
  },
});

/**
 * Coin telescope (D31): a brass telescope on a short iron pillar, tilted to
 * the view. Frame: a floor slot, +Z toward the view.
 */
export const coinTelescope = definePart({
  prop: 'coin-telescope',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'scope-post' }, () => {
      b.lathe([[0.07, 0], [0.07, 0.03], [0.03, 0.05], [0.025, 0.36], [0.045, 0.38]], { segments: 6, capTop: true });
    });
    b.with({ color: mixColor(PALETTE.yellow, PALETTE.trunk, 0.4), pattern: PATTERN.metal, ink: 'scope' }, () => {
      b.box([-0.05, 0.38, -0.04], [0.05, 0.46, 0.04]);
      b.at(compose(translation(0, 0.44, -0.02), rotationX(Math.PI / 2 - 0.25)), () => b.lathe([[0.03, -0.1], [0.035, 0.02], [0.045, 0.2], [0.05, 0.22]], { segments: 8, capTop: true, capBottom: true }));
    });
    return { mesh: b.build() };
  },
});

/**
 * Swing (D32): a plank seat on two ropes, hung from a low branch of the tree
 * it stands beside. Frame: the tree's cell, +Z toward the open side the
 * swing hangs over.
 */
export const swing = definePart({
  prop: 'swing',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 769));
    // Out past the crown's edge, so the swing shows from above: a long low bough reaching out.
    const z = 0.52, top = 0.5, seat = 0.12 + r('h') * 0.03;
    b.with({ color: PALETTE.trunk, pattern: PATTERN.bark, ink: 'swing-branch' }, () => tube(b, [[0, top - 0.16, 0.05], [0.02, top - 0.03, z * 0.6], [0.03, top, z + 0.1]], [0.035, 0.025, 0.016], { seg: 5 }));
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'swing', sway: (_x: number, y: number) => Math.max(0, (top - y) / top) * 0.35 }, () => {
      for (const x of [-0.08, 0.08]) b.box([x + 0.02 - 0.004, seat, z - 0.004], [x + 0.02 + 0.004, top, z + 0.004]);
      b.with({ color: PALETTE.red }, () => b.box([-0.09, seat - 0.025, z - 0.05], [0.13, seat, z + 0.05]));
    });
    return { mesh: b.build(), anchors: { seat: translation(0.02, seat, z) } };
  },
});

/**
 * Hammock (D32): a striped hammock slung between two tree trunks a cell
 * either side. Frame: the middle cell's centre slot, +X toward one tree
 * (the trunks stand at x = ±1).
 */
export const hammock = definePart({
  prop: 'hammock',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 887));
    const colors = clothColors();
    const color = colors[Math.floor(r('c') * colors.length)]!;
    const tie = 0.32, low = 0.14, half = 0.62, w = 0.1;
    b.with({ color: PALETTE.sand, pattern: PATTERN.none, ink: 'hammock-rope' }, () => {
      for (const s of [-1, 1]) tube(b, [[s * 0.93, tie, 0], [s * half, tie - 0.06, 0]], 0.007, { seg: 3 });
    });
    const n = 8;
    const at = (t: number): [number, number] => {
      const x = -half + 2 * half * t;
      return [x, tie - 0.06 - (tie - 0.06 - low) * Math.sin(Math.PI * t)];
    };
    b.with({ color, pattern: PATTERN.stripes, ink: 'hammock', sway: (x: number) => (1 - Math.abs(x) / half) * 0.25 }, () => {
      for (let i = 0; i < n; i++) {
        const [x0, y0] = at(i / n), [x1, y1] = at((i + 1) / n);
        // a shallow trough: the middle line a little lower than the edges
        b.quad([x0, y0, w], [x1, y1, w], [x1, y1 - 0.02, 0], [x0, y0 - 0.02, 0]);
        b.quad([x0, y0 - 0.02, 0], [x1, y1 - 0.02, 0], [x1, y1, -w], [x0, y0, -w]);
        b.quad([x1, y1, w], [x0, y0, w], [x0, y0 - 0.025, 0], [x1, y1 - 0.025, 0]);
        b.quad([x1, y1 - 0.025, 0], [x0, y0 - 0.025, 0], [x0, y0, -w], [x1, y1, -w]);
      }
    });
    return { mesh: b.build(), anchors: { 'seat-0': translation(0, low, 0) } };
  },
});

/**
 * Picnic (D32): a checked blanket on the grass with a basket and a bottle.
 * Frame: a floor slot, square to the world.
 */
export const picnic = definePart({
  prop: 'picnic',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 509));
    b.rotateY(r('turn') * Math.PI);
    const check = [PALETTE.red, PALETTE.glass, PALETTE.yellow][Math.floor(r('c') * 3)]!;
    const y = 0.008, s = 0.07;
    b.setInk('blanket').setPattern(PATTERN.cloth);
    for (let i = -3; i < 3; i++) {
      for (let j = -2; j < 2; j++) {
        b.with({ color: (i + j) % 2 === 0 ? check : PALETTE.white }, () => b.quad([i * s, y, (j + 1) * s], [(i + 1) * s, y, (j + 1) * s], [(i + 1) * s, y, j * s], [i * s, y, j * s]));
      }
    }
    b.with({ color: PALETTE.wood, pattern: PATTERN.thatch, ink: 'basket' }, () => {
      b.box([0.08, y, -0.12], [0.2, 0.09, -0.04], { skip: ['bottom'] });
      tube(b, [[0.09, 0.09, -0.08], [0.14, 0.15, -0.08], [0.19, 0.09, -0.08]], 0.008, { seg: 3 });
    });
    b.with({ color: PALETTE.leafDark, pattern: PATTERN.glass, ink: 'bottle' }, () => b.at(translation(-0.12, y, 0.06), () => b.lathe([[0.022, 0], [0.022, 0.07], [0.008, 0.1], [0.008, 0.12]], { segments: 6, capTop: true })));
    b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'apples' }, () => {
      ball(b, -0.03, y + 0.02, -0.07, 0.022);
      ball(b, 0.01, y + 0.02, -0.1, 0.022);
    });
    return { mesh: b.build() };
  },
});

/**
 * Hand pump (D33): a dark iron pump with a curved handle, over a stone
 * trough. Frame: a floor slot, +Z the way the spout points.
 */
export const pump = definePart({
  prop: 'pump',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'trough' }, () => {
      b.box([-0.14, 0, 0.04], [0.14, 0.1, 0.22], { skip: ['bottom'] });
    });
    b.with({ color: PALETTE.sea, pattern: PATTERN.water, ink: 'trough-water' }, () => b.quad([-0.11, 0.102, 0.19], [0.11, 0.102, 0.19], [0.11, 0.102, 0.07], [-0.11, 0.102, 0.07]));
    b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'pump' }, () => {
      b.lathe([[0.06, 0], [0.06, 0.03], [0.045, 0.05], [0.04, 0.42], [0.055, 0.44], [0.045, 0.49], [0, 0.52]], { segments: 8, capBottom: false });
      tube(b, [[0, 0.33, 0.03], [0, 0.32, 0.12], [0, 0.27, 0.14]], 0.018, { seg: 5 });
      tube(b, [[0, 0.46, -0.03], [0, 0.5, -0.14], [0, 0.44, -0.24]], 0.012, { seg: 4 });
      ball(b, 0, 0.44, -0.245, 0.02);
    });
    return { mesh: b.build() };
  },
});

/**
 * Lost kite (D34): a diamond kite in the town's bright colours caught in a
 * tree's crown, its tail of bows hanging down, a loop of string. Frame: the
 * tree's top cell; `top` = the height of the crown's top above that floor.
 */
export const kite = definePart({
  prop: 'kite',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 101));
    const top = item.params?.top ?? 1;
    const colors = [PALETTE.red, PALETTE.yellow, PALETTE.glass, PALETTE.magic, PALETTE.pink];
    const a = colors[Math.floor(r('a') * colors.length)]!, c = colors[(Math.floor(r('a') * colors.length) + 2) % colors.length]!;
    const turn = r('turn') * Math.PI * 2;
    b.at(compose(translation(0, top - 0.06, 0), rotationY(turn), translation(0, 0, 0.16), rotationZ(0.5 + r('tilt') * 0.4), rotationX(-0.35)), () => {
      const s = 0.13;
      const diamond = (z: number, col: string, half: 'l' | 'r'): void => {
        b.with({ color: col, pattern: PATTERN.cloth, ink: 'kite', sway: 0.2 }, () => {
          const pts: Vec3[] = half === 'l' ? [[0, -s * 1.5, z], [0, s, z], [-s, 0, z]] : [[0, s, z], [0, -s * 1.5, z], [s, 0, z]];
          b.polygon(pts);
          b.polygon([...pts].reverse().map(([x, y]): Vec3 => [x, y, z - 0.008]));
        });
      };
      diamond(0.004, a, 'l');
      diamond(0.004, c, 'r');
      // The tail: a line of little bows hanging down.
      b.with({ color: PALETTE.ink, pattern: PATTERN.none, ink: 'kite-tail', sway: (_x: number, y: number) => Math.min(1, Math.max(0, -y / 0.4)) * 0.9 }, () => {
        tube(b, [[0, -s * 1.5, 0], [0.03, -0.3, 0.02], [-0.02, -0.45, 0.03]], 0.004, { seg: 3 });
      });
      b.with({ color: c, pattern: PATTERN.none, ink: 'kite-tail', sway: (_x: number, y: number) => Math.min(1, Math.max(0, -y / 0.4)) * 0.9 }, () => {
        for (const [x, y] of [[0.015, -0.27], [0.01, -0.36], [-0.012, -0.44]] as const) {
          b.polygon([[x - 0.03, y - 0.015, 0.01], [x, y, 0.01], [x - 0.03, y + 0.015, 0.01]]);
          b.polygon([[x + 0.03, y + 0.015, 0.01], [x, y, 0.01], [x + 0.03, y - 0.015, 0.01]]);
        }
      });
    });
    return { mesh: b.build() };
  },
});
