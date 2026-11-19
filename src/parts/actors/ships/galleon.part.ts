// The galleon (L38): the showpiece. About seven cells from the stern lantern
// to the end of the bowsprit; three masts, the mainmast taller than a
// three-storey house. What makes it read at a glance:
//
//   a high stern castle   the sheer rises aft in two steps (quarterdeck and
//                         poop), with a row of cabin windows down each side,
//                         quarter galleries, and a flat stern with windows
//                         and three lanterns that glow at night
//   a beakhead            a long low beak under the bowsprit, a figurehead
//                         at its tip (seeded: lion, lady, dragon, bird)
//   masts with tops       round platforms partway up, the topmasts above
//   a few lines           shrouds fanned to the rail and the stays between
//                         the masts, in one dark group: confident strokes,
//                         not a web
//   livery                dark wood below a proud wale, the upper works in
//                         a strong colour, a row of gun ports
//
// Sails, flags and the gangplank are instances of their own (the harbour
// system furls, braces and fills them). Frame: afloat, +Z the bow.

import { compose, rotationX, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import { flat } from '../boats/hull';
import { drawShipHull, sidePanel, type ShipHull } from './hull';
import { drawMast, figurehead, lantern, line, prism, shipsBoat, shrouds } from './kit';
import { shipPaint, type ShipPaint } from './paint';
import { onMast, rigOf, type ShipRig } from './rig';

/** A window on the hull's side: a frame in the trim colour and its pane. */
function sideWindow(b: MeshBuilder, hull: ShipHull, t: number, y: number, w: number, h: number, paint: ShipPaint, ink: string): void {
  for (const side of [1, -1]) {
    b.with({ color: paint.trim, ink: `${ink}-frame` }, () => sidePanel(b, hull, t, y, w + 0.05, h + 0.05, side, 0.012));
    b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: `${ink}-frame` }, () => sidePanel(b, hull, t, y, w, h, side, 0.02));
  }
}

/** A window on the flat stern, at x across and y up: it follows the stern's rake. */
function sternWindow(b: MeshBuilder, hull: ShipHull, x: number, y: number, w: number, h: number, paint: ShipPaint, ink: string): void {
  const at = (dx: number, dy: number, out: number): Vec3 => [x + dx, y + dy, hull.z(0, y + dy) - out];
  b.with({ color: paint.trim, ink }, () => flat(b, [at(-w / 2 - 0.025, -h / 2 - 0.025, 0.012), at(w / 2 + 0.025, -h / 2 - 0.025, 0.012), at(w / 2 + 0.025, h / 2 + 0.025, 0.012), at(-w / 2 - 0.025, h / 2 + 0.025, 0.012)], [0, 0, -1]));
  b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink }, () => flat(b, [at(-w / 2, -h / 2, 0.02), at(w / 2, -h / 2, 0.02), at(w / 2, h / 2, 0.02), at(-w / 2, h / 2, 0.02)], [0, 0, -1]));
}

/** A door (or small window) on a bulkhead at station t, facing `toward` (+1 forward). */
function bulkheadPanel(b: MeshBuilder, hull: ShipHull, t: number, x: number, y0: number, w: number, h: number, toward: number): void {
  const z = hull.z(t, y0 + h / 2) + toward * 0.014;
  flat(b, [[x - w / 2, y0, z], [x + w / 2, y0, z], [x + w / 2, y0 + h, z], [x - w / 2, y0 + h, z]], [0, 0, toward]);
}

