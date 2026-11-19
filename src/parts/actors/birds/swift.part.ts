// A swift (L13): a small dark cigar with a pale throat and a forked tail.
// It is all silhouette: the sickle wings ('bird-wing/swift') are most of it.
// One ink group.
//
// Frame: facing +Z, its belly at the origin (see kit.ts). A swift never
// stands; its 'sit' drawing is the bird with its wings shut.

import { scaling } from '@/core/mat4';
import { airborne } from '@/gen/airborne';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { ball } from '../kit';
import { birdColors, bodyScale, sheet } from './kit';

export default definePart({
  actor: 'swift',
  build(_item, ctx) {
    const b = ctx.mesh().setPattern(airborne(PATTERN.none)); // in the air: no shade on the ground (src/gen/airborne.ts)
    const c = birdColors();
    b.setInk('body');
    b.at(scaling(bodyScale('swift')), () => {
      b.setColor(c.swift);
      ball(b, 0, 0.026, 0.006, 0.024, 0.022, 0.066, 8, 5);
      b.setColor(c.swiftPale);
      ball(b, 0, 0.018, 0.05, 0.013, 0.011, 0.016, 6, 4); // throat
      // The fork of the tail: two blades splaying back.
      b.setColor(c.swift);
      for (const side of [-1, 1]) {
        sheet(b, [0, 0.028, -0.04], [side * 0.014, 0.028, -0.04], [side * 0.034, 0.03, -0.098], [side * 0.02, 0.03, -0.092]);
      }
    });
    return { mesh: b.build(), animated: true };
  },
});
