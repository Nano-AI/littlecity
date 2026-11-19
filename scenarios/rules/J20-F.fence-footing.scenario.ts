// Fixture for J20-F (fence footing):
//   fence edge pieces all round the eaves of a cottage's pitched roof   none drawn: nothing to stand on
//   fence edge pieces round a roof terrace (a garden on the roof)       drawn: the terrace is flat
//   fence edge pieces round a plot on the ground                        drawn

import { scenario } from '@/scenario';

export default scenario({
  name: 'J20-F.fence-footing',
  seed: 2026,
  about: 'Fence edge pieces with nothing flat on either side (round a pitched roof) are left out; on a roof terrace and on the ground they stand.',
  build(b) {
    b.house(10, 10, { w: 3, d: 3, color: 4 });
    b.fenceAround(10, 10, 12, 12);
    b.house(18, 10, { w: 2, d: 2, color: 1 });
    b.garden(18, 10, 19, 11);
    b.fenceAround(18, 10, 19, 11);
    b.fenceAround(24, 10, 26, 12);
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 34, zoom: 4.5, target: [18, 1.4, 11] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 4.5, target: [18, 1.4, 11] },
  ],
  expect(plan, _dressing, check) {
    const bare = plan.features.filter((f) => f.type === 'run-bare');
    const at = (x: number): number => bare.filter((f) => (Math.floor(f.edge! / 2) & 63) >= x - 1 && (Math.floor(f.edge! / 2) & 63) <= x + 3).length;
    check.equal(at(10), 12, 'every piece round the pitched roof is bare');
    check.equal(at(18), 0, 'the roof terrace keeps its railing');
    check.equal(at(24), 0, 'the plot on the ground keeps its fence');
  },
});
