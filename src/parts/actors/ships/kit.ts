// Shapes the big ships share (L38–L41): masts with their tops, a few
// confident lines of rigging, lanterns, figureheads, a beak, a ship's boat.
// Pure: MeshBuilder in, triangles out.

import { compose, rotationX, translation, type Vec3 } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import { ball } from '../kit';
import { drawHull, face, flat, stick, thwart, unit, type HullSpec } from '../boats/hull';
import { onMast, type Mast } from './rig';

/** A mast: a tapering spar from its foot to its head, raked aft, with its round top if it has one. */
export function drawMast(b: MeshBuilder, m: Mast, spar: ColorInput, topColor: ColorInput, ink: string): void {
  const tilt = rotationX(-m.rake);
  b.with({ color: spar, ink }, () => {
    b.at(compose(translation(0, m.foot, m.z), tilt), () => {
      const h = m.head - m.foot;
      const top = m.top !== null ? m.top - m.foot : h * 0.6;
      // The lower mast, and the topmast above the top: thinner, a step in the outline.
      b.lathe([[m.r0, -0.02], [m.r0 * 0.82, top]], { segments: 8 });
      b.lathe([[m.r0 * 0.62, top], [m.r1 * 0.7, h], [0, h + 0.02]], { segments: 7 });
    });
  });
  if (m.top !== null) {
    b.with({ color: topColor, ink: `${ink}-top` }, () => {
      const [, , z] = onMast(m, m.top!);
      b.at(translation(0, 0, z), () => {
        // The top: a round platform with a low rail round it, a little wider at its lip.
        b.lathe([[m.r0 * 0.9, m.top! - 0.1], [0.17, m.top! - 0.02], [0.2, m.top!], [0.2, m.top! + 0.07], [0.15, m.top! + 0.07]], { segments: 10 });
      });
    });
  }
}

/** A line of rigging from a to c: a thin square stick. */
export function line(b: MeshBuilder, a: Vec3, c: Vec3, w = 0.018): void {
  stick(b, a, c, w);
}

/** Shrouds: `n` lines down each side from a point on the mast to the rail, fanned fore and aft. */
export function shrouds(b: MeshBuilder, from: Vec3, railAt: (dz: number) => Vec3, n: number, spread: number, w = 0.018): void {
  for (let i = 0; i < n; i++) {
    const dz = n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1);
    for (const side of [1, -1]) {
      const r = railAt(dz);
      line(b, [from[0] + side * 0.03, from[1], from[2]], [side * r[0], r[1], r[2]], w);
    }
  }
}

/** A lantern: a glowing ball under a dark cap, on a short post standing at (x, y, z). */
export function lantern(b: MeshBuilder, x: number, y: number, z: number, r: number, ink: string): void {
  b.with({ color: PALETTE.metal, ink: `${ink}-iron` }, () => {
    b.at(translation(x, 0, z), () => {
      b.lathe([[0.016, y - 0.14], [0.016, y - r * 0.8]], { segments: 5 });
      b.lathe([[r * 1.05, y + r * 0.6], [r * 0.2, y + r * 1.55], [0, y + r * 1.6]], { segments: 6 });
    });
  });
  b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: `${ink}-glow` }, () => ball(b, x, y, z, r * 0.9, r, r * 0.9, 7, 4));
}

/**
 * A figurehead at (x, y, z) leaning forward over the water: 0 a gilt lion, 1 a white lady, 2 a red
 * dragon, 3 a blue bird. About 0.3 long. One ink group.
 */
