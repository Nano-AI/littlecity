// The ring a landing piece knocks out of the ground (F01): a thin flat band
// that the feedback system grows from the piece's foot. It is so thin that
// the pen line round it is what you see: a drawn impact ring. Broken into
// three arcs, like a ring sketched in quick strokes.
//
// Frame: lying on the ground round the origin, radius 1; the system scales it.

import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { flatRing } from './kit';

export default definePart({
  actor: 'dust-ring',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.white).setInk('ring');
    const turn = ctx.rand('turn') * Math.PI * 2;
    const third = (Math.PI * 2) / 3;
    for (let k = 0; k < 3; k++) {
      const gap = 0.16 + ctx.rand('gap', k) * 0.14;
      flatRing(b, 0.014, 0.955, 1, 8, turn + k * third + gap, turn + (k + 1) * third - gap * 0.4);
    }
    return { mesh: b.build(), animated: true };
  },
});
