// The three stalls (R-S01), drawn standing on the local origin (the centre
// of the cell's floor). Not a generator file: stall.gen.ts reads the role
// and tags and calls drawStall.
//
// A stall is built in its own frame: +Z toward the customer, +X along the
// counter. Two ways of emitting keep that honest:
//
//   rigid(fn)    boxes, lathes, tubes and quads, emitted under the stall's
//                rotation (which side it fronts, and a degree or two askew).
//   lump/mound   heaps of fruit and bunches of flowers are FLAT-TONE lumps
//                (src/parts/ground/kit.ts): their normals are world
//                directions and must not be rotated, so these two take stall
//                coordinates and place the lump themselves.
//
// Design for the zoom the player sees (a cell is about 55 pixels): the read
// is the striped awning, its zigzag valance, the counter, and a few bold
// masses of colour for the goods. From behind: the back slope, and a barrel,
// crates or sacks under it.

import { compose, rotationX, rotationY, scaling, translation, type Vec3 } from '@/core/mat4';
import type { Dir4 } from '@/core/grid';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { lump as kitLump, mixColor, mound as kitMound, rngOf, TONE, tube, vary, type LumpOptions, type Rgb, type Rng } from '@/parts/ground/kit';
import type { Goods, StallRole } from '@/rules/roles/ground-props';
import { PALETTE, RAMPS } from '@/style/palette';
import { STALL } from '@/style/props';

export interface StallLook {
  role: StallRole;
  /** Market stalls only. */
  goods: Goods;
  /** The side the counter faces. */
  front: Dir4;
  seed: number;
  /** Palette index: 0 leaves the awning to the seed, 1–7 picks its colour (the paint tool). */
  color?: number;
}

interface Ctx {
  b: MeshBuilder;
  r: Rng;
  /** Emit under the stall's rotation. */
  rigid(fn: () => void): void;
  /** A flat-tone lump or mound at stall coordinates (radii along the stall's x, y, z). */
  lump(x: number, y: number, z: number, rx: number, ry: number, rz: number, opts?: LumpOptions): void;
  mound(x: number, y: number, z: number, rx: number, ry: number, rz: number, opts?: LumpOptions): void;
}

