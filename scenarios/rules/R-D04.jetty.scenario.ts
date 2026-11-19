// R-D04 Jetty: the default dock. A lone block, a two-block stub, a square,
// an L and a platform clear of the land are all jetties: a plain deck on
// stilts with a mooring post or two.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-D04.jetty',
  seed: 104,
  about: 'Jetties: a lone block, a stub, a square, an L and a platform out in the water.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    b.block('dock', 12, 0, 30);
    b.block('dock', 15, 0, 30).block('dock', 15, 0, 31);
    for (let x = 18; x <= 19; x++) for (let z = 30; z <= 31; z++) b.block('dock', x, 0, z);
    for (let z = 30; z <= 32; z++) b.block('dock', 22, 0, z);
    b.block('dock', 23, 0, 32).block('dock', 24, 0, 32);
    for (let x = 27; x <= 29; x++) for (let z = 32; z <= 33; z++) b.block('dock', x, 0, z);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 4, target: [20.5, 1, 31] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 4, target: [20.5, 1, 31] },
    { name: 'west', yaw: 135, pitch: 30, zoom: 4, target: [20.5, 1, 31] },
    { name: 'east', yaw: 315, pitch: 30, zoom: 4, target: [20.5, 1, 31] },
  ],
  expect(plan, _dressing, check) {
    for (const [x, z] of [[12, 30], [15, 31], [19, 31], [23, 32], [28, 33]] as const) check.role(x, 0, z, 'jetty');
    check.equal(check.applied('R-D04.jetty'), 5, 'five jetties');
    check.equal(check.structure(22, 0, 30).cells.length, 5, 'the L is one dock');
    check.sameStructure([22, 0, 30], [24, 0, 32]);
    // Every jetty has somewhere to tie up, and a bollard never comes without its mooring.
    for (const [x, z] of [[12, 30], [15, 31], [19, 31], [23, 32], [28, 33]] as const) check.hasFeature({ type: 'bollard', variant: 'post', on: [x, 0, z] });
    check.equal(check.sockets({ type: 'mooring' }).length, check.features({ type: 'bollard' }).length, 'one mooring per bollard');
    check.noFeature({ type: 'pier-head' });
    check.ok(plan.features.every((f) => f.type !== 'dock-crane'), 'no cranes on jetties');
  },
});
