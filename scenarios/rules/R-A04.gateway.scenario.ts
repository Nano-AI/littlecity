// R-A04 and J15: a gateway is a small arch standing over a floor. Its axis
// follows what is around it: across the path that runs through it, between
// the walls or blocks on either side of it, or along x when nothing says
// otherwise.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-A04.gateway',
  seed: 53,
  about: 'Gateways: over a path running north–south, over one running east–west, between two marble blocks, in a wall run; a bare arch.',
  build(b) {
    b.path(10, 8, 10, 14).put('arch', 10, 11); // the path runs along z: the arch spans x
    b.path(13, 11, 19, 11).put('arch', 16, 11); // the path runs along x: the arch spans z
    b.put('marble', 22, 10).put('marble', 22, 12).plaza(21, 11, 23, 11).put('arch', 22, 11); // between blocks along z
    b.put('wall', 26, 11).put('wall', 28, 11).path(27, 9, 27, 13).put('arch', 27, 11); // in a wall run along x
    b.put('arch', 31, 11); // nothing around it: a viaduct of one, spanning x
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 3.4, target: [20, 1.5, 11] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3.4, target: [20, 1.5, 11] },
    { name: 'close', yaw: 20, pitch: 24, zoom: 7, target: [13, 1.5, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 11, 'gateway');
    check.hasTag(10, 1, 11, 'arch:gate');
    check.hasFeature({ type: 'arch-opening', at: [10, 1, 11], dir: 2 }); // passage along z
    check.hasFeature({ type: 'arch-opening', at: [16, 1, 11], dir: 1 }); // passage along x
    check.hasFeature({ type: 'arch-opening', at: [22, 1, 11], dir: 1 }); // spans z between the blocks
    check.role(22, 1, 11, 'gateway');
    check.hasFeature({ type: 'arch-opening', at: [27, 1, 11], dir: 2 }); // spans x between the walls
    check.hasSocket({ type: 'arch-crown', at: [10, 1, 11] });
    check.role(31, 1, 11, 'viaduct');
    check.hasFeature({ type: 'arch-opening', at: [31, 1, 11], dir: 2 });
  },
});