/** A quad through four points in order, wound so that it faces `want`. */
function quadFacing(b: MeshBuilder, p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, want: Vec3): void {
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
  const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
  const dot = (uy * vz - uz * vy) * want[0] + (uz * vx - ux * vz) * want[1] + (ux * vy - uy * vx) * want[2];
  if (dot >= 0) b.quad(p0, p1, p2, p3);
  else b.quad(p3, p2, p1, p0);
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

// ───────────────────────────────────────────────── the frame and awning ──

const POST = 0.05;
const CLOTH = 0.02;
const SCALLOPS = 7;

/** Four posts and a pitched, striped awning with a zigzag valance front and back. */
function frameAndAwning(ctx: Ctx, color: ColorInput): void {
  const { b, r } = ctx;
  const W = STALL.halfWidth;
  const postX = W - 0.06;
  const frontPostZ = STALL.frontZ - 0.1, backPostZ = STALL.backZ + 0.06;
  const sag = STALL.sag * (0.6 + r('sag') * 0.8);
  const span = (x: number): number => Math.max(0, 1 - (x / postX) * (x / postX));
  const frontY = (x: number): number => STALL.frontY - sag * span(x);
  const backY = (x: number): number => STALL.backY - sag * 0.7 * span(x);
  const ridgeY = (x: number): number => STALL.ridgeY - sag * 0.25 * span(x);
  /** The awning's height over a point of the stall. */
  const clothY = (x: number, z: number): number => {
    if (z >= STALL.ridgeZ) return ridgeY(x) + ((z - STALL.ridgeZ) / (STALL.frontZ - STALL.ridgeZ)) * (frontY(x) - ridgeY(x));
    return ridgeY(x) + ((STALL.ridgeZ - z) / (STALL.ridgeZ - STALL.backZ)) * (backY(x) - ridgeY(x));
  };
  // Wind: nothing at the ridge and the posts, a little at the eaves between posts, most at the valance's points.
  const eaveSway = (x: number): number => STALL.eaveSway * span(x);
  const roofSway = (x: number, _y: number, z: number): number => {
    const t = z >= STALL.ridgeZ ? (z - STALL.ridgeZ) / (STALL.frontZ - STALL.ridgeZ) : (STALL.ridgeZ - z) / (STALL.ridgeZ - STALL.backZ);
    return eaveSway(x) * clamp01(t) * clamp01(t);
  };
  const valanceSway = (eave: (x: number) => number) => (x: number, y: number): number => {
    const e = eaveSway(x);
    return e + (STALL.sway - e) * clamp01((eave(x) - y) / Math.max(STALL.valance, 0.01));
  };

  ctx.rigid(() => {
    b.with({ color: RAMPS.wood[1]!, pattern: PATTERN.bark, ink: 'frame' }, () => {
      for (const sx of [-1, 1]) {
        b.boxAt([sx * postX, 0, frontPostZ], [POST, clothY(sx * postX, frontPostZ) - CLOTH, POST], { skip: ['bottom', 'top'] });
        b.boxAt([sx * postX, 0, backPostZ], [POST, clothY(sx * postX, backPostZ) - CLOTH, POST], { skip: ['bottom', 'top'] });
      }
    });

    const xs: number[] = [];
    for (let i = 0; i <= SCALLOPS; i++) xs.push(-W + (2 * W * i) / SCALLOPS);
    const rows: Vec3[][] = [
      xs.map((x): Vec3 => [x, backY(x), STALL.backZ]),
      xs.map((x): Vec3 => [x, ridgeY(x), STALL.ridgeZ]),
      xs.map((x): Vec3 => [x, frontY(x), STALL.frontZ]),
    ];
    const under = (p: Vec3): Vec3 => [p[0], p[1] - CLOTH, p[2]];
    b.with({ color, pattern: PATTERN.stripes, ink: 'awning', sway: roofSway }, () => {
      const last = rows.length - 1, n = xs.length - 1;
      for (let i = 0; i < last; i++) {
        for (let j = 0; j < n; j++) {
          const a = rows[i + 1]![j]!, bq = rows[i + 1]![j + 1]!, c = rows[i]![j + 1]!, d = rows[i]![j]!;
          b.quad(a, bq, c, d);
          b.quad(under(d), under(c), under(bq), under(a));
        }
        // The cloth's thickness at the two open ends.
        const p0 = rows[i]![0]!, q0 = rows[i + 1]![0]!, p1 = rows[i]![n]!, q1 = rows[i + 1]![n]!;
        b.quad(under(p0), under(q0), q0, p0);
        b.quad(under(q1), under(p1), p1, q1);
      }
    });
    // The valances hang from the eaves, a point to each stripe, on both faces.
    const valance = (z: number, eave: (x: number) => number, out: number, key: string): void => {
      b.with({ color, pattern: PATTERN.stripes, ink: 'awning', sway: valanceSway(eave) }, () => {
        for (let j = 0; j < SCALLOPS; j++) {
          const x0 = xs[j]!, x1 = xs[j + 1]!, xm = (x0 + x1) / 2;
          const drop = STALL.valance * (0.9 + r(key, j) * 0.25);
          const straight = drop * 0.42;
          for (const face of [0, 1]) {
            const zz = z + out * (face === 0 ? 0.004 : -0.01);
            const tl: Vec3 = [x0, eave(x0), zz], tr: Vec3 = [x1, eave(x1), zz];
            const bl: Vec3 = [x0, eave(x0) - straight, zz], br: Vec3 = [x1, eave(x1) - straight, zz];
            const tip: Vec3 = [xm, eave(xm) - drop, zz];
            const want: Vec3 = [0, 0, face === 0 ? out : -out];
            quadFacing(b, bl, br, tr, tl, want);
            if (want[2] > 0) b.tri(bl, tip, br);
            else b.tri(br, tip, bl);
          }
        }
      });
    };
    valance(STALL.frontZ, frontY, 1, 'vf');
    valance(STALL.backZ, backY, -1, 'vb');

    // A lantern under each end of the ridge, in the open gable: the market glows at night from every side.
    for (let k = 0; k < 2; k++) {
      const x = (k === 0 ? -1 : 1) * (W - 0.065), top = ridgeY(x) - CLOTH - 0.012 - r('lantern', k) * 0.02;
      b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: `cap${k}` }, () =>
        b.at(compose(translation(x, top - 0.035, STALL.ridgeZ), rotationY(Math.PI / 4)), () => b.lathe([[0.055, 0], [0, 0.035]], { segments: 4, smooth: false, capBottom: true })),
      );
      b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: `lantern${k}` }, () => b.boxAt([x, top - 0.12, STALL.ridgeZ], [0.07, 0.085, 0.07]));
    }
  });
}

// ─────────────────────────────────────────────────────────── furniture ──

