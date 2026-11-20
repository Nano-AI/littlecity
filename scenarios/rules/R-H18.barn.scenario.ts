// R-H18 (RC-09, FX-06): a long one-storey house off the road beside a field
// is a barn (timber walls, a long gable, big doors, a hayloft, no chimney),
// and with a farmhouse beside it a farmstead (hay and a cart in the yard).
// The same house on the street, the same house near a square, and a big
// one-storey house far from any field are not barns, and none is a manor.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-H18.barn',
  seed: 4118,
  about: 'A barn and its farmhouse by a field; the same barn shape on a street, by a square and far from fields (homes).',
  build(b) {
    // The farmstead: a 4 × 2 barn, its farmhouse, a field.
    b.house(10, 10, { w: 4, d: 2, color: 3 });
    b.house(10, 14, { w: 2, floors: 2, color: 1 });
    b.garden(15, 9, 18, 13);
    b.path(8, 16, 18, 16);
    // The same barn shape fronting a street.
    b.house(22, 10, { w: 4, d: 2, color: 2 });
    b.path(20, 12, 28, 12);
    b.garden(22, 14, 25, 16);
    // By a square.
    b.house(10, 24, { w: 4, d: 2, color: 4 });
    b.garden(15, 23, 17, 25);
    b.plaza(10, 28, 13, 30);
    // Far from any field: a big one-storey house is a home, not a manor (FX-06).
    b.house(30, 24, { w: 4, d: 3, color: 5 });
  },
  cameras: [
    { name: 'farm', yaw: 30, pitch: 30, zoom: 4.6, target: [12.5, 1, 12] },
    { name: 'doors', yaw: 200, pitch: 28, zoom: 5, target: [12, 1, 11] },
    { name: 'dusk', yaw: 120, pitch: 30, zoom: 4.2, target: [12.5, 1, 12], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 38, zoom: 1.9, target: [20, 1, 19] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 1, 10, 'barn');
    check.hasTag(10, 1, 10, 'barn');
    check.hasTag(10, 1, 10, 'farmstead');
    check.noFeature({ type: 'chimney', on: [10, 1, 10] });
    check.noFeature({ type: 'dormer', on: [10, 1, 10] });
    check.hasFeature({ type: 'roof', variant: 'gable', on: [10, 1, 10] });
    check.hasFeature({ type: 'barn-doors', on: [10, 1, 10], rule: 'J30.trade-fronts' });
    check.hasFeature({ type: 'hayloft', on: [10, 1, 10] });
    check.hasProp({ type: 'structure-prop', variant: 'hay', rule: 'R-H98.structure-props' });
    check.hasProp({ type: 'role-prop', variant: 'cart', rule: 'R-H98.structure-props' });
    const role = (x: number, z: number): string | undefined => plan.roles.get(check.structure(x, 1, z).id)?.role;
    check.ok(role(22, 10) !== 'barn', 'a house on a street is no barn');
    check.ok(role(10, 24) !== 'barn', 'a house by a square is no barn');
    check.ok(role(30, 24) !== 'barn' && role(30, 24) !== 'manor', 'a big one-storey house far from fields is a home');
  },
});
