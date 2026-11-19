// LOOK FIXTURE. The spike's plants, rebuilt with MeshBuilder: one seed makes
// one of a family (round tree, cypress), never a clone. Crowns are blobs in
// one ink group, so the outline runs round the whole crown and the creases
// where blobs meet draw the leaf masses. Crowns sway with the wind.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import { rotationZ, translation, type Mat4Like } from '@/core/mat4';
import { rand } from '@/core/rand';
import { defineGenerator } from '@/gen/api';
import { MeshBuilder, parseColor, PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { bead, blob } from './shapes';

/** A palette colour nudged a little lighter or darker and warmer or cooler: no two crowns match. */
export function vary(hex: string, r: number, amount = 1): [number, number, number] {
  const [cr, cg, cb] = parseColor(hex);
  const light = 1 + (r - 0.5) * 0.12 * amount;
  const warm = (((r * 7.31) % 1) - 0.5) * 10 * amount;
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return [clamp(cr * light + warm), clamp(cg * light), clamp(cb * light - warm)];
}

const FLOWERS = [PALETTE.red, PALETTE.pink, PALETTE.yellow, PALETTE.white];

export function roundTree(b: MeshBuilder, seed: number, scale = 1): void {
  const r = (...p: (string | number)[]): number => rand(seed, ...p);
  const th = 0.26 + r('th') * 0.12, tr = 0.045 + r('tr') * 0.015;
  b.scale(scale * (0.88 + r('s') * 0.24));
  b.with({ color: vary(PALETTE.trunk, r('tc'), 0.6), pattern: PATTERN.bark, ink: 'trunk' }, () =>
    b.at(rotationZ((r('lean') - 0.5) * 0.14), () => b.lathe([[tr, 0], [tr * 0.8, th]], { segments: 8 })),
  );
  const R0 = 0.23 + r('R') * 0.07;
  b.with({ color: vary(PALETTE.leaf, r('lc')), pattern: PATTERN.leaves, ink: 'crown', sway: 0.85 }, () => {
    const y0 = th - 0.05;
    blob(b, 0, y0 + R0 * 0.85, 0, R0);
    const extra = 1 + Math.floor(r('n') * 4), a0 = r('a') * 6.28;
    for (let j = 0; j < extra; j++) {
      const a = a0 + (j * 6.28) / extra + (r('ja', j) - 0.5) * 0.8;
      const d = R0 * (0.5 + r('jd', j) * 0.35), rr = R0 * (0.5 + r('jr', j) * 0.28);
      blob(b, Math.cos(a) * d, y0 + R0 * (0.45 + r('jy', j) * 0.85), Math.sin(a) * d, rr);
    }
  });
}

export function cypress(b: MeshBuilder, seed: number, scale = 1): void {
  const r = (...p: (string | number)[]): number => rand(seed, ...p);
  b.scale(scale);
  b.with({ color: PALETTE.trunk, pattern: PATTERN.bark, ink: 'trunk' }, () => b.lathe([[0.05, 0], [0.04, 0.2]], { segments: 6 }));
  const h = 0.9 + r('h') * 0.4, rad = 0.15 + r('rad') * 0.05;
  b.with({ color: vary(PALETTE.leafDark, r('c')), pattern: PATTERN.leaves, ink: 'crown', sway: (_x, y) => Math.min(1, Math.max(0, y) * 0.9) }, () => {
    blob(b, 0, 0.12 + h * 0.5, 0, rad, h * 0.5, rad);
    if (r('tip') < 0.6) blob(b, (r('tx') - 0.5) * 0.04, 0.12 + h * 0.9, 0, rad * 0.62, h * 0.25, rad * 0.62);
  });
}

export function bush(b: MeshBuilder, seed: number, scale = 1): void {
  const r = (...p: (string | number)[]): number => rand(seed, ...p);
  b.scale(scale);
  const n = 2 + Math.floor(r('n') * 3);
  b.with({ color: vary(PALETTE.bush, r('c'), 0.8), pattern: PATTERN.leaves, ink: 'crown', sway: 0.3 }, () => {
    blob(b, 0, 0.1, 0, 0.13 + r('r0') * 0.04);
    for (let j = 0; j < n - 1; j++) {
      const a = r('a', j) * 6.28, d = 0.1 + r('d', j) * 0.06, rr = 0.09 + r('rr', j) * 0.04;
      blob(b, Math.cos(a) * d, rr * 0.75, Math.sin(a) * d, rr);
    }
  });
  if (r('fl') < 0.5) {
    // The flowers are part of the bush's surface: dots of colour, no outline of their own.
    b.setInk('crown').setSway(0.3);
    for (let i = 0; i < 3; i++) b.with({ color: FLOWERS[Math.floor(r('fc', i) * FLOWERS.length)]! }, () => bead(b, (r('fx', i) - 0.5) * 0.25, 0.17 + r('fy', i) * 0.05, 0.08 + r('fz', i) * 0.06, 0.03));
    b.setSway(0);
  }
}

export default defineGenerator({
  kind: 'tree',
  build(s, plan) {
    const anchors: Record<string, Mat4Like> = {};
    const out = new MeshBuilder({ ink: s.id });
    for (const cell of s.cells) {
      const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
      const seed = plan.world.seed ^ (x * 977 + z * 131 + y * 17);
      // A tree block is a small clump: one main plant and a companion or two, off-centre.
      const main = rand(seed, 'kind') < 0.62;
      const at = (dx: number, dz: number, fn: () => void): void => {
        out.at(translation(x + 0.5 + dx, y * CELL_H, z + 0.5 + dz), fn);
      };
      const b = (id: string): MeshBuilder => new MeshBuilder({ ink: `${s.id}:${id}` });
      const jx = (rand(seed, 'jx') - 0.5) * 0.24, jz = (rand(seed, 'jz') - 0.5) * 0.24;
      at(jx, jz, () => {
        const m = b('main');
        if (main) roundTree(m, seed, 1.25);
        else cypress(m, seed, 1.1);
        out.add(m);
      });
      if (rand(seed, 'second') < 0.55) {
        const a = rand(seed, 'sa') * 6.28;
        at(jx + Math.cos(a) * 0.3, jz + Math.sin(a) * 0.3, () => {
          const m = b('second');
          bush(m, seed + 1, 1);
          out.add(m);
        });
      }
    }
    return { mesh: out.build(), anchors };
  },
});