/** A plank counter with an overhanging top, across the front of the stall. */
function counter(ctx: Ctx, swap: boolean): void {
  const { b, r } = ctx;
  const Y = STALL.counter;
  ctx.rigid(() => {
    b.with({ color: RAMPS.wood[Math.floor(r('counter') * 3)]!, pattern: PATTERN.planks, ink: 'counter' }, () =>
      b.box([-0.375, 0, 0.04], [0.375, Y - 0.04, 0.41], { skip: ['bottom', 'top'] }),
    );
    b.with({ color: RAMPS.wood[5]!, pattern: swap ? PATTERN.planksAcross : PATTERN.planks, ink: 'top' }, () =>
      b.box([-0.41, Y - 0.04, 0.005], [0.41, Y, 0.445]),
    );
  });
}

/** A barrel standing on (x, z). */
function barrel(ctx: Ctx, x: number, z: number, key: string): void {
  const { b, r } = ctx;
  const s = 0.92 + r(key) * 0.16;
  ctx.rigid(() =>
    b.at(compose(translation(x, 0, z), scaling(s)), () => {
      b.with({ color: RAMPS.wood[3]!, pattern: PATTERN.bark, ink: key }, () =>
        b.lathe([[0.085, 0], [0.112, 0.13], [0.1, 0.26], [0.086, 0.3]], { segments: 8, capTop: true }),
      );
      // Two iron hoops, a hair proud of the staves: they read by colour, inside the barrel's outline.
      b.with({ color: PALETTE.metal, ink: key }, () => {
        b.lathe([[0.101, 0.055], [0.108, 0.09]], { segments: 8 });
        b.lathe([[0.109, 0.2], [0.105, 0.235]], { segments: 8 });
      });
    }),
  );
}

/** Two crates, the upper one set down askew. */
function crates(ctx: Ctx, x: number, z: number, key: string): void {
  const { b, r } = ctx;
  ctx.rigid(() => {
    b.with({ color: RAMPS.wood[4]!, pattern: PATTERN.planks, ink: `${key}a` }, () =>
      b.at(compose(translation(x, 0, z), rotationY((r(key, 'a') - 0.5) * 0.3)), () => b.boxAt([0, 0, 0], [0.23, 0.16, 0.2], { skip: ['bottom'] })),
    );
    b.with({ color: RAMPS.wood[2]!, pattern: PATTERN.planks, ink: `${key}b` }, () =>
      b.at(compose(translation(x + 0.01, 0.16, z), rotationY(0.25 + (r(key, 'b') - 0.5) * 0.5)), () => b.boxAt([0, 0, 0], [0.17, 0.12, 0.15], { skip: ['bottom'] })),
    );
  });
}

/** Two full sacks leaning on each other. */
function sacks(ctx: Ctx, x: number, z: number, key: string): void {
  const { b, r } = ctx;
  const color = vary(PALETTE.dirt, r(key), 0.6);
  ctx.rigid(() =>
    b.with({ color, pattern: PATTERN.cloth, ink: key }, () => {
      kitLump(b, x - 0.04, 0.11, z, 0.095, 0.11, 0.085, { seg: 7, rings: 4 });
      kitLump(b, x + 0.085, 0.085, z + 0.03, 0.075, 0.085, 0.07, { seg: 6, rings: 3 });
      kitLump(b, x - 0.04, 0.225, z, 0.035, 0.03, 0.035, { seg: 4, rings: 2 });
    }),
  );
}

/** What stands behind the counter, under the back of the awning: two of barrel, crates, sacks. */
function backStock(ctx: Ctx, choices: readonly ('barrel' | 'crates' | 'sacks')[]): void {
  const { r } = ctx;
  const first = Math.floor(r('stock') * choices.length);
  const flip = r('stock-side') < 0.5 ? -1 : 1;
  for (let i = 0; i < 2; i++) {
    const what = choices[(first + i) % choices.length]!;
    const x = flip * (i === 0 ? -0.2 : 0.19) + (r('sx', i) - 0.5) * 0.04;
    const z = -0.24 + (r('sz', i) - 0.5) * 0.05;
    if (what === 'barrel') barrel(ctx, x, z, `stock${i}`);
    else if (what === 'crates') crates(ctx, x, z, `stock${i}`);
    else sacks(ctx, x, z, `stock${i}`);
  }
}

// ─────────────────────────────────────────────────────────────── goods ──

const FRUIT: readonly (string | Rgb)[] = [PALETTE.red, PALETTE.yellow, PALETTE.bush, mixColor(PALETTE.yellow, PALETTE.red, 0.5), PALETTE.pink];

