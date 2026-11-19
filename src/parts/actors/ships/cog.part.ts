// The merchant cog (L39): a round-bellied trader about four cells long,
// with one mast and one great square sail. What makes it a cog:
//
//   the hull     short and deep, nearly as broad as it is high, a straight
//                raked stem and stern post, planked in strakes (two proud
//                wales over plain wood)
//   castles      a boxy castle aft and a smaller one forward, each a ring
//                of painted parapet with battlements, standing on the rail
//   the rudder   hung on the sternpost, with its tiller under the castle
//   cargo        barrels and a crate lashed in the waist
//
// The sail, its yard and the flags are instances of their own (sail.part.ts,
// fittings.part.ts). Frame: afloat, +Z the bow.

import { definePart } from '@/gen/api';
import type { ColorInput, MeshBuilder } from '@/gen/mesh';
import { RAMPS } from '@/style/palette';
import { drawShipHull, wale, type ShipHull } from './hull';
import { drawMast, lantern, line, prism, shrouds } from './kit';
import { shipPaint, type ShipPaint } from './paint';
import { onMast, rigOf, type ShipRig } from './rig';

/**
 * A castle: a rectangle of parapet `h` tall standing on the rail between stations t0 and t1, `w` either
 * side of the middle, with merlons along its top. One ink group for the walls, one for the battlements.
 */
function castle(b: MeshBuilder, hull: ShipHull, t0: number, t1: number, w: number, h: number, color: ColorInput, trim: ColorInput, ink: string): void {
  const y0 = Math.min(hull.rail(t0), hull.rail(t1)) - 0.06;
  const z0 = hull.z(t0, y0) - (t0 <= 0.001 ? 0.08 : 0), z1 = hull.z(t1, y0);
  const th = 0.045;
  b.with({ color, ink }, () => {
    // Two sides, the end and the front, each a thin wall: the outside faces and the tops.
    b.box([w - th, y0, z0], [w, y0 + h, z1], { skip: ['bottom'] });
    b.box([-w, y0, z0], [-w + th, y0 + h, z1], { skip: ['bottom'] });
    b.box([-w + th, y0, z0], [w - th, y0 + h, z0 + th], { skip: ['bottom', 'e', 'w'] });
    b.box([-w + th, y0, z1 - th], [w - th, y0 + h, z1], { skip: ['bottom', 'e', 'w'] });
  });
  // The underside where it overhangs the hull.
  b.with({ color, ink }, () => {
    const under = y0 - 0.001;
    b.box([-w, under - 0.04, z0], [w, under, z1], { only: ['bottom', 'n', 's', 'e', 'w'] });
  });
  b.with({ color: trim, ink: `${ink}-merlons` }, () => {
    const top = y0 + h;
    const m = 0.09;
    for (let z = z0 + 0.05; z + m <= z1 - 0.03; z += m * 2.4) {
      b.box([w - th - 0.008, top, z], [w + 0.008, top + 0.07, z + m], { skip: ['bottom'] });
      b.box([-w - 0.008, top, z], [-w + th + 0.008, top + 0.07, z + m], { skip: ['bottom'] });
    }
    for (let x = -w + 0.1; x + m <= w - 0.08; x += m * 2.4) {
      b.box([x, top, z0 - 0.008], [x + m, top + 0.07, z0 + th + 0.008], { skip: ['bottom'] });
      b.box([x, top, z1 - th - 0.008], [x + m, top + 0.07, z1 + 0.008], { skip: ['bottom'] });
    }
  });
}

