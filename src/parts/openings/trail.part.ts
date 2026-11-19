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
    // Each quarter-cell line has a half-width either side and a small sideways drift, all from its
    // world position: a trodden line wanders and is never the same width twice.
    const at = (i: number): { l: number; r: number } => {
      const k = along0 * 4 + i;
      const drift = (rand(seed, 'trail-drift', k, cross) - 0.5) * 0.1;
      return { l: 0.11 + rand(seed, 'trail', k, cross, 0) * 0.07 - drift, r: 0.11 + rand(seed, 'trail', k, cross, 1) * 0.07 + drift };
    };
    const n = 4;
    const y = 0.014;
    b.setColor(PALETTE.dirt).setPattern(PATTERN.dirt).setInk('trail');
    for (let i = 0; i < n; i++) {
      const a = -0.5 + i / n, c = -0.5 + (i + 1) / n;
      const p0 = at(i), p1 = at(i + 1);
      const P = (along: number, across: number): Vec3 => (alongX ? [along, y, across] : [across, y, along]);
      if (alongX) b.quad(P(a, p0.r), P(c, p1.r), P(c, -p1.l), P(a, -p0.l));
      else b.quad(P(a, -p0.l), P(c, -p1.l), P(c, p1.r), P(a, p0.r));
    }
    return { mesh: b.build() };
  },
});
