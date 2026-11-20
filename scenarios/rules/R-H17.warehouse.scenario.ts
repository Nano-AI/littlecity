// R-H17 (RC-02): the big houses facing a quay across the harbour street are
// warehouses: a column of loading doors up the water side with a hoist beam
// and pulley at the eaves, crates at the door, sockets for the porters. The
// house on the harbour square stays the inn; a small house on the quay and a
// big house on an open coast with no dock are not warehouses.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-H17.warehouse',
  seed: 4117,
  about: 'Two warehouses on a quay street; the harbour square with its inn; a small quay house; a big house on an open coast.',
  terrain(t) {
    t.flat(1);
    t.water(4, 22, 43, 43);
  },
  build(b) {
    b.path(6, 20, 30, 20);
    for (let x = 8; x <= 24; x++) b.block('dock', x, 0, 22);
    b.house(8, 18, { w: 3, d: 2, floors: 3, color: 7 });
    b.house(12, 18, { w: 2, d: 2, floors: 2, color: 2 });
    b.house(15, 19, { color: 4 }); // small
    // The harbour square, and its inn.
    b.plaza(18, 16, 22, 19);
    b.house(19, 14, { w: 3, d: 2, floors: 2, color: 1 });
    // An open coast, no dock: a big house there is no store.
    b.house(36, 19, { w: 2, d: 2, floors: 2, color: 5 });
  },
  cameras: [
    { name: 'quay', yaw: 20, pitch: 28, zoom: 4, target: [12, 1.5, 19.5] },
    { name: 'dusk', yaw: 330, pitch: 30, zoom: 3.6, target: [12, 1.5, 19.5], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 36, zoom: 2, target: [20, 1, 19] },
  ],
  expect(plan, _dressing, check) {
    check.role(8, 1, 18, 'warehouse');
    check.role(12, 1, 18, 'warehouse');
    check.hasFeature({ type: 'loading-doors', on: [8, 1, 18], dir: 2, rule: 'J30.trade-fronts' });
    check.hasSocket({ type: 'loading-door' }, 2);
    check.hasSocket({ type: 'hoist' }, 2);
    check.hasProp({ type: 'structure-prop', variant: 'crates', rule: 'R-H98.structure-props' });
    check.role(19, 1, 14, 'inn');
    const role = (x: number, z: number): string | undefined => plan.roles.get(check.structure(x, 1, z).id)?.role;
    check.ok(role(15, 19) !== 'warehouse', 'a small house on the quay is no warehouse');
    check.ok(role(36, 19) !== 'warehouse', 'a house on an open coast is no warehouse');
    const doors = check.features({ type: 'loading-doors', on: [8, 1, 18] })[0]!;
    check.equal((doors.params as { storeys?: number }).storeys, 3, 'a door on every storey');
  },
});