export function drawCog(b: MeshBuilder, rig: ShipRig, paint: ShipPaint): void {
  // A cog is planked wood all over; its colour is in its castles and its sail.
  const wood: ShipPaint = { ...paint, upper: RAMPS.wood[0]!, hull: RAMPS.wood[3]!, wale: RAMPS.wood[7]!, rail: RAMPS.wood[5]!, bulkhead: RAMPS.wood[2]! };
  const hull = drawShipHull(b, rig.spec, wood, { boot: 0.06, wale: [0.27, 0.32], waleOut: 0.03 });
  wale(b, hull, 0.47, 0.52, 0.026, 0.02, 0.96, RAMPS.wood[7]!, 'wale2');

  // The castles, aft and forward.
  const aftW = hull.outer(0.1, 0.95) + 0.06;
  castle(b, hull, 0, 0.23, aftW, 0.3, paint.upper, paint.wale, 'aftcastle');
  castle(b, hull, 0.82, 0.97, hull.outer(0.86, 0.9) + 0.04, 0.24, paint.upper, paint.wale, 'forecastle');
  // A door into the aft castle from the waist.
  b.with({ color: paint.port, ink: 'door' }, () => {
    const z = hull.z(0.21, 0.6) + 0.012;
    b.quad([-0.1, 0.52, z], [0.1, 0.52, z], [0.1, 0.86, z], [-0.1, 0.86, z]);
  });

  // The sternpost rudder and the stem's head.
  b.with({ color: RAMPS.wood[7]!, ink: 'rudder' }, () => {
    const zs = (y: number): number => hull.z(0, y);
    prism(b, [[zs(-0.28) - 0.24, -0.28], [zs(-0.28), -0.28], [zs(1.0), 1.0], [zs(1.0) - 0.06, 1.0], [zs(0.15) - 0.24, 0.15]], () => 0.035);
  });
  b.with({ color: RAMPS.wood[7]!, ink: 'stem' }, () => {
    const zs = (y: number): number => hull.z(1, y);
    prism(b, [[zs(0.0) - 0.05, 0.0], [zs(0.0) + 0.05, 0.0], [zs(1.12) + 0.06, 1.12], [zs(1.12) - 0.03, 1.12]], () => 0.035);
  });

  // The mast and its top, the shrouds and the forestay.
  const m = rig.masts[0]!;
  drawMast(b, m, paint.spar, RAMPS.wood[3]!, 'mast');
  b.with({ color: paint.rope, ink: 'rigging' }, () => {
    shrouds(b, onMast(m, m.top! - 0.05), (dz) => {
      const t = hull.t(m.z + dz - 0.15);
      const y = hull.rail(t);
      return [hull.outer(t, y) + 0.03, y, hull.z(t, y)];
    }, 3, 0.3);
    line(b, onMast(m, m.top! + 0.06), [0, 1.12, hull.z(1, 1.12) + 0.02]);
    line(b, onMast(m, m.head - 0.08), [0, rig.spec.rail(0) + 0.3, hull.z(0.06, 1.2)]);
  });

  // Cargo lashed in the waist: barrels and a crate, and a hatch.
  b.with({ color: RAMPS.wood[7]!, ink: 'hatch' }, () => b.boxAt([0, 0.52, hull.z(0.38, 0.52)], [0.5, 0.06, 0.34], { skip: ['bottom'] }));
  b.with({ color: RAMPS.wood[1]!, ink: 'barrels' }, () => {
    for (const [x, t] of [[0.3, 0.64], [0.12, 0.66], [-0.3, 0.62]] as const) {
      const z = hull.z(t, 0.52);
      b.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1], () => b.lathe([[0.075, 0.52], [0.095, 0.6], [0.095, 0.68], [0.075, 0.76], [0, 0.76]], { segments: 8 }));
    }
  });
  b.with({ color: RAMPS.wood[2]!, ink: 'crate' }, () => b.boxAt([-0.08, 0.52, hull.z(0.7, 0.52) + 0.05], [0.22, 0.2, 0.22], { skip: ['bottom'] }));

  // A lantern over the stern.
  rig.lanterns.forEach(([x, y, z], i) => lantern(b, x, y, z, 0.08, `lantern${i}`));
}

export default definePart({
  actor: 'cog',
  build(item, ctx) {
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const b = ctx.mesh();
    drawCog(b, rigOf('cog', look), shipPaint(look, 'cog'));
    return { mesh: b.build(), animated: true };
  },
});
