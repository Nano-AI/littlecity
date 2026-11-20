// Shaping the land: a moat dug round a little castle on a plateau, and a
// house plot levelled on a slope beside it. Seed 2, generator 2.
//
//   npm run shots -- land-moat-castle

import { columnIndex } from '@/core/grid';
import { scenario } from '@/scenario';
import { MAT_POND } from '@/terrain/land';
import { digToWater, heightOf, quarters, rect, SEED, shape, stack } from './land';

const ring = (cx: number, cz: number, r: number): number[] => rect(cx - r, cz - r, cx + r, cz + r).filter((i) => Math.max(Math.abs((i % 48) - cx), Math.abs(Math.floor(i / 48) - cz)) === r);

export default scenario({
  name: 'land-moat-castle',
  seed: SEED,
  about: 'A moat dug round a castle on a plateau (a pond: it is shut in), and a plot levelled on a slope with a house on it.',
  terrain: 'generated',
  terrainGen: 2,
  build(b) {
    digToWater(b, ring(12, 25, 2));
    for (const [x, z] of [[11, 24], [13, 24], [11, 26], [13, 26]] as const) stack(b, 'tower', x, z, 3, 1);
    for (const [x, z] of [[12, 24], [11, 25], [13, 25], [12, 26]] as const) stack(b, 'marble', x, z, 2, 0);
    stack(b, 'house', 12, 25, 3, 2);
    // A plot on the slope to the north: the high columns dug down to the level of its middle.
    const plot = rect(9, 14, 12, 16);
    const to = heightOf(b, 10, 15);
    b.edit({ type: 'land', up: plot.filter((i) => heightOf(b, i % 48, Math.floor(i / 48)) < to), down: plot.filter((i) => heightOf(b, i % 48, Math.floor(i / 48)) > to) }, 'level');
    stack(b, 'house', 10, 15, 1, 4);
    stack(b, 'house', 11, 15, 1, 4);
    void shape;
  },
  cameras: quarters([12, 2, 22], 2.6),
  expect(plan, _dressing, check) {
    const t = plan.terrain;
    for (const i of ring(12, 25, 2)) check.equal(t.height[i], 0, `moat at ${i % 48}, ${Math.floor(i / 48)}`);
    check.equal(t.material[columnIndex(12, 23)], MAT_POND, 'a moat shut in by land is a pond');
    check.kind(11, 2, 24, 'tower');
  },
});
