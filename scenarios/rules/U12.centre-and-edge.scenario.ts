// Fixture for U12 (centre and edge). A square with houses round it and a
// street leading away:
//   two- and three-storey houses on the square         a stone ground storey
//   a cottage of one storey on the square               left as it is
//   a two-storey house four steps from the square       stone
//   a two-storey house far down the street              plain: it is not in the centre
//   a town with a plaza too small to be a square        nobody is in the centre

import { scenario } from '@/scenario';

export default scenario({
  name: 'U12.centre-and-edge',
  seed: 1212,
  about: 'Houses of two storeys or more within four steps of a square get a stone ground storey; cottages and houses farther out do not.',
  build(b) {
    b.plaza(14, 14, 16, 16);
    b.path(17, 15, 32, 15);
    b.house(14, 13, { floors: 2, color: 2 });
    b.house(15, 13, { floors: 3, color: 4 });
    b.house(16, 13, { color: 0 });
    b.house(13, 14, { d: 2, floors: 2, color: 6 });
    b.house(20, 14, { floors: 2, color: 1 });
    b.house(29, 14, { floors: 2, color: 3 });
    // A plaza of two cells, with a tall house beside it.
    b.plaza(30, 22, 31, 22);
    b.house(30, 21, { floors: 2, color: 5 });
  },
  cameras: [
    { name: 'centre', yaw: 30, pitch: 28, zoom: 5.5, target: [16, 1.6, 14.5] },
    { name: 'centre-back', yaw: 210, pitch: 30, zoom: 5.5, target: [16, 1.6, 14.5] },
    { name: 'street', yaw: 45, pitch: 32, zoom: 3, target: [22, 1.2, 16] },
  ],
  expect(plan, _dressing, check) {
    const stone = (x: number, z: number): boolean => plan.tags.get(check.structure(x, 1, z).id)?.has('stone-ground') ?? false;
    check.ok(stone(14, 13) && stone(15, 13) && stone(13, 14), 'tall houses on the square stand on stone');
    check.ok(!stone(16, 13), 'a one-storey cottage does not');
    check.ok(stone(20, 14), 'four steps from the square is still the centre');
    check.ok(!stone(29, 14), 'far down the street is not');
    check.ok(!stone(30, 21), 'a plaza of two cells is not a square');
    check.equal(check.applied('U12.centre-and-edge'), 4, 'four houses in the centre');
  },
});