/** Three crates heaped with fruit, each heap one colour. */
function fruit(ctx: Ctx): void {
  const { b, r } = ctx;
  const Y = STALL.counter;
  const first = Math.floor(r('fruit') * FRUIT.length);
  for (let i = 0; i < 3; i++) {
    const cx = (i - 1) * 0.255, cz = 0.225 + (r('cz', i) - 0.5) * 0.03;
    ctx.rigid(() =>
      b.with({ color: RAMPS.wood[3]!, pattern: PATTERN.planks, ink: 'crates' }, () =>
        b.at(compose(translation(cx, Y, cz), rotationY((r('cy', i) - 0.5) * 0.12)), () => b.boxAt([0, 0, 0], [0.22, 0.06, 0.31], { skip: ['bottom'] })),
      ),
    );
    b.with({ color: FRUIT[(first + i * 2) % FRUIT.length]!, ink: `fruit${i}` }, () => {
      ctx.mound(cx, Y + 0.05, cz, 0.09, 0.055, 0.135, { seg: 7, rings: 2, normal: TONE.lit });
      for (let k = 0; k < 2; k++) {
        ctx.lump(cx + (r('fx', i, k) - 0.5) * 0.07, Y + 0.088 + r('fy', i, k) * 0.015, cz + (k - 0.5) * 0.12, 0.046, 0.042, 0.046, { seg: 5, rings: 3, normal: TONE.lit, twist: r('ft', i, k) * 6 });
      }
    });
  }
}

/** A basket of round loaves, long loaves laid out, and a tall basket of baguettes. */
function bread(ctx: Ctx): void {
  const { b, r } = ctx;
  const Y = STALL.counter;
  const crust = mixColor(PALETTE.wood, PALETTE.yellow, 0.45);
  const flip = r('flip') < 0.5 ? -1 : 1;
  ctx.rigid(() => {
    b.with({ color: RAMPS.wood[3]!, pattern: PATTERN.thatch, ink: 'basket' }, () =>
      b.at(translation(flip * -0.25, Y, 0.21), () => b.lathe([[0.09, 0], [0.125, 0.07], [0.105, 0.07]], { segments: 8 })),
    );
    b.with({ color: vary(crust, r('loaf'), 0.8), ink: 'loaves' }, () => {
      for (let k = 0; k < 3; k++) {
        b.at(compose(translation(flip * (-0.04 + k * 0.075), Y + 0.027, 0.22 + (r('lz', k) - 0.5) * 0.04), rotationY((r('ly', k) - 0.5) * 0.3)), () =>
          kitLump(b, 0, 0, 0, 0.034, 0.03, 0.125, { seg: 5, rings: 3 }),
        );
      }
    });
    b.with({ color: RAMPS.wood[3]!, pattern: PATTERN.thatch, ink: 'tall-basket' }, () =>
      b.at(translation(flip * 0.28, Y, 0.17), () => b.lathe([[0.065, 0], [0.085, 0.14], [0.07, 0.14]], { segments: 8 })),
    );
    b.with({ color: crust, ink: 'baguettes' }, () => {
      for (let k = 0; k < 4; k++) {
        const a = r('ba', k) * 6.28, lean = 0.03 + r('bl', k) * 0.05;
        const x = flip * 0.28 + Math.cos(a) * 0.025, z = 0.17 + Math.sin(a) * 0.025;
        tube(b, [[x, Y + 0.03, z], [x + Math.cos(a) * lean, Y + 0.3 + r('bh', k) * 0.05, z + Math.sin(a) * lean]], 0.024, { seg: 5, capEnd: true });
      }
    });
  });
  b.with({ color: crust, ink: 'rolls' }, () => {
    const x = flip * -0.25;
    ctx.mound(x, Y + 0.06, 0.21, 0.1, 0.05, 0.1, { seg: 7, rings: 2, normal: TONE.lit });
    for (let k = 0; k < 3; k++) {
      const a = r('ra') * 6.28 + k * 2.1;
      ctx.lump(x + Math.cos(a) * 0.05, Y + 0.105, 0.21 + Math.sin(a) * 0.05, 0.05, 0.04, 0.05, { seg: 5, rings: 3, normal: TONE.lit });
    }
  });
}

