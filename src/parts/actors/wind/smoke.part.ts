// Chimney smoke (L02). The actor itself is the first puff of the plume; the
// behaviour (src/life/wind/smoke.behaviour.ts) spawns the others as 'puff'
// instances and moves them all. Frame: the 'chimney-top' socket.

import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';

export default definePart({
  actor: 'smoke',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.white).setInk('puff');
    ball(b, 0, 0, 0, 0.4, 0.37, 0.4, 8, 4);
    ball(b, 0.24, 0.1, -0.08, 0.25, 0.23, 0.25, 6, 3);
    ball(b, -0.2, -0.08, 0.1, 0.24, 0.22, 0.24, 6, 3);
    return { mesh: b.build(), animated: true };
  },
});
