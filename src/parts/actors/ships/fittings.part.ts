// The big ships' small movable fittings (L38–L41): flags, the gangplank,
// the goods the crew carry ashore, and the call itself (which draws nothing:
// the harbour system draws the ship).

import type { Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { definePart } from '@/gen/api';
import type { ColorInput, MeshBuilder } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import { face, stick } from '../boats/hull';
import { ball } from '../kit';
import { shipPaint } from './paint';

/**
 * A strip of bunting flying along +Z from the hoist: `width(u)` tall at u (0 at the hoist, 1 at the fly),
 * waving a little across. Both faces; `colorOf(i, j)` per panel. Sway grows toward the fly.
 */
function flagCloth(b: MeshBuilder, length: number, nu: number, nv: number, top: (u: number) => number, bottom: (u: number) => number, colorOf: (i: number, j: number) => ColorInput, wave: number): void {
  for (const sheet of [1, -1]) {
    const n: Vec3 = [sheet, 0, 0];
    const p = (i: number, j: number): Vec3 => {
      const u = i / nu, v = j / nv;
      const x = wave * Math.sin(u * Math.PI * 2.2) * u + sheet * 0.003;
      return [x, top(u) + (bottom(u) - top(u)) * v, u * length];
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        b.setColor(colorOf(i, j));
        face(b, [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], [n, n, n, n]);
      }
    }
  }
}

export const flag = definePart({
  actor: 'ship-flag',
  build(item, ctx) {
    const b = ctx.mesh();
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const paint = shipPaint(look);
    const [field, charge] = paint.flag;
    const length = item.params?.length ?? 1;
    b.setSway((_x, _y, z) => Math.min(1, Math.max(0, z / length)) ** 0.8 * 0.9).setInk('flag');
    if (item.variant === 'ensign') {
      const h = length * 0.66;
      // The staff is drawn here: it turns with the flag, about its own axis.
      b.with({ color: RAMPS.wood[1]!, ink: 'staff', sway: 0 }, () => b.lathe([[0.022, -0.72], [0.016, 0.02], [0.03, 0.04], [0, 0.07]], { segments: 6 }));
      const design = rand(look, 'ensign') * 3;
      flagCloth(b, length, 5, 4, () => 0, () => -h, (i, j) => {
        if (design < 1) return j === 1 || j === 2 ? charge : field; // a band across
        if (design < 2) return i === 1 || j === 1 || j === 2 && i === 1 ? charge : field; // a cross near the hoist
        return (i < 2) !== (j < 2) ? charge : field; // quartered
      }, 0.03);
    } else {
      // A long pennant, two colours lengthwise, ending in a swallowtail.
      const w = 0.12;
      flagCloth(b, length, 9, 2, (u) => -0.005 - u * w * 0.3, (u) => -w + u * w * 0.62, (_i, j) => (j === 0 ? field : charge), 0.04);
    }
    return { mesh: b.build(), animated: true };
  },
});

export const gangplank = definePart({
  actor: 'gangplank',
  build(item, ctx) {
    const b = ctx.mesh();
    const len = item.params?.length ?? 1;
    b.with({ color: RAMPS.wood[5]!, ink: 'plank' }, () => b.box([-0.14, -0.035, 0], [0.14, 0, len]));
    // Cleats across it, every so often: one group with the plank's rope rail.
    b.with({ color: RAMPS.wood[3]!, ink: 'cleats' }, () => {
      for (let z = 0.15; z < len - 0.05; z += 0.18) b.box([-0.12, 0, z], [0.12, 0.018, z + 0.03], { skip: ['bottom'] });
    });
    b.with({ color: RAMPS.wood[7]!, ink: 'rope' }, () => {
      for (const x of [-0.13, 0.13]) {
        stick(b, [x, 0, 0.02], [x, 0.26, 0.04], 0.018);
        stick(b, [x, 0.26, 0.04], [x, 0.24, len - 0.02], 0.014);
      }
    });
    return { mesh: b.build(), animated: true };
  },
});

export const goods = definePart({
  actor: 'ship-goods',
  build(item, ctx) {
    const b = ctx.mesh();
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const r = (k: string): number => rand(look, 'ship-goods', k);
    if (item.variant === 'barrel') {
      b.with({ color: RAMPS.wood[r('w') < 0.5 ? 1 : 3]!, ink: 'barrel' }, () => b.lathe([[0.075, 0], [0.095, 0.06], [0.1, 0.13], [0.095, 0.2], [0.075, 0.26], [0, 0.26]], { segments: 9 }));
      b.with({ color: PALETTE.metal, ink: 'hoops' }, () => {
        for (const y of [0.045, 0.215]) b.lathe([[0.092, y], [0.094, y + 0.022]], { segments: 9 });
      });
    } else if (item.variant === 'sack') {
      b.with({ color: r('c') < 0.5 ? PALETTE.dirt : PALETTE.sand, ink: 'sack' }, () => {
        ball(b, 0, 0.08, 0, 0.12, 0.085, 0.09, 8, 5);
        ball(b, 0, 0.17, 0, 0.04, 0.04, 0.035, 5, 3);
      });
    } else {
      const s = 0.2 + r('s') * 0.05;
      b.with({ color: RAMPS.wood[r('w') < 0.5 ? 2 : 5]!, ink: 'crate' }, () => b.boxAt([0, 0, 0], [s, s * 0.85, s], { skip: ['bottom'] }));
      // Battens across two faces: they read by colour, in the crate's own group.
      b.with({ color: RAMPS.wood[7]!, ink: 'crate' }, () => {
        b.box([-s / 2 - 0.008, s * 0.38, -s / 2 - 0.008], [s / 2 + 0.008, s * 0.47, s / 2 + 0.008], { skip: ['bottom', 'top'] });
      });
    }
    return { mesh: b.build(), animated: true };
  },
});

export const call = definePart({
  actor: 'ship-call',
  build(_item, ctx) {
    return { mesh: ctx.mesh().build(), animated: true };
  },
});
