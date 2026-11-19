// J15 with S1: how arches choose their axis and how runs that do not simply
// span are held up. Left to right: an L of spans sharing a corner pier; a
// half arch of two hanging off a marble block; a hanging run of four (half
// arch, then a pier under each cell beyond two); a free run of three on a
// pier at each end; a lone arch in the air on one pier; a 2 × 2 of standing
// arches, which all span x.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J15.arch-direction',
  seed: 54,
  about: 'Arch axes and S1: a corner pier, half arches, hanging runs with piers, free runs on end piers, parallel runs.',
  build(b) {
    // An L three levels up, anchored on two marble towers: an x-arm of 3 and a z-arm of 4 meeting at (13, 3, 10).
    b.stack('marble', 10, 10, { floors: 3 }).stack('marble', 13, 14, { floors: 3 });
    for (let x = 11; x <= 13; x++) b.block('arch', x, 3, 10);
    for (let z = 11; z <= 13; z++) b.block('arch', 13, 3, z);
    // A half arch: two cells hanging off a block.
    b.stack('marble', 17, 10, { floors: 3 }).block('arch', 18, 3, 10).block('arch', 19, 3, 10);
    // A hanging run of four.
    b.stack('marble', 17, 14, { floors: 2 });
    for (let x = 18; x <= 21; x++) b.block('arch', x, 2, 14);
    // A free run of three, and a lone arch.
    for (let x = 24; x <= 26; x++) b.block('arch', x, 2, 10);
    b.block('arch', 29, 2, 10);
    // 2 × 2 on the ground.
    b.put('arch', 25, 14).put('arch', 26, 14).put('arch', 25, 15).put('arch', 26, 15);
  },
  cameras: [
    { name: 'front', yaw: 30, pitch: 26, zoom: 3.1, target: [19.5, 2, 12.5] },
    { name: 'back', yaw: 215, pitch: 32, zoom: 3.1, target: [19.5, 2, 12.5] },
    { name: 'side', yaw: 120, pitch: 30, zoom: 3.1, target: [19.5, 2, 12.5] },
    { name: 'corner', yaw: 60, pitch: 24, zoom: 5.5, target: [12, 2.5, 11.5] },
  ],
  expect(_plan, _dressing, check) {
    // The corner cell belongs to the longer arm (z), and carries the corner pier.
    check.hasFeature({ type: 'arch-opening', at: [13, 3, 10], dir: 1 });
    check.hasFeature({ type: 'arch-opening', at: [11, 3, 10], dir: 2 });
    const corner = check.hasFeature({ type: 'pier', at: [13, 3, 10] })[0]!;
    check.equal((corner.params as { depth: number }).depth, 2, 'the corner pier goes down to the ground');
    // The half arch: no pier, variant half, anchored toward the west.
    check.hasFeature({ type: 'arch-opening', variant: 'half', at: [19, 3, 10] });
    check.equal((check.features({ type: 'arch-opening', at: [18, 3, 10] })[0]!.params as { toward?: number }).toward, 3, 'it hangs from the block on its west');
    check.noFeature({ type: 'pier', on: [18, 3, 10] });
    // Hanging run of four: piers under the third and fourth cells only.
    check.noFeature({ type: 'pier', at: [18, 2, 14] });
    check.noFeature({ type: 'pier', at: [19, 2, 14] });
    check.hasFeature({ type: 'pier', at: [20, 2, 14] });
    check.hasFeature({ type: 'pier', at: [21, 2, 14] });
    // Free run: a pier under each end cell.
    check.hasFeature({ type: 'pier', at: [24, 2, 10] });
    check.noFeature({ type: 'pier', at: [25, 2, 10] });
    check.hasFeature({ type: 'pier', at: [26, 2, 10] });
    check.hasFeature({ type: 'pier', at: [29, 2, 10] });
    // 2 × 2: equal runs both ways resolve to x for all four.
    for (const [x, z] of [[25, 14], [26, 14], [25, 15], [26, 15]] as const) check.hasFeature({ type: 'arch-opening', at: [x, 1, z], dir: 2 });
  },
});
