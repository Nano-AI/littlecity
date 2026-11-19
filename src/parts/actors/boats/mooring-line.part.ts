// A length of rope (L17): one unit long along +X from the origin. The
// rowboat's behaviour stretches it from the mooring to the bow (two lengths
// when the line hangs slack). Thin enough that the pen line is the rope.

import { definePart } from '@/gen/api';
import { dockColors } from '@/gen/dock/wood';
import { stick } from './hull';

export default definePart({
  actor: 'mooring-line',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.setColor(dockColors(0).rope).setInk('rope');
    stick(b, [0, 0, 0], [1, 0, 0], 0.02);
    return { mesh: b.build(), animated: true };
  },
});
