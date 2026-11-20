// The midwinter festival's props (D35; Seasons, design section 13a): strings of small coloured
// bulbs, a wreath for a front door, and the big tree for the main square. The bulbs and the star
// are PATTERN.glow, so they shine as the page darkens; the festival system (src/life/seasons/) shows
// each prop only while the festival is on and lights it with a param, like the lamps.

import { DIR4 } from '@/core/grid';
import { compose, rotationY, scaling, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { wallInSocket } from '@/parts/openings/door-leaf';
import { pine } from '@/gen/tree/species';
import { PALETTE } from '@/style/palette';
import { lump, mixColor, rngOf, tube } from './kit';

/** The bulbs' colours, in the order they repeat along a string. */
export function bulbColors(): readonly (string | readonly [number, number, number])[] {
  // Lit from inside: each a step paler than its palette colour, so it sings against the night.
  return [PALETTE.red, PALETTE.yellow, PALETTE.glass, PALETTE.white, PALETTE.leaf, PALETTE.pink].map((c) => mixColor(c, PALETTE.white, 0.3));
}

/** A wall stands this far inside its cell line; eaves reach 0.12 past it. */
const WALL = 0.43;

/** A sagging wire from a to b with a bulb every `gap` along it, hanging just under the wire. */
function string(b: MeshBuilder, a: Vec3, c: Vec3, sag: number, gap: number, first: number): void {
  const at = (t: number): Vec3 => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t];
  b.with({ color: PALETTE.ink, pattern: PATTERN.none, ink: 'wire' }, () => {
    const pts: Vec3[] = [];
    for (let i = 0; i <= 6; i++) pts.push(at(i / 6));
    tube(b, pts, 0.005, { seg: 3 });
  });
  const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const n = Math.max(2, Math.round(len / gap));
  const colors = bulbColors();
  b.setPattern(PATTERN.glow).setInk('bulbs');
  for (let i = 0; i < n; i++) {
    const [x, y, z] = at((i + 0.5) / n);
    b.with({ color: colors[(first + i) % colors.length]! }, () => lump(b, x, y - 0.034, z, 0.038, 0.044, 0.038, { seg: 6, rings: 3 }));
  }
}

/**
 * A string of lights. Eave: frame at the centre of a top-storey cell's top, world axes; a string
 * under the eave of each side in the `faces` mask (1 N, 2 E, 4 S, 8 W). Street and square: a line,
 * origin at `from`, +X toward `to`, hanging `drop` below its ends.
 */
export const festivalLights = definePart({
  prop: 'festival-lights',
  build(item, ctx) {
    const b = ctx.mesh();
    const look = item.params?.look ?? 0;
    const r = rngOf(ctx.seed ^ (look * 131));
    if (item.variant === 'eave') {
      const faces = item.params?.faces ?? 4;
      // Along the eave's edge, hanging from the gutter, so the roof never hides it from above.
      const y = 0.66 - 0.8;
      for (let d = 0; d < 4; d++) {
        if (!(faces & (1 << d))) continue;
        const [dx, dz] = DIR4[d]!;
        // Along the face from one corner to the other, just proud of the wall, under the eave.
        const ox = -dz, oz = dx;
        const out = WALL + 0.12;
        const a: Vec3 = [dx * out - ox * 0.47, y, dz * out - oz * 0.47];
        const c: Vec3 = [dx * out + ox * 0.47, y, dz * out + oz * 0.47];
        string(b, a, c, 0.035, 0.24, Math.floor(r('first', d) * 6));
      }
      return { mesh: b.build() };
    }
    const span = Math.max(0.4, ctx.span);
    const y0 = -(item.params?.drop ?? 0);
    string(b, [0, y0, 0], [span, y0, 0], 0.04 * span + 0.03, 0.22, Math.floor(r('first') * 6));
    return { mesh: b.build() };
  },
});

