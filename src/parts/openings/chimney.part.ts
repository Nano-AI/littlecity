// Chimneys (Houses owner; catalogue J11). A brick stack with a stone cap and
// a pot or two; beside a taller wall a tall flue, which climbs that wall as a
// brick breast (never a free-standing stick); a stove pipe on a stilt house. The house generator stands it astride the ridge with a slight lean
// (a crooked chimney is half a cottage's character).
//
// Frame: origin on the roof surface, +Y up, +X along the ridge. The stack
// runs on down below the origin so it always meets the roof whatever the
// pitch. The 'chimney-top' socket is the centre of the flue opening.

import { translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { personaOf } from './lib';

export default definePart({
  feature: 'chimney',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    const variant = item.variant ?? 'plain';
    const below = 0.32;
    if (variant === 'pipe') {
      const h = item.params?.height ?? 0.36;
      b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'pipe' }, () => {
        b.lathe([[0.034, -below], [0.034, h]], { segments: 8 });
        b.lathe([[0.085, h + 0.02], [0, h + 0.085]], { segments: 8, capBottom: true });
      });
      return { mesh: b.build(), anchors: { 'chimney-top': translation(0, h + 0.09, 0) } };
    }
    const tall = variant === 'tall-flue';
    const against = item.params?.against;
    if (tall && against !== undefined) {
      // A chimney breast: the frame is on the taller wall (+Z into it, +X along it) at the low
      // roof's wall top. Brick, 0.2 wide and 0.1 proud, to `height`, with a cap and one pot.
      const h = item.params?.height ?? 1.05;
      const hw = 0.1, d = 0.1;
      b.with({ color: PALETTE.brick, pattern: PATTERN.brick, ink: 'stack' }, () => b.box([-hw, -0.45, -d], [hw, h, 0], { skip: ['bottom', 'top', 's'] }));
      b.with({ color: p.trim, ink: 'cap' }, () => b.box([-hw - 0.025, h, -d - 0.025], [hw + 0.025, h + 0.045, 0]));
      b.with({ color: PALETTE.redDark, ink: 'pots' }, () =>
        b.at(translation(0, h + 0.045, -d / 2), () => b.lathe([[0.03, 0], [0.026, 0.065]], { segments: 6, capTop: true })));
      return { mesh: b.build(), anchors: { 'chimney-top': translation(0, h + 0.12, -d / 2) } };
    }
    // Free-standing: a tall one is stout, has a shoulder half-way, and never towers.
    const h = tall ? Math.min(0.8, item.params?.height ?? 0.7) : (item.params?.height ?? 0.3 + ctx.rand('h') * 0.08);
    const w = tall ? 0.18 : 0.165;
    b.with({ color: PALETTE.brick, pattern: PATTERN.brick, ink: 'stack' }, () => {
      b.boxAt([0, -below, 0], [w, h + below, w], { skip: ['bottom', 'top'] });
      if (tall) b.boxAt([0, -below, 0], [w + 0.06, h * 0.5 + below, w + 0.06], { skip: ['bottom'] });
    });
    b.with({ color: p.trim, ink: 'cap' }, () => b.boxAt([0, h, 0], [w + 0.055, 0.045, w + 0.055]));
    // Pots: one or two short clay tubes on the cap.
    const pots = tall ? 1 : ctx.rand('pots') < 0.5 ? 1 : 2;
    b.with({ color: PALETTE.redDark, ink: 'pots' }, () => {
      for (let i = 0; i < pots; i++) {
        const x = pots === 1 ? 0 : i === 0 ? -0.042 : 0.042;
        b.at(translation(x, h + 0.045, 0), () => b.lathe([[0.03, 0], [0.026, 0.065]], { segments: 6, capTop: true }));
      }
    });
    return { mesh: b.build(), anchors: { 'chimney-top': translation(0, h + 0.12, 0) } };
  },
});
