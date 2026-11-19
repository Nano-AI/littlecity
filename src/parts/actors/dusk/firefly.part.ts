// A firefly (L10): a speck of light. PATTERN.beam, so it is drawn as light
// over the finished page and never inked (a pen line round a thing this
// small would leave only a black dot). A bright core inside a soft halo.
// The behaviour hides it by day and blinks it through its param.
// Frame: centred on the origin.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { ball } from '../kit';

export default definePart({
  actor: 'firefly',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.yellow).setPattern(PATTERN.beam).setInk('fly');
    b.setEdge(0.72);
    ball(b, 0, 0, 0, 0.075, 0.075, 0.075, 8, 4);
    b.setEdge(0);
    ball(b, 0, 0, 0, 0.036, 0.036, 0.036, 6, 3);
    return { mesh: b.build(), animated: true };
  },
});
