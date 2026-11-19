// R-A05: a hanging run with nothing on it, anchored on a house, is a
// loggia: an open balcony with a white balustrade in place of the stone
// parapet. Anchored on marble it would be a buttress instead.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-A05.loggia',
  seed: 84,
  about: 'A loggia of two cells off a house, one of one cell, and for comparison a hanging run off marble (a flying buttress).',
  build(b) {
    b.house(10, 11, { floors: 3, color: 6 }).block('arch', 11, 2, 11).block('arch', 12, 2, 11);
    b.house(15, 11, { floors: 3, color: 2 }).block('arch', 15, 2, 12);
    b.stack('marble', 19, 11, { floors: 3 }).block('arch', 20, 2, 11);
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 4.2, target: [15, 2.4, 11.5] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 4.2, target: [15, 2.4, 11.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(11, 2, 11, 'loggia');
    check.hasFeature({ type: 'loggia-rail', on: [11, 2, 11] }, 2);
    check.hasFeature({ type: 'arch-opening', variant: 'half', at: [12, 2, 11] });
    check.role(15, 2, 12, 'loggia');
    check.role(20, 2, 11, 'flying-buttress');
    check.noFeature({ type: 'loggia-rail', on: [20, 2, 11] });
  },
});
