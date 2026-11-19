// R-A03: a hanging run (anchored at one end only) with nothing on it,
// anchored on a tower or on marble, is a flying buttress: a slim stone rib
// with a pinnacle over its outer end. Past two cells it comes down on a
// pier. With a block standing on it, it stays a plain half arch.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-A03.flying-buttress',
  seed: 83,
  about: 'Buttresses off a tower (2 cells) and off marble (3 cells, with a pier); a hanging run carrying a marble block (a viaduct).',
  build(b) {
    b.tower(10, 11, { floors: 5, color: 1 }).block('arch', 11, 3, 11).block('arch', 12, 3, 11);
    b.stack('marble', 16, 11, { floors: 4 });
    for (let x = 17; x <= 19; x++) b.block('arch', x, 3, 11);
    b.stack('marble', 23, 11, { floors: 4 }).block('arch', 24, 3, 11).block('marble', 24, 4, 11);
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 3.4, target: [17, 3, 11] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 3.4, target: [17, 3, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(11, 3, 11, 'flying-buttress');
    check.hasTag(11, 3, 11, 'arch:buttress');
    check.hasFeature({ type: 'pinnacle', at: [12, 3, 11] });
    check.noFeature({ type: 'pier', on: [11, 3, 11] });
    check.role(17, 3, 11, 'flying-buttress');
    check.hasFeature({ type: 'pinnacle', at: [19, 3, 11] });
    check.hasFeature({ type: 'pier', at: [19, 3, 11] });
    check.role(24, 3, 11, 'viaduct');
  },
});
