// A corner turret (U10): a round oriel on the corner of a house at a street
// junction, carried on a stone corbel from the top of the ground storey,
// climbing the upper storeys with a window on each street, and capped by a
// cone that rises above the eave with a gilded ball on its tip.
//
// Frame (the house generator supplies it): origin on the floor of the lowest
// storey it climbs, at the corner where the two wall planes meet, +Z pointing
// diagonally out of the corner, +Y up. `storeys` = how many storeys its body
// climbs; the body stops just under the eave and the cone stands over it.

import { CELL_H } from '@/core/grid';
import { compose, rotationY, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { rampColor, PALETTE } from '@/style/palette';
import { bead, personaOf } from './lib';

export default definePart({
  feature: 'corner-oriel',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    const s = ctx.structure;
    const wall = s && ctx.plan.tags.get(s.id)?.has('white-walls') ? PALETTE.white : rampColor('house', s?.color ?? 5);
    const storeys = Math.max(1, item.params?.storeys ?? 1);
    const r = 0.21, cz = 0.15; // radius; the axis stands this far out from the corner
    const y0 = 0.08, y1 = storeys * CELL_H - 0.06;
    const seg = 12;
    b.at(translation(0, 0, cz), () => {
      // The corbel: a cone of stone narrowing down to the ground storey's wall head.
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'turret-corbel' }, () => {
        b.lathe([[0.03, y0 - 0.3], [r * 0.55, y0 - 0.14], [r + 0.02, y0 - 0.02], [r + 0.02, y0]], { segments: seg, capTop: false });
      });
      // The body, in the house's own wall colour, with a white band at each floor.
      b.with({ color: wall, pattern: PATTERN.plaster, ink: 'turret' }, () => b.lathe([[r, y0], [r, y1]], { segments: seg }));
      b.with({ color: p.trim, pattern: PATTERN.none, ink: 'turret-band' }, () => {
        for (let k = 1; k < storeys; k++) b.lathe([[r + 0.02, k * CELL_H - 0.05], [r + 0.02, k * CELL_H]], { segments: seg, capTop: true });
        b.lathe([[r + 0.03, y1 - 0.045], [r + 0.03, y1]], { segments: seg, capTop: true });
      });
      // A window on each storey, looking down each of the two streets (±45° from the corner) and one out of the corner.
      for (let k = 0; k < storeys; k++) {
        for (const a of [-Math.PI / 4, 0, Math.PI / 4]) {
          if (a === 0 && storeys > 1 && k === 0) continue;
          const base = k * CELL_H + (k === 0 ? y0 : 0) + 0.18;
          b.at(compose(rotationY(a), translation(0, base, r)), () => {
            b.with({ color: p.trim, pattern: PATTERN.none, ink: 'turret-window' }, () => {
              b.box([-0.085, -0.03, -0.02], [0.085, 0.31, 0.012], { skip: ['n', 'bottom'] });
            });
            b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'turret-window' }, () => {
              b.quad([-0.055, 0.01, 0.014], [0.055, 0.01, 0.014], [0.055, 0.27, 0.014], [-0.055, 0.27, 0.014]);
            });
          });
        }
      }
      // The cone, from just under the eave, in the roof's colour, and its gilded ball.
      const lean = (ctx.rand('lean') - 0.5) * 0.03;
      b.with({ color: p.roofColor, pattern: PATTERN.shingles, ink: 'turret-cap' }, () => {
        b.lathe([[r + 0.06, y1], [r + 0.065, y1 + 0.03], [0.02, y1 + 0.58 + lean]], { segments: seg, capBottom: true, smooth: true });
      });
      b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'turret-ball' }, () => {
        b.boxAt([0, y1 + 0.56, 0], [0.018, 0.1, 0.018], { skip: ['bottom'] });
        bead(b, 0, y1 + 0.69, 0, 0.035);
      });
    });
    return { mesh: b.build() };
  },
});
