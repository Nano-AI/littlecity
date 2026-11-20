// R-H20 (RC-05): houses on a bridge whose deck is a street are its shops,
// the Ponte Vecchio: shopfronts on the deck, half-timbered, timber struts
// under the walls that overhang the river. A house on a bridge with no
// street on or to it is not one, nor is one filling the whole deck.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-H20.bridge-shop',
  seed: 4220,
  about: 'A two-wide stone bridge with a street on one lane and shops on the other; a bridge with no street, a house on it (a home).',
  terrain(t) {
    t.flat(1);
    t.water(4, 19, 43, 23); // a river five wide
  },
  build(b) {
    for (let z = 19; z <= 23; z++) b.block('arch', 18, 0, z).block('arch', 19, 0, z);
    b.path(18, 16, 18, 26);
    b.house(19, 20, { d: 2, floors: 2, color: 4 });
    b.house(19, 22, { floors: 2, color: 1 });
    // No street: a bridge to nowhere with a house on it.
    for (let z = 19; z <= 23; z++) b.block('arch', 30, 0, z).block('arch', 31, 0, z);
    b.house(31, 21, { floors: 2, color: 6 });
  },
  cameras: [
    { name: 'bridge', yaw: 50, pitch: 26, zoom: 4.2, target: [19, 1.5, 21] },
    { name: 'river', yaw: 100, pitch: 18, zoom: 4.2, target: [19, 1.2, 21] },
    { name: 'dusk', yaw: 310, pitch: 28, zoom: 4.2, target: [19, 1.5, 21], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 36, zoom: 2.2, target: [24, 1, 21] },
  ],
  expect(plan, _dressing, check) {
    check.role(19, 1, 20, 'bridge-shop');
    check.role(19, 1, 22, 'bridge-shop');
    check.hasFeature({ type: 'door', variant: 'shop', on: [19, 1, 20], dir: 3 });
    check.hasFeature({ type: 'jetty', on: [19, 1, 20] }, 2);
    check.hasFeature({ type: 'bridge-brackets', on: [19, 1, 20] });
    check.ok(plan.roles.get(check.structure(31, 1, 21).id)?.role !== 'bridge-shop', 'no street, no bridge shop');
  },
});
