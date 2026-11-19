// Awning (Houses owner; dressed onto shops by D07). A sloping cloth with a
// scalloped valance, striped in one accent colour and white. Its free edge
// moves with the wind (sway), the edge on the wall does not.
//
// Frame: the 'awning-mount' socket: on the wall above the shopfront, +Z out.

import { definePart } from '@/gen/api';
import { PATTERN } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

const COLORS = [PALETTE.red, PALETTE.glass, PALETTE.leafDark, PALETTE.yellow, PALETTE.pink] as const;

export default definePart({
  prop: 'awning',
  build(item, ctx) {
    const b = ctx.mesh();
    const color = COLORS[(((item.params?.color ?? 0) % COLORS.length) + COLORS.length) % COLORS.length]!;
    const w = 0.74, out = 0.3, fall = 0.13, lip = 0.055;
    const x0 = -w / 2 - 0.04, x1 = w / 2 - 0.04; // a little to the left: the sign hangs at the right corner
    b.setColor(color).setPattern(item.variant === 'plain' ? PATTERN.cloth : PATTERN.stripes).setInk('awning');
    b.setSway((_x, _y, z) => Math.max(0, z / out) * 0.45);
    // The cloth, sagging a little between the wall and the front bar.
    const mid = out * 0.55, sag = 0.012 + ctx.rand('sag') * 0.01;
    b.quad([x0, 0.02, 0], [x0, -fall * 0.5 - sag, mid], [x1, -fall * 0.5 - sag, mid], [x1, 0.02, 0]);
    b.quad([x0, -fall * 0.5 - sag, mid], [x0, -fall, out], [x1, -fall, out], [x1, -fall * 0.5 - sag, mid]);
    // The cheeks, so it has a side from every quarter.
    b.tri([x1, 0.02, 0], [x1, -fall * 0.5 - sag, mid], [x1, -fall, 0]);
    b.tri([x1, -fall * 0.5 - sag, mid], [x1, -fall, out], [x1, -fall, 0]);
    b.tri([x0, 0.02, 0], [x0, -fall, 0], [x0, -fall * 0.5 - sag, mid]);
    b.tri([x0, -fall * 0.5 - sag, mid], [x0, -fall, 0], [x0, -fall, out]);
    // The valance: a row of scallops hanging from the front edge.
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = x0 + (w * i) / n, c = x0 + (w * (i + 1)) / n, m = (a + c) / 2;
      b.quad([a, -fall - lip * 0.6, out], [c, -fall - lip * 0.6, out], [c, -fall, out], [a, -fall, out]);
      b.tri([a, -fall - lip * 0.6, out], [m, -fall - lip, out], [c, -fall - lip * 0.6, out]);
    }
    return { mesh: b.build() };
  },
});
