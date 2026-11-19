// The end of a vista (U09; the hall's clock is U11-F's): the one facade cell
// a long straight street runs into gets something worth looking at. Drawn on
// the wall plane (lib.ts): origin at the bottom centre of the storey on the
// wall, +X to the viewer's right, +Z out.
//
//   clock     a white dial in a stone roundel high on the storey (socket
//             'clock-hands'; and a 'flag-mount' to its right for a hall's flag)
//   niche     a round-headed niche painted blue inside, a little white saint
//             with a gold halo on a ledge
//   doorway   pilasters either side of the main door and a pediment over it
//   oriel     a canted bay window on a stone corbel, with its own little roof
//
// Bold shapes, a few ink groups, under about 150 triangles each.

import { compose, rotationZ, translation, type Mat4Like } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { clockFace } from '@/parts/monuments/openings';
import { PALETTE } from '@/style/palette';
import { archPts, bar, bead, circlePts, face, personaOf, plate, slab } from './lib';

/** A canted oriel: front face parallel to the wall, two raked sides. y0..y1 is the glazed body. */
function oriel(b: MeshBuilder, body: string, roof: string, y0: number, y1: number, w: number, out: number): void {
  const f = w * 0.3; // half the width of the front face
  const L: [number, number] = [-w / 2, 0], R: [number, number] = [w / 2, 0];
  const FL: [number, number] = [-f, out], FR: [number, number] = [f, out];
  const wall = (a: [number, number], c: [number, number], ya: number, yc: number): void => {
    b.quad([a[0], ya, a[1]], [c[0], ya, c[1]], [c[0], yc, c[1]], [a[0], yc, a[1]]);
  };
  // The body: three faces, glazed by panes laid just proud of them.
  b.with({ color: body, pattern: PATTERN.none, ink: 'oriel' }, () => {
    wall(L, FL, y0, y1);
    wall(FL, FR, y0, y1);
    wall(FR, R, y0, y1);
  });
  b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'oriel' }, () => {
    const pane = (a: [number, number], c: [number, number]): void => {
      const nx = -(c[1] - a[1]), nz = c[0] - a[0];
      const len = Math.hypot(nx, nz) || 1;
      const ox = (nx / len) * 0.004, oz = (nz / len) * 0.004;
      const k = 0.16; // inset of the pane from each end of its face
      const p0: [number, number] = [a[0] + (c[0] - a[0]) * k + ox, a[1] + (c[1] - a[1]) * k + oz];
      const p1: [number, number] = [a[0] + (c[0] - a[0]) * (1 - k) + ox, a[1] + (c[1] - a[1]) * (1 - k) + oz];
      b.quad([p0[0], y0 + 0.06, p0[1]], [p1[0], y0 + 0.06, p1[1]], [p1[0], y1 - 0.06, p1[1]], [p0[0], y1 - 0.06, p0[1]]);
    };
    pane(L, FL);
    pane(FL, FR);
    pane(FR, R);
  });
  // The corbel: a stone wedge tapering back into the wall.
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'oriel-corbel' }, () => {
    const d = 0.2;
    const tip: [number, number, number] = [0, y0 - d, 0];
    b.tri([FL[0], y0, FL[1]], tip, [FR[0], y0, FR[1]]);
    b.tri([L[0], y0, L[1]], tip, [FL[0], y0, FL[1]]);
    b.tri([FR[0], y0, FR[1]], tip, [R[0], y0, R[1]]);
  });
  // The roof: three sloping faces rising back to the wall.
  b.with({ color: roof, pattern: PATTERN.shingles, ink: 'oriel-roof' }, () => {
    const e = 0.03, rise = 0.16;
    const l: [number, number, number] = [L[0] - e, y1, 0], r: [number, number, number] = [R[0] + e, y1, 0];
    const fl: [number, number, number] = [FL[0] - e * 0.6, y1, FL[1] + e], fr: [number, number, number] = [FR[0] + e * 0.6, y1, FR[1] + e];
    const top: [number, number, number] = [0, y1 + rise, 0];
    b.tri(l, fl, top);
    b.tri(fl, fr, top);
    b.tri(fr, r, top);
    b.polygon([l, r, fr, fl]);
  });
}

