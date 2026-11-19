// Laundry line (D05): a rope between two facing windows with the wash pegged
// along it. Shirts, trousers, a sheet, a towel, a dress, a pair of socks;
// which ones and their colours come from `laundry-line.look`.
//
// The rope hangs from a small pulley bracket on each wall, at the head of
// the window frames (LINE_LIFT above the two anchors, which sit half-way up
// their cell faces), so people can walk underneath.
// Every garment is pegged at the top (sway 0) and free at the hem, so the
// wind lifts the whole wash together.
//
// Frame: origin at the `from` socket (a 'line-anchor' on a cell face), +X
// toward the `to` socket, `ctx.span` the distance between them. House walls
// stand a little inside their cell, so the rope runs on past both anchors. The part owns the socket 'perch'
// (the middle of the rope).

import { translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PROP } from '@/style/dressing';
import { PALETTE } from '@/style/palette';
import { clothColors, tube } from './kit';

/** How far above its two anchors the rope is hung: the head of a window frame. */
export const LINE_LIFT = 0.25;
/** A house wall stands this far inside its cell face; the brackets are on the wall. */
const SILL_OUT = 0.07;

type P2 = readonly [number, number];
/** Garment outlines, pegged along y = 0 and hanging down; counter-clockwise seen from +Z. Width, then shape. */
const GARMENTS: readonly { w: number; shape: readonly P2[]; white?: number }[] = [
  // shirt
  { w: 0.25, shape: [[-0.118, -0.035], [-0.1, -0.078], [-0.062, -0.055], [-0.062, -0.165], [0.062, -0.165], [0.062, -0.055], [0.1, -0.078], [0.118, -0.035], [0.062, 0], [-0.062, 0]] },
  // trousers
  { w: 0.14, shape: [[-0.055, 0], [-0.062, -0.21], [-0.014, -0.21], [0, -0.075], [0.014, -0.21], [0.062, -0.21], [0.055, 0]] },
  // sheet
  { w: 0.24, shape: [[-0.11, 0], [-0.11, -0.18], [0.11, -0.185], [0.11, 0]], white: 0.75 },
  // towel
  { w: 0.11, shape: [[-0.045, 0], [-0.045, -0.2], [0.045, -0.2], [0.045, 0]], white: 0.2 },
  // dress
  { w: 0.18, shape: [[-0.035, 0], [-0.045, -0.07], [-0.085, -0.21], [0.085, -0.21], [0.045, -0.07], [0.035, 0]] },
  // socks
  { w: 0.1, shape: [[-0.04, 0], [-0.04, -0.09], [-0.005, -0.09], [-0.005, 0]] },
];

function garment(b: MeshBuilder, shape: readonly P2[], x: number, y: number, tilt: number, scale: number): void {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const at = (p: P2, z: number): Vec3 => [x + (p[0] * c - p[1] * s) * scale, y + (p[0] * s + p[1] * c) * scale, z];
  b.polygon(shape.map((p) => at(p, 0.006)));
  b.polygon([...shape].reverse().map((p) => at(p, -0.006)));
}

export default definePart({
  prop: 'laundry-line',
  build(item, ctx) {
    const b = ctx.mesh();
    const span = Math.max(0.4, ctx.span);
    const count = Math.max(1, Math.min(6, Math.round(item.params?.garments ?? 4)));
    const look = item.params?.look ?? 0;
    const r = (...parts: (number | string)[]): number => ctx.rand(look, ...parts);
    const sag = PROP.lineSag * span;
    const x0 = -SILL_OUT + 0.02, x1 = span + SILL_OUT - 0.02;
    const rope = (t: number): Vec3 => [x0 + (x1 - x0) * t, LINE_LIFT - sag * 4 * t * (1 - t), 0];

    // The rope: dark, so it reads as a pen line.
    b.with({ color: PALETTE.ink, pattern: PATTERN.none, ink: 'rope' }, () => {
      const pts: Vec3[] = [];
      for (let i = 0; i <= 8; i++) pts.push(rope(i / 8));
      tube(b, pts, 0.009, { seg: 3 });
    });
    // A pulley bracket on each wall.
    b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'brackets' }, () => {
      b.box([-SILL_OUT, LINE_LIFT - 0.03, -0.025], [x0 + 0.02, LINE_LIFT + 0.03, 0.025]);
      b.box([x1 - 0.02, LINE_LIFT - 0.03, -0.025], [span + SILL_OUT, LINE_LIFT + 0.03, 0.025]);
    });

    // The wash: as many pieces as asked for, or as fit, spread along the rope with a little crowding to one side.
    const colors = clothColors();
    const room = span - 0.16;
    const picks: number[] = [];
    let used = 0;
    for (let i = 0; i < count; i++) {
      const g = Math.floor(r('g', i) * GARMENTS.length);
      const w = GARMENTS[g]!.w * 1.1;
      if (used + w > room) continue;
      picks.push(g);
      used += w;
    }
    const slack = (room - used) / (picks.length + 1);
    let x = 0.08 + slack * (0.6 + r('lead') * 0.8);
    const drop = PROP.garmentDrop;
    picks.forEach((g, i) => {
      const def = GARMENTS[g]!;
      const w = def.w * 1.1;
      const cx = x + w / 2;
      const t = (cx - x0) / (x1 - x0);
      const y = rope(t)[1] - 0.008;
      const white = r('w', i) < (def.white ?? 0.3);
      const color = white ? PALETTE.white : colors[Math.floor(r('c', i) * colors.length)]!;
      b.with({ color, pattern: PATTERN.cloth, ink: `g${i}` }, () => {
        b.setSway((_px, py) => Math.min(1, Math.max(0, (y - py) / drop)) * PROP.garmentSway);
        garment(b, def.shape, cx, y, (r('tilt', i) - 0.5) * 0.12, 1.08 + r('s', i) * 0.16);
        if (g === 5) garment(b, def.shape, cx + 0.055, y, (r('tilt2', i) - 0.5) * 0.14, 1.1); // the other sock
        b.setSway(0);
      });
      x += w + slack * (0.7 + r('gap', i) * 0.6);
    });
    return { mesh: b.build(), anchors: { perch: translation(span * 0.5, rope(0.5)[1] + 0.012, 0) } };
  },
});
