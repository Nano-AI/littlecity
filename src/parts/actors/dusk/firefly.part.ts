// A firefly (L10): a speck of light. PATTERN.beam, so it is drawn as light
// over the finished page and never inked (a pen line round a thing this
// small would leave only a black dot). A bright core inside a soft halo.
// The behaviour hides it by day and blinks it through its param.
// Frame: centred on the origin.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { ball } from '../kit';

export default definePart({
  actor: 'firefly',
  build(_item, ctx) {
    const b = ctx.mesh();
    // Drawn as light in its own colour (the behaviour sets param c): a warm yellow-green heart in a
    // wide soft halo.
    b.setColor('#d8f070').setPattern(PATTERN.beam).setInk('fly');
    b.setEdge(0.35);
    ball(b, 0, 0, 0, 0.16, 0.16, 0.16, 12, 7);
    b.setEdge(0);
    ball(b, 0, 0, 0, 0.045, 0.045, 0.045, 6, 3);
    return { mesh: b.build(), animated: true };
  },
});
