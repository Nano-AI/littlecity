// Dormer (Houses owner; J10). A small gabled window house standing on the
// roof slope: a front in the wall colour with one window, two cheeks, and
// its own little roof running back into the main one.
//
// Frame: origin on the roof surface at the middle of the dormer's front,
// +Y up, +Z looking out (down the slope). Everything runs back along −Z far
// enough to disappear into the roof behind, whatever the pitch.

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE, rampColor } from '@/style/palette';
import { bar, face, personaOf, plate, rectPts } from './lib';

export default definePart({
  feature: 'dormer',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    if (item.variant === 'skylight') {
      // A roof light: a framed pane lying on the slope (the frame's +Y is the slope's normal).
      b.with({ color: p.trim, ink: 'window' }, () => {
        b.box([-0.15, -0.01, -0.19], [0.15, 0.035, 0.19], { skip: ['bottom'] });
        b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => b.quad([-0.11, 0.038, 0.15], [0.11, 0.038, 0.15], [0.11, 0.038, -0.15], [-0.11, 0.038, -0.15]));
        b.quad([-0.011, 0.04, 0.15], [0.011, 0.04, 0.15], [0.011, 0.04, -0.15], [-0.011, 0.04, -0.15]);
      });
      return { mesh: b.build() };
    }
    const s = ctx.structure;
    const wall = s && !ctx.plan.tags.get(s.id)?.has('white-walls') ? rampColor('house', s.color) : PALETTE.white;
    const hw = 0.185, top = 0.26, peak = 0.41, foot = -0.16, back = -0.8, over = 0.04;
    b.with({ color: wall, pattern: PATTERN.plaster, ink: 'dormer' }, () => {
      b.polygon([[-hw, foot, 0], [hw, foot, 0], [hw, top, 0], [0, peak, 0], [-hw, top, 0]]);
      b.quad([hw, foot, 0], [hw, foot, back], [hw, top, back], [hw, top, 0]);
      b.quad([-hw, foot, back], [-hw, foot, 0], [-hw, top, 0], [-hw, top, back]);
    });
    // Its roof: two slopes from a little ridge, overhanging the front and the cheeks.
    const e = hw + over, drop = (over * (peak - top)) / hw;
    const ridge: [Vec3, Vec3] = [[0, peak, over], [0, peak, back]];
    b.with({ color: p.roofColor, pattern: p.cover === 'thatch' ? PATTERN.thatch : PATTERN.shingles, ink: 'dormer-roof' }, () => {
      b.quad([e, top - drop, over], [e, top - drop, back], ridge[1], ridge[0]);
      b.quad([-e, top - drop, back], [-e, top - drop, over], ridge[0], ridge[1]);
    });
    // The little bargeboard: the roof's edge seen from the front.
    b.with({ color: p.trim, ink: 'dormer-roof' }, () => {
      const t = 0.035;
      b.quad([0, peak - t, over], [e, top - drop - t, over], [e, top - drop, over], [0, peak, over]);
      b.quad([-e, top - drop - t, over], [0, peak - t, over], [0, peak, over], [-e, top - drop, over]);
    });
    // One window, the frame and pane in one ink group.
    b.with({ color: p.trim, ink: 'window' }, () => {
      const frame = rectPts(0.25, 0.22, 0.025);
      plate(b, frame, 0, 0.028);
      b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => face(b, rectPts(0.18, 0.155, 0.058), 0.031));
      bar(b, 0, 0.058, 0, 0.213, 0.02, 0.034);
    });
    return { mesh: b.build() };
  },
});
