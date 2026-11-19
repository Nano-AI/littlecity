// L29: a belfry's bell, hanging from its pivot under the beam (the 'bell'
// socket), mouth down. The tower generator draws only the beam while this
// part exists; src/life/mechanisms/bell.behaviour.ts swings it at dusk.

import { definePart } from '@/gen/api';
import { bellShape } from '@/parts/monuments/openings';
import { PALETTE } from '@/style/palette';

export default definePart({
  actor: 'bell',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.yellow).setInk('bell');
    bellShape(b);
    return { mesh: b.build(), animated: true };
  },
});
