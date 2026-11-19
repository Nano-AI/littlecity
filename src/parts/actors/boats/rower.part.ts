// The rower (L20): the rowboat of L17 with someone sitting on the middle
// thwart, facing aft as a rower does, the oars out in the rowlocks with
// their blades just touching the water. The behaviour moves and rocks the
// whole thing; the stroke itself shows as the boat's surge.
//
// Frame: afloat. +Z is the bow, y = 0 the waterline (see hull.ts).

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PERSON } from '@/style/people';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';
import { drawHull, stick, thwart } from './hull';
import { boatPaint } from './paint';
import { rowboatSpec } from './rowboat.part';

export default definePart({
  actor: 'rower',
  build(item, ctx) {
    const b = ctx.mesh();
    const look = item.params?.look ?? 0;
    const paint = boatPaint(look);
    const hull = drawHull(b, rowboatSpec(), paint);
    b.with({ color: paint.seat, ink: 'thwarts' }, () => {
      for (const t of [0.36, 0.62]) thwart(b, hull, t, 0.075, hull.sheer(t) - 0.026);
      thwart(b, hull, 0.085, 0.085, hull.sheer(0.085) - 0.026);
    });
    // The oars: from the hands, over the rowlocks, out and down to the water.
    const seatT = 0.5;
    const ySeat = hull.sheer(seatT) - 0.026;
    const zLock = hull.z(0.56, ySeat);
    b.with({ ink: 'oars' }, () => {
      for (const side of [-1, 1]) {
        const lock: Vec3 = [side * (hull.outer(0.56, hull.sheer(0.56)) - 0.008), hull.sheer(0.56) + 0.008, zLock];
        const hand: Vec3 = [side * 0.035, ySeat + 0.05, zLock - 0.02];
        const loom: Vec3 = [side * 0.25, 0.012, zLock - 0.05];
        const tip: Vec3 = [side * 0.33, -0.004, zLock - 0.07];
        b.setColor(paint.spar);
        stick(b, hand, lock, 0.014);
        stick(b, lock, loom, 0.013);
        b.setColor(PALETTE.white);
        stick(b, loom, tip, 0.036, 0.01);
      }
    });
    // The rower: a sitting figure facing aft (toward −Z), a hat in the sun.
    const pick = (list: readonly string[], what: string): string => list[Math.floor(ctx.rand(what) * list.length) % list.length]!;
    const top = pick(PERSON.tops, 'top');
    const skin = pick(PERSON.skin, 'skin');
    const zBody = hull.z(seatT, ySeat) - 0.012;
    b.with({ color: top, ink: 'rower' }, () => {
      ball(b, 0, ySeat + 0.055, zBody, 0.045, 0.06, 0.04, 8, 5);
      for (const side of [-1, 1]) stick(b, [side * 0.04, ySeat + 0.085, zBody - 0.005], [side * 0.035, ySeat + 0.05, zLock - 0.02], 0.018);
    });
    b.with({ color: skin, ink: 'rower-head' }, () => ball(b, 0, ySeat + 0.14, zBody + 0.004, 0.032, 0.034, 0.032, 8, 5));
    b.with({ color: pick(PERSON.hats, 'hat'), ink: 'rower-hat' }, () => {
      ball(b, 0, ySeat + 0.165, zBody + 0.004, 0.05, 0.008, 0.05, 10, 3);
      ball(b, 0, ySeat + 0.178, zBody + 0.004, 0.028, 0.02, 0.028, 8, 4);
    });
    return { mesh: b.build(), animated: true };
  },
});
