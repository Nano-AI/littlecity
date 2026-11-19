// R-T05: a tower exactly 3 tall with a garden within 2 cells is a dovecote:
// dove holes with perching ledges on its top storey, a low cone with a little
// lantern. Taller, or with no garden near, it is not.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-T05.dovecote',
  seed: 74,
  about: 'A dovecote by a garden; a 4-storey tower by the same garden and a 3-storey tower far from it stay watchtowers.',
  build(b) {
    b.garden(10, 11, 12, 12).tower(11, 10, { floors: 3, color: 2 });
    b.tower(13, 12, { floors: 4, color: 5 }); // too tall
    b.tower(18, 11, { floors: 3, color: 0 }); // no garden near
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 4.4, target: [14, 2, 11] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 4.4, target: [14, 2, 11] },
  ],
  expect(_plan, _dressing, check) {
    check.role(11, 1, 10, 'dovecote');
    check.hasFeature({ type: 'cap', variant: 'dovecote', at: [11, 3, 10] });
    check.equal(check.features({ type: 'dove-holes', at: [11, 3, 10] }).length, 2, 'dove holes on two sides');
    check.hasSocket({ type: 'perch', at: [11, 3, 10] }, 2);
    check.noFeature({ type: 'window', at: [11, 3, 10] });
    check.role(13, 1, 12, 'watchtower');
    check.role(18, 1, 11, 'watchtower');
  },
});
