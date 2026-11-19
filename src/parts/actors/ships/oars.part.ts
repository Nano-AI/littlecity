// A galley's bank of oars along one side (L40), drawn in the ship's frame at
// rest: level, square out from the side, blades a little down. The harbour
// system dips the whole bank about the line of its tholes and sweeps it fore
// and aft (body.ts, oarStroke), so the oars rise and dip together.
//
// One ink group: the looms are thin, and a pen line round each would be ink
// noise; the bank reads as one rhythm of strokes against the water.

import { definePart } from '@/gen/api';
import { stick } from '../boats/hull';
import { shipPaint } from './paint';
import { rigOf } from './rig';

export default definePart({
  actor: 'ship-oars',
  build(item, ctx) {
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const side = (item.params?.side ?? 1) < 0 ? -1 : 1;
    const rig = rigOf('galley', look);
    const o = rig.oars!;
    const paint = shipPaint(look, 'galley');
    const b = ctx.mesh();
    b.setInk('oars');
    const inboard = 0.32;
    const blade = 0.36;
    for (let i = 0; i < o.count; i++) {
      const z = o.z0 + ((o.z1 - o.z0) * i) / Math.max(1, o.count - 1);
      const x = side * o.x;
      // Each oar leans a hair differently: rowers are people.
      const drop = 0.05 + 0.012 * ((i * 7) % 3);
      const out = o.length - inboard;
      b.setColor(paint.spar);
      stick(b, [x - side * inboard, o.y + 0.07, z], [x + side * (out - blade), o.y - drop * ((out - blade) / out), z], 0.026);
      b.setColor(paint.upper);
      stick(b, [x + side * (out - blade), o.y - drop * ((out - blade) / out), z], [x + side * out, o.y - drop, z], 0.075, 0.016);
    }
    return { mesh: b.build(), animated: true };
  },
});