/** Wheels of cheese: a stack, one with a wedge cut out, and two in red wax with the wedge beside them. */
function cheese(ctx: Ctx): void {
  const { b, r } = ctx;
  const Y = STALL.counter;
  const yellow = PALETTE.yellow, pale = mixColor(PALETTE.yellow, PALETTE.white, 0.5), rind = mixColor(PALETTE.yellow, PALETTE.wood, 0.4);
  const flip = r('flip') < 0.5 ? -1 : 1;
  ctx.rigid(() => {
    b.with({ color: rind, ink: 'wheels' }, () => {
      b.at(translation(flip * -0.25, Y, 0.21), () => b.lathe([[0.118, 0], [0.118, 0.07], [0, 0.07]], { segments: 12 }));
      b.at(translation(flip * -0.24, Y + 0.07, 0.2), () => b.lathe([[0.09, 0], [0.09, 0.06], [0, 0.06]], { segments: 10 }));
    });
    // The cut wheel: the gap faces the customer and shows the paler paste.
    const gap = 0.5, start = Math.PI / 2 + gap, sweep = Math.PI * 2 - gap * 2;
    b.at(translation(flip * 0.02, Y, 0.2), () => {
      b.with({ color: yellow, ink: 'cut' }, () => b.lathe([[0.105, 0], [0.105, 0.08], [0, 0.08]], { segments: 10, start, sweep }));
      b.with({ color: pale, ink: 'cut' }, () => {
        for (const t of [start, start + sweep]) {
          const dx = Math.cos(t) * 0.105, dz = Math.sin(t) * 0.105;
          quadFacing(b, [0, 0, 0], [dx, 0, dz], [dx, 0.08, dz], [0, 0.08, 0], [0, 0, 1]);
        }
      });
    });
    b.with({ color: PALETTE.redDark, ink: 'wax' }, () => {
      b.at(translation(flip * 0.28, Y, 0.16), () => b.lathe([[0.07, 0], [0.075, 0.03], [0.07, 0.06], [0, 0.06]], { segments: 10 }));
      b.at(translation(flip * 0.27, Y + 0.06, 0.17), () => b.lathe([[0.058, 0], [0.062, 0.025], [0.058, 0.05], [0, 0.05]], { segments: 10 }));
    });
    b.with({ color: pale, ink: 'wedge' }, () =>
      b.at(compose(translation(flip * 0.23, Y, 0.33), rotationY(0.5 + r('wedge'))), () => b.extrude([[-0.06, 0], [0.06, -0.04], [0.06, 0.04]], 0, 0.065)),
    );
  });
}

const GLAZE: readonly (string | Rgb)[] = [PALETTE.brick, mixColor(PALETTE.brick, PALETTE.yellow, 0.4), PALETTE.glass, PALETTE.white, PALETTE.redDark];
const POTS: readonly (readonly [number, number])[][] = [
  [[0.04, 0], [0.078, 0.07], [0.072, 0.13], [0.036, 0.185], [0.048, 0.22]], // a tall jug
  [[0.045, 0], [0.09, 0.055], [0.084, 0.095], [0.056, 0.12], [0.068, 0.135]], // a round crock
  [[0.035, 0], [0.062, 0.08], [0.04, 0.15], [0.052, 0.19]], // a vase
  [[0.03, 0], [0.085, 0.05], [0.092, 0.075]], // a bowl
];

/** Four pots, jugs and bowls in a row, each its own glaze. */
function pots(ctx: Ctx): void {
  const { b, r } = ctx;
  const Y = STALL.counter;
  const order = Math.floor(r('order') * 4), glaze = Math.floor(r('glaze') * GLAZE.length);
  ctx.rigid(() => {
    for (let i = 0; i < 4; i++) {
      const profile = POTS[(order + i) % POTS.length]!;
      const color = GLAZE[(glaze + i * 2) % GLAZE.length]!;
      const s = 0.95 + r('ps', i) * 0.2;
      const mouth = profile[profile.length - 1]!;
      b.at(compose(translation(-0.285 + i * 0.19, Y, 0.2 + (r('pz', i) - 0.5) * 0.08), scaling(s)), () => {
        b.with({ color, ink: `pot${i}` }, () => b.lathe(profile, { segments: 8 }));
        // The dark of its mouth.
        b.with({ color: mixColor(color, PALETTE.ink, 0.6), ink: `pot${i}` }, () => b.lathe([[mouth[0] - 0.006, mouth[1] - 0.012], [0, mouth[1] - 0.012]], { segments: 8 }));
      });
    }
  });
}

const DYES: readonly (string | Rgb)[] = [PALETTE.pink, PALETTE.glass, PALETTE.yellow, PALETTE.magic, PALETTE.red, PALETTE.leafDark, PALETTE.white];

