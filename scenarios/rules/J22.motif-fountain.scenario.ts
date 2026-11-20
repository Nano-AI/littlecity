// FX-08: a square has one centre. On an 11 × 5 square with its fountain
// three cells east of the middle, the rings centre on the fountain; on a
// 7 × 7 square with its fountain by the edge, where no 5 × 5 fits round it,
// there is no motif at all.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'J22.motif-fountain',
  seed: 4022,
  about: 'An 11 × 5 square with the fountain off the middle (motif on the fountain); a 7 × 7 with the fountain at its edge (no motif).',
  build(b) {
    b.plaza(8, 10, 18, 14);
    b.put('fountain', 16, 12);
    b.plaza(24, 9, 30, 15);
    b.put('fountain', 25, 12);
  },
  cameras: [{ name: 'squares', yaw: 30, pitch: 45, zoom: 2.6, target: [19, 1, 12] }],
  expect(_plan, _dressing, check) {
    const motifs = check.features({ type: 'plaza-motif' });
    const east = motifs.find((m) => m.structure === check.floorStructure(8, 1, 10).id);
    check.ok(east !== undefined && east.cell === key(16, 1, 12), 'the long square: rings round the fountain');
    check.equal((east?.params as { size?: number } | undefined)?.size, 5, 'as big as fits round it');
    check.ok(!motifs.some((m) => m.structure === check.floorStructure(24, 1, 9).id), 'the fountain at the edge: no motif');
  },
});
