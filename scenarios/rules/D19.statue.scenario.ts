// Fixture for D19 (statue). A square with four plinths round it, and two
// marble pieces that are not plinths:
//   four plinths on the square's edge           something on each: a figure, a sundial or an urn
//   a marble block with a pillar on it          nothing: it carries the pillar
//   a lone marble block away from any square    nothing: not a plinth

import { scenario } from '@/scenario';

export default scenario({
  name: 'D19.statue',
  seed: 1919,
  about: 'Every plinth beside a square carries a statue, a sundial or an urn; marble that is not a plinth carries nothing.',
  build(b) {
    b.plaza(10, 10, 16, 15);
    for (const [x, z] of [[11, 10], [15, 10], [11, 15], [15, 15]] as const) b.eraseFloor(x, z).put('marble', x, z);
    b.eraseFloor(13, 15).put('marble', 13, 15).block('pillar', 13, 2, 15);
    b.put('marble', 24, 12);
  },
  cameras: [
    { name: 'square', yaw: 35, pitch: 30, zoom: 4.6, target: [13, 1.3, 12.5] },
    { name: 'close', yaw: 20, pitch: 22, zoom: 10, target: [11, 1.5, 10] },
    { name: 'back', yaw: 215, pitch: 30, zoom: 4.6, target: [13, 1.3, 12.5] },
  ],
  expect(_plan, dressing, check) {
    const statues = dressing.props.filter((p) => p.type === 'statue');
    check.equal(statues.length, 4, 'one on each plinth');
    check.ok(new Set(statues.map((p) => p.variant)).size >= 2, 'not all the same');
    check.noProp({ type: 'statue', at: [24, 1, 12] });
  },
});
