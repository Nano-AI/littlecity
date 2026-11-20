// R-H16 (RC-03, FX-12): a house on a river bank is its watermill: a turning
// undershot wheel in a timber frame on the water side, a weir across the
// stream beside it, sacks at the land door. One mill to a reach of river: a
// second house on the same bank 4 cells on is a home. A house on the open
// sea shore is no mill (a small one is a boathouse; a big two-storey one,
// since FX-12, is not even that).

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-H16.watermill',
  seed: 4116,
  about: 'A mill on a two-wide river; a second house on the same bank (a home); a small and a big house on the sea shore.',
  terrain(t) {
    t.flat(1);
    t.water(4, 20, 43, 21); // a river two wide, running east to the sea
    t.water(4, 34, 43, 43); // the sea to the south
  },
  build(b) {
    b.house(14, 18, { w: 2, d: 2, floors: 2, color: 4 });
    b.path(10, 17, 18, 17);
    b.house(19, 18, { w: 2, d: 2, floors: 2, color: 1 });
    // The sea shore: a small boathouse, and a big two-storey house that is too big for one (FX-12).
    b.house(14, 33, { color: 2 });
    b.house(20, 32, { w: 2, d: 2, floors: 2, color: 6 });
  },
  cameras: [
    { name: 'mill', yaw: 20, pitch: 26, zoom: 5.5, target: [15, 1, 19.5] },
    { name: 'mill-side', yaw: 300, pitch: 30, zoom: 5, target: [15, 1, 19.5] },
    { name: 'dusk', yaw: 60, pitch: 28, zoom: 4.5, target: [15, 1, 19.5], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 36, zoom: 2, target: [17, 1, 25] },
  ],
  expect(plan, dressing, check) {
    check.role(14, 1, 18, 'watermill');
    check.hasFeature({ type: 'mill-race', on: [14, 1, 18], dir: 2, rule: 'J30.trade-fronts' });
    check.hasSocket({ type: 'wheel-hub' });
    check.hasActor({ type: 'water-wheel', rule: 'R-H98.structure-props' });
    check.hasProp({ type: 'structure-prop', variant: 'weir' });
    check.ok(plan.roles.get(check.structure(19, 1, 18).id)?.role !== 'watermill', 'one mill to a reach of river');
    check.role(14, 1, 33, 'boathouse');
    check.ok(plan.roles.get(check.structure(20, 1, 32).id)?.role !== 'boathouse', 'a big two-storey house on the shore is no boathouse');
    check.ok(!plan.features.some((f) => f.type === 'window' && f.structure === check.structure(14, 1, 18).id && f.cell === check.features({ type: 'mill-race' })[0]!.cell && f.dir === 2), 'no window behind the wheel');
    void dressing;
  },
});
