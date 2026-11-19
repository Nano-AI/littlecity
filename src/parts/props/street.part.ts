// Street props (U05, U06): street tree, signpost, the dirt trail a street
// frays into at the town's edge. Several parts in one file; each is
// discovered by its own export.

import { DIR4 } from '@/core/grid';
import { compose, rotationY, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { lump, mixColor, rngOf, tube, vary, TONE } from './kit';

/** Raw ink id shared by the cells of a trail, so it is outlined once along its length. */
const INK_TRAIL = 61020;

/**
 * Street tree: a small clipped tree in a square of earth, the kind a town
 * plants in rows. Smaller than a placed tree, so the player's own trees
 * stay the landmarks. Frame: a floor slot, square to the world.
 */
export const streetTree = definePart({
  prop: 'street-tree',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 677));
    const h = 0.34 + r('h') * 0.06, rad = 0.2 + r('rad') * 0.03;
    b.with({ color: PALETTE.dirtDark, pattern: PATTERN.dirt, ink: 'pit' }, () => b.box([-0.13, 0, -0.13], [0.13, 0.018, 0.13], { skip: ['bottom'] }));
    const lean = (r('lean') - 0.5) * 0.08;
    b.with({ color: PALETTE.trunk, pattern: PATTERN.bark, ink: 'trunk' }, () => tube(b, [[0, 0.018, 0], [lean * 0.5, h * 0.6, 0], [lean, h + 0.04, 0]], [0.03, 0.024, 0.02], { seg: 5 }));
    const leaf = vary(PALETTE.leaf, r('leaf'));
    const cy = h + rad * 0.72;
    b.with({ pattern: PATTERN.leaves, ink: 'crown' }, () => {
      b.setSway((_x, y) => Math.min(1, Math.max(0, (y - h) / (rad * 2))) * 0.8);
      b.with({ color: leaf }, () => {
        lump(b, lean, cy, 0, rad, rad * 0.92, rad, { seg: 8, rings: 5, normal: TONE.lit });
        lump(b, lean + rad * 0.5, cy - rad * 0.2, rad * 0.35, rad * 0.55, rad * 0.5, rad * 0.55, { seg: 7, rings: 4, normal: TONE.lit, twist: 1 });
      });
      b.with({ color: mixColor(leaf, PALETTE.leafDark, 0.45) }, () => lump(b, lean + rad * 0.3, cy - rad * 0.15, -rad * 0.62, rad * 0.62, rad * 0.55, rad * 0.5, { seg: 7, rings: 4, normal: TONE.shade }));
      b.setSway(0);
    });
    return { mesh: b.build() };
  },
});

/** Signpost: a post with pointed boards for arms. Frame: a floor slot. */
export const signpost = definePart({
  prop: 'signpost',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 373));
    const arms = Math.max(1, Math.min(3, item.params?.arms ?? 2));
    const h = 0.6;
    b.rotateZ((r('lean') - 0.5) * 0.06);
    b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'post' }, () => b.boxAt([0, 0, 0], [0.04, h, 0.04], { skip: ['bottom'] }));
    for (let i = 0; i < arms; i++) {
      const y = h - 0.07 - i * 0.1, turn = r('turn', i) * 0.5 + i * (Math.PI / 2) + (i === 2 ? Math.PI / 2 : 0);
      b.at(compose(translation(0, y, 0), rotationY(turn)), () => {
        b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: `arm${i}` }, () => {
          const len = 0.2 + r('len', i) * 0.05, t = 0.012;
          const pts = (z: number): Vec3[] => [[0.01, -0.035, z], [len, -0.035, z], [len + 0.045, 0, z], [len, 0.035, z], [0.01, 0.035, z]];
          b.polygon(pts(0.02 + t));
          b.polygon([...pts(0.02 - t)].reverse());
        });
      });
    }
    return { mesh: b.build() };
  },
});

/**
 * Dirt trail: one cell of the worn track a street frays into where the town
 * ends. It narrows from cell to cell (`step` of `steps`) and the last one
 * tapers away into the grass. Frame: the cell's centre slot, square to the
 * world; `dir` is the way it runs.
 */
export const dirtTrail = definePart({
  prop: 'dirt-trail',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 499));
    const [dx, dz] = DIR4[(((item.params?.dir ?? 0) % 4) + 4) % 4]!;
    const step = item.params?.step ?? 0, steps = Math.max(1, item.params?.steps ?? 1);
    // The trail is drawn along one running coordinate g (cells from the street's end), so its width
    // and its wander depend only on g and the town seed: neighbouring cells meet exactly.
    const wave = (item.params?.look ?? 0) - step; // the same number for every cell of one trail
    const rr = rngOf(wave * 7919 + 13);
    const half = (g: number): number => 0.27 * Math.pow(Math.max(0, 1 - g / (steps - 0.25)), 0.7) + 0.05;
    const centre = (g: number): number => Math.sin(g * 1.9 + rr('phase') * 6.3) * 0.1 * Math.min(1, g * 0.8);
    const y = 0.013, n = 5;
    const up: Vec3 = [0, 1, 0];
    b.setColor(PALETTE.dirt).setPattern(PATTERN.dirt).setInkId(INK_TRAIL);
    // It starts under the street's rounded end and stops short of the last cell's far edge in a blunt tip.
    const g0 = step === 0 ? -0.3 : step, g1 = step === steps - 1 ? steps - 0.3 : step + 1;
    const P = (g: number, side: number): Vec3 => {
      const along = g - step - 0.5;
      const k = Math.round(g * n);
      const across = centre(g) + side * half(g) * (0.86 + rr('w', k, side) * 0.28);
      return [dx * along - dz * across, y, dz * along + dx * across];
    };
    const sheet = (a: Vec3, c: Vec3, d: Vec3, e: Vec3): void => {
      // Whichever way it runs, the sheet must face up.
      const cross = (c[2] - a[2]) * (e[0] - a[0]) - (c[0] - a[0]) * (e[2] - a[2]);
      if (cross >= 0) b.quad(a, c, d, e, { normals: [up, up, up, up] });
      else b.quad(e, d, c, a, { normals: [up, up, up, up] });
    };
    const cuts = Math.round((g1 - g0) * n);
    for (let i = 0; i < cuts; i++) {
      const a0 = g0 + ((g1 - g0) * i) / cuts, a1 = g0 + ((g1 - g0) * (i + 1)) / cuts;
      sheet(P(a0, -1), P(a0, 1), P(a1, 1), P(a1, -1));
    }
    if (step === steps - 1) {
      // The blunt tip, and a scuffed patch or two beyond it where the grass is winning.
      const tip = g1 + 0.12;
      const m: Vec3 = [dx * (tip - step - 0.5) - dz * centre(tip), y, dz * (tip - step - 0.5) + dx * centre(tip)];
      const l = P(g1, -1), rt = P(g1, 1);
      const cross = (rt[2] - l[2]) * (m[0] - l[0]) - (rt[0] - l[0]) * (m[2] - l[2]);
      if (cross >= 0) b.tri(l, rt, m, { normals: [up, up, up] });
      else b.tri(m, rt, l, { normals: [up, up, up] });
    }
    void r;
    return { mesh: b.build() };
  },
});
