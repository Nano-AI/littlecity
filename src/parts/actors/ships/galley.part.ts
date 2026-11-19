// The galley (L40): long, low and quick, about six cells. What makes it a
// galley at a glance:
//
//   the ram        a bronze beak at the waterline, under a stem that rises
//                  and curls back
//   the stern      a tall post curling forward over the steersman, and an
//                  awning on posts over the after deck, striped in livery
//   the outrigger  a frame along each side at the rail, carrying the tholes
//                  for a bank of oars (the oars are their own instances:
//                  oars.part.ts; the harbour system rows them together)
//   an eye         painted on each bow
//   steering oars  two great oars angled down over the stern quarters
//
// Frame: afloat, +Z the bow.

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import type { MeshBuilder } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import { stick } from '../boats/hull';
import { drawShipHull, sidePanel } from './hull';
import { drawMast, lantern, line, prism } from './kit';
import { shipPaint, type ShipPaint } from './paint';
import { onMast, rigOf, type ShipRig } from './rig';

/** Points along a curl: from `a`, rising and turning by `turn` radians over `len`, in the YZ plane. */
function curl(a: Vec3, len: number, start: number, turn: number, steps: number): Vec3[] {
  const out: Vec3[] = [a];
  let ang = start, [x, y, z] = a;
  const step = len / steps;
  for (let i = 0; i < steps; i++) {
    ang += turn / steps;
    y += Math.cos(ang) * step;
    z += Math.sin(ang) * step;
    out.push([x, y, z]);
  }
  return out;
}

/** The start of segment i of a chain of sticks, drawn back a hair into the one before so their end caps do not coincide. */
function nudge(a: Vec3, c: Vec3, i: number): Vec3 {
  if (i === 0) return a;
  const d = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) || 1;
  return [a[0] - ((c[0] - a[0]) / d) * 0.006, a[1] - ((c[1] - a[1]) / d) * 0.006, a[2] - ((c[2] - a[2]) / d) * 0.006];
}