/** Bolts of cloth stacked across the counter, and a length of one hanging over its front. */
function cloth(ctx: Ctx): void {
  const { b, r } = ctx;
  const Y = STALL.counter;
  const first = Math.floor(r('dye') * DYES.length);
  const spots: readonly (readonly [number, number])[] = [[0.1, 0.05], [0.21, 0.05], [0.32, 0.05], [0.155, 0.139], [0.265, 0.139]];
  ctx.rigid(() => {
    for (let i = 0; i < spots.length; i++) {
      const [z, y] = spots[i]!;
      const half = 0.25 + r('len', i) * 0.07, off = (r('off', i) - 0.5) * 0.1;
      b.with({ color: DYES[(first + i * 3) % DYES.length]!, pattern: PATTERN.cloth, ink: `bolt${i}` }, () =>
        tube(b, [[off - half, Y + y, z], [off + half, Y + y, z]], 0.052, { seg: 7, capStart: true, capEnd: true }),
      );
    }
    // The hanging length: over the counter's edge and down its front.
    const x0 = (r('drape') < 0.5 ? -1 : 1) * 0.2 - 0.09, x1 = x0 + 0.18, zf = 0.452;
    b.with({ color: DYES[(first + 6) % DYES.length]!, pattern: PATTERN.cloth, ink: 'drape' }, () => {
      b.quad([x0, Y + 0.006, zf], [x1, Y + 0.006, zf], [x1, Y + 0.006, 0.37], [x0, Y + 0.006, 0.37]);
      b.quad([x0, Y - 0.2, zf], [x1, Y - 0.23, zf], [x1, Y + 0.006, zf], [x0, Y + 0.006, zf]);
    });
  });
}

const DRAW_GOODS: Record<Goods, (ctx: Ctx) => void> = { fruit, bread, cheese, pots, cloth };

// ────────────────────────────────────────────────────────── fish stall ──

/** A slab of ice with the catch laid out on it, a crab, fish hung from the eave and a brass scale. */
function fish(ctx: Ctx): void {
  const { b, r } = ctx;
  const Y = STALL.counter;
  const silver = mixColor(PALETTE.glass, PALETTE.white, 0.3), salmon = mixColor(PALETTE.pink, PALETTE.brick, 0.4);
  const x0 = -0.36, x1 = 0.36, z0 = 0.05, z1 = 0.415, yb = Y + 0.09, yf = Y + 0.035;
  const slope = Math.atan2(yb - yf, z1 - z0);
  const flip = r('flip') < 0.5 ? -1 : 1;
  ctx.rigid(() => {
    b.with({ color: mixColor(PALETTE.foam, PALETTE.shallow, 0.3), ink: 'ice' }, () => {
      quadFacing(b, [x0, yf, z1], [x1, yf, z1], [x1, yb, z0], [x0, yb, z0], [0, 1, 0]);
      quadFacing(b, [x0, Y, z1], [x1, Y, z1], [x1, yf, z1], [x0, yf, z1], [0, 0, 1]);
      quadFacing(b, [x0, Y, z0], [x1, Y, z0], [x1, yb, z0], [x0, yb, z0], [0, 0, -1]);
      quadFacing(b, [x0, Y, z0], [x0, Y, z1], [x0, yf, z1], [x0, yb, z0], [-1, 0, 0]);
      quadFacing(b, [x1, Y, z0], [x1, Y, z1], [x1, yf, z1], [x1, yb, z0], [1, 0, 0]);
    });
    // The catch, heads toward the customer.
    for (let i = 0; i < 4; i++) {
      const x = flip * (-0.27 + i * 0.125), z = 0.235 + (r('fz', i) - 0.5) * 0.04;
      const y = yb + ((z - z0) / (z1 - z0)) * (yf - yb) + 0.014;
      b.with({ color: i === Math.floor(r('salmon') * 4) ? salmon : vary(silver, r('fc', i), 0.8), ink: 'catch' }, () =>
        b.at(compose(translation(x, y, z), rotationX(slope), rotationY((r('fy', i) - 0.5) * 0.3)), () => {
          kitLump(b, 0, 0, 0.01, 0.038, 0.022, 0.1, { seg: 5, rings: 3 });
          b.tri([0, 0.004, -0.075], [0.04, 0.004, -0.14], [-0.04, 0.004, -0.14]);
        }),
      );
    }
    // A crab at the far end of the slab.
    const cx = flip * 0.25, cz = 0.25, cy = yb + ((cz - z0) / (z1 - z0)) * (yf - yb);
    b.with({ color: PALETTE.red, ink: 'crab' }, () => {
      kitLump(b, cx, cy + 0.012, cz, 0.055, 0.03, 0.042, { seg: 6, rings: 3 });
      kitLump(b, cx - 0.055, cy + 0.01, cz + 0.055, 0.026, 0.02, 0.03, { seg: 4, rings: 2 });
      kitLump(b, cx + 0.055, cy + 0.01, cz + 0.055, 0.026, 0.02, 0.03, { seg: 4, rings: 2 });
    });
    // Hung from the front eave: three fish by their tails, and a scale.
    const hz = STALL.frontZ - 0.04, hy = STALL.frontY - 0.03;
    b.with({ color: silver, ink: 'hung' }, () => {
      for (let i = 0; i < 3; i++) {
        const x = flip * (-0.3 + i * 0.105), len = 0.07 + r('hl', i) * 0.02;
        const top = hy - 0.02 - r('hd', i) * 0.02;
        kitLump(b, x, top - 0.04 - len, hz, 0.03, len, 0.017, { seg: 5, rings: 3 });
        quadFacing(b, [x, top - 0.05, hz], [x - 0.03, top, hz], [x, top - 0.012, hz], [x + 0.03, top, hz], [0, 0, 1]);
      }
    });
    const sx = flip * 0.22;
    b.with({ color: PALETTE.metal, ink: 'scale' }, () => tube(b, [[sx, hy, hz], [sx, hy - 0.13, hz]], 0.013, { seg: 4 }));
    b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'scale' }, () =>
      b.at(translation(sx, hy - 0.2, hz), () => {
        b.lathe([[0, 0], [0.075, 0.04]], { segments: 8 });
        b.lathe([[0.075, 0.04], [0, 0.012]], { segments: 8 });
        b.lathe([[0, 0.012], [0.012, 0.012], [0.012, 0.08], [0, 0.08]], { segments: 4 });
      }),
    );
  });
}