export default definePart({
  feature: 'vista',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    const variant = item.variant ?? 'oriel';
    const anchors: Record<string, Mat4Like> = {};
    const lean = (ctx.rand('lean') - 0.5) * 0.012;
    b.at(rotationZ(lean), () => {
      if (variant === 'clock') {
        const cy = 0.43 + (ctx.rand('y') - 0.5) * 0.02, r = 0.2;
        // A stone roundel with a keystone over it, and the dial in it.
        b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'roundel' }, () => {
          plate(b, circlePts(r + 0.045, 0, cy, 16), 0, 0.03);
          slab(b, -0.04, 0.04, cy + r + 0.02, cy + r + 0.1, 0, 0.045);
        });
        b.at(translation(0, cy, 0.0), () => {
          const hands = clockFace(b, 'dial', r - 0.01, Math.floor(ctx.rand('hour') * 12));
          for (const [k, m] of Object.entries(hands)) anchors[k] = compose(translation(0, cy, 0), m);
        });
        anchors['flag-mount'] = translation(0.36, 0.5, 0.02);
      } else if (variant === 'niche') {
        const y0 = 0.16, w = 0.3, straight = 0.24;
        b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'niche' }, () => {
          // The surround, a ledge on a corbel below it.
          plate(b, archPts(w + 0.08, straight + 0.02, y0 - 0.04, 0, 8), 0, 0.025);
          slab(b, -0.15, 0.15, y0 - 0.06, y0, 0, 0.09);
          b.quad([-0.08, y0 - 0.06, 0.09], [-0.04, y0 - 0.14, 0], [0.04, y0 - 0.14, 0], [0.08, y0 - 0.06, 0.09]);
        });
        // The inside of the niche, painted blue, with a gold halo.
        b.with({ color: PALETTE.glass, pattern: PATTERN.none, ink: 'niche-inside' }, () => face(b, archPts(w, straight, y0, 0, 8), 0.03));
        b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'niche-inside' }, () => face(b, circlePts(0.065, 0, y0 + 0.3, 10), 0.034));
        // The saint: a robed figure with a round head.
        b.with({ color: PALETTE.white, pattern: PATTERN.marble, ink: 'saint' }, () => {
          b.at(translation(0, y0, 0.06), () => b.lathe([[0.06, 0], [0.055, 0.12], [0.035, 0.2], [0.02, 0.22]], { segments: 7, capTop: true }));
          bead(b, 0, y0 + 0.255, 0.06, 0.035);
        });
      } else if (variant === 'doorway') {
        const stone = p.trim;
        b.with({ color: stone, pattern: PATTERN.none, ink: 'doorway' }, () => {
          // Pilasters with a base and a capital either side of the door frame (0.34 × 0.55).
          for (const k of [-1, 1]) {
            const x = k * 0.215;
            slab(b, x - 0.035, x + 0.035, 0, 0.56, 0, 0.045, ['n', 'bottom']);
            slab(b, x - 0.05, x + 0.05, 0, 0.05, 0, 0.06, ['n', 'bottom']);
            slab(b, x - 0.05, x + 0.05, 0.53, 0.58, 0, 0.06, ['n']);
          }
          // The entablature, and a pediment over it.
          const t = 0.58, apex = 0.75;
          slab(b, -0.3, 0.3, t, t + 0.05, 0, 0.07);
          const u = t + 0.05;
          b.tri([-0.31, u, 0.07], [0.31, u, 0.07], [0, apex, 0.07]);
          // the pediment's two raking tops, back to the wall
          b.quad([0, apex, 0.07], [0.31, u, 0.07], [0.31, u, 0], [0, apex, 0]);
          b.quad([-0.31, u, 0.07], [0, apex, 0.07], [0, apex, 0], [-0.31, u, 0]);
        });
        // A gilded boss in the pediment.
        b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'doorway-boss' }, () => face(b, circlePts(0.028, 0, 0.675, 8), 0.074));
      } else {
        oriel(b, p.trim, p.roofColor, 0.2, 0.62, 0.54, 0.19);
        // A slim mullion on the front face.
        b.with({ color: p.trim, pattern: PATTERN.none, ink: 'oriel' }, () => bar(b, 0, 0.26, 0, 0.56, 0.022, 0.196));
      }
    });
    return { mesh: b.build(), anchors };
  },
});
