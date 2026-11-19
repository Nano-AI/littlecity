// A sparkle (F03, the Auto morph): a four-pointed star, drawn as two thin
// diamonds crossed at right angles so it shows from every side. Self-lit
// (PATTERN.glow), so it stays bright at dusk. One ink group.
//
// Frame: centred on the origin, 1 tall (the long points run along Y);
// whoever spawns it scales and spins it.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { twoSided } from './kit';

export default definePart({
  actor: 'sparkle',
  build(item, ctx) {
    const b = ctx.mesh();
    const look = Math.abs(Math.round(item.params?.look ?? 0)) % 2;
    b.setColor(look === 0 ? PALETTE.yellow : PALETTE.magic).setPattern(PATTERN.glow).setInk('star');
    const w = 0.13; // half-width of the waist
    const s = 0.34; // reach of the short points
    for (const turn of [0, 1]) {
      b.at(turn === 0 ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1], () => {
        // An eight-cornered star outline in the XY plane: long points up and down, short ones sideways.
        twoSided(b, [[0, -0.5, 0], [w, -w, 0], [s, 0, 0], [w, w, 0], [0, 0.5, 0], [-w, w, 0], [-s, 0, 0], [-w, -w, 0]]);
      });
    }
    return { mesh: b.build(), animated: true };
  },
});
