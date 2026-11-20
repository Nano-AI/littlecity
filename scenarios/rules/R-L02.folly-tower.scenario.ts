// R-L02 (RC-21): a Light far inland is a folly tower: plain stone, a
// gallery and an open belvedere, no lantern and no beam, and the house
// against it is nobody's keeper's cottage. A Light by the sea stays a
// lighthouse with its keeper.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-L02.folly-tower',
  seed: 4302,
  about: 'A Light 15 cells inland with a house against it (folly); a Light on the shore with a house against it (lighthouse, keeper).',
  terrain(t) {
    t.flat(1);
    t.water(4, 34, 43, 43);
  },
  build(b) {
    b.stack('lighthouse', 14, 14, { floors: 5 });
    b.house(15, 14, { w: 2, color: 3 });
    b.stack('lighthouse', 26, 32, { floors: 4 });
    b.house(27, 32, { w: 2, color: 1 });
  },
  cameras: [
    { name: 'folly', yaw: 30, pitch: 26, zoom: 4.5, target: [15, 2.5, 14] },
    { name: 'dusk', yaw: 40, pitch: 30, zoom: 2.4, target: [20, 2, 23], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    check.role(14, 1, 14, 'folly-tower');
    check.hasFeature({ type: 'cap', variant: 'belvedere', on: [14, 1, 14] });
    check.noFeature({ type: 'cap', variant: 'lantern-room', on: [14, 1, 14] });
    check.ok(_plan.roles.get(check.structure(15, 1, 14).id)?.role !== 'keepers-cottage', 'nobody keeps a folly');
    check.role(26, 1, 32, 'lighthouse');
    check.role(27, 1, 32, 'keepers-cottage');
    check.equal(dressing.actors.filter((a) => a.type === 'lighthouse-beam').length, 1, 'one beam: the real lighthouse');
  },
});