// ──────────────────────────────────────────────────────── flower stall ──

const BLOOMS: readonly (string | Rgb)[] = [PALETTE.red, PALETTE.pink, PALETTE.yellow, PALETTE.white, PALETTE.magic, mixColor(PALETTE.yellow, PALETTE.red, 0.5)];

/** A bucket on (x, y, z) with a bunch in it: a round mass of one colour, or a tall spray of leaf with flowers at its head. */
function bunch(ctx: Ctx, x: number, y: number, z: number, size: number, key: string, tall: boolean): void {
  const { b, r } = ctx;
  const zinc = mixColor(PALETTE.metal, PALETTE.white, 0.55);
  const h = 0.085 * size;
  ctx.rigid(() =>
    b.with({ color: r(key, 'pot') < 0.5 ? zinc : PALETTE.brick, ink: 'buckets' }, () =>
      b.at(translation(x, y, z), () => b.lathe([[0.042 * size, 0], [0.06 * size, h]], { segments: 6 })),
    ),
  );
  const color = BLOOMS[Math.floor(r(key, 'c') * BLOOMS.length)]!;
  if (tall) {
    b.with({ color: vary(PALETTE.leafDark, r(key, 'leaf'), 0.7), pattern: PATTERN.leaves, ink: 'blooms', sway: 0.2 }, () =>
      ctx.lump(x, y + h + 0.07 * size, z, 0.05 * size, 0.09 * size, 0.05 * size, { seg: 5, rings: 3, normal: TONE.mid }),
    );
    b.with({ color, ink: 'blooms', sway: 0.25 }, () => {
      for (let k = 0; k < 3; k++) {
        const a = r(key, 'a') * 6.28 + k * 2.1;
        ctx.lump(x + Math.cos(a) * 0.035 * size, y + h + (0.12 + k * 0.025) * size, z + Math.sin(a) * 0.035 * size, 0.038 * size, 0.038 * size, 0.038 * size, { seg: 4, rings: 2, normal: TONE.lit });
      }
    });
  } else {
    b.with({ color: vary(PALETTE.leafDark, r(key, 'leaf'), 0.7), pattern: PATTERN.leaves, ink: 'blooms', sway: 0.15 }, () =>
      ctx.mound(x, y + h - 0.01, z, 0.082 * size, 0.035 * size, 0.082 * size, { seg: 6, rings: 1, normal: TONE.mid }),
    );
    b.with({ color, ink: 'blooms', sway: 0.2 }, () =>
      ctx.lump(x, y + h + 0.04 * size, z, 0.072 * size, 0.055 * size, 0.072 * size, { seg: 6, rings: 3, normal: TONE.lit, twist: r(key, 't') * 6 }),
    );
  }
}