export function drawGalley(b: MeshBuilder, rig: ShipRig, paint: ShipPaint): void {
  const hull = drawShipHull(b, rig.spec, paint, { boot: 0.05, wale: [0.15, 0.2], waleOut: 0.025 });
  const o = rig.oars!;

  // ── the outriggers, carrying the tholes ──
  b.with({ color: paint.upper, ink: 'outrigger' }, () => {
    for (const side of [1, -1]) {
      const x0 = side * (rig.spec.beam / 2 - 0.04), x1 = side * (o.x + 0.06);
      b.box([Math.min(x0, x1), o.y - 0.07, o.z0 - 0.25], [Math.max(x0, x1), o.y - 0.01, o.z1 + 0.25]);
    }
  });
  b.with({ color: paint.wale, ink: 'thole-rail' }, () => {
    for (const side of [1, -1]) b.box([side * o.x - 0.025, o.y - 0.01, o.z0 - 0.25], [side * o.x + 0.025, o.y + 0.02, o.z1 + 0.25], { skip: ['bottom'] });
  });

  // ── the ram and the stem ──
  const zs = (y: number): number => hull.z(1, y);
  b.with({ color: RAMPS.roof[2]!, ink: 'ram' }, () => {
    prism(b, [[zs(-0.08) - 0.2, -0.08], [zs(0) + 0.62, 0.0], [zs(0.05) + 0.6, 0.07], [zs(0.16) - 0.05, 0.16]], (z) => 0.09 - 0.07 * Math.min(1, Math.max(0, (z - zs(0)) / 0.6)));
  });
  b.with({ color: paint.hull, ink: 'stem' }, () => {
    const pts = curl([0, 0.3, zs(0.3) - 0.02], 0.62, 0.35, -1.5, 6);
    for (let i = 0; i + 1 < pts.length; i++) stick(b, nudge(pts[i]!, pts[i + 1]!, i), pts[i + 1]!, 0.07 - i * 0.006, 0.07 - i * 0.006);
  });

  // ── the stern post, curling forward, a lantern hung from its crook ──
  const stern: Vec3[] = [];
  b.with({ color: paint.wale, ink: 'sternpost' }, () => {
    const zt = hull.z(0, 0.5);
    const pts = curl([0, 0.3, zt - 0.04], 2.0, -0.4, 2.9, 11);
    for (let i = 0; i + 1 < pts.length; i++) stick(b, nudge(pts[i]!, pts[i + 1]!, i), pts[i + 1]!, 0.09 - i * 0.006, 0.07 - i * 0.004);
    stern.push(...pts);
  });

  // ── the eyes on the bows ──
  for (const side of [1, -1]) {
    b.with({ color: PALETTE.white, ink: 'eye' }, () => sidePanel(b, hull, 0.935, 0.3, 0.16, 0.09, side, 0.012));
    b.with({ color: PALETTE.metal, ink: 'eye' }, () => sidePanel(b, hull, 0.938, 0.3, 0.06, 0.06, side, 0.02));
  }

  // ── the awning over the after deck ──
  const za = hull.z(0.1, 0.5), zb = hull.z(0.26, 0.5);
  const aw = hull.outer(0.18, 0.5) - 0.02, top = 1.0;
  b.with({ color: paint.spar, ink: 'awning-posts' }, () => {
    for (const x of [-aw, aw]) for (const z of [za + 0.06, zb - 0.06]) stick(b, [x, hull.deck(hull.t(z)), z], [x, top, z], 0.035);
  });
  b.with({ ink: 'awning' }, () => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      // A cambered canopy in stripes running fore and aft, livery and white.
      b.setColor(i % 2 === 0 ? paint.upper : PALETTE.white);
      const x0 = -aw - 0.08 + ((2 * aw + 0.16) * i) / n, x1 = -aw - 0.08 + ((2 * aw + 0.16) * (i + 1)) / n;
      const y = (x: number): number => top + 0.12 * (1 - (x / (aw + 0.08)) ** 2);
      b.quad([x0, y(x0), za - 0.05], [x0, y(x0), zb + 0.05], [x1, y(x1), zb + 0.05], [x1, y(x1), za - 0.05]);
      b.quad([x1, y(x1) - 0.012, za - 0.05], [x1, y(x1) - 0.012, zb + 0.05], [x0, y(x0) - 0.012, zb + 0.05], [x0, y(x0) - 0.012, za - 0.05]);
    }
    // A scalloped valance along each side.
    b.setColor(paint.upper);
    for (const side of [1, -1]) {
      const x = side * (aw + 0.08);
      const pts: Vec3[] = [[x, top, za - 0.05], [x, top, zb + 0.05], [x, top - 0.08, zb + 0.05], [x, top - 0.08, za - 0.05]];
      b.quad(pts[0]!, side > 0 ? pts[3]! : pts[1]!, pts[2]!, side > 0 ? pts[1]! : pts[3]!);
      const inner = pts.map((q): Vec3 => [q[0] - side * 0.004, q[1], q[2]]);
      b.quad(inner[0]!, side > 0 ? inner[1]! : inner[3]!, inner[2]!, side > 0 ? inner[3]! : inner[1]!);
    }
  });

  // ── the steering oars, one each quarter, angled down into the water ──
  b.with({ ink: 'steering' }, () => {
    for (const side of [1, -1]) {
      const head: Vec3 = [side * (hull.outer(0.08, 0.5) + 0.02), 0.85, hull.z(0.08, 0.5)];
      const neck: Vec3 = [side * (hull.outer(0.08, 0.5) + 0.12), -0.05, hull.z(0.0, 0.2) - 0.25];
      const blade: Vec3 = [side * (hull.outer(0.08, 0.5) + 0.15), -0.3, hull.z(0.0, 0.2) - 0.36];
      b.setColor(paint.spar);
      stick(b, head, neck, 0.05);
      b.setColor(paint.upper);
      stick(b, neck, blade, 0.03, 0.16);
    }
  });

  // ── the mast, its stays, and a lantern on the stern post ──
  const m = rig.masts[0]!;
  drawMast(b, m, paint.spar, RAMPS.wood[3]!, 'mast');
  b.with({ color: paint.rope, ink: 'rigging' }, () => {
    line(b, onMast(m, m.head - 0.1), [0, 0.5, zs(0.5) - 0.1]);
    line(b, onMast(m, m.head - 0.1), [0, 0.55, hull.z(0.13, 0.5)]);
    for (const side of [1, -1]) line(b, onMast(m, m.head * 0.7), [side * (o.x + 0.02), o.y, m.z - 0.1]);
  });
  const crook = stern.reduce((a, p) => (p[1] > a[1] ? p : a), stern[0]!);
  lantern(b, 0, crook[1] - 0.2, crook[2] + 0.14, 0.075, 'lantern');
}

export default definePart({
  actor: 'galley',
  build(item, ctx) {
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const b = ctx.mesh();
    drawGalley(b, rigOf('galley', look), shipPaint(look, 'galley') as ShipPaint);
    return { mesh: b.build(), animated: true };
  },
});
