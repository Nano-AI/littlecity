// A puff: the one soft round thing that smoke (L02), landing dust (F01) and
// the pop of a removed piece (F04) are all made of. A fat ball with two
// smaller lobes, one ink group, so it is outlined once like a drawn cloud.
//
// Frame: centred on the origin, about 1 across (radius 0.5); whoever spawns
// it scales it. `look` picks one of a few shapes so a plume is not one stamp.

import { definePart } from '@/gen/api';
import { PALETTE } from '@/style/palette';
import { ball } from './kit';

/** Lobe layouts: [x, y, z, radius] beside the main ball of radius 0.4. */
const LOBES: readonly (readonly (readonly [number, number, number, number])[])[] = [
  [[0.26, -0.06, 0.05, 0.27], [-0.22, 0.1, -0.08, 0.24]],
  [[-0.27, -0.08, 0.02, 0.26], [0.2, 0.14, 0.1, 0.22]],
  [[0.05, 0.2, 0.2, 0.25], [-0.1, -0.12, -0.24, 0.26]],
  [[0.24, 0.12, -0.1, 0.24]],
];

export default definePart({
  actor: 'puff',
  build(item, ctx) {
    const b = ctx.mesh();
    const variant = item.variant ?? 'smoke';
    const look = Math.abs(Math.round(item.params?.look ?? 0)) % LOBES.length;
    b.setColor(variant === 'dust' ? PALETTE.path : PALETTE.white).setInk('puff');
    const coarse = variant !== 'smoke';
    ball(b, 0, 0, 0, 0.4, 0.37, 0.4, coarse ? 8 : 10, coarse ? 4 : 6);
    for (const [x, y, z, r] of LOBES[look]!) ball(b, x, y, z, r, r * 0.92, r, coarse ? 6 : 8, 4);
    return { mesh: b.build(), animated: true };
  },
});
