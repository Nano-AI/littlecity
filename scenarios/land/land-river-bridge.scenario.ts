// Shaping the land: a river dug across the island from the west sea to the
// generator's own river, bridged; and the generator's river filled in at one
// place to make a causeway. Seed 2 (generator 2) has rivers of its own, so the
// dug channel can be checked side by side with a generated one.
//
//   npm run shots -- land-river-bridge

import { columnIndex } from '@/core/grid';
import { MAT } from '@/core/world';
import { scenario } from '@/scenario';
import { MAT_RIVER } from '@/terrain/terrain2';
import { digToWater, heightOf, lay, quarters, rect, SEED, shape, stack } from './land';

export default scenario({
  name: 'land-river-bridge',
  seed: SEED,
  about: 'A river dug from the sea to the generated river, with a stone bridge; the generated river filled at a causeway.',
  terrain: 'generated',
  terrainGen: 2,
  build(b) {
    digToWater(b, rect(10, 34, 25, 34));
    b.block('arch', 18, 0, 34);
    lay(b, 'path', 18, 30, 18, 33);
    lay(b, 'path', 18, 35, 18, 38);
    stack(b, 'house', 16, 32, 2, 3);
    stack(b, 'house', 20, 36, 1, 5);
    stack(b, 'house', 21, 36, 1, 5);
    // A causeway across the generated river.
    shape(b, rect(26, 21, 29, 21), 1);
    lay(b, 'path', 24, 21, 31, 21);
  },
  cameras: quarters([20, 1, 30], 2.2),
  expect(plan, _dressing, check) {
    const t = plan.terrain;
    for (let x = 11; x <= 25; x++) check.equal(t.height[columnIndex(x, 34)], 0, `dug at x = ${x}`);
    check.equal(t.material[columnIndex(15, 34)], MAT_RIVER, 'the dug channel is river water');
    const banks = [12, 14, 16, 18, 20, 22].filter((x) => t.material[columnIndex(x, 33)] === MAT.grass).length;
    check.ok(banks >= 4, `grass banks inland, got ${banks} of 6`);
    check.kind(18, 0, 34, 'arch');
    check.ok(plan.world.terrainEdits !== undefined, 'the edits are in the world');
    void heightOf;
  },
});
