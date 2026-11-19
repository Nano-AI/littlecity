// The lighthouse beam (L09): a long shaft of light from the lantern and a
// short one out of its back, as a turning lens throws. PATTERN.beam: drawn
// translucent over the finished page and never inked; `edge` runs 0 at the
// lamp to 1 at the tip, which is how the shader fades it out.
//
// Frame: the 'lantern' socket; the long shaft runs along +Z, dipping a
// little toward the sea. The behaviour turns it about Y.

import { rotationX } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { DUSKY } from '@/style/animation';
import { PALETTE } from '@/style/palette';

/** A shaft along +Z from radius r0 at the lamp to r1 at `length`, a little flattened, fading along its length. */
function shaft(b: MeshBuilder, length: number, r0: number, r1: number, from: number, to: number): void {
  const sides = 10;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, c = ((i + 1) / sides) * Math.PI * 2;
    const ax = Math.cos(a), ay = Math.sin(a) * 0.7, cx = Math.cos(c), cy = Math.sin(c) * 0.7;
    // Counter-clockwise seen from outside.
    b.quad([ax * r0, ay * r0, 0], [cx * r0, cy * r0, 0], [cx * r1, cy * r1, length], [ax * r1, ay * r1, length], { edge: [from, from, to, to] });
  }
}

export default definePart({
  actor: 'lighthouse-beam',
  build(item, ctx) {
    const b = ctx.mesh();
    const reach = item.params?.reach ?? DUSKY.beamReach;
    b.setColor(PALETTE.yellow).setPattern(PATTERN.beam).setInk('beam');
    b.at(rotationX(0.045), () => shaft(b, reach, 0.07, reach * Math.tan(DUSKY.beamWidth), 0, 1));
    b.at([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1], () => shaft(b, reach * 0.3, 0.07, reach * 0.3 * Math.tan(DUSKY.beamWidth), 0.45, 1));
    return { mesh: b.build(), animated: true };
  },
});
