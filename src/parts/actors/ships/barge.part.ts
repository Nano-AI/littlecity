// The river barge (L41): flat, broad and plain, about three cells long, with
// blunt raked ends like a punt's, a low rail, and its load heaped amidships:
// sacks, hay or barrels (`load`). Its short mast and sail are instances of
// their own (sail.part.ts), so it can lower them to pass under a bridge; the
// bargeman with his pole is a figure the harbour system draws.
//
// Frame: afloat, +Z the bow.

import { definePart } from '@/gen/api';
import type { MeshBuilder } from '@/gen/mesh';
import { rand } from '@/core/rand';
import { PALETTE, RAMPS } from '@/style/palette';
import { ball } from '../kit';
import { drawShipHull } from './hull';
import { lantern } from './kit';
import type { ShipPaint } from './paint';
import { shipPaint } from './paint';
import { rigOf, type ShipRig } from './rig';

/** Heaps the load on the deck between stations 0.25 and 0.65; no higher than about 0.3 above the deck. */
function drawLoad(b: MeshBuilder, rig: ShipRig, load: number, look: number): void {
  const hull = rig.hull;
  const deck = rig.spec.decks[0]!.y;
  const z0 = hull.z(0.24, deck), z1 = hull.z(0.66, deck);
  const r = (k: string, i: number): number => rand(look, 'barge-load', k, i);
  if (load === 1) {
    // Hay: a long rounded rick, with a few loose wisps.
    b.with({ color: RAMPS.wall[0]!, ink: 'hay' }, () => {
      ball(b, 0, deck + 0.04, (z0 + z1) / 2, 0.36, 0.26, (z1 - z0) / 2, 10, 5);
      ball(b, 0.12, deck + 0.18, (z0 + z1) / 2 + 0.12, 0.2, 0.14, 0.3, 7, 4);
    });
    return;
  }
  if (load === 2) {
    b.with({ color: RAMPS.wood[1]!, ink: 'barrels' }, () => {
      let i = 0;
      for (let z = z0 + 0.12; z < z1 - 0.08; z += 0.24) {
        for (const x of [-0.24, 0, 0.24]) {
          const h = 0.24 + r('h', i++) * 0.02;
          b.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, deck, z, 1], () => b.lathe([[0.08, 0], [0.1, h * 0.25], [0.1, h * 0.75], [0.08, h], [0, h]], { segments: 8 }));
        }
      }
    });
    b.with({ color: PALETTE.metal, ink: 'hoops' }, () => {
      for (let z = z0 + 0.12; z < z1 - 0.08; z += 0.24) for (const x of [-0.24, 0, 0.24]) b.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, deck, z, 1], () => b.lathe([[0.097, 0.04], [0.099, 0.06]], { segments: 8 }));
    });
    return;
  }
  // Sacks, in two layers, each a soft lump turned a little its own way.
  b.with({ ink: 'sacks' }, () => {
    let i = 0;
    for (let z = z0 + 0.1; z < z1 - 0.06; z += 0.2) {
      for (const x of [-0.22, 0, 0.22]) {
        b.setColor(r('c', i) < 0.6 ? PALETTE.sand : PALETTE.dirt);
        ball(b, x + (r('x', i) - 0.5) * 0.04, deck + 0.06, z, 0.12, 0.08, 0.1, 7, 4);
        i++;
      }
    }
    for (let z = z0 + 0.2; z < z1 - 0.16; z += 0.2) {
      for (const x of [-0.11, 0.11]) {
        b.setColor(r('c', i) < 0.6 ? PALETTE.sand : PALETTE.dirt);
        ball(b, x, deck + 0.18, z, 0.12, 0.08, 0.1, 7, 4);
        i++;
      }
    }
  });
}

export function drawBarge(b: MeshBuilder, rig: ShipRig, paint: ShipPaint, load: number, look: number): void {
  const wood: ShipPaint = { ...paint, upper: RAMPS.wood[0]!, hull: RAMPS.wood[3]!, wale: paint.upper, rail: RAMPS.wood[5]!, deck: RAMPS.wood[2]! };
  drawShipHull(b, rig.spec, wood, { boot: 0.04, wale: [0.17, 0.22], waleOut: 0.025 });
  drawLoad(b, rig, load, look);
  // A tiller over the stern, and a lantern on a post at the bow.
  b.with({ color: RAMPS.wood[7]!, ink: 'tiller' }, () => {
    const z = rig.hull.z(0, 0.3);
    b.box([-0.02, -0.15, z - 0.2], [0.02, 0.32, z + 0.02]);
    b.box([-0.015, 0.32, z - 0.02], [0.015, 0.35, z + 0.42]);
  });
  rig.lanterns.forEach(([x, y, z], i) => lantern(b, x, y, z, 0.06, `lantern${i}`));
}

export default definePart({
  actor: 'barge',
  build(item, ctx) {
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const b = ctx.mesh();
    drawBarge(b, rigOf('barge', look), shipPaint(look, 'barge'), Math.round(item.params?.load ?? look % 3) % 3, look);
    return { mesh: b.build(), animated: true };
  },
});
