// LOOK FIXTURE. The spike's street lamp, as a prop: it exercises the
// instanced path of the renderer and PATTERN.glow (the lantern is self-lit
// and comes on at dusk).

import { rotationY, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

export default definePart({
  prop: 'lamp',
  build(_item, ctx) {
    const b = ctx.mesh();
    b.setColor(PALETTE.metal).setPattern(PATTERN.metal).setInk('post');
    b.boxAt([0, 0, 0], [0.1, 0.05, 0.1], { skip: ['bottom'] });
    b.lathe([[0.03, 0.05], [0.022, 0.62]], { segments: 8 });
    b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: 'lantern' }, () => b.boxAt([0, 0.62, 0], [0.12, 0.13, 0.12]));
    b.setInk('cap');
    b.at(rotationY(Math.PI / 4), () => b.lathe([[0.11, 0.75], [0, 0.83]], { segments: 4, smooth: false, capBottom: true }));
    return { mesh: b.build(), anchors: { 'lamp-head': translation(0, 0.68, 0) } };
  },
});
