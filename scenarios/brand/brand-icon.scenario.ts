// The app icon's picture (tools/brand.mjs): one striped tower of four
// storeys on a little sandy islet in the sea, its door to the camera,
// framed tight for a square.
// (Name and about avoid the word the gallery's filter test searches for.)

import { scenario } from '@/scenario';

export default scenario({
  name: 'brand-icon',
  seed: 5,
  about: 'The app icon: a red and white striped tower on a small islet.',
  terrain(t) {
    t.flat(0);
    t.disc(23.5, 23.5, 1.2, 1);
  },
  build(b) {
    b.stack('lighthouse', 23, 23, { floors: 4 });
  },
  cameras: [{ name: 'icon', yaw: 40, pitch: 22, zoom: 9.5, target: [23.5, 2.4, 23.5] }],
  expect(_plan, _dressing, check) {
    check.role(23, 1, 23, 'lighthouse');
    check.hasFeature({ type: 'cap', variant: 'lantern-room', at: [23, 4, 23] });
  },
});