/** Three steps of buckets, a bunch in each, and two big tubs of tall flowers behind. */
function flowers(ctx: Ctx): void {
  const { b, r } = ctx;
  const zf = 0.445, d = 0.13, x0 = -0.39, x1 = 0.39;
  const ys = [0.14, 0.27, 0.4];
  const zb = zf - d * ys.length;
  ctx.rigid(() =>
    b.with({ color: RAMPS.wood[2]!, pattern: PATTERN.planks, ink: 'stand' }, () => {
      for (let k = 0; k < ys.length; k++) {
        const za = zf - d * k, zc = zf - d * (k + 1), yLow = k === 0 ? 0 : ys[k - 1]!, y = ys[k]!;
        quadFacing(b, [x0, y, za], [x1, y, za], [x1, y, zc], [x0, y, zc], [0, 1, 0]);
        quadFacing(b, [x0, yLow, za], [x1, yLow, za], [x1, y, za], [x0, y, za], [0, 0, 1]);
      }
      quadFacing(b, [x0, 0, zb], [x1, 0, zb], [x1, ys[2]!, zb], [x0, ys[2]!, zb], [0, 0, -1]);
      // The two ends: the stair profile, seen from outside.
      const profile: [number, number][] = [[zf, 0], [zb, 0], [zb, ys[2]!], [zf - 2 * d, ys[2]!], [zf - 2 * d, ys[1]!], [zf - d, ys[1]!], [zf - d, ys[0]!], [zf, ys[0]!]];
      b.polygon(profile.map(([z, y]): Vec3 => [x1, y, z]));
      b.polygon([...profile].reverse().map(([z, y]): Vec3 => [x0, y, z]));
    }),
  );
  for (let k = 0; k < ys.length; k++) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.25 + (r('bx', k, i) - 0.5) * 0.04;
      bunch(ctx, x, ys[k]!, zf - d * (k + 0.5), 1, `b${k}${i}`, r('tall', k, i) < 0.25 && k < 2);
    }
  }
  const flip = r('flip') < 0.5 ? -1 : 1;
  bunch(ctx, flip * -0.2, 0, -0.2, 1.7, 'tub0', true);
  bunch(ctx, flip * 0.17, 0, -0.25, 1.45, 'tub1', false);
}

// ─────────────────────────────────────────────────────────── the stall ──

/** A market stall's awning tells what it sells from across the square. */
const AWNINGS: Record<Goods, string> = {
  fruit: RAMPS.roof[3]!,
  bread: RAMPS.roof[2]!,
  cheese: PALETTE.yellow,
  pots: RAMPS.roof[4]!,
  cloth: PALETTE.red,
};

/** The colour of a stall's awning (it is striped with white). */
export function awningColor(look: StallLook): string {
  if (look.color) return RAMPS.roof[(look.color - 1) % RAMPS.roof.length]!;
  if (look.role === 'fish-stall') return PALETTE.glass;
  if (look.role === 'flower-stall') return rngOf(look.seed)('awning') < 0.6 ? PALETTE.pink : PALETTE.yellow;
  return AWNINGS[look.goods];
}

/** Draws one stall on the builder's origin. Also used by galleries and tests. */
export function drawStall(b: MeshBuilder, look: StallLook): void {
  const r = rngOf(look.seed);
  const theta = ((2 - look.front) * Math.PI) / 2 + (r('askew') - 0.5) * 2 * STALL.askew;
  const turn = rotationY(theta);
  const c = Math.cos(theta), s = Math.sin(theta);
  const swap = look.front === 1 || look.front === 3;
  const place = (fn: typeof kitLump) => (x: number, y: number, z: number, rx: number, ry: number, rz: number, opts?: LumpOptions): void =>
    fn(b, c * x + s * z, y, -s * x + c * z, swap ? rz : rx, ry, swap ? rx : rz, opts);
  const ctx: Ctx = { b, r, rigid: (fn) => b.at(turn, fn), lump: place(kitLump), mound: place(kitMound) };

  frameAndAwning(ctx, awningColor(look));
  if (look.role === 'flower-stall') {
    flowers(ctx);
    return;
  }
  counter(ctx, swap);
  if (look.role === 'fish-stall') {
    fish(ctx);
    backStock(ctx, ['barrel', 'crates']);
  } else {
    DRAW_GOODS[look.goods](ctx);
    backStock(ctx, ['barrel', 'crates', 'sacks']);
  }
}