export function figurehead(b: MeshBuilder, kind: number, at: Vec3, ink: string): void {
  const [x, y, z] = at;
  const color = [PALETTE.yellow, PALETTE.white, PALETTE.red, RAMPS.roof[1]!][kind % 4]!;
  b.with({ color, ink }, () => {
    b.at(compose(translation(x, y, z), rotationX(-0.75)), () => {
      // The body, leaning out along +Z (tipped forward), and the head at its end.
      ball(b, 0, 0, 0.0, 0.07, 0.07, 0.15, 8, 5);
      if (kind === 0) {
        ball(b, 0, 0.03, 0.17, 0.085, 0.08, 0.08, 8, 5); // a mane
        ball(b, 0, 0.02, 0.24, 0.045, 0.045, 0.05, 6, 4);
      } else if (kind === 1) {
        ball(b, 0, 0.02, 0.17, 0.05, 0.055, 0.05, 7, 4);
        ball(b, 0, 0.0, 0.12, 0.06, 0.03, 0.05, 6, 3); // hair falling back
      } else if (kind === 2) {
        ball(b, 0, 0.03, 0.18, 0.045, 0.045, 0.09, 7, 4); // a long snout
        ball(b, 0, 0.09, 0.14, 0.012, 0.05, 0.025, 4, 3); // a horn
      } else {
        ball(b, 0, 0.03, 0.17, 0.05, 0.05, 0.05, 7, 4);
        ball(b, 0, 0.02, 0.24, 0.015, 0.015, 0.05, 4, 3); // a beak
        ball(b, 0.09, 0.02, 0.0, 0.11, 0.02, 0.07, 6, 3); // wings
        ball(b, -0.09, 0.02, 0.0, 0.11, 0.02, 0.07, 6, 3);
      }
    });
  });
}

/**
 * A solid of `halfWidth(z)` either side of x = 0 through a side outline in the YZ plane (points [z, y],
 * counter-clockwise in the (z, y) plane drawn with z to the right and y up): a beak, a ram, a stern post. Its sides are flat; its edges round off
 * with soft normals so only its outline and the top's turn are inked.
 */
export function prism(b: MeshBuilder, outline: readonly (readonly [number, number])[], halfWidth: (z: number, y: number) => number): void {
  const n = outline.length;
  const side = (s: number): Vec3[] => outline.map(([z, y]): Vec3 => [s * halfWidth(z, y), y, z]);
  const r = side(1), l = side(-1);
  flat(b, r, [1, 0, 0]);
  flat(b, l, [-1, 0, 0]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ez = outline[j]![0] - outline[i]![0], ey = outline[j]![1] - outline[i]![1];
    // The outward normal of this edge of a counter-clockwise outline (seen from +X: z to the right, y up).
    const nn = unit([0, -ez, ey]);
    face(b, [r[i]!, r[j]!, l[j]!, l[i]!], [nn, nn, nn, nn]);
  }
}

function boatSpec(): HullSpec {
  return {
    length: 1.0,
    beam: 0.4,
    freeboard: 0.12,
    bowRise: 0.07,
    sternRise: 0.03,
    draft: 0.06,
    widest: 0.42,
    transom: 0.62,
    bowPoint: 1,
    stemRake: 0.4,
    transomRake: 0.14,
    round: 0.36,
    vee: 0.85,
    skin: 0.025,
    strake: 0.036,
    boot: 0.02,
    sole: 0.02,
    stations: 8,
  };
}

/** The ship's boat, lying on chocks on the deck at (x, deckY, z), its bow forward. */
export function shipsBoat(b: MeshBuilder, x: number, deckY: number, z: number, colors: { topsides: ColorInput; strake: ColorInput; seat: ColorInput }): void {
  const spec = boatSpec();
  const lift = spec.draft + 0.05;
  b.with({ color: colors.seat, ink: 'chocks' }, () => {
    for (const dz of [-0.26, 0.24]) b.boxAt([x, deckY, z + dz], [0.34, 0.07, 0.06], { skip: ['bottom'] });
  });
  b.at(translation(x, deckY + lift, z), () => {
    const hull = drawHull(b, spec, { bottom: colors.strake, topsides: colors.topsides, strake: colors.strake, rail: colors.seat, inside: PALETTE.wood, sole: colors.seat }, { hull: 'boat', inside: 'boat-inside' });
    b.with({ color: colors.seat, ink: 'boat-thwarts' }, () => {
      for (const t of [0.35, 0.62]) thwart(b, hull, t, 0.08, hull.sheer(t) - 0.03);
    });
  });
}
