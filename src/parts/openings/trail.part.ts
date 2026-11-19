// Trail (Houses owner; J08). One cell of a worn dirt trail from a door
// toward a floor: a strip of bare earth with a wavering edge, lying on the
// grass. The cells of one house's trail share an ink group, so the trail is
// outlined once along its length, not cell by cell.
//
// Frame: the centre of the ground cell's floor, world axes. `dir` is the way
// the trail runs (away from the door).

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { keyX, keyZ } from '@/core/grid';
import { rand } from '@/core/rand';
import { PALETTE } from '@/style/palette';

export default definePart({
  feature: 'trail',
  build(item, ctx) {
    const b = new MeshBuilder({ ink: `trail:${item.structure}` });
    const seed = ctx.structure?.seed ?? ctx.seed;
    const alongX = item.dir === 1 || item.dir === 3;
    // The half-width at each quarter-cell line depends on the WORLD position of that line,
    // so neighbouring trail cells agree exactly where they meet.
    const cell = item.cell ?? 0;
    const along0 = alongX ? keyX(cell) : keyZ(cell), cross = alongX ? keyZ(cell) : keyX(cell);
    const half = (i: number, side: number): number => 0.15 + rand(seed, 'trail', along0 * 4 + i, cross, side) * 0.07;
    const n = 4;
    const y = 0.014;
    b.setColor(PALETTE.dirt).setPattern(PATTERN.dirt).setInk('trail');
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const a = -0.5 + t0, c = -0.5 + t1;
      const l0 = half(i, 0), r0 = half(i, 1), l1 = half(i + 1, 0), r1 = half(i + 1, 1);
      const P = (along: number, across: number): Vec3 => (alongX ? [along, y, across] : [across, y, along]);
      if (alongX) b.quad(P(a, r0), P(c, r1), P(c, -l1), P(a, -l0));
      else b.quad(P(a, -l0), P(c, -l1), P(c, r1), P(a, r0));
    }
    return { mesh: b.build() };
  },
});
