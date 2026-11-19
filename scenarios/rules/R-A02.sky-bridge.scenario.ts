// R-A02: a valid span at level 2 or higher between two houses that both
// rise above it is a sky bridge: a covered timber gallery in the first
// house's colour. Between two roofs, or between marble blocks, it is a plain
// stone span (a viaduct).

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-A02.sky-bridge',
  seed: 82,
  about: 'A sky bridge between two tall houses; a span from roof to roof; a span between marble blocks.',
  build(b) {
    b.house(9, 11, { floors: 4, color: 2 }).house(12, 11, { floors: 4, color: 6 }).block('arch', 10, 3, 11).block('arch', 11, 3, 11);
    b.house(15, 11, { floors: 3, color: 1 }).house(18, 11, { floors: 3, color: 3 }).block('arch', 16, 3, 11).block('arch', 17, 3, 11); // roof to roof
    b.stack('marble', 21, 11, { floors: 4 }).stack('marble', 24, 11, { floors: 4 }).block('arch', 22, 3, 11).block('arch', 23, 3, 11);
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 3.4, target: [16.5, 3, 11] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 3.4, target: [16.5, 3, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 3, 11, 'sky-bridge');
    check.hasTag(10, 3, 11, 'deck:covered');
    const bays = check.hasFeature({ type: 'covered-gallery', on: [10, 3, 11] }, 2);
    check.equal((bays[0]!.params as { color: number }).color, 2, 'the first house\'s colour');
    check.hasFeature({ type: 'arch-opening', at: [10, 3, 11], dir: 2 });
    check.role(16, 3, 11, 'viaduct');
    check.noFeature({ type: 'covered-gallery', on: [16, 3, 11] });
    check.role(22, 3, 11, 'viaduct');
  },
});