export function drawGalleon(b: MeshBuilder, rig: ShipRig, paint: ShipPaint): void {
  const spec = rig.spec;
  const hull = drawShipHull(b, spec, paint, { boot: 0.07, wale: [0.25, 0.32], waleOut: 0.035 });
  const deckAt = hull.deck;

  // ── the side: gun ports along the waist, cabin windows in the stern castle ──
  b.with({ color: paint.port, ink: 'ports' }, () => {
    for (const t of [0.37, 0.46, 0.55, 0.64, 0.72]) for (const side of [1, -1]) sidePanel(b, hull, t, 0.46, 0.13, 0.11, side, 0.014);
    for (const side of [1, -1]) sidePanel(b, hull, 0.27, 0.5, 0.12, 0.1, side, 0.014);
  });
  for (const [t, y] of [[0.06, 0.92], [0.135, 0.92], [0.21, 0.92]] as const) sideWindow(b, hull, t, y, 0.11, 0.15, paint, `win${t}`);

  // ── the stern: two rows of windows, a carved band, the rudder ──
  for (const x of [-0.27, -0.09, 0.09, 0.27]) sternWindow(b, hull, x, 0.9, 0.12, 0.17, paint, `stern${x}`);
  for (const x of [-0.17, 0, 0.17]) sternWindow(b, hull, x, 1.26, 0.1, 0.12, paint, `poop${x}`);
  b.with({ color: paint.trim, ink: 'stern-band' }, () => {
    const y0 = 1.08, y1 = 1.14;
    const x0 = hull.outer(0, y0) - 0.01, x1 = hull.outer(0, y1) - 0.01;
    flat(b, [[-x0, y0, hull.z(0, y0) - 0.018], [x0, y0, hull.z(0, y0) - 0.018], [x1, y1, hull.z(0, y1) - 0.018], [-x1, y1, hull.z(0, y1) - 0.018]], [0, 0, -1]);
  });
  b.with({ color: paint.hull, ink: 'rudder' }, () => {
    const zs = (y: number): number => hull.z(0, y);
    prism(b, [[zs(-0.3) - 0.2, -0.3], [zs(-0.3), -0.3], [zs(0.95), 0.95], [zs(0.95) - 0.07, 0.95], [zs(0.2) - 0.2, 0.2]], () => 0.035);
  });
  // ── quarter galleries: a little bay with a window and a cap on each stern quarter ──
  for (const side of [1, -1]) {
    const t0 = 0.02, t1 = 0.085, y0 = 0.72, y1 = 1.1;
    const x0 = hull.outer(0.05, 0.9) - 0.04, x1 = hull.outer(0.05, 0.9) + 0.12;
    const za = hull.z(t0, 0.9), zc = hull.z(t1, 0.9);
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    b.with({ color: paint.upper, ink: `gallery${side}` }, () => {
      b.box([side > 0 ? lo : -hi, y0, za], [side > 0 ? hi : -lo, y1, zc], { skip: [side > 0 ? 'w' : 'e'] });
    });
    b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: `gallery${side}` }, () => {
      const x = side * (hi + 0.006);
      flat(b, [[x, y0 + 0.1, za + 0.05], [x, y0 + 0.1, zc - 0.05], [x, y1 - 0.08, zc - 0.05], [x, y1 - 0.08, za + 0.05]], [side, 0, 0]);
    });
    b.with({ color: paint.trim, ink: `gallery-cap${side}` }, () => {
      b.box([side > 0 ? lo : -hi - 0.03, y1, za - 0.03], [side > 0 ? hi + 0.03 : -lo, y1 + 0.06, zc + 0.03]);
      b.box([side > 0 ? lo : -hi + 0.04, y0 - 0.06, za + 0.02], [side > 0 ? hi - 0.04 : -lo, y0, zc - 0.02], { skip: ['top'] });
    });
  }

  // ── the castles' fronts: doors and windows ──
  b.with({ color: paint.port, ink: 'doors' }, () => {
    bulkheadPanel(b, hull, 0.29, 0, 0.5, 0.2, 0.38, 1);
    bulkheadPanel(b, hull, 0.1, 0, 1.13, 0.14, 0.15, 1);
    bulkheadPanel(b, hull, 0.78, 0, 0.5, 0.18, 0.26, -1);
  });
  b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'qd-windows' }, () => {
    for (const x of [-0.36, 0.36]) bulkheadPanel(b, hull, 0.29, x, 0.78, 0.13, 0.15, 1);
  });

  // ── the beakhead and figurehead ──
  const zs = (y: number): number => hull.z(1, y);
  const tipZ = zs(0.5) + 0.78;
  b.with({ color: paint.hull, ink: 'beak' }, () => {
    prism(
      b,
      [[zs(0.2) - 0.2, 0.2], [tipZ - 0.12, 0.52], [tipZ, 0.6], [tipZ - 0.05, 0.65], [zs(0.72) - 0.14, 0.72]],
      (z) => 0.1 - 0.08 * Math.min(1, Math.max(0, (z - zs(0.5)) / 0.86)),
    );
  });
  b.with({ color: paint.trim, ink: 'beak-rail' }, () => {
    for (const side of [1, -1]) line(b, [side * 0.12, 0.8, zs(0.8) - 0.05], [side * 0.03, 0.68, tipZ - 0.05], 0.03);
  });
  figurehead(b, paint.figurehead, [0, 0.6, tipZ + 0.02], 'figurehead');

  // ── masts, tops, bowsprit ──
  rig.masts.forEach((m, i) => drawMast(b, m, paint.spar, RAMPS.wood[3]!, `mast${i}`));
  const bsFoot: Vec3 = [0, 0.86, hull.z(0.93, 0.8)];
  const elev = 0.46, bsLen = 2.3;
  b.with({ color: paint.spar, ink: 'bowsprit' }, () => {
    b.at(compose(translation(bsFoot[0], bsFoot[1], bsFoot[2]), rotationX(Math.PI / 2 - elev)), () => b.lathe([[0.065, -0.3], [0.035, bsLen], [0, bsLen + 0.02]], { segments: 7 }));
  });
  const bs = (f: number): Vec3 => [0, bsFoot[1] + Math.sin(elev) * bsLen * f, bsFoot[2] + Math.cos(elev) * bsLen * f];

  // ── on deck: the ship's boat, a capstan, a hatch ──
  shipsBoat(b, 0, deckAt(0.62), hull.z(0.615, 0.5), { topsides: PALETTE.white, strake: paint.upper, seat: RAMPS.wood[5]! });
  b.with({ color: RAMPS.wood[3]!, ink: 'capstan' }, () => {
    b.at(translation(0, 0, hull.z(0.385, 0.5)), () => b.lathe([[0.09, 0.5], [0.07, 0.64], [0.12, 0.66], [0.12, 0.7], [0, 0.71]], { segments: 8 }));
  });
  b.with({ color: RAMPS.wood[7]!, ink: 'hatch' }, () => b.boxAt([0, 0.5, hull.z(0.43, 0.5)], [0.4, 0.06, 0.24], { skip: ['bottom'] }));

  // ── rigging: shrouds from each top to the rail, stays between the masts ──
  b.with({ color: paint.rope, ink: 'rigging' }, () => {
    for (const m of rig.masts) {
      const at = onMast(m, (m.top ?? m.head * 0.6) - 0.04);
      shrouds(b, at, (dz) => {
        const tt = hull.t(m.z + dz - 0.2);
        const y = hull.rail(tt);
        return [hull.outer(tt, y) + 0.04, y, hull.z(tt, y)];
      }, 2, 0.2);
    }
    const [fore, main, miz] = rig.masts as [typeof rig.masts[0], typeof rig.masts[0], typeof rig.masts[0]];
    line(b, onMast(main, main.top! + 0.05), onMast(fore, fore.foot + 0.25));
    line(b, onMast(main, main.head - 0.1), onMast(fore, fore.head - 0.12));
    line(b, onMast(fore, fore.top! + 0.05), bs(0.55));
    line(b, onMast(fore, fore.head - 0.1), bs(0.97));
    line(b, onMast(miz, miz.top! + 0.04), onMast(main, 1.1));
  });

  // ── stern lanterns ──
  rig.lanterns.forEach(([x, y, z], i) => lantern(b, x, y, z, i === 0 ? 0.095 : 0.07, `lantern${i}`));
}

export default definePart({
  actor: 'galleon',
  build(item, ctx) {
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const b = ctx.mesh();
    drawGalleon(b, rigOf('galleon', look), shipPaint(look, 'galleon'));
    return { mesh: b.build(), animated: true };
  },
});
