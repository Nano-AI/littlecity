// L29: the hands of a tower clock, at the 'clock-hands' socket (the dial's
// centre, +Z out of the face). The actor is the hour hand pointing at twelve;
// variant 'minute' is the minute hand, spawned by the behaviour
// (src/life/mechanisms/clock.behaviour.ts), which turns both about Z. They
// join the dial's ink group, as the baked hands did: they read by colour.

import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { clockHands } from '@/parts/monuments/openings';
import { PALETTE } from '@/style/palette';

export default definePart({
  actor: 'clock-hands',
  build(item, ctx) {
    const b = ctx.mesh();
    const radius = item.params?.radius ?? 0.25;
    // A hair proud of the baked dial, so the two never fight for the same depth.
    b.setColor(PALETTE.metal).setPattern(PATTERN.none).setInk('hands');
    b.at(translation(0, 0, -0.045), () => clockHands(b, radius, 0, item.variant === 'minute' ? 'minute' : 'hour'));
    return { mesh: b.build(), animated: true };
  },
});
