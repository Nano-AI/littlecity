// The playing field, busy: four courts in play along two streets of family
// houses (basketball, tennis, a pitch, a green), for the frame-rate budget.

import { scenario } from '@/scenario';

export default scenario({
  name: 'field-four-courts',
  seed: 4404,
  about: 'Two streets of family houses with a basketball court, a tennis court, a football pitch and a kickabout green.',
  build(b) {
    for (const z of [12, 26]) {
      b.path(6, z, 41, z);
      for (let i = 0; i < 8; i++) b.house(7 + i * 4, z - 3, { w: 2, d: 3, floors: 2, color: (i + z) % 8 });
    }
    b.floor('field', 8, 14, 11, 16); //  basketball
    b.floor('field', 14, 14, 18, 15); // tennis
    b.floor('field', 22, 14, 28, 17); // football
    b.floor('field', 32, 14, 33, 15); // a green
  },
  cameras: [{ name: 'all', yaw: 30, pitch: 40, zoom: 2.6, target: [22, 1, 17] }],
  expect(plan, _dressing, check) {
    check.equal(plan.roles.get(check.floorStructure(8, 1, 14).id)?.role, 'basketball-court', 'basketball');
    check.equal(plan.roles.get(check.floorStructure(14, 1, 14).id)?.role, 'tennis-court', 'tennis');
    check.equal(plan.roles.get(check.floorStructure(22, 1, 14).id)?.role, 'football-pitch', 'football');
    check.equal(plan.roles.get(check.floorStructure(32, 1, 14).id)?.role, 'kickabout-green', 'green');
  },
});
