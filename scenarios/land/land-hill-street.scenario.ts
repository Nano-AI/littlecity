// Shaping the land: a hill raised in steps on the east side with a tower on
// its top, and a street of houses sunk into the water (they stand on stilts).
// Seed 2, generator 2.
//
//   npm run shots -- land-hill-street

import { columnIndex, key } from '@/core/grid';
import { MAT } from '@/core/world';
import { scenario } from '@/scenario';
import { quarters, rect, SEED, shape, stack } from './land';

export default scenario({
  name: 'land-hill-street',
  seed: SEED,
  about: 'A stepped hill raised with the brush and a tower on top; a row of houses sunk to the water with their ground.',
  terrain: 'generated',
  terrainGen: 2,
  build(b) {
    shape(b, rect(32, 17, 36, 21), 1, 2);
    shape(b, rect(33, 18, 35, 20), 1, 2);
    shape(b, rect(34, 19, 34, 19), 1, 1);
    stack(b, 'tower', 34, 19, 3, 2);
    b.block('stairs', 33, 3, 21, { rot: 0 });
    // The street: houses on the ground, then the ground under them dug down to the water.
    for (const x of [16, 18, 20, 22]) stack(b, 'house', x, 37, 2, x % 8);
    shape(b, rect(15, 37, 23, 37), -1, 1);
  },
  cameras: [...quarters([34, 3, 19], 3), ...quarters([19, 1, 37], 3).map((c) => ({ ...c, name: `street-${c.name}` }))],
  expect(plan, _dressing, check) {
    const t = plan.terrain;
    check.equal(t.height[columnIndex(34, 19)], 6, 'the top of the hill');
    check.equal(t.height[columnIndex(18, 37)], 0, 'the street is under water');
    check.ok(plan.world.blocks.get(key(18, 0, 37))?.kind === 'house', 'its houses rode down with it');
    check.ok(t.material[columnIndex(34, 19)] !== MAT.sand, 'no sand on a hilltop');
  },
});
