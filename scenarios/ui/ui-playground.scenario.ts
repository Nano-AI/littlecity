// The town the interface's browser tests play in (tests/e2e/interface.e2e.test.ts).
// Flat ground, so nothing moves when the terrain generator changes, and a
// few pieces to act on: an Auto block to change, a house to paint, a tree
// that cannot change, stairs to turn, and open grass to build on.
// Everything here is something a player could place under the design's
// rules (pieces on a walkable top), so it stays valid as the rules arrive.
//
// The test file knows these positions; change both together.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'ui-playground',
  seed: 11,
  about: 'Flat ground with one Auto block, a house, a tree, stairs and a marble block: the interface tests play here.',
  build(b) {
    b.block('auto', 20, 1, 22);
    b.block('house', 24, 1, 22, { color: 1 });
    b.block('tree', 27, 1, 22);
    b.block('stairs', 22, 1, 25, { rot: 0 });
    b.block('marble', 30, 1, 22);
  },
  cameras: [{ name: 'play', yaw: 45, pitch: 40, zoom: 3, target: [24, 1, 25] }],
  expect(plan, _dressing, check) {
    check.equal(plan.world.blocks.size, 5, 'blocks placed');
    check.equal(plan.world.blocks.get(key(20, 1, 22))?.kind, 'auto', 'the Auto block is stored as auto');
    check.kind(24, 1, 22, 'house');
  },
});
