// The pool of light the lighthouse beam lays on the sea (L09): a long soft
// oval lying flat, brightest in its middle. PATTERN.beam, so it is drawn
// translucent over the page; the land hides the part of it that would fall
// ashore (it lies at the waterline, under every terrace).
//
// Frame: on the water straight under the lantern; the oval lies out along
// +Z. The behaviour turns it with the beam.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { DUSKY } from '@/style/animation';
import { PALETTE } from '@/style/palette';

export default definePart({
  actor: 'beam-glow',
  build(item, ctx) {
    const b = ctx.mesh();
    const reach = item.params?.reach ?? DUSKY.beamReach;
    b.setColor(PALETTE.yellow).setPattern(PATTERN.beam).setInk('glow');
    // Centred well out along the beam; long along it, a few cells across.
    const cz = reach * 0.58, rz = reach * 0.4, rx = Math.max(0.9, reach * Math.tan(DUSKY.beamWidth) * 1.5);
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, c = ((i + 1) / n) * Math.PI * 2;
      // A fan from the middle (edge 0.35: soft even there) to the rim (edge 1: nothing). Counter-clockwise from above.
      b.tri([0, 0, cz], [Math.sin(a) * rx, 0, cz + Math.cos(a) * rz], [Math.sin(c) * rx, 0, cz + Math.cos(c) * rz], { edge: [0.35, 1, 1] });
    }
    return { mesh: b.build(), animated: true };
  },
});