/** A wreath on a front door: a ring of dark leaves with red berries and a bow. Frame: the door's socket. */
export const wreath = definePart({
  prop: 'wreath',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 17));
    b.at(compose(wallInSocket('plain', item.params?.steps ?? 0), translation(0, 0.36, 0.05)), () => {
      const n = 9, R = 0.06;
      b.with({ color: mixColor(PALETTE.leafDark, PALETTE.metal, 0.15), pattern: PATTERN.leaves, ink: 'wreath' }, () => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          lump(b, Math.cos(a) * R, Math.sin(a) * R, 0, 0.026, 0.026, 0.018, { seg: 5, rings: 3 });
        }
      });
      b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'berries' }, () => {
        for (let i = 0; i < 4; i++) {
          const a = r('berry', i) * Math.PI * 2;
          lump(b, Math.cos(a) * R, Math.sin(a) * R, 0.02, 0.011, 0.011, 0.011, { seg: 4, rings: 2 });
        }
        // The bow at the bottom.
        lump(b, -0.018, -R - 0.012, 0.02, 0.016, 0.011, 0.008, { seg: 4, rings: 2 });
        lump(b, 0.018, -R - 0.012, 0.02, 0.016, 0.011, 0.008, { seg: 4, rings: 2 });
      });
    });
    return { mesh: b.build() };
  },
});

/** A five-pointed star, flat in its own XY plane, `R` from its centre to a point. */
function star(b: MeshBuilder, R: number): void {
  const pts: Vec3[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? R : R * 0.45;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr, 0]);
  }
  const front = [0, 0, 1] as const, back = [0, 0, -1] as const;
  for (let i = 0; i < 10; i++) {
    const p = pts[i]!, q = pts[(i + 1) % 10]!;
    b.tri([0, 0, 0.012], p, q, { normals: [front, front, front] });
    b.tri([0, 0, -0.012], q, p, { normals: [back, back, back] });
  }
}

/**
 * The town's tree: a tall fir hung with a spiral of coloured lights and a few glass baubles, with a
 * star on top, standing in a wooden tub. Frame: a corner slot of the square, on the paving.
 */
export const festivalTree = definePart({
  prop: 'festival-tree',
  build(item, ctx) {
    const b = ctx.mesh();
    const r = rngOf(ctx.seed ^ ((item.params?.look ?? 0) * 7));
    const S = 1.45;
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'tub' }, () =>
      b.lathe([[0.17, 0], [0.2, 0.16], [0.21, 0.16]], { segments: 10, capTop: true }),
    );
    let top = 0;
    b.at(compose(translation(0, 0.12, 0), scaling(S)), () => {
      top = pine(b, (...p) => r('fir', ...p)) * S + 0.12;
    });
    // A spiral of lights round the cone, from just above the tub to near the top.
    const y0 = 0.5, y1 = top - 0.18;
    const colors = bulbColors();
    b.setPattern(PATTERN.glow).setInk('lights');
    const n = 46;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = y0 + (y1 - y0) * t;
      const rad = 0.6 * (1 - t) + 0.1;
      const a = t * Math.PI * 2 * 4.3 + r('turn') * 6;
      b.with({ color: colors[i % colors.length]! }, () => lump(b, Math.cos(a) * rad, y, Math.sin(a) * rad, 0.045, 0.045, 0.045, { seg: 6, rings: 3 }));
    }
    // Glass baubles.
    for (let i = 0; i < 9; i++) {
      const t = 0.1 + 0.75 * r('bt', i);
      const y = y0 + (y1 - y0) * t;
      const rad = 0.5 * (1 - t) + 0.1;
      const a = r('ba', i) * Math.PI * 2;
      b.with({ color: [PALETTE.red, PALETTE.magic, PALETTE.yellow][i % 3]!, pattern: PATTERN.metal, ink: `bauble${i % 3}` }, () =>
        lump(b, Math.cos(a) * rad, y, Math.sin(a) * rad, 0.04, 0.04, 0.04, { seg: 6, rings: 3 }),
      );
    }
    // The star, two crossed so it reads from every side.
    b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: 'star' }, () => {
      for (const a of [0, Math.PI / 2]) b.at(compose(translation(0, top + 0.06, 0), rotationY(a)), () => star(b, 0.12));
    });
    return { mesh: b.build() };
  },
});
