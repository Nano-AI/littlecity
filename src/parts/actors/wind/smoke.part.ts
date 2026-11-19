// Chimney smoke (L02). The actor itself is the first puff of the plume; the
// behaviour (src/life/wind/smoke.behaviour.ts) spawns the others as 'puff'
// mist instances and moves them all. Frame: the 'chimney-top' socket.
//
// Smoke is MIST (src/gen/airborne.ts): a translucent wash with no pen line,
// thick in the middle and thinning to nothing at the rim, laid over the page
// by the overlay pass. The behaviour sets its opacity (param a).

import { definePart } from '@/gen/api';
import { mistPuff } from '../kit';

export default definePart({
  actor: 'smoke',
  build(_item, ctx) {
    const b = ctx.mesh();
    mistPuff(b, 0);
    return { mesh: b.build(), animated: true };
  },
});
